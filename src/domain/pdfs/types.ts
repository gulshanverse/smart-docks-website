import type { PdfAsset, PdfClassification, PdfPageDimensions, PdfTextPresence, ProcessingBoundary } from "../files/types";

export type PdfInspectionErrorCode = "invalid-pdf" | "pdf-protected" | "pdf-preview-failure" | "decode-failure";

export interface PdfInspectionResult {
  asset: PdfAsset;
  firstPagePreviewUrl: string | null;
  pageDimensions: PdfPageDimensions | null;
  textPresence: PdfTextPresence;
  textExtractable: boolean;
  classification: PdfClassification;
  processingBoundary: ProcessingBoundary;
}

export interface PdfInspectionValidation {
  valid: boolean;
  type: "pdf";
  pageCount: number;
  previewAvailable: boolean;
  classification: PdfClassification;
  protected: boolean;
  processingBoundary: ProcessingBoundary;
  message: string;
}

export interface PdfInspectionFailure {
  code: PdfInspectionErrorCode;
  title: string;
  message: string;
  recovery: string;
}

export interface PdfInspectionSignals {
  pageCount: number;
  pagesSampled: number;
  pagesWithText: number;
  textItemCount: number;
  boundedCharacterCount: number;
  firstPageHasRasterImage: boolean;
  rasterPages: number;
  protected: boolean;
}

export function classifyPdf(signals: PdfInspectionSignals): PdfClassification {
  if (signals.protected) return "protected";
  if (signals.pageCount <= 0 || signals.pagesSampled <= 0) return "invalid";

  const sampledTextRatio = signals.pagesWithText / signals.pagesSampled;
  const imageRatio = signals.rasterPages / signals.pagesSampled;
  const hasMeaningfulText = signals.textItemCount > 0 && signals.boundedCharacterCount >= 12;

  if (hasMeaningfulText && imageRatio > 0 && sampledTextRatio < 1) return "mixed";
  if (hasMeaningfulText) return "text";
  if (imageRatio > 0 || signals.firstPageHasRasterImage) return "scanned";
  return "unknown";
}
