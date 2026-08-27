import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { PDFDocument as PdfLibDocument } from "pdf-lib";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PdfAsset } from "../../domain/files/types";
import { classifyPdf, type PdfInspectionSignals } from "../../domain/pdfs/types";
import { hasPdfSignature, readPdfVersion } from "../../domain/pdfs/helpers";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";
import { MAX_OPTIMIZATION_PAGES, MAX_OPTIMIZATION_SAMPLE_PAGES, type PdfOptimizationAnalysis, type PdfOptimizationCandidateSpec, type PdfOptimizationPlan, type PdfOptimizationProgress } from "../../domain/pdfs/optimization";
import { safeCoreFilename } from "../../domain/pdfs/core";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RASTER_OPERATORS = new Set<number>([
  pdfjsLib.OPS.paintImageMaskXObject,
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintInlineImageXObject,
]);
const MAX_RENDER_DIMENSION = 1800;
const BASE_RENDER_SCALE = 2;

export interface PdfOptimizationCandidateOutput {
  candidate: PdfOptimizationCandidateSpec;
  bytes: Uint8Array;
  filename: string;
  inputBytes: number;
  outputBytes: number;
  expectedPageCount: number;
  warnings: string[];
}

export class OptimizationCancelledError extends Error {
  constructor() {
    super("PDF optimization was cancelled. The original PDF remains unchanged.");
    this.name = "OptimizationCancelledError";
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OptimizationCancelledError();
}

function emitProgress(onProgress: ((progress: PdfOptimizationProgress) => void) | undefined, progress: PdfOptimizationProgress): void {
  onProgress?.(progress);
}

function samplePageNumbers(pageCount: number): number[] {
  if (pageCount <= MAX_OPTIMIZATION_SAMPLE_PAGES) return Array.from({ length: pageCount }, (_, index) => index + 1);
  return [...new Set([1, 2, Math.ceil(pageCount / 2), pageCount - 1, pageCount].filter((page) => page >= 1 && page <= pageCount))];
}

function textStats(items: readonly unknown[]): { itemCount: number; characterCount: number } {
  let itemCount = 0;
  let characterCount = 0;
  for (const item of items) {
    const value = typeof item === "object" && item !== null && "str" in item && typeof item.str === "string" ? item.str : "";
    if (!value.trim()) continue;
    itemCount += 1;
    characterCount = Math.min(2_000, characterCount + value.length);
    if (characterCount >= 2_000) break;
  }
  return { itemCount, characterCount };
}

function hasRasterOperator(operatorList: { fnArray: number[] }): boolean {
  return operatorList.fnArray.some((operator) => RASTER_OPERATORS.has(operator));
}

async function openPdf(fileBytes: Uint8Array): Promise<{ pdf: PDFDocumentProxy; task: ReturnType<typeof pdfjsLib.getDocument> }> {
  const task = pdfjsLib.getDocument({ data: fileBytes, useWorkerFetch: true });
  let protectedPdf = false;
  task.onPassword = () => {
    protectedPdf = true;
    void task.destroy();
  };
  try {
    const pdf = await task.promise;
    if (protectedPdf) throw new Error("protected-pdf");
    return { pdf, task };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (protectedPdf) throw new Error("This PDF is password protected and cannot be optimized here.");
    throw error;
  }
}

function assertOptimizationInput(file: File): void {
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local optimization limit.");
}

export async function analyzePdfForOptimization(file: File, asset?: PdfAsset, onProgress?: (progress: PdfOptimizationProgress) => void, signal?: AbortSignal): Promise<PdfOptimizationAnalysis> {
  assertOptimizationInput(file);
  throwIfCancelled(signal);
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!hasPdfSignature(header)) throw new Error("This file is not a valid PDF.");
  const data = new Uint8Array(await file.arrayBuffer());
  const { pdf, task } = await openPdf(data);
  try {
    const pageCount = pdf.numPages;
    if (pageCount < 1) throw new Error("The PDF has no usable pages.");
    const pages = samplePageNumbers(pageCount);
    let textPages = 0;
    let rasterPages = 0;
    let imageHeavyPages = 0;
    const sampledPagePixels: PdfOptimizationAnalysis["sampledPagePixels"] = [];
    for (let index = 0; index < pages.length; index += 1) {
      throwIfCancelled(signal);
      const pageNumber = pages[index];
      emitProgress(onProgress, { stage: "analyzing", completed: index, total: pages.length, detail: `Analyzing page ${pageNumber} of ${pageCount}` });
      const page = await pdf.getPage(pageNumber);
      try {
        const text = textStats((await page.getTextContent({ disableNormalization: false })).items);
        const operators = await page.getOperatorList();
        const raster = hasRasterOperator(operators);
        if (text.itemCount > 0) textPages += 1;
        if (raster) rasterPages += 1;
        if (raster && text.characterCount < 12) imageHeavyPages += 1;
        const viewport = page.getViewport({ scale: 1 });
        sampledPagePixels.push({ pageNumber, width: Math.round(viewport.width), height: Math.round(viewport.height) });
      } finally {
        page.cleanup();
      }
    }
    emitProgress(onProgress, { stage: "analyzing", completed: pages.length, total: pages.length, detail: "PDF analysis complete" });
    const signals: PdfInspectionSignals = {
      pageCount,
      pagesSampled: pages.length,
      pagesWithText: textPages,
      textItemCount: textPages,
      boundedCharacterCount: textPages > 0 ? 12 : 0,
      firstPageHasRasterImage: rasterPages > 0,
      rasterPages,
      protected: false,
    };
    const classification = asset?.classification ?? classifyPdf(signals);
    const textPresent = asset?.textExtractable ?? textPages > 0;
    const rasterPresent = rasterPages > 0 || classification === "scanned" || classification === "mixed";
    const imageHeavy = classification === "scanned" || imageHeavyPages > 0;
    const opportunities: PdfOptimizationAnalysis["optimizationOpportunities"] = imageHeavy
      ? classification === "mixed" ? ["image-quality", "image-resolution", "structural-preservation"] : ["image-quality", "image-resolution"]
      : textPresent ? ["structural-preservation", "metadata-cleanup"] : ["none"];
    const warnings = [...(asset?.warnings ?? [])];
    if (pages.length < pageCount) warnings.push(`Analysis sampled ${pages.length} of ${pageCount} pages; optimization still processes pages sequentially within the browser limit.`);
    if (pageCount > MAX_OPTIMIZATION_PAGES) warnings.push(`Optimization is limited to ${MAX_OPTIMIZATION_PAGES} pages at a time to keep browser memory bounded.`);
    return { inputBytes: file.size, pageCount, pdfVersion: readPdfVersion(header), classification, textPresent, rasterPresent, imageHeavy, sampledPages: pages, pagesAnalyzed: pages.length, textPages, rasterPages, imageHeavyPages, sampledPagePixels, optimizationOpportunities: opportunities, warnings, processingBoundary: "browser-local" };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

function renderScale(candidate: PdfOptimizationCandidateSpec): number {
  return BASE_RENDER_SCALE * (candidate.resolutionScale ?? 1);
}

async function renderPageToJpeg(page: PDFPageProxy, candidate: PdfOptimizationCandidateSpec, signal?: AbortSignal): Promise<Uint8Array> {
  throwIfCancelled(signal);
  const initial = page.getViewport({ scale: renderScale(candidate) });
  const fit = Math.min(1, MAX_RENDER_DIMENSION / Math.max(initial.width, initial.height));
  const viewport = page.getViewport({ scale: renderScale(candidate) * fit });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create a canvas for PDF optimization.");
  try {
    await page.render({ canvas: null, canvasContext: context, viewport }).promise;
    throwIfCancelled(signal);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The browser could not encode an optimized PDF page.")), "image/jpeg", candidate.quality ?? 0.78));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function classifyPage(page: PDFPageProxy): Promise<{ hasText: boolean; hasRaster: boolean; width: number; height: number }> {
  const text = textStats((await page.getTextContent({ disableNormalization: false })).items);
  const operators = await page.getOperatorList();
  const viewport = page.getViewport({ scale: 1 });
  return { hasText: text.itemCount > 0, hasRaster: hasRasterOperator(operators), width: viewport.width, height: viewport.height };
}

async function applyBasicMetadata(output: PdfLibDocument, file: File, plan: PdfOptimizationPlan): Promise<string[]> {
  if (plan.metadataPolicy === "remove-non-essential") {
    output.setTitle("");
    output.setAuthor("");
    output.setSubject("");
    output.setCreator("SmartDocs");
    output.setProducer("SmartDocs browser-local PDF optimization");
    return ["Non-essential basic metadata fields were cleared where supported; this is not universal metadata stripping."];
  }
  const { readPdfMetadata } = await import("./core-operations");
  const metadata = await readPdfMetadata(file);
  if (metadata.preservation !== "available") return ["Basic source metadata was not available to preserve."];
  if (metadata.title) output.setTitle(metadata.title);
  if (metadata.author) output.setAuthor(metadata.author);
  if (metadata.subject) output.setSubject(metadata.subject);
  if (metadata.creator) output.setCreator(metadata.creator);
  if (metadata.producer) output.setProducer(metadata.producer);
  if (metadata.creationDate) output.setCreationDate(new Date(metadata.creationDate));
  return [];
}

async function createRasterizedPdf(sourceBytes: Uint8Array, file: File, plan: PdfOptimizationPlan, candidate: PdfOptimizationCandidateSpec, onProgress?: (progress: PdfOptimizationProgress) => void, signal?: AbortSignal): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create();
  const { pdf, task } = await openPdf(sourceBytes.slice());
  const source = await PDFDocument.load(sourceBytes.slice(), { updateMetadata: false });
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfCancelled(signal);
      emitProgress(onProgress, { stage: "optimizing", completed: pageNumber - 1, total: pdf.numPages, detail: `Optimizing page ${pageNumber} of ${pdf.numPages}` });
      const page = await pdf.getPage(pageNumber);
      try {
        const details = candidate.scope === "raster-only-pages" ? await classifyPage(page) : null;
        if (candidate.scope === "raster-only-pages" && (!details?.hasRaster || details.hasText)) {
          const [copied] = await output.copyPages(source, [pageNumber - 1]);
          output.addPage(copied);
          continue;
        }
        const width = details?.width ?? page.getViewport({ scale: 1 }).width;
        const height = details?.height ?? page.getViewport({ scale: 1 }).height;
        const jpegBytes = await renderPageToJpeg(page, candidate, signal);
        const image = await output.embedJpg(jpegBytes);
        const outputPage = output.addPage([width, height]);
        outputPage.drawImage(image, { x: 0, y: 0, width, height });
      } finally {
        page.cleanup();
      }
    }
    emitProgress(onProgress, { stage: "optimizing", completed: pdf.numPages, total: pdf.numPages, detail: "Writing optimized PDF" });
    const warnings = await applyBasicMetadata(output, file, plan);
    if (warnings.length) void warnings;
    return await output.save({ useObjectStreams: false });
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

export async function optimizePdfCandidates(file: File, plan: PdfOptimizationPlan, onProgress?: (progress: PdfOptimizationProgress) => void, signal?: AbortSignal): Promise<PdfOptimizationCandidateOutput[]> {
  assertOptimizationInput(file);
  if (plan.pageCount > MAX_OPTIMIZATION_PAGES) throw new Error(`Browser-local PDF optimization is limited to ${MAX_OPTIMIZATION_PAGES} pages at a time.`);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfSignature(sourceBytes.slice(0, 8))) throw new Error("This file is not a valid PDF.");
  const outputs: PdfOptimizationCandidateOutput[] = [];
  const candidates = plan.candidates;
  for (let index = 0; index < candidates.length; index += 1) {
    throwIfCancelled(signal);
    const candidate = candidates[index];
    emitProgress(onProgress, { stage: "optimizing", completed: index, total: candidates.length, detail: `Testing optimization candidate ${index + 1} of ${candidates.length}` });
    const bytes = candidate.strategy === "original-preserved" || candidate.strategy === "conservative-preservation" ? sourceBytes.slice() : await createRasterizedPdf(sourceBytes, file, plan, candidate, onProgress, signal);
    throwIfCancelled(signal);
    outputs.push({ candidate, bytes, filename: safeCoreFilename(file.name, candidate.strategy === "original-preserved" || candidate.strategy === "conservative-preservation" ? "optimized" : `optimized-${candidate.mode}`, "pdf"), inputBytes: file.size, outputBytes: bytes.byteLength, expectedPageCount: plan.pageCount, warnings: candidate.scope === "raster-only-pages" ? ["Image-heavy pages were recompressed while text/vector pages were copied without default rasterization."] : candidate.strategy === "original-preserved" || candidate.strategy === "conservative-preservation" ? ["No destructive rasterization was applied; text/vector content remains preserved."] : ["Raster optimization may change visual fidelity; inspect the before/after preview."] });
  }
  emitProgress(onProgress, { stage: "optimizing", completed: candidates.length, total: candidates.length, detail: "Candidate generation complete" });
  return outputs;
}
