import type { ProcessingBoundary, SupportedImageMimeType } from "../files/types";

export const PDF_CORE_BOUNDARY: ProcessingBoundary = "browser-local";
export type PdfCoreOperation = "merge" | "split" | "render_images" | "create_pdf" | "detect_blank_pages" | "remove_blank_pages";
export type PdfImageFormat = "jpg" | "png" | "webp";
export type PdfImageResolution = "standard" | "high" | "screen" | "150dpi" | "200dpi" | "300dpi";
export type BlankPageClassification = "likely-blank" | "possibly-blank" | "not-blank" | "unknown";

export interface PdfMetadataSnapshot {
  title: string | null;
  author: string | null;
  subject: string | null;
  creator: string | null;
  producer: string | null;
  creationDate: string | null;
  preservation: "available" | "not-available" | "not-requested";
}

export interface PdfMergePlan {
  operation: "merge";
  inputPageCounts: number[];
  expectedOutputPageCount: number;
  orderedInputNames: string[];
  preserveMetadata: boolean;
  processingBoundary: ProcessingBoundary;
}

export interface PdfRange { start: number; end: number; }
export interface PdfSplitPlan {
  operation: "split";
  ranges: PdfRange[];
  expectedOutputPageCounts: number[];
  processingBoundary: ProcessingBoundary;
}

export interface PdfImageRenderPlan {
  operation: "render_images";
  pageNumbers: number[];
  format: PdfImageFormat;
  resolution: PdfImageResolution;
  processingBoundary: ProcessingBoundary;
}

export interface ImageToPdfPlan {
  operation: "create_pdf";
  inputNames: string[];
  expectedOutputPageCount: number;
  pagePolicy: "fit-centered";
  preserveMetadata: boolean;
  processingBoundary: ProcessingBoundary;
}

export interface PdfBlankDetectionPlan {
  operation: "detect_blank_pages";
  pageNumbers: number[];
  coverage: "complete" | "sampled";
  strategy: "bounded-visual-review";
  processingBoundary: ProcessingBoundary;
}

export interface PdfBlankRemovalPlan {
  operation: "remove_blank_pages";
  confirmedPageNumbers: number[];
  expectedOutputPageCount: number;
  reviewRequired: true;
  processingBoundary: ProcessingBoundary;
}

export interface BlankPageSignals {
  pageNumber: number;
  textCharacterCount: number;
  hasRasterContent: boolean;
  nonBackgroundRatio: number | null;
  classification: BlankPageClassification;
  confidence: "bounded-heuristic";
}

export function parsePageRanges(input: string, pageCount: number): { ranges: PdfRange[] } | { error: string } {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { error: "The PDF has no valid pages." };
  const pieces = input.split(",").map((part) => part.trim()).filter(Boolean);
  if (pieces.length === 0) return { error: "Enter at least one page range, such as 1-3 or 5-7." };
  const ranges: PdfRange[] = [];
  for (const piece of pieces) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(piece);
    if (!match) return { error: `Invalid page range “${piece}”. Use values such as 1-3, 4, or 8-12.` };
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) return { error: `Page range “${piece}” is outside pages 1-${pageCount}.` };
    ranges.push({ start, end });
  }
  return { ranges };
}

export function createSplitPlan(input: string, pageCount: number): { plan: PdfSplitPlan } | { error: string } {
  const parsed = parsePageRanges(input, pageCount);
  if ("error" in parsed) return parsed;
  return { plan: { operation: "split", ranges: parsed.ranges, expectedOutputPageCounts: parsed.ranges.map((range) => range.end - range.start + 1), processingBoundary: PDF_CORE_BOUNDARY } };
}

export function createMergePlan(inputNames: string[], inputPageCounts: number[], preserveMetadata = false): { plan: PdfMergePlan } | { error: string } {
  if (inputNames.length < 2) return { error: "Select at least two valid PDFs to merge." };
  if (inputNames.length !== inputPageCounts.length || inputPageCounts.some((count) => count < 1)) return { error: "Every selected PDF must have a valid page count." };
  return { plan: { operation: "merge", inputPageCounts: [...inputPageCounts], expectedOutputPageCount: inputPageCounts.reduce((sum, count) => sum + count, 0), orderedInputNames: [...inputNames], preserveMetadata, processingBoundary: PDF_CORE_BOUNDARY } };
}

export function createPdfImagePlan(pageNumbers: readonly number[], pageCount: number, format: PdfImageFormat, resolution: PdfImageResolution): { plan: PdfImageRenderPlan } | { error: string } {
  const unique = [...new Set(pageNumbers)].sort((a, b) => a - b);
  if (unique.length === 0) return { error: "Select at least one page to convert." };
  if (unique.some((page) => page < 1 || page > pageCount)) return { error: "One or more selected pages are outside the document." };
  return { plan: { operation: "render_images", pageNumbers: unique, format, resolution, processingBoundary: PDF_CORE_BOUNDARY } };
}

export function createImageToPdfPlan(inputNames: string[], preserveMetadata = false): { plan: ImageToPdfPlan } | { error: string } {
  if (inputNames.length === 0) return { error: "Select at least one supported image." };
  return { plan: { operation: "create_pdf", inputNames: [...inputNames], expectedOutputPageCount: inputNames.length, pagePolicy: "fit-centered", preserveMetadata, processingBoundary: PDF_CORE_BOUNDARY } };
}

export function createBlankDetectionPlan(pageCount: number, pageNumbers?: readonly number[]): { plan: PdfBlankDetectionPlan } | { error: string } {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { error: "The PDF has no valid pages to inspect." };
  const requested = pageNumbers?.length ? [...new Set(pageNumbers)] : null;
  if (requested?.some((page) => !Number.isInteger(page) || page < 1 || page > pageCount)) return { error: "One or more blank-page scan pages are outside the document." };
  if (requested && requested.length > 50) return { error: "Blank-page review is limited to 50 explicitly selected pages at a time." };
  const selected = requested ?? (pageCount <= 50 ? Array.from({ length: pageCount }, (_, index) => index + 1) : [...new Set([1, ...Array.from({ length: 48 }, (_, index) => Math.min(pageCount, 1 + Math.round((index + 1) * (pageCount - 1) / 49))), pageCount])]);
  return { plan: { operation: "detect_blank_pages", pageNumbers: selected.sort((a, b) => a - b), coverage: selected.length === pageCount ? "complete" : "sampled", strategy: "bounded-visual-review", processingBoundary: PDF_CORE_BOUNDARY } };
}

export function createBlankRemovalPlan(pageCount: number, confirmedPageNumbers: readonly number[]): { plan: PdfBlankRemovalPlan } | { error: string } {
  if (!Number.isInteger(pageCount) || pageCount < 2) return { error: "A PDF must retain at least one page after blank-page removal." };
  const selected = [...new Set(confirmedPageNumbers)].sort((a, b) => a - b);
  if (selected.length === 0) return { error: "Review and select at least one page before removing blank pages." };
  if (selected.some((page) => !Number.isInteger(page) || page < 1 || page > pageCount)) return { error: "One or more confirmed blank pages are outside the document." };
  if (selected.length >= pageCount) return { error: "Blank-page removal must retain at least one page." };
  return { plan: { operation: "remove_blank_pages", confirmedPageNumbers: selected, expectedOutputPageCount: pageCount - selected.length, reviewRequired: true, processingBoundary: PDF_CORE_BOUNDARY } };
}

export function classifyBlankPage(signals: Omit<BlankPageSignals, "classification" | "confidence">): BlankPageSignals {
  const { textCharacterCount, hasRasterContent, nonBackgroundRatio } = signals;
  let classification: BlankPageClassification = "unknown";
  if (textCharacterCount > 0 || hasRasterContent) {
    if (nonBackgroundRatio !== null && nonBackgroundRatio < 0.002 && textCharacterCount === 0) classification = "possibly-blank";
    else classification = "not-blank";
  } else if (nonBackgroundRatio !== null && nonBackgroundRatio < 0.001) classification = "likely-blank";
  else if (nonBackgroundRatio !== null) classification = "possibly-blank";
  return { ...signals, classification, confidence: "bounded-heuristic" };
}

export function supportedImageMime(name: string, mimeType: string): SupportedImageMimeType | null {
  const lower = name.toLowerCase();
  if (mimeType === "image/jpeg" || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (mimeType === "image/png" || lower.endsWith(".png")) return "image/png";
  if (mimeType === "image/webp" || lower.endsWith(".webp")) return "image/webp";
  return null;
}

export function safeCoreFilename(name: string, suffix: string, extension: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? name;
  const base = leaf.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
  return `${base}-${suffix}.${extension}`;
}
