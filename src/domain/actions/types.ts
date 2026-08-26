import type { ProcessingBoundary } from "../files/types";

export const ACTION_PLAN_VERSION = "phase7-action-plan-v1" as const;
export const PDF_COORDINATE_MODEL = "pdf-points-bottom-left" as const;
export const MAX_ACTIONS = 24;
export const MAX_TEXT_LENGTH = 1_000;
export const MAX_HISTORY = 8;

export type PreservationImpact = "none" | "low" | "medium" | "high" | "unknown";
export type ActionRisk = "low" | "medium" | "high" | "unknown";
export type ActionType =
  | "delete-pages"
  | "extract-pages"
  | "reorder-pages"
  | "rotate-pages"
  | "redact-region"
  | "highlight-region"
  | "add-text"
  | "annotate-shape"
  | "annotate-note"
  | "crop-pages"
  | "resize-pages"
  | "update-metadata"
  | "remove-basic-metadata";

export interface PageIdentity {
  sourcePageId: string;
  sourcePageNumber: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActionTarget {
  page: PageIdentity;
  rect?: PdfRect;
  text?: string;
}

export interface ActionParameters {
  rect?: PdfRect;
  text?: string;
  fontSize?: number;
  rotationDegrees?: 90 | 180 | 270;
  color?: string;
  opacity?: number;
  shape?: "rectangle" | "line" | "arrow";
  pageSize?: "A4" | "A5" | "Letter" | "Legal";
  metadata?: Partial<Record<"title" | "author" | "subject" | "creator" | "producer", string>>;
}

export interface ActionEvidence {
  source: "user" | "deterministic" | "ai";
  reason: string;
  sourcePageId?: string;
  sourcePageNumber?: number;
  excerpt?: string;
}

export interface DocumentAction {
  actionId: string;
  actionType: ActionType;
  sourceDocumentId: string;
  targets: ActionTarget[];
  parameters: ActionParameters;
  evidence: ActionEvidence;
  preservationImpact: PreservationImpact;
  risk: ActionRisk;
  previewRequired: boolean;
  confirmationRequired: boolean;
  processingBoundary: ProcessingBoundary;
}

export interface DocumentActionPlan {
  version: typeof ACTION_PLAN_VERSION;
  planId: string;
  sourceDocumentId: string;
  sourcePageCount: number;
  coordinateModel: typeof PDF_COORDINATE_MODEL;
  actions: DocumentAction[];
  expectedPageCount: number;
  conflicts: string[];
  warnings: string[];
  requiresHighRiskConfirmation: boolean;
}

export interface ActionPlanError {
  code: "invalid-action" | "invalid-target" | "conflict" | "too-many-actions" | "empty-plan";
  message: string;
}

export type ActionPlanResult = { plan: DocumentActionPlan } | { error: ActionPlanError };

export interface ActionProposal extends Omit<DocumentAction, "evidence" | "processingBoundary"> {
  evidence: ActionEvidence & { source: "ai" };
  processingBoundary: "server-assisted";
}

export const ACTION_IMPACTS: Record<ActionType, { impact: PreservationImpact; risk: ActionRisk; previewRequired: boolean }> = {
  "delete-pages": { impact: "high", risk: "high", previewRequired: true },
  "extract-pages": { impact: "medium", risk: "medium", previewRequired: true },
  "reorder-pages": { impact: "medium", risk: "medium", previewRequired: true },
  "rotate-pages": { impact: "low", risk: "low", previewRequired: false },
  "redact-region": { impact: "high", risk: "high", previewRequired: true },
  "highlight-region": { impact: "low", risk: "low", previewRequired: true },
  "add-text": { impact: "low", risk: "low", previewRequired: true },
  "annotate-shape": { impact: "low", risk: "low", previewRequired: true },
  "annotate-note": { impact: "low", risk: "low", previewRequired: true },
  "crop-pages": { impact: "medium", risk: "medium", previewRequired: true },
  "resize-pages": { impact: "medium", risk: "medium", previewRequired: true },
  "update-metadata": { impact: "low", risk: "low", previewRequired: false },
  "remove-basic-metadata": { impact: "medium", risk: "medium", previewRequired: false },
};

export function pageIdentity(documentId: string, pageNumber: number): PageIdentity {
  return { sourcePageId: `${documentId}:page:${pageNumber}`, sourcePageNumber: pageNumber };
}
