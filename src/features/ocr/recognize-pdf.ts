import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PdfDocumentAnalysis } from "../../domain/pdfs/document-analysis";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";
import { createOcrPlan } from "../../domain/ocr/planning";
import {
  MAX_OCR_DOCUMENT_TEXT_CHARS,
  type OcrDocumentResult,
  type OcrPageResult,
  type OcrPlan,
  type OcrLanguage,
  type OcrProviderProgress,
} from "../../domain/ocr/types";
import { tesseractOcrProvider } from "./tesseract-provider";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const OCR_RENDER_SCALE = 2;
const MAX_OCR_RENDER_PIXELS = 8_000_000;

export type OcrProgress = { stage: "planning" | "rendering" | "recognizing" | "complete" | "cancelled"; pageNumber?: number; completed: number; total: number; progress: number | null; detail: string };

export class OcrCancelledError extends Error {
  constructor() {
    super("OCR was cancelled. Partial OCR output was discarded and the original document remains unchanged.");
    this.name = "OcrCancelledError";
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OcrCancelledError();
}

function emit(onProgress: ((progress: OcrProgress) => void) | undefined, progress: OcrProgress): void {
  onProgress?.(progress);
}

function findSourceText(analysis: PdfDocumentAnalysis, pageNumber: number): string {
  return analysis.text.textPages.find((page) => page.pageNumber === pageNumber)?.sample ?? "";
}

async function openPdf(data: Uint8Array): Promise<{ pdf: PDFDocumentProxy; task: ReturnType<typeof pdfjsLib.getDocument> }> {
  const task = pdfjsLib.getDocument({ data, useWorkerFetch: true });
  let passwordRequired = false;
  task.onPassword = () => { passwordRequired = true; };
  try {
    return { pdf: await task.promise, task };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (passwordRequired) throw new Error("This PDF is password protected and cannot be OCR-processed here.");
    throw error;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the OCR page image.")), type, quality);
  });
}

async function renderPageForOcr(page: PDFPageProxy, signal?: AbortSignal): Promise<{ image: Blob; width: number; height: number }> {
  throwIfCancelled(signal);
  const initialViewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const initialPixels = initialViewport.width * initialViewport.height;
  const scale = initialPixels > MAX_OCR_RENDER_PIXELS ? Math.sqrt(MAX_OCR_RENDER_PIXELS / initialPixels) * OCR_RENDER_SCALE : OCR_RENDER_SCALE;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  try {
    const context = canvas.getContext("2d", { willReadFrequently: false });
    if (!context) throw new Error("The browser could not create an OCR canvas.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const renderTask = page.render({ canvas, canvasContext: context, viewport });
    await renderTask.promise;
    throwIfCancelled(signal);
    return { image: await canvasBlob(canvas, "image/jpeg", 0.94), width: canvas.width, height: canvas.height };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function toPageResult(pageNumber: number, status: OcrPageResult["status"], language: OcrLanguage, role: OcrPageResult["sourceRole"], text = ""): OcrPageResult {
  return { pageNumber, status, text: text.slice(0, 6_000), characterCount: text.length, blocks: [], lines: [], words: [], boundingBoxes: [], confidence: { value: null, metric: "unavailable", note: "No OCR engine confidence was produced for this page." }, language, processingTimeMs: null, failure: null, sourceRole: role, renderedWidth: null, renderedHeight: null };
}

function handleProviderProgress(progress: OcrProviderProgress, onProgress: ((progress: OcrProgress) => void) | undefined, completed: number, total: number): void {
  const stage = progress.phase === "initializing" || progress.phase === "loading-language" ? "planning" : progress.phase === "complete" ? "complete" : progress.phase === "failed" ? "recognizing" : "recognizing";
  emit(onProgress, { stage, pageNumber: progress.pageNumber, completed, total, progress: progress.progress, detail: progress.message });
}

export async function recognizePdf(file: File, analysis: PdfDocumentAnalysis, language: OcrLanguage = "eng", onProgress?: (progress: OcrProgress) => void, signal?: AbortSignal): Promise<{ plan: OcrPlan; result: OcrDocumentResult }> {
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local OCR limit.");
  const plan = createOcrPlan(analysis, language);
  emit(onProgress, { stage: "planning", completed: 0, total: plan.plannedPages.length, progress: 0, detail: `OCR plan ready: ${plan.plannedPages.length} page${plan.plannedPages.length === 1 ? "" : "s"} selected locally.` });
  if (!plan.supported) throw new Error(plan.warnings[0] ?? "The selected OCR language is not supported locally.");
  if (plan.recommendation === "review-limit") throw new Error(plan.warnings[0] ?? "This document exceeds the bounded OCR page limit; review the plan before recognizing it.");
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfCancelled(signal);
  const { pdf, task } = await openPdf(data);
  const start = performance.now();
  const pageResults: OcrPageResult[] = plan.pages.map((page) => toPageResult(page.pageNumber, page.status, language, page.sourceRole, page.status === "not-needed" ? findSourceText(analysis, page.pageNumber) : ""));
  const processedPages: number[] = [];
  const skippedPages = plan.pages.filter((page) => page.status !== "recommended").map((page) => page.pageNumber);
  const failedPages: number[] = [];
  const abortHandler = () => { void tesseractOcrProvider.cancel(); };
  signal?.addEventListener("abort", abortHandler, { once: true });
  try {
    for (let index = 0; index < plan.plannedPages.length; index += 1) {
      const pageNumber = plan.plannedPages[index];
      throwIfCancelled(signal);
      const pagePlan = plan.pages.find((candidate) => candidate.pageNumber === pageNumber);
      const page = await pdf.getPage(pageNumber);
      const pageStart = performance.now();
      try {
        const pageResultIndex = pageResults.findIndex((candidate) => candidate.pageNumber === pageNumber);
        pageResults[pageResultIndex] = { ...pageResults[pageResultIndex], status: "running" };
        emit(onProgress, { stage: "rendering", pageNumber, completed: index, total: plan.plannedPages.length, progress: index / Math.max(1, plan.plannedPages.length), detail: `Rendering page ${pageNumber} of ${pdf.numPages} for local OCR.` });
        const raster = await renderPageForOcr(page, signal);
        const recognized = await tesseractOcrProvider.recognizePage({ pageNumber, image: raster.image, width: raster.width, height: raster.height, sourceWidthPoints: page.getViewport({ scale: 1 }).width, sourceHeightPoints: page.getViewport({ scale: 1 }).height, role: pagePlan?.sourceRole ?? null }, { language, signal, onProgress: (progress) => handleProviderProgress(progress, onProgress, index, plan.plannedPages.length) });
        throwIfCancelled(signal);
        pageResults[pageResultIndex] = { ...pageResults[pageResultIndex], status: "completed", text: recognized.text, characterCount: recognized.text.length, blocks: recognized.blocks, lines: recognized.lines, words: recognized.words, boundingBoxes: recognized.boundingBoxes, confidence: recognized.confidence, processingTimeMs: Math.round(performance.now() - pageStart), failure: null, renderedWidth: raster.width, renderedHeight: raster.height };
        processedPages.push(pageNumber);
        emit(onProgress, { stage: "recognizing", pageNumber, completed: index + 1, total: plan.plannedPages.length, progress: (index + 1) / Math.max(1, plan.plannedPages.length), detail: `OCR completed for page ${pageNumber} of ${pdf.numPages}.` });
      } catch (error) {
        if (error instanceof OcrCancelledError || signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new OcrCancelledError();
        const pageResultIndex = pageResults.findIndex((candidate) => candidate.pageNumber === pageNumber);
        const message = error instanceof Error ? error.message : "The OCR engine could not recognize this page.";
        pageResults[pageResultIndex] = { ...pageResults[pageResultIndex], status: "failed", processingTimeMs: Math.round(performance.now() - pageStart), failure: { kind: "engine", message } };
        failedPages.push(pageNumber);
        emit(onProgress, { stage: "recognizing", pageNumber, completed: index + 1, total: plan.plannedPages.length, progress: (index + 1) / Math.max(1, plan.plannedPages.length), detail: `OCR failed on page ${pageNumber}; continuing with the remaining pages.` });
      } finally {
        page.cleanup();
      }
    }
    const boundedTextCharacterCount = Math.min(MAX_OCR_DOCUMENT_TEXT_CHARS, pageResults.reduce((sum, page) => sum + Math.min(page.text.length, 6_000), 0));
    const result: OcrDocumentResult = { documentId: analysis.fileName, fileName: file.name, pageCount: pdf.numPages, processedPages, skippedPages, failedPages, language, textPresence: processedPages.length > 0 || pageResults.some((page) => page.status === "not-needed" && page.text.length > 0) ? "detected" : failedPages.length > 0 ? "unknown" : "not-detected", pages: pageResults, boundedTextCharacterCount, processingTimeMs: Math.round(performance.now() - start), cancelled: false, searchablePdfAvailable: false, warnings: [...plan.warnings, ...(failedPages.length > 0 ? [`${failedPages.length} page${failedPages.length === 1 ? "" : "s"} failed OCR and were not used for searchable-PDF authoring.`] : [])], processingBoundary: "browser-local" };
    emit(onProgress, { stage: "complete", completed: plan.plannedPages.length, total: plan.plannedPages.length, progress: 1, detail: `OCR complete: ${processedPages.length} recognized, ${skippedPages.length} skipped, ${failedPages.length} failed.` });
    return { plan, result };
  } catch (error) {
    if (error instanceof OcrCancelledError || signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      emit(onProgress, { stage: "cancelled", completed: 0, total: plan.plannedPages.length, progress: null, detail: "OCR cancelled; partial output discarded." });
      throw new OcrCancelledError();
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    await tesseractOcrProvider.terminate();
    await task.destroy().catch(() => undefined);
  }
}
