import { COLLECTION_LIMITS, type CollectionDocument, type CollectionIntent, type CollectionOperation, type CollectionWorkflowPlan, type CollectionWorkflowStep } from "./types";
import { evaluateCollectionCompatibility } from "./compatibility";

function operationForGoal(goal: string): CollectionOperation {
  const normalized = goal.toLowerCase();
  if (/merge/.test(normalized)) return "merge-pdfs";
  if (/(images?|photos?).*(one )?pdf|pdf.*(images?|photos?)/.test(normalized)) return "image-collection-to-pdf";
  if (/optim|compress|smaller|under \d/.test(normalized)) return "optimize-pdfs";
  if (/summar/.test(normalized)) return "multi-document-summarize";
  if (/extract|invoice number|total/.test(normalized)) return "multi-document-extract";
  if (/\bask\b|which documents|what document|mention/.test(normalized)) return "multi-document-ask";
  if (/structure|compare|difference/.test(normalized)) return "multi-document-structure";
  if (/search|find|look for/.test(normalized)) return "multi-document-search";
  return "inspect";
}

function targetFromGoal(goal: string): string | null {
  const target = /(?:under|below|less than|to)\s*(\d+(?:\.\d+)?)\s*(kb|mb)\b/i.exec(goal);
  return target ? `${target[1]} ${target[2].toUpperCase()}` : null;
}
function step(stepId: string, capability: string, inputDocumentIds: readonly string[], outputDocumentIds: readonly string[], dependencies: readonly string[] = [], options: Partial<CollectionWorkflowStep> = {}): CollectionWorkflowStep {
  return { stepId, capability, inputDocumentIds, outputDocumentIds, dependencies, status: "ready", risk: "low", processingBoundary: "browser-local", supportsCancellation: true, requiresConfirmation: false, validationPlan: ["Validate the format-specific result before download"], ...options };
}

export function planCollectionWorkflow(collectionId: string, documents: readonly CollectionDocument[], goal: string): CollectionWorkflowPlan {
  const operation = operationForGoal(goal);
  const selected = documents.filter((document) => document.selected);
  const input = selected.length > 0 ? selected : documents;
  const compatibility = evaluateCollectionCompatibility(input, operation);
  const ids = input.map((document) => document.documentId);
  const target = targetFromGoal(goal);
  const isAi = operation.startsWith("multi-document-") && operation !== "multi-document-search" && operation !== "multi-document-structure";
  const intent: CollectionIntent = { contractVersion: "phase11-collection-intent-v1", collectionId, documentIds: ids, operation, target, constraints: ["Preserve originals", "Sequential heavy work", `Maximum ${COLLECTION_LIMITS.maxOutputs} outputs`], ordering: ids, outputPolicy: operation === "merge-pdfs" || operation === "image-collection-to-pdf" ? "single" : operation === "inspect" || operation === "multi-document-search" || operation === "multi-document-structure" ? "analysis-only" : "individual", quality: null, processingBoundary: isAi ? "browser-local-to-ai-gateway" : "browser-local", evidence: [{ type: "user-selected", label: "Collection goal" }, { type: "detected", label: `${input.length} selected documents` }], confidence: operation === "inspect" ? "medium" : "high" };
  let steps: CollectionWorkflowStep[] = [];
  if (operation === "merge-pdfs") {
    steps = [step("collection.inspect", "Inspect selected PDFs", ids, ids.map((id) => `${id}:inspected`)), step("collection.merge", "Merge PDFs in explicit order", ids, ["collection-output"], ["collection.inspect"], { risk: "medium" }), step("collection.validate", "Reopen and validate merged PDF", ["collection-output"], ["validated-output"], ["collection.merge"])];
  } else if (operation === "image-collection-to-pdf") {
    steps = [step("collection.inspect", "Validate ordered image inputs", ids, ids.map((id) => `${id}:validated`)), step("collection.create-pdf", "Create ordered image PDF", ids, ["collection-output"], ["collection.inspect"]), step("collection.validate", "Reopen and validate collection PDF", ["collection-output"], ["validated-output"], ["collection.create-pdf"])];
  } else if (operation === "optimize-pdfs") {
    steps = input.flatMap((document) => [step(`${document.documentId}.inspect`, "Inspect PDF", [document.documentId], [`${document.documentId}:analysis`]), step(`${document.documentId}.optimize`, `Optimize ${document.asset.name}${target ? ` to ${target}` : ""}`, [document.documentId], [`${document.documentId}:output`], [`${document.documentId}.inspect`], { risk: "medium" }), step(`${document.documentId}.validate`, "Validate optimized PDF", [`${document.documentId}:output`], [`${document.documentId}:validated`], [`${document.documentId}.optimize`])]);
  } else if (operation === "inspect") {
    steps = [step("collection.inspect", "Inspect collection documents", ids, ids.map((id) => `${id}:analysis`)), step("collection.validate", "Validate collection analysis", ids.map((id) => `${id}:analysis`), ["collection-analysis"], ["collection.inspect"])];
  } else {
    steps = [step("collection.inspect", "Inspect and gather bounded source content", ids, ids.map((id) => `${id}:bounded-context`), [], { risk: isAi ? "medium" : "low", processingBoundary: isAi ? "browser-local-to-ai-gateway" : "browser-local", requiresConfirmation: isAi }), step("collection.query", operation.replaceAll("-", " "), ids.map((id) => `${id}:bounded-context`), ["collection-result"], ["collection.inspect"], { risk: isAi ? "medium" : "low", processingBoundary: isAi ? "browser-local-to-ai-gateway" : "browser-local", requiresConfirmation: isAi, validationPlan: ["Validate bounded response size", "Validate document provenance", "Validate location references"] }), step("collection.validate", "Validate collection result and provenance", ["collection-result"], ["validated-result"], ["collection.query"])];
  }
  const depth = Math.max(0, steps.length > 0 ? 3 : 0);
  const compatible = compatibility.supported && input.length <= COLLECTION_LIMITS.maxDocuments && depth <= COLLECTION_LIMITS.maxWorkflowDepth;
  const executable = operation === "merge-pdfs" || operation === "image-collection-to-pdf" || operation === "inspect" || operation === "multi-document-search";
  const warnings = [...compatibility.warnings, ...(compatible ? [] : [compatibility.message]), ...(input.length > COLLECTION_LIMITS.maxOutputs ? [`Output count is capped at ${COLLECTION_LIMITS.maxOutputs}.`] : []), ...(executable ? [] : ["This plan is reviewable but is not executable in the current collection milestone."])];
  return { workflowId: `${collectionId}-${operation}`, collectionId, intent, steps: compatible ? steps : steps.map((current) => ({ ...current, status: "failed" })), compatible, risk: operation === "merge-pdfs" || operation === "optimize-pdfs" ? "medium" : isAi ? "medium" : "low", processingBoundary: intent.processingBoundary, requiresConfirmation: isAi, expectedOutputCount: operation === "merge-pdfs" || operation === "image-collection-to-pdf" ? 1 : operation === "inspect" || operation === "multi-document-search" || operation === "multi-document-structure" ? 0 : input.length, executable, warnings: compatible ? warnings : [compatibility.message, ...compatibility.warnings, ...(executable ? [] : ["This plan is reviewable but is not executable in the current collection milestone."])] };
}

export function collectionCapabilities(documents: readonly CollectionDocument[]): readonly CollectionOperation[] {
  const compatibility = (operation: CollectionOperation) => evaluateCollectionCompatibility(documents, operation).supported;
  return (["inspect", "merge-pdfs", "image-collection-to-pdf", "optimize-pdfs", "multi-document-search", "multi-document-summarize", "multi-document-extract", "multi-document-ask", "multi-document-structure"] as const).filter(compatibility);
}
