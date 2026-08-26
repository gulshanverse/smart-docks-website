import type { FileAsset } from "../files/types";

export type UnifiedOperation =
  | "image.compress"
  | "pdf.optimize"
  | "pdf.convert"
  | "pdf.ocr"
  | "pdf.search"
  | "pdf.understand"
  | "pdf.edit"
  | "pdf.organize"
  | "office.inspect"
  | "office.extract_text"
  | "unsupported";

export type UnifiedEvidenceType = "measured" | "detected" | "user-selected" | "ocr" | "ai" | "unknown";
export type UnifiedRisk = "low" | "medium" | "high" | "unknown";
export type UnifiedBoundary = "browser-local" | "browser-local-to-ai-gateway";

export interface UnifiedIntent {
  contractVersion: "phase10-intent-v1";
  sourceDocumentId: string;
  goal: string;
  operation: UnifiedOperation;
  target: string | null;
  constraints: readonly string[];
  outputFormat: string | null;
  selectedPages: string | null;
  confirmationPolicy: "none" | "review" | "explicit";
  processingBoundary: UnifiedBoundary;
  evidence: readonly { type: UnifiedEvidenceType; label: string }[];
  confidence: "high" | "medium" | "low";
}

export interface UnifiedWorkflowStep {
  id: string;
  capability: string;
  input: string;
  output: string;
  status: "pending" | "ready" | "running" | "completed" | "failed" | "cancelled";
  risk: UnifiedRisk;
  processingBoundary: UnifiedBoundary;
  requiresConfirmation: boolean;
  supportsCancellation: boolean;
  validationRequirement: string;
}

export interface UnifiedWorkflowPlan {
  id: string;
  source: FileAsset;
  intent: UnifiedIntent;
  steps: readonly UnifiedWorkflowStep[];
  risk: UnifiedRisk;
  processingBoundary: UnifiedBoundary;
  requiresConfirmation: boolean;
  expectedOutput: string;
  validationPlan: readonly string[];
  warnings: readonly string[];
}

export type UnifiedWorkflowState = "idle" | "intake" | "inspecting" | "planning" | "review" | "awaiting-confirmation" | "running" | "cancelling" | "cancelled" | "validating" | "completed" | "failed" | "recoverable-error";

export interface UnifiedProvenance {
  sourceDocumentId: string;
  sourceName: string;
  location: string | null;
  operation: UnifiedOperation;
  evidenceType: UnifiedEvidenceType;
}

export interface UnifiedResult {
  status: "validated" | "best-effort" | "target-achieved" | "original-preserved" | "cancelled" | "failed" | "rejected";
  sourceDocumentId: string;
  operation: UnifiedOperation;
  outputFileName: string | null;
  outputFormat: string | null;
  outputBytes: number | null;
  pageCount: number | null;
  processingBoundary: UnifiedBoundary;
  validationMessage: string;
  warnings: readonly string[];
  provenance: readonly UnifiedProvenance[];
}
