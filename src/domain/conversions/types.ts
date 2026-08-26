import type { SupportedImageMimeType } from "../files/types";

export const CONVERSION_CONTRACT_VERSION = "phase8-conversion-v1" as const;
export const CONVERSION_BOUNDARY = "browser-local" as const;
export const MAX_CONVERSION_FILES = 20;
export const MAX_CONVERSION_PAGES = 50;
export const MAX_CONVERSION_INPUT_BYTES = 50 * 1024 * 1024;
export const MAX_CONVERSION_PIXEL_DIMENSION = 3_000;
export const MAX_CONVERSION_TOTAL_PIXELS = 24_000_000;
export const MAX_CONVERSION_MARGIN_POINTS = 144;
export const MAX_CONVERSION_TEXT_LENGTH = 160;

export type ConversionFormat = "jpeg" | "png" | "webp" | "pdf";
export type ConversionInputFormat = "image" | "pdf" | "image-collection";
export type ConversionOperation = "image-to-image" | "image-to-pdf" | "pdf-to-image";
export type ConversionQuality = "maximum" | "high" | "balanced" | "small" | "smallest-practical";
export type ConversionResolution = "screen" | "150dpi" | "200dpi" | "300dpi";
export type ConversionPageSelectionKind = "all" | "current" | "selected" | "range";
export type ConversionPageSize = "A4" | "A5" | "Letter" | "Legal" | "original";
export type ConversionOrientation = "auto" | "portrait" | "landscape";
export type ConversionFitMode = "contain" | "cover" | "fit-width" | "fit-height";
export type ConversionBackground = "white" | "black" | "transparent";
export type ConversionTargetScope = "per-file" | "total";
export type ConversionMetadataPolicy = "preserve-basic" | "discard";

export interface ConversionIntentPageSelection {
  kind: ConversionPageSelectionKind;
  value: string | null;
}

export interface ConversionIntent {
  targetFormat: ConversionFormat | null;
  targetSize: ConversionTargetSize | null;
  pageSelection: ConversionIntentPageSelection;
  quality: ConversionQuality | null;
  resolution: ConversionResolution | null;
  pageSize: ConversionPageSize | null;
  orientation: ConversionOrientation | null;
  fitMode: ConversionFitMode | null;
  marginPoints: number | null;
  background: ConversionBackground | null;
}

export interface ConversionSource {
  id: string;
  name: string;
  inputFormat: "image" | "pdf";
  mimeType: SupportedImageMimeType | "application/pdf";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  order: number;
}

export interface ConversionPageSelection {
  kind: ConversionPageSelectionKind;
  pageNumbers: readonly number[];
  sourcePageCount: number;
}

export interface ConversionTargetSize {
  scope: ConversionTargetScope;
  bytes: number;
  label: string;
}

export interface ConversionValidationPolicy {
  expectedOutputFormat: ConversionFormat;
  expectedOutputCount: number;
  expectedPageCount: number | null;
  requireDecode: boolean;
  requireNonZeroBytes: boolean;
  requireRepresentativePreview: boolean;
  maxPixelDimension: number;
  maxTotalPixels: number;
}

export interface ConversionPlan {
  contractVersion: typeof CONVERSION_CONTRACT_VERSION;
  planId: string;
  operation: ConversionOperation;
  sourceFiles: readonly ConversionSource[];
  inputFormat: ConversionInputFormat;
  outputFormat: ConversionFormat;
  pageSelection: ConversionPageSelection;
  ordering: readonly string[];
  quality: ConversionQuality;
  resolution: ConversionResolution | null;
  pageSize: ConversionPageSize | null;
  orientation: ConversionOrientation | null;
  fitMode: ConversionFitMode | null;
  marginPoints: number | null;
  background: ConversionBackground | null;
  targetSize: ConversionTargetSize | null;
  metadataPolicy: ConversionMetadataPolicy;
  processingBoundary: typeof CONVERSION_BOUNDARY;
  validationPolicy: ConversionValidationPolicy;
  warnings: readonly string[];
  strategy: "direct-canvas" | "pdfjs-render" | "pdf-page-authoring";
}

export interface ConversionOutputValidation {
  valid: boolean;
  signatureValid: boolean;
  decoded: boolean;
  mimeValid: boolean;
  nonZeroBytes: boolean;
  dimensions: { width: number; height: number } | null;
  pageCount: number | null;
  expectedFormat: ConversionFormat;
  message: string;
}

export interface ConversionOutput {
  outputId: string;
  filename: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  pageCount: number | null;
  blob: Blob;
  validation: ConversionOutputValidation;
  warnings: readonly string[];
}

export interface ConversionResultSet {
  contractVersion: typeof CONVERSION_CONTRACT_VERSION;
  sourceFiles: readonly ConversionSource[];
  inputFormat: ConversionInputFormat;
  outputFormat: ConversionFormat;
  inputBytes: number;
  outputBytes: number;
  outputs: readonly ConversionOutput[];
  pageCount: number | null;
  quality: ConversionQuality;
  resolution: ConversionResolution | null;
  targetSize: ConversionTargetSize | null;
  targetAchieved: boolean | null;
  conversionApplied: true;
  compressionApplied: boolean;
  resizeApplied: boolean;
  processingBoundary: typeof CONVERSION_BOUNDARY;
  strategy: ConversionPlan["strategy"];
  warnings: readonly string[];
  message: string;
}

export function mimeForConversionFormat(format: ConversionFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "application/pdf";
}

export function extensionForConversionFormat(format: ConversionFormat): string {
  if (format === "jpeg") return "jpg";
  return format;
}
