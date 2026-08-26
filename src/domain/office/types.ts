import type { FileAssetBase, ProcessingBoundary } from "../files/types";

export const OFFICE_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export type OfficeMimeType = (typeof OFFICE_MIME_TYPES)[number];
export type OfficeDocumentType = "word" | "presentation" | "spreadsheet" | "unknown";
export type OfficeFormat = "docx" | "pptx" | "xlsx" | "docm" | "pptm" | "xlsm" | "doc" | "ppt" | "xls" | "unknown";
export type OfficeValidationStatus = "validated" | "rejected" | "warning";
export type OfficeCapabilityState = "available" | "unavailable" | "conditional";

export interface OfficeCapability {
  id: string;
  label: string;
  state: OfficeCapabilityState;
  reason: string;
}

export interface OfficeWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface OfficeMetadata {
  title: string | null;
  subject: string | null;
  creator: string | null;
  lastModifiedBy: string | null;
  created: string | null;
  modified: string | null;
}

export interface OfficeFeatureSignals {
  paragraphCount?: number;
  headingCount?: number;
  tableCount?: number;
  imageCount?: number;
  hyperlinkCount?: number;
  sectionCount?: number;
  slideCount?: number;
  titleSignals?: string[];
  textBoxCount?: number;
  shapeCount?: number;
  chartCount?: number;
  notesPresent?: boolean;
  themePresent?: boolean;
  masterPresent?: boolean;
  sheetCount?: number;
  visibleSheetCount?: number;
  hiddenSheetCount?: number;
  usedRanges?: Record<string, string>;
  formulaCount?: number;
  mergedCellCount?: number;
  workbookHyperlinkCount?: number;
  hiddenRowOrColumnSignals?: number;
}

export interface OfficeTextBlock {
  id: string;
  text: string;
  kind: "paragraph" | "heading" | "slide-title" | "slide-text" | "cell";
  location: string;
}

export interface OfficeSlideSummary {
  slideNumber: number;
  title: string | null;
  text: string;
  shapeCount: number;
  imageCount: number;
  chartCount: number;
}

export interface OfficeSheetPreview {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  range: string | null;
  rows: Array<{ address: string; value: string; formula: string | null }>;
  truncated: boolean;
}

export interface OfficeDocumentAnalysis {
  documentType: OfficeDocumentType;
  format: OfficeFormat;
  version: string | null;
  fileSize: number;
  complexity: "low" | "moderate" | "high" | "unknown";
  metadata: OfficeMetadata;
  features: OfficeFeatureSignals;
  warnings: readonly OfficeWarning[];
  capabilities: readonly OfficeCapability[];
  preservationRisk: "low" | "moderate" | "high" | "unknown";
  processingBoundary: ProcessingBoundary;
  validationStatus: OfficeValidationStatus;
  sampledStructure: readonly OfficeTextBlock[];
  slides: readonly OfficeSlideSummary[];
  sheets: readonly OfficeSheetPreview[];
  extractedText: string;
}

export interface OfficeAsset extends FileAssetBase {
  category: "office";
  mimeType: OfficeMimeType | "application/octet-stream";
  format: OfficeFormat;
  documentType: OfficeDocumentType;
  analysis: OfficeDocumentAnalysis;
  capabilities: readonly OfficeCapability[];
  warnings: readonly OfficeWarning[];
  validationStatus: OfficeValidationStatus;
  previewUrl: null;
}

export interface OfficeInspectionLimits {
  maxInputBytes: number;
  maxEntries: number;
  maxEntryCompressedBytes: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxXmlBytes: number;
  maxTextCharacters: number;
  maxRowsPerSheet: number;
  maxSlides: number;
}

export const DEFAULT_OFFICE_LIMITS: OfficeInspectionLimits = {
  maxInputBytes: 50 * 1024 * 1024,
  maxEntries: 512,
  maxEntryCompressedBytes: 12 * 1024 * 1024,
  maxEntryUncompressedBytes: 32 * 1024 * 1024,
  maxTotalUncompressedBytes: 100 * 1024 * 1024,
  maxXmlBytes: 8 * 1024 * 1024,
  maxTextCharacters: 120_000,
  maxRowsPerSheet: 30,
  maxSlides: 50,
};

export interface OfficeUnsupportedResult {
  state: "unavailable";
  message: string;
  recovery: string;
}
