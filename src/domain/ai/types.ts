import type { DocumentIntelligenceSnapshot, PdfPageRole } from "../pdfs/document-analysis";
import type { OcrBoundingBox, OcrDocumentResult, DocumentStructureResult } from "../ocr/types";

export const AI_CONTEXT_VERSION = "phase6-context-v1";
export const AI_RESULT_VERSION = "phase6-result-v1";
export const AI_PROMPT_VERSION = "phase6-v1";
export const MAX_AI_PAGES = 12;
export const MAX_AI_BLOCKS = 96;
export const MAX_AI_BLOCK_CHARS = 900;
export const MAX_AI_TOTAL_CONTEXT_CHARS = 24_000;
export const MAX_AI_QUERY_CHARS = 600;
export const MAX_AI_RESPONSE_CHARS = 18_000;
export const MAX_AI_SOURCE_EXCERPT_CHARS = 320;
export const MAX_AI_RESULT_ITEMS = 80;
export const MAX_AI_RELEVANCE_PAGES = 8;

export type AiOperation = "classify" | "summarize" | "extract" | "ask" | "structure";
export type AiProcessingBoundary = "ai-gateway" | "deterministic-mock";
export type AiOperationState = "idle" | "preparing" | "awaiting-consent" | "retrieving" | "sending" | "streaming" | "validating" | "completed" | "failed" | "cancelled" | "rate-limited" | "unavailable";
export type AiConfidence = "high" | "medium" | "low" | "unknown";
export type AiSourceType = "pdf-text" | "ocr" | "deterministic-structure" | "metadata";
export type AiEntityType = "PERSON" | "ORGANIZATION" | "LOCATION" | "DATE" | "MONEY" | "EMAIL" | "PHONE" | "URL" | "DOCUMENT_ID" | "INVOICE_NUMBER" | "CONTRACT_ID";
export type AiDocumentType = "invoice" | "receipt" | "bank-statement" | "resume" | "contract" | "agreement" | "report" | "research-paper" | "letter" | "application-form" | "identity-document" | "tax-document" | "medical-document" | "book" | "manual" | "presentation" | "other" | "unknown";

export interface AiModelConfig {
  providerId: string;
  modelId: string;
  maxOutputTokens: number;
  temperature: number;
  structuredOutput: boolean;
  streaming: boolean;
}

export interface AiSourceReference {
  pageNumber: number;
  blockId: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  boundingBox: OcrBoundingBox | null;
  sourceType: AiSourceType;
  confidence: AiConfidence;
  excerpt: string | null;
}

export interface AiContextBlock {
  blockId: string;
  pageNumber: number;
  text: string;
  boundingBox: OcrBoundingBox | null;
  sourceType: AiSourceType;
  confidence: AiConfidence;
  offsetStart: number;
  offsetEnd: number;
}

export interface AiContextPage {
  pageNumber: number;
  role: PdfPageRole | null;
  text: string;
  blocks: AiContextBlock[];
  sourceReferences: AiSourceReference[];
}

export interface AiDocumentContext {
  version: typeof AI_CONTEXT_VERSION;
  documentId: string;
  fileName: string;
  pageCount: number;
  documentSnapshot: DocumentIntelligenceSnapshot;
  structure: Pick<DocumentStructureResult, "documentType" | "title" | "sections" | "tableLikeRegions" | "signatureLikeRegions" | "boundedTextCharacterCount">;
  ocrStatus: Pick<OcrDocumentResult, "textPresence" | "processedPages" | "skippedPages" | "failedPages" | "boundedTextCharacterCount" | "language">;
  pages: AiContextPage[];
  relevantPageNumbers: number[];
  truncated: boolean;
  truncationReason: string | null;
  totalContextChars: number;
  estimatedInputTokens: number | null;
  processingBoundary: "browser-local-to-ai-gateway";
}

export interface AiDocumentRequest {
  version: typeof AI_CONTEXT_VERSION;
  operation: AiOperation;
  context: AiDocumentContext;
  schemaId: string;
  schemaVersion: string;
  query: string | null;
  consent: true;
  requestId: string;
}

export interface AiClassificationResult {
  documentType: AiDocumentType;
  confidence: AiConfidence;
  reason: string;
  evidence: AiSourceReference[];
}

export interface AiSummaryResult {
  shortSummary: string;
  detailedSummary: string;
  keyPoints: Array<{ text: string; source: AiSourceReference[] }>;
  purpose: { value: string | null; source: AiSourceReference[] };
  importantDates: AiExtractedFact[];
  importantEntities: AiEntity[];
  importantAmounts: AiExtractedFact[];
  warnings: string[];
}

export interface AiExtractedFact {
  field: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidence: AiConfidence;
  source: AiSourceReference[];
  sourceStatus: "verified" | "uncertain" | "not-found" | "unknown";
}

export interface AiEntity {
  value: string;
  type: AiEntityType;
  confidence: AiConfidence;
  source: AiSourceReference[];
}

export interface AiExtractionResult {
  schemaId: string;
  schemaVersion: string;
  documentType: AiDocumentType;
  fields: AiExtractedFact[];
  entities: AiEntity[];
  tables: AiTableResult[];
  warnings: string[];
}

export interface AiTableResult {
  pageNumber: number;
  columns: string[];
  rows: string[][];
  confidence: AiConfidence;
  source: AiSourceReference[];
  warning: string | null;
}

export interface AiAnswerResult {
  answer: string;
  confidence: AiConfidence;
  sourceStatus: "supported" | "not-found" | "conflicting" | "unknown";
  sources: AiSourceReference[];
  conflicts: AiConflict[];
  warnings: string[];
}

export interface AiConflict {
  field: string;
  values: Array<{ value: string; source: AiSourceReference[] }>;
}

export interface AiStructureResult {
  title: { value: string | null; confidence: AiConfidence; source: AiSourceReference[] };
  sections: Array<{ title: string; pageNumber: number; confidence: AiConfidence; source: AiSourceReference[] }>;
  tables: AiTableResult[];
  forms: Array<{ label: string; value: string | null; checked: boolean | null; source: AiSourceReference[] }>;
  warnings: string[];
}

export type AiOperationResult =
  | { operation: "classify"; value: AiClassificationResult }
  | { operation: "summarize"; value: AiSummaryResult }
  | { operation: "extract"; value: AiExtractionResult }
  | { operation: "ask"; value: AiAnswerResult }
  | { operation: "structure"; value: AiStructureResult };

export interface AiDocumentResponse {
  version: typeof AI_RESULT_VERSION;
  requestId: string;
  operation: AiOperation;
  state: "completed";
  model: AiModelConfig;
  result: AiOperationResult;
  usage: { inputTokens: number | null; outputTokens: number | null; estimated: boolean };
  processingTimeMs: number;
  processingBoundary: AiProcessingBoundary;
}

export interface AiError {
  code: "provider-unavailable" | "network-failure" | "timeout" | "rate-limit" | "authentication-failure" | "invalid-schema" | "invalid-provenance" | "context-too-large" | "unsupported-document" | "empty-document" | "ocr-incomplete" | "cancelled" | "unknown";
  message: string;
  retryable: boolean;
}

export interface AiFailureResponse {
  version: typeof AI_RESULT_VERSION;
  requestId: string;
  operation: AiOperation;
  state: Exclude<AiOperationState, "idle" | "preparing" | "awaiting-consent" | "retrieving" | "sending" | "streaming" | "validating" | "completed">;
  error: AiError;
  processingBoundary: AiProcessingBoundary;
}

export interface AiDocumentProvider {
  readonly id: string;
  readonly model: AiModelConfig;
  analyzeDocument(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse>;
  summarizeDocument(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse>;
  extractFields(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse>;
  answerQuestion(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse>;
  classifyDocument(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse>;
  extractStructuredData(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse>;
}

export interface AiSchemaField {
  id: string;
  label: string;
  type: "string" | "date" | "money" | "number" | "entity" | "table";
  required: boolean;
}

export interface AiDocumentSchema {
  id: string;
  version: string;
  supportedDocumentTypes: AiDocumentType[];
  fields: AiSchemaField[];
}

export interface AiDocumentSchemaRegistry {
  get(schemaId: string, version?: string): AiDocumentSchema | null;
  list(): AiDocumentSchema[];
}

export interface AiOperationProgress {
  state: AiOperationState;
  detail: string;
  relevantPages: number[];
  contextChars: number;
  estimatedInputTokens: number | null;
}
