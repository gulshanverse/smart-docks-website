import type { PdfPageDimensions } from "../files/types";

export type PdfPageOrientation = "portrait" | "landscape" | "square";
export type PdfPagePaperSizeHint = "A4" | "Letter" | "other";
export type PdfPagePreviewState = "idle" | "loading" | "ready" | "error";
export type PdfPageTypeHint = "text" | "scanned" | "mixed" | "image-heavy" | "unknown";

export interface PdfPageGeometry extends PdfPageDimensions {
  orientation: PdfPageOrientation;
  paperSizeHint: PdfPagePaperSizeHint;
  millimeterLabel: string;
}

export interface PdfPageAsset {
  pageNumber: number;
  widthPoints: number;
  heightPoints: number;
  orientation: PdfPageOrientation;
  paperSizeHint: PdfPagePaperSizeHint;
  hasText: boolean;
  textCharacterCount: number;
  hasRasterContent: boolean;
  typeHint: PdfPageTypeHint;
  previewState: PdfPagePreviewState;
  previewUrl: string | null;
  thumbnailState: PdfPagePreviewState;
  thumbnailUrl: string | null;
  selected: boolean;
  warnings: readonly string[];
}

export interface PdfPageSignals {
  hasText: boolean;
  textCharacterCount: number;
  hasRasterContent: boolean;
}

export const PDF_PAGE_TEXT_LIMIT = 2_000;
export const PDF_PAGE_SAMPLE_LIMIT = 8;

export function normalizePdfPageGeometry(view: readonly number[]): PdfPageGeometry {
  const widthPoints = Math.round(Math.abs((view[2] ?? 0) - (view[0] ?? 0)));
  const heightPoints = Math.round(Math.abs((view[3] ?? 0) - (view[1] ?? 0)));
  const orientation: PdfPageOrientation = widthPoints === heightPoints ? "square" : widthPoints > heightPoints ? "landscape" : "portrait";
  const isA4 = (Math.abs(widthPoints - 595) <= 8 && Math.abs(heightPoints - 842) <= 8) || (Math.abs(widthPoints - 842) <= 8 && Math.abs(heightPoints - 595) <= 8);
  const isLetter = (Math.abs(widthPoints - 612) <= 8 && Math.abs(heightPoints - 792) <= 8) || (Math.abs(widthPoints - 792) <= 8 && Math.abs(heightPoints - 612) <= 8);
  const paperSizeHint: PdfPagePaperSizeHint = isA4 ? "A4" : isLetter ? "Letter" : "other";
  const paperLabel = paperSizeHint === "other" ? `${widthPoints} × ${heightPoints} pt` : paperSizeHint;
  const millimeterLabel = `${Math.round(widthPoints * 25.4 / 72)} × ${Math.round(heightPoints * 25.4 / 72)} mm`;
  return {
    widthPoints,
    heightPoints,
    orientation,
    paperSizeHint,
    millimeterLabel,
    label: `${paperLabel} · ${orientation[0].toUpperCase()}${orientation.slice(1)}`,
  };
}

export function samplePdfPageNumbers(pageCount: number, maxPages = PDF_PAGE_SAMPLE_LIMIT): number[] {
  if (pageCount <= 0 || maxPages <= 0) return [];
  if (pageCount <= maxPages) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const candidates = [1, 2, Math.ceil(pageCount / 2), pageCount - 1, pageCount];
  return [...new Set(candidates.filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount))];
}

export function normalizePdfPageText(values: readonly string[], limit = PDF_PAGE_TEXT_LIMIT): { hasText: boolean; textCharacterCount: number } {
  let textCharacterCount = 0;
  for (const value of values) {
    if (!value.trim()) continue;
    textCharacterCount = Math.min(limit, textCharacterCount + value.trim().length);
    if (textCharacterCount >= limit) break;
  }
  return { hasText: textCharacterCount > 0, textCharacterCount };
}

export function inferPdfPageTypeHint(signals: PdfPageSignals): PdfPageTypeHint {
  if (signals.hasText && signals.hasRasterContent) return "mixed";
  if (signals.hasRasterContent && !signals.hasText) return "scanned";
  if (signals.hasRasterContent) return "image-heavy";
  if (signals.hasText) return "text";
  return "unknown";
}

export function pageHintLabel(page: Pick<PdfPageAsset, "typeHint">): string {
  if (page.typeHint === "scanned") return "Likely scanned page";
  if (page.typeHint === "mixed") return "Likely mixed page";
  if (page.typeHint === "image-heavy") return "Image-heavy page";
  if (page.typeHint === "text") return "Text page";
  return "Unknown page type";
}

export function createPdfPageAsset(pageNumber: number, geometry: PdfPageGeometry | null = null, signals: PdfPageSignals = { hasText: false, textCharacterCount: 0, hasRasterContent: false }): PdfPageAsset {
  const safeGeometry = geometry ?? {
    widthPoints: 0,
    heightPoints: 0,
    orientation: "portrait" as const,
    paperSizeHint: "other" as const,
    millimeterLabel: "Dimensions unavailable",
    label: "Dimensions unavailable",
  };
  return {
    pageNumber,
    widthPoints: safeGeometry.widthPoints,
    heightPoints: safeGeometry.heightPoints,
    orientation: safeGeometry.orientation,
    paperSizeHint: safeGeometry.paperSizeHint,
    hasText: signals.hasText,
    textCharacterCount: signals.textCharacterCount,
    hasRasterContent: signals.hasRasterContent,
    typeHint: inferPdfPageTypeHint(signals),
    previewState: "idle",
    previewUrl: null,
    thumbnailState: "idle",
    thumbnailUrl: null,
    selected: false,
    warnings: [],
  };
}

export function pageGeometryFromAsset(page: PdfPageAsset): PdfPageGeometry {
  const paperLabel = page.paperSizeHint === "other" ? `${page.widthPoints} × ${page.heightPoints} pt` : page.paperSizeHint;
  return {
    widthPoints: page.widthPoints,
    heightPoints: page.heightPoints,
    orientation: page.orientation,
    paperSizeHint: page.paperSizeHint,
    millimeterLabel: page.widthPoints > 0 && page.heightPoints > 0 ? `${Math.round(page.widthPoints * 25.4 / 72)} × ${Math.round(page.heightPoints * 25.4 / 72)} mm` : "Dimensions unavailable",
    label: `${paperLabel} · ${page.orientation[0].toUpperCase()}${page.orientation.slice(1)}`,
  };
}
