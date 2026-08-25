export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export const SUPPORTED_PDF_TYPES = ["application/pdf"] as const;
export type SupportedPdfMimeType = (typeof SUPPORTED_PDF_TYPES)[number];

export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_INPUT_BYTES = 50 * 1024 * 1024;

export type FileCategory = "image" | "pdf";
export type ProcessingBoundary = "browser-local" | "server-assisted";
export type PdfClassification = "text" | "scanned" | "mixed" | "unknown" | "protected" | "invalid";
export type PdfTextPresence = "detected" | "limited" | "not-detected" | "unknown";

export interface FileAssetBase {
  id: string;
  name: string;
  sizeBytes: number;
  extension: string;
  processingBoundary: ProcessingBoundary;
}

export interface ImageAsset extends FileAssetBase {
  category: "image";
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
  previewUrl: string;
  capabilities: {
    compressToTarget: true;
  };
}

export interface PdfPageDimensions {
  widthPoints: number;
  heightPoints: number;
  label: string;
}

export interface PdfAsset extends FileAssetBase {
  category: "pdf";
  mimeType: SupportedPdfMimeType;
  pdfVersion: string | null;
  pageCount: number;
  encrypted: boolean;
  passwordProtected: boolean;
  textPresence: PdfTextPresence;
  textExtractable: boolean;
  classification: PdfClassification;
  pageDimensions: PdfPageDimensions | null;
  previewUrl: string | null;
  capabilities: {
    inspect: true;
    renderPreview: true;
  };
  warnings: readonly string[];
}

export type FileAsset = ImageAsset | PdfAsset;

export type FileIntakeErrorCode =
  | "unsupported-format"
  | "oversized-input"
  | "oversized-pdf"
  | "invalid-image"
  | "invalid-pdf"
  | "decode-failure"
  | "pdf-protected"
  | "pdf-preview-failure";

export interface FileIntakeError {
  code: FileIntakeErrorCode;
  title: string;
  message: string;
  recovery: string;
}
