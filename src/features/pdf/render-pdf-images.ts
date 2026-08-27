import * as pdfjsLib from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PdfImageFormat, PdfImageRenderPlan, BlankPageSignals } from "../../domain/pdfs/core";
import { classifyBlankPage } from "../../domain/pdfs/core";
import { normalizePdfPageText } from "../../domain/pdfs/pages";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
const RASTER_OPERATORS = new Set<number>([pdfjsLib.OPS.paintImageMaskXObject, pdfjsLib.OPS.paintImageXObject, pdfjsLib.OPS.paintInlineImageXObject]);

export interface PdfImageOutput { pageNumber: number; filename: string; blob: Blob; bytes: number; format: PdfImageFormat; width: number; height: number; }

export interface PdfImageRenderOptions { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void; maxDimension?: number; }

function mime(format: PdfImageFormat): string { return format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png"; }
function extension(format: PdfImageFormat): string { return format === "jpg" ? "jpg" : format; }
function scaleFor(plan: PdfImageRenderPlan): number {
  if (plan.resolution === "300dpi") return 4.17;
  if (plan.resolution === "200dpi") return 2.78;
  if (plan.resolution === "150dpi") return 2.08;
  if (plan.resolution === "high") return 1.8;
  return plan.resolution === "screen" ? 1.15 : 1.15;
}
function safeName(name: string, pageNumber: number, format: PdfImageFormat, totalPageCount: number): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
  const width = Math.max(3, String(totalPageCount).length);
  return `${base}-page-${String(pageNumber).padStart(width, "0")}.${extension(format)}`;
}

async function openPdf(file: File) {
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local render limit.");
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data, useWorkerFetch: true });
  let protectedPdf = false;
  task.onPassword = () => { protectedPdf = true; void task.destroy(); };
  try {
    const pdf = await task.promise;
    if (protectedPdf) throw new Error("protected-pdf");
    return { pdf, task };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (protectedPdf) throw new Error("This PDF is password protected and cannot be rendered here.");
    throw error;
  }
}

async function renderCanvas(page: PDFPageProxy, scale: number, maxDimension: number, signal?: AbortSignal): Promise<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }> {
  const initial = page.getViewport({ scale });
  const fit = Math.min(1, maxDimension / Math.max(initial.width, initial.height));
  const viewport = page.getViewport({ scale: scale * fit });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("render-canvas-unavailable");
  if (signal?.aborted) throw new DOMException("The conversion was cancelled.", "AbortError");
  const renderTask = page.render({ canvas: null, canvasContext: context, viewport });
  const cancel = () => renderTask.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await renderTask.promise;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
  return { canvas, context };
}

export async function renderPdfImages(file: File, plan: PdfImageRenderPlan, options: PdfImageRenderOptions = {}): Promise<PdfImageOutput[]> {
  const { pdf, task } = await openPdf(file);
  const outputs: PdfImageOutput[] = [];
  try {
    for (let index = 0; index < plan.pageNumbers.length; index += 1) {
      const pageNumber = plan.pageNumbers[index];
      if (options.signal?.aborted) throw new DOMException("The conversion was cancelled.", "AbortError");
      if (pageNumber < 1 || pageNumber > pdf.numPages) throw new Error(`Page ${pageNumber} is outside this PDF.`);
      const page = await pdf.getPage(pageNumber);
      let canvas: HTMLCanvasElement | null = null;
      try {
        const rendered = await renderCanvas(page, scaleFor(plan), options.maxDimension ?? 1800, options.signal);
        canvas = rendered.canvas;
        const blob = await new Promise<Blob>((resolve, reject) => canvas?.toBlob((value) => value ? resolve(value) : reject(new Error("image-encode-failure")), mime(plan.format), plan.format === "png" ? undefined : 0.9));
        outputs.push({ pageNumber, filename: safeName(file.name, pageNumber, plan.format, pdf.numPages), blob, bytes: blob.size, format: plan.format, width: canvas.width, height: canvas.height });
        options.onProgress?.(index + 1, plan.pageNumbers.length);
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        page.cleanup();
      }
    }
    return outputs;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

export async function detectBlankPages(file: File, pageNumbers?: readonly number[]): Promise<BlankPageSignals[]> {
  const { pdf, task } = await openPdf(file);
  const requested = pageNumbers?.length ? [...new Set(pageNumbers)] : null;
  if (requested && requested.length > 50) {
    await task.destroy().catch(() => undefined);
    throw new Error("Blank-page review is limited to 50 explicitly selected pages at a time.");
  }
  const pagesToCheck = requested ?? (pdf.numPages <= 50 ? Array.from({ length: pdf.numPages }, (_, index) => index + 1) : [...new Set([1, ...Array.from({ length: 48 }, (_, index) => Math.min(pdf.numPages, 1 + Math.round((index + 1) * (pdf.numPages - 1) / 49))), pdf.numPages])]);
  const results: BlankPageSignals[] = [];
  try {
    for (const pageNumber of pagesToCheck) {
      const page = await pdf.getPage(pageNumber);
      let canvas: HTMLCanvasElement | null = null;
      try {
        const text = normalizePdfPageText((await page.getTextContent()).items.map((item: unknown) => typeof item === "object" && item !== null && "str" in item && typeof item.str === "string" ? item.str : ""));
        const operators = await page.getOperatorList();
        const hasRasterContent = operators.fnArray.some((operator: number) => RASTER_OPERATORS.has(operator));
        const rendered = await renderCanvas(page, 0.3, 220);
        canvas = rendered.canvas;
        const pixels = rendered.context.getImageData(0, 0, canvas.width, canvas.height).data;
        let occupied = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3];
          const luminance = (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
          if (alpha > 10 && luminance < 245) occupied += 1;
        }
        const ratio = pixels.length > 0 ? occupied / (pixels.length / 4) : null;
        results.push(classifyBlankPage({ pageNumber, textCharacterCount: text.textCharacterCount, hasRasterContent, nonBackgroundRatio: ratio }));
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        page.cleanup();
      }
    }
    return results;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
