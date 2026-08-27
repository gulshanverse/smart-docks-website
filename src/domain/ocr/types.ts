import type { DocumentIntelligenceSnapshot, PdfDocumentAnalysis, PdfPageRole, PdfStructureSignals } from "../pdfs/document-analysis";
import type { PdfFeatureChange } from "../pdfs/preservation";
import type { } from "../files/types";

export const MAX_OCR_PAGES_PER_RUN = 24;
export const MAX_OCR_PAGE_TEXT_CHARS = 6_000;
export const MAX_OCR_PAGE_BLOCKS = 160;
export const MAX_OCR_PAGE_LINES = 240;
export const MAX_OCR_PAGE_WORDS = 1_200;
export const MAX_OCR_DOCUMENT_TEXT_CHARS = MAX_OCR_PAGES_PER_RUN * MAX_OCR_PAGE_TEXT_CHARS;
export const MAX_DOCUMENT_SEARCH_RESULTS = 80;
export const MAX_SEARCH_QUERY_CHARS = 120;
export const MAX_SENSITIVE_REGIONS = 80;

export type OcrLanguage = "eng" | "hin";
export type SupportedOcrLanguage = "eng";
export type OcrPageStatus = "not-needed" | "recommended" | "running" | "completed" | "failed" | "skipped" | "unknown";
export type OcrConfidenceMetric = "engine-reported" | "not-reported" | "unavailable";
export type OcrTextPresence = "detected" | "limited" | "not-detected" | "unknown";
export type OcrFailureKind = "engine" | "render" | "cancelled" | "unsupported-language" | "resource-limit" | "unknown";

export interface OcrConfidence {
  value: number | null;
  metric: OcrConfidenceMetric;
  note: string;
}

export interface OcrBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrWordResult {
  text: string;
  box: OcrBoundingBox | null;
  confidence: OcrConfidence;
}

export interface OcrLineResult {
  text: string;
  box: OcrBoundingBox | null;
  words: OcrWordResult[];
}

export interface OcrBlockResult {
  text: string;
  box: OcrBoundingBox | null;
  lines: OcrLineResult[];
}

export interface OcrPageResult {
  pageNumber: number;
  status: OcrPageStatus;
  text: string;
  characterCount: number;
  blocks: OcrBlockResult[];
  lines: OcrLineResult[];
  words: OcrWordResult[];
  boundingBoxes: OcrBoundingBox[];
  confidence: OcrConfidence;
  language: OcrLanguage;
  processingTimeMs: number | null;
  failure: { kind: OcrFailureKind; message: string } | null;
  sourceRole: PdfPageRole | null;
  renderedWidth: number | null;
  renderedHeight: number | null;
}

export interface OcrPagePlan {
  pageNumber: number;
  status: Extract<OcrPageStatus, "not-needed" | "recommended" | "skipped" | "unknown">;
  reason: string;
  sourceRole: PdfPageRole | null;
}

export interface OcrPlan {
  documentId: string;
  pageCount: number;
  language: OcrLanguage;
  supported: boolean;
  pages: OcrPagePlan[];
  plannedPages: number[];
  skippedPages: number[];
  blockedPages: number[];
  maxPagesPerRun: number;
  recommendation: "ocr-first" | "ocr-then-optimize" | "not-needed" | "review-limit" | "unsupported";
  warnings: string[];
  processingBoundary: "browser-local";
}

export interface OcrDocumentResult {
  documentId: string;
  fileName: string;
  pageCount: number;
  processedPages: number[];
  skippedPages: number[];
  failedPages: number[];
  language: OcrLanguage;
  textPresence: OcrTextPresence;
  pages: OcrPageResult[];
  boundedTextCharacterCount: number;
  processingTimeMs: number;
  cancelled: boolean;
  searchablePdfAvailable: boolean;
  warnings: string[];
  processingBoundary: "browser-local";
}

export interface OcrPageInput {
  pageNumber: number;
  image: Blob;
  width: number;
  height: number;
  sourceWidthPoints: number;
  sourceHeightPoints: number;
  role: PdfPageRole | null;
}

export interface OcrProviderSupport {
  providerId: string;
  available: boolean;
  supportedLanguages: SupportedOcrLanguage[];
  workerSupported: boolean;
  wasmSupported: boolean;
  offlineReady: boolean;
  message: string;
}

export interface OcrProviderProgress {
  pageNumber?: number;
  pageIndex?: number;
  pageTotal?: number;
  phase: "initializing" | "loading-language" | "recognizing" | "complete" | "failed";
  progress: number | null;
  message: string;
}

export interface OcrProviderPageOutput {
  text: string;
  blocks: OcrBlockResult[];
  lines: OcrLineResult[];
  words: OcrWordResult[];
  boundingBoxes: OcrBoundingBox[];
  confidence: OcrConfidence;
  language: OcrLanguage;
}

export interface OcrProvider {
  readonly id: string;
  detectSupport(): Promise<OcrProviderSupport>;
  recognizePage(input: OcrPageInput, options: { language: OcrLanguage; onProgress?: (progress: OcrProviderProgress) => void; signal?: AbortSignal }): Promise<OcrProviderPageOutput>;
  recognizeDocument(inputs: AsyncIterable<OcrPageInput>, options: { language: OcrLanguage; onProgress?: (progress: OcrProviderProgress) => void; signal?: AbortSignal }): Promise<OcrProviderPageOutput[]>;
  cancel(): Promise<void>;
  terminate(): Promise<void>;
}

export interface SearchMatch {
  pageNumber: number;
  start: number;
  end: number;
  excerpt: string;
  box: OcrBoundingBox | null;
}

export interface DocumentSearchResult {
  query: string;
  matches: SearchMatch[];
  truncated: boolean;
  searchedPages: number[];
  warnings: string[];
}

export interface SearchablePdfValidation {
  sourcePageCount: number;
  candidatePageCount: number;
  sourceTextPresence: OcrTextPresence;
  candidateTextPresence: OcrTextPresence;
  sourceCharacterCount: number;
  candidateCharacterCount: number;
  dimensionsPreserved: boolean;
  orientationPreserved: boolean;
  representativePagesRendered: number[];
  featureChanges: PdfFeatureChange[];
  criticalFailures: string[];
  status: "valid" | "invalid" | "unknown";
  warnings: string[];
}

export type LikelyDocumentType = "invoice" | "receipt" | "letter" | "report" | "application-form" | "resume" | "book" | "notes" | "scanned-document" | "unknown";
export type DeterministicSignalKind = "email" | "phone" | "url" | "date" | "invoice-number" | "currency" | "id-like";

export interface SensitiveRegion {
  pageNumber: number;
  kind: DeterministicSignalKind;
  box: OcrBoundingBox | null;
  value: null;
  note: string;
}

export interface TableLikeSignal {
  pageNumber: number;
  box: OcrBoundingBox | null;
  confidence: "likely" | "uncertain";
  reason: string;
}

export interface SignatureLikeSignal {
  pageNumber: number;
  box: OcrBoundingBox | null;
  confidence: "likely" | "uncertain";
  note: "possible signature region";
}

export interface DocumentStructureResult {
  documentType: { value: LikelyDocumentType; confidence: "likely" | "uncertain" | "unknown" };
  title: { value: string | null; confidence: "likely" | "uncertain" | "unknown" };
  sections: Array<{ title: string; pageNumber: number; confidence: "likely" | "uncertain" }>;
  tableLikeRegions: TableLikeSignal[];
  signatureLikeRegions: SignatureLikeSignal[];
  sensitiveRegions: SensitiveRegion[];
  pageGroups: PdfStructureSignals["pageGroups"];
  boundedTextCharacterCount: number;
  warnings: string[];
}

export interface DocumentUnderstandingInput {
  sourceAnalysis: DocumentIntelligenceSnapshot;
  ocr: Pick<OcrDocumentResult, "documentId" | "pageCount" | "language" | "textPresence" | "processedPages" | "skippedPages" | "failedPages" | "boundedTextCharacterCount" | "warnings">;
  structure: DocumentStructureResult;
  futureAiBoundary: "not-invoked";
}

export interface DocumentUnderstandingSnapshot extends DocumentUnderstandingInput {
  processingBoundary: "browser-local";
  generatedBy: "deterministic-rules";
}

export interface OcrSearchablePdfRequest {
  source: File;
  analysis: PdfDocumentAnalysis;
  plan: OcrPlan;
  result: OcrDocumentResult;
  preserveVisualAppearance: boolean;
  onProgress?: (progress: { phase: "authoring" | "validating" | "complete"; pageNumber?: number; pageTotal?: number; message: string }) => void;
  signal?: AbortSignal;
}
