import type { FileAsset } from "../files/types";
import type { UnifiedBoundary, UnifiedEvidenceType, UnifiedRisk } from "../unified/types";

export const COLLECTION_CONTRACT_VERSION = "phase11-document-collection-v1" as const;
export const COLLECTION_INTENT_VERSION = "phase11-collection-intent-v1" as const;
export const COLLECTION_RESULT_VERSION = "phase11-collection-result-v1" as const;

export const COLLECTION_LIMITS = {
  maxDocuments: 12,
  maxPdfPages: 120,
  maxOcrPages: 24,
  maxSearchCharacters: 120_000,
  maxMatches: 100,
  maxOutputs: 12,
  maxWorkflowDepth: 8,
  maxHistoryItems: 20,
} as const;

export type CollectionState = "idle" | "collecting" | "inspecting" | "planning" | "review" | "awaiting-confirmation" | "queued" | "running" | "validating" | "completed" | "partial-success" | "failed" | "cancelled" | "recoverable-error";
export type CollectionOperation = "inspect" | "merge-pdfs" | "image-collection-to-pdf" | "optimize-pdfs" | "multi-document-search" | "multi-document-summarize" | "multi-document-extract" | "multi-document-ask" | "multi-document-structure" | "unsupported";

export interface CollectionDocument {
  documentId: string;
  file: File;
  originalFile: File;
  asset: FileAsset;
  order: number;
  selected: boolean;
  duplicateOf: string | null;
  fingerprint: string;
}

export interface CollectionIntent {
  contractVersion: typeof COLLECTION_INTENT_VERSION;
  collectionId: string;
  documentIds: readonly string[];
  operation: CollectionOperation;
  target: string | null;
  constraints: readonly string[];
  ordering: readonly string[];
  outputPolicy: "individual" | "single" | "analysis-only";
  quality: string | null;
  processingBoundary: UnifiedBoundary;
  evidence: readonly { type: UnifiedEvidenceType; label: string }[];
  confidence: "high" | "medium" | "low";
}

export interface CollectionWorkflowStep {
  stepId: string;
  capability: string;
  inputDocumentIds: readonly string[];
  outputDocumentIds: readonly string[];
  dependencies: readonly string[];
  status: "pending" | "ready" | "running" | "completed" | "failed" | "cancelled" | "not-started";
  risk: UnifiedRisk;
  processingBoundary: UnifiedBoundary;
  supportsCancellation: boolean;
  requiresConfirmation: boolean;
  validationPlan: readonly string[];
}

export interface CollectionWorkflowPlan {
  workflowId: string;
  collectionId: string;
  intent: CollectionIntent;
  steps: readonly CollectionWorkflowStep[];
  compatible: boolean;
  risk: UnifiedRisk;
  processingBoundary: UnifiedBoundary;
  requiresConfirmation: boolean;
  expectedOutputCount: number;
  executable: boolean;
  warnings: readonly string[];
}

export interface CollectionProvenance {
  documentId: string;
  documentName: string;
  format: string;
  location: string | null;
  excerpt: string | null;
  sourceType: "native-text" | "ocr" | "office-text" | "office-cell" | "ai" | "detected" | "measured";
  confidence: "high" | "medium" | "low" | null;
}

export interface CollectionSearchMatch {
  documentId: string;
  documentName: string;
  format: string;
  location: string | null;
  excerpt: string;
  sourceType: CollectionProvenance["sourceType"];
  confidence: "high" | "medium" | "low" | null;
}

export interface CollectionSearchResult {
  query: string;
  matches: readonly CollectionSearchMatch[];
  searchedDocumentCount: number;
  totalDocumentCount: number;
  searchedCharacters: number;
  truncated: boolean;
  message: string;
}

export interface CollectionDocumentResult {
  documentId: string;
  documentName: string;
  status: "validated" | "best-effort" | "failed" | "cancelled" | "not-started";
  outputFileName: string | null;
  downloadUrl: string | null;
  outputBytes: number | null;
  validationMessage: string;
  warnings: readonly string[];
  provenance: readonly CollectionProvenance[];
}

export interface CollectionResult {
  contractVersion: typeof COLLECTION_RESULT_VERSION;
  collectionId: string;
  workflowId: string;
  sourceDocumentIds: readonly string[];
  outputDocumentIds: readonly string[];
  perDocumentResults: readonly CollectionDocumentResult[];
  overallStatus: "validated" | "partial-success" | "failed" | "cancelled" | "best-effort";
  validationSummary: string;
  warnings: readonly string[];
  processingBoundary: UnifiedBoundary;
  provenance: readonly CollectionProvenance[];
  historyReference: string;
}

export interface CollectionHistoryItem {
  historyId: string;
  workflowId: string;
  collectionId: string;
  operation: CollectionOperation;
  sourceDocumentIds: readonly string[];
  sourceNames: readonly string[];
  resultStatus: CollectionResult["overallStatus"];
  timestamp: number;
  outputFileNames: readonly string[];
  warnings: readonly string[];
  resultAvailable: boolean;
}

export interface DocumentCollection {
  contractVersion: typeof COLLECTION_CONTRACT_VERSION;
  collectionId: string;
  documents: readonly CollectionDocument[];
  ordering: readonly string[];
  goal: string;
  intent: CollectionIntent | null;
  capabilities: readonly string[];
  workflowPlan: CollectionWorkflowPlan | null;
  processingBoundary: UnifiedBoundary;
  risk: UnifiedRisk;
  state: CollectionState;
  history: readonly CollectionHistoryItem[];
  provenance: readonly CollectionProvenance[];
  createdAt: number;
}
