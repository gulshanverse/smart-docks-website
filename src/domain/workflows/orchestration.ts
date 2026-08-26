import type { FileAsset } from "../files/types";
import type { CollectionDocument } from "../collections/types";
import { planCollectionWorkflow } from "../collections/planner";

export const WORKFLOW_CONTRACT_VERSION = "phase12-workflow-v1" as const;
export const MAX_CONCURRENT_STEPS = 2;
export const MAX_RETRIES = 2;

export type WorkflowStepId = string;
export type WorkflowRisk = "low" | "medium" | "high";
export type WorkflowBoundary = "browser-local" | "browser-local-to-ai-gateway";
export type WorkflowResourceClass = "light" | "document" | "ocr" | "optimization" | "ai";
export type WorkflowFailurePolicy = "fail_fast" | "continue_independent" | "continue_best_effort" | "skip_failed_document" | "require_manual_review";
export type WorkflowRetryPolicy = "never" | "bounded-retryable";
export type WorkflowCancellationPolicy = "cancellable" | "finish-current-step" | "not-cancellable";
export type WorkflowStepType = "inspect" | "condition" | "transform" | "analysis" | "merge" | "validate" | "review" | "foreach";

export type WorkflowExecutionState = "draft" | "planned" | "review" | "confirmed" | "running" | "paused" | "completed" | "cancelled" | "failed" | "partially_completed" | "recoverable" | "review_required";
export type WorkflowStepState = "pending" | "ready" | "running" | "validating" | "completed" | "skipped" | "cancelled" | "failed" | "blocked" | "retrying";

export type WorkflowInput =
  | { kind: "original-document"; documentId: string; fileName: string; mimeType: string }
  | { kind: "collection"; documentIds: readonly string[] }
  | { kind: "artifact"; artifactId: string; expectedType: WorkflowArtifact["type"] }
  | { kind: "analysis"; artifactId: string }
  | { kind: "structured-extraction"; artifactId: string }
  | { kind: "pages"; documentId: string; pageNumbers: readonly number[] }
  | { kind: "search-matches"; artifactId: string };

export interface WorkflowOutput {
  artifactId: string;
  type: WorkflowArtifact["type"];
  fileName: string | null;
  mimeType: string | null;
  terminal: boolean;
}

export interface WorkflowProvenance {
  sourceDocumentIds: readonly string[];
  parentArtifactIds: readonly string[];
  originatingStepId: WorkflowStepId | null;
  sourceType: "original" | "derived" | "analysis" | "ai-proposal";
  location: string | null;
  confidence: "high" | "medium" | "low" | null;
}

export interface WorkflowValidation {
  id: string;
  description: string;
  required: boolean;
  status: "pending" | "passed" | "failed" | "not-applicable";
  message: string | null;
}

export interface WorkflowCondition {
  source: "document.category" | "document.classification" | "document.pageCount" | "artifact.validationStatus" | "step.state" | "collection.count";
  operator: "equals" | "not-equals" | "greater-than" | "less-than" | "in";
  value: string | number | readonly string[];
}

export interface WorkflowFailure {
  code: string;
  message: string;
  retryable: boolean;
  stepId: WorkflowStepId;
  at: number;
}

export interface WorkflowStep {
  id: WorkflowStepId;
  type: WorkflowStepType;
  capability: string;
  inputs: readonly WorkflowInput[];
  dependencies: readonly WorkflowStepId[];
  expectedOutputs: readonly WorkflowOutput[];
  risk: WorkflowRisk;
  processingBoundary: WorkflowBoundary;
  validationPlan: readonly WorkflowValidation[];
  provenance: WorkflowProvenance;
  state: WorkflowStepState;
  failurePolicy: WorkflowFailurePolicy;
  retryPolicy: WorkflowRetryPolicy;
  cancellationPolicy: WorkflowCancellationPolicy;
  resourceClass: WorkflowResourceClass;
  requiresConfirmation: boolean;
  condition?: WorkflowCondition;
  foreachDocumentIds?: readonly string[];
  progress?: { completed: number; total: number } | null;
  failure?: WorkflowFailure | null;
}

export interface WorkflowDefinition {
  workflowId: string;
  contractVersion: typeof WORKFLOW_CONTRACT_VERSION;
  goal: string;
  steps: readonly WorkflowStep[];
  failurePolicy: WorkflowFailurePolicy;
  requiresConfirmation: boolean;
  processingBoundary: WorkflowBoundary;
  warnings: readonly string[];
}

export interface WorkflowPlan extends WorkflowDefinition {
  topologicalOrder: readonly WorkflowStepId[];
  parallelReadyGroups: readonly (readonly WorkflowStepId[])[];
  blockedStepIds: readonly WorkflowStepId[];
  terminalOutputIds: readonly string[];
  intermediateArtifactIds: readonly string[];
  valid: boolean;
}

export type WorkflowArtifactType = "source-document" | "derived-document" | "intermediate-document" | "analysis-result" | "structured-extraction" | "search-result" | "summary" | "final-result";
export type WorkflowArtifactStatus = "available" | "superseded" | "failed" | "cancelled";
export type WorkflowValidationStatus = "pending" | "validated" | "failed";

export interface WorkflowArtifact {
  artifactId: string;
  sourceDocumentId: string | null;
  parentArtifactId: string | null;
  stepId: WorkflowStepId | null;
  fileName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  pageCount: number | null;
  type: WorkflowArtifactType;
  status: WorkflowArtifactStatus;
  validationStatus: WorkflowValidationStatus;
  provenance: WorkflowProvenance;
  createdAt: number;
  ephemeral: true;
}

export interface WorkflowContext {
  sessionId: string;
  documents: readonly Pick<FileAsset, "id" | "name" | "sizeBytes" | "mimeType" | "category">[];
  artifacts: readonly WorkflowArtifact[];
  goal: string;
  signal?: AbortSignal;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  state: WorkflowExecutionState;
  stepStates: Readonly<Record<WorkflowStepId, WorkflowStepState>>;
  completedStepIds: readonly WorkflowStepId[];
  failedStepIds: readonly WorkflowStepId[];
  blockedStepIds: readonly WorkflowStepId[];
  cancelledStepIds: readonly WorkflowStepId[];
  artifacts: readonly WorkflowArtifact[];
  failures: readonly WorkflowFailure[];
  checkpoints: readonly WorkflowStepId[];
  startedAt: number | null;
  finishedAt: number | null;
  message: string;
}

export interface WorkflowHistoryEntry {
  executionId: string;
  workflowId: string;
  goal: string;
  timestamp: number;
  documentCount: number;
  stepSummary: Readonly<Record<WorkflowStepState, number>>;
  finalState: WorkflowExecutionState;
  artifactMetadata: readonly Pick<WorkflowArtifact, "artifactId" | "type" | "fileName" | "mimeType" | "byteSize" | "pageCount" | "validationStatus" | "ephemeral">[];
  warnings: readonly string[];
}

export function createWorkflowStep(input: Omit<WorkflowStep, "state" | "failure" | "progress">): WorkflowStep {
  return { ...input, state: "pending", failure: null, progress: null };
}

export function aggregateBoundary(steps: readonly Pick<WorkflowStep, "processingBoundary">[]): WorkflowBoundary {
  return steps.some((step) => step.processingBoundary === "browser-local-to-ai-gateway") ? "browser-local-to-ai-gateway" : "browser-local";
}

const WORKFLOW_TRANSITIONS: Readonly<Record<WorkflowExecutionState, readonly WorkflowExecutionState[]>> = {
  draft: ["planned"], planned: ["review", "failed"], review: ["confirmed", "review_required", "failed"], confirmed: ["running", "cancelled"], running: ["paused", "completed", "partially_completed", "failed", "cancelled", "recoverable", "review_required"], paused: ["running", "cancelled", "recoverable"], completed: [], cancelled: ["recoverable"], failed: ["recoverable"], partially_completed: ["recoverable", "completed"], recoverable: ["review", "confirmed", "running", "cancelled"], review_required: ["confirmed", "cancelled", "recoverable"],
};

const STEP_TRANSITIONS: Readonly<Record<WorkflowStepState, readonly WorkflowStepState[]>> = {
  pending: ["ready", "blocked", "cancelled"], ready: ["running", "blocked", "cancelled"], running: ["validating", "failed", "cancelled", "retrying"], validating: ["completed", "failed", "retrying"], completed: [], skipped: [], cancelled: [], failed: ["retrying", "blocked"], blocked: ["ready", "cancelled"], retrying: ["running", "failed", "cancelled"],
};

export function canTransitionWorkflowState(from: WorkflowExecutionState, to: WorkflowExecutionState): boolean { return WORKFLOW_TRANSITIONS[from].includes(to); }
export function transitionWorkflowState(from: WorkflowExecutionState, to: WorkflowExecutionState): WorkflowExecutionState { if (!canTransitionWorkflowState(from, to)) throw new Error(`Invalid workflow transition: ${from} → ${to}`); return to; }
export function canTransitionWorkflowStep(from: WorkflowStepState, to: WorkflowStepState): boolean { return STEP_TRANSITIONS[from].includes(to); }
export function transitionWorkflowStep(from: WorkflowStepState, to: WorkflowStepState): WorkflowStepState { if (!canTransitionWorkflowStep(from, to)) throw new Error(`Invalid workflow step transition: ${from} → ${to}`); return to; }

export function evaluateWorkflowCondition(condition: WorkflowCondition, values: Readonly<Record<string, string | number | boolean>>): boolean {
  const actual = values[condition.source];
  if (actual === undefined) return false;
  if (condition.operator === "equals") return actual === condition.value;
  if (condition.operator === "not-equals") return actual !== condition.value;
  if (condition.operator === "greater-than") return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
  if (condition.operator === "less-than") return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
  return Array.isArray(condition.value) && condition.value.includes(String(actual));
}

export function validateWorkflowPlan(definition: WorkflowDefinition): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];
  if (definition.contractVersion !== WORKFLOW_CONTRACT_VERSION) errors.push("Unsupported workflow contract version.");
  const ids = new Set<string>();
  for (const step of definition.steps) {
    if (ids.has(step.id)) errors.push(`Duplicate workflow step ID: ${step.id}.`);
    ids.add(step.id);
    if (step.validationPlan.length === 0) errors.push(`Step ${step.id} has no validation plan.`);
    if (step.expectedOutputs.some((output) => output.artifactId === step.id)) errors.push(`Step ${step.id} cannot output an artifact with its own step ID.`);
  }
  for (const step of definition.steps) for (const dependency of step.dependencies) if (!ids.has(dependency)) errors.push(`Step ${step.id} depends on missing step ${dependency}.`);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(definition.steps.map((step) => [step.id, step]));
  function visit(id: string): void {
    if (visiting.has(id)) { errors.push(`Workflow dependency cycle includes ${id}.`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  definition.steps.forEach((step) => visit(step.id));
  return { valid: errors.length === 0, errors };
}

export function topologicalSort(steps: readonly WorkflowStep[]): readonly WorkflowStepId[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const indegree = new Map(steps.map((step) => [step.id, 0]));
  for (const step of steps) for (const dependency of step.dependencies) if (byId.has(dependency)) indegree.set(step.id, (indegree.get(step.id) ?? 0) + 1);
  const queue = steps.filter((step) => indegree.get(step.id) === 0).map((step) => step.id);
  const result: string[] = [];
  while (queue.length) { const id = queue.shift()!; result.push(id); for (const step of steps) if (step.dependencies.includes(id)) { const next = (indegree.get(step.id) ?? 0) - 1; indegree.set(step.id, next); if (next === 0) queue.push(step.id); } }
  if (result.length !== steps.length) throw new Error("Cannot topologically sort a cyclic workflow.");
  return result;
}

export function readyStepIds(steps: readonly WorkflowStep[], completed: ReadonlySet<string>, running: ReadonlySet<string>, failed: ReadonlySet<string>): readonly string[] {
  return steps.filter((step) => step.state === "pending" || step.state === "ready").filter((step) => !running.has(step.id) && !failed.has(step.id)).filter((step) => step.dependencies.every((dependency) => completed.has(dependency))).map((step) => step.id);
}

export function buildWorkflowPlan(definition: WorkflowDefinition): WorkflowPlan {
  const validation = validateWorkflowPlan(definition);
  const order = validation.valid ? topologicalSort(definition.steps) : [];
  const completed = new Set<string>();
  const groups: string[][] = [];
  for (let index = 0; index < order.length; index += 1) {
    const group = definition.steps.filter((step) => order[index] === step.id || (step.dependencies.every((dependency) => completed.has(dependency)) && !completed.has(step.id))).map((step) => step.id);
    const unique = [...new Set(group)];
    if (unique.length) { groups.push(unique); unique.forEach((id) => completed.add(id)); }
  }
  const referenced = new Set(definition.steps.flatMap((step) => step.inputs.filter((input): input is Extract<WorkflowInput, { kind: "artifact" }> => input.kind === "artifact").map((input) => input.artifactId)));
  const terminalOutputIds = definition.steps.flatMap((step) => step.expectedOutputs.filter((output) => output.terminal).map((output) => output.artifactId));
  return { ...definition, topologicalOrder: order, parallelReadyGroups: groups, blockedStepIds: validation.valid ? [] : definition.steps.map((step) => step.id), terminalOutputIds, intermediateArtifactIds: [...referenced].filter((id) => !terminalOutputIds.includes(id)), valid: validation.valid };
}

export interface SchedulerEvent { type: "step-start" | "step-complete" | "step-fail" | "step-block" | "workflow-cancel"; stepId?: string; message?: string; }
export interface SchedulerResult { completed: readonly string[]; failed: readonly string[]; blocked: readonly string[]; cancelled: readonly string[]; }

export async function runBoundedScheduler(steps: readonly WorkflowStep[], execute: (step: WorkflowStep) => Promise<void>, options: { maxConcurrent?: number; signal?: AbortSignal; onEvent?: (event: SchedulerEvent) => void; failurePolicy?: WorkflowFailurePolicy } = {}): Promise<SchedulerResult> {
  const maxConcurrent = Math.max(1, Math.min(options.maxConcurrent ?? MAX_CONCURRENT_STEPS, MAX_CONCURRENT_STEPS));
  const completed = new Set<string>(); const failed = new Set<string>(); const blocked = new Set<string>(); const cancelled = new Set<string>(); const pending = new Map(steps.map((step) => [step.id, step])); const running = new Set<string>();
  while (pending.size || running.size) {
    if (options.signal?.aborted) { pending.forEach((_, id) => cancelled.add(id)); options.onEvent?.({ type: "workflow-cancel", message: "Workflow cancellation requested." }); break; }
    const ready = [...pending.values()].filter((step) => step.dependencies.every((dependency) => completed.has(dependency))).filter((step) => !step.dependencies.some((dependency) => failed.has(dependency) || blocked.has(dependency))).slice(0, maxConcurrent - running.size);
    for (const step of ready) { pending.delete(step.id); running.add(step.id); options.onEvent?.({ type: "step-start", stepId: step.id }); void execute(step).then(() => { completed.add(step.id); running.delete(step.id); options.onEvent?.({ type: "step-complete", stepId: step.id }); }).catch((error: unknown) => { failed.add(step.id); running.delete(step.id); options.onEvent?.({ type: "step-fail", stepId: step.id, message: error instanceof Error ? error.message : "Step failed." }); }); }
    if (running.size === 0) { for (const step of pending.values()) { if (step.dependencies.some((dependency) => failed.has(dependency) || blocked.has(dependency))) { pending.delete(step.id); blocked.add(step.id); options.onEvent?.({ type: "step-block", stepId: step.id, message: "Dependency failed." }); } } if (pending.size && blocked.size === 0) throw new Error("Workflow scheduler stalled on unresolved dependencies."); if (!pending.size) break; }
    else await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (options.failurePolicy === "fail_fast" && failed.size) { pending.forEach((_, id) => blocked.add(id)); pending.clear(); }
  }
  return { completed: [...completed], failed: [...failed], blocked: [...blocked], cancelled: [...cancelled] };
}


function stableId(value: string): string {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `wf-${(hash >>> 0).toString(36)}`;
}

function workflowStepFor(id: string, type: WorkflowStepType, capability: string, document: FileAsset, dependencies: readonly string[], options: Partial<WorkflowStep> = {}): WorkflowStep {
  return createWorkflowStep({ id, type, capability, inputs: [{ kind: "original-document", documentId: document.id, fileName: document.name, mimeType: document.mimeType }], dependencies, expectedOutputs: [{ artifactId: `${id}:result`, type: type === "analysis" || type === "inspect" ? "analysis-result" : type === "validate" ? "final-result" : "derived-document", fileName: null, mimeType: null, terminal: type === "validate" }], risk: "low", processingBoundary: "browser-local", validationPlan: [{ id: `${id}:validation`, description: "Validate the format-specific result before it is presented.", required: true, status: "pending", message: null }], provenance: { sourceDocumentIds: [document.id], parentArtifactIds: [], originatingStepId: id, sourceType: "original", location: null, confidence: "high" }, failurePolicy: "continue_best_effort", retryPolicy: "never", cancellationPolicy: "cancellable", resourceClass: type === "transform" ? "document" : "light", requiresConfirmation: false, ...options });
}

export function planWorkflowForCollection(collectionId: string, documents: readonly CollectionDocument[], goal: string): WorkflowPlan {
  const collectionPlan = planCollectionWorkflow(collectionId, documents, goal);
  const steps = collectionPlan.steps.map((sourceStep) => {
    const isAnalysis = sourceStep.capability.includes("search") || sourceStep.capability.includes("extract") || sourceStep.capability.includes("summar") || sourceStep.capability.includes("structure") || sourceStep.capability.includes("ask");
    const isTransform = sourceStep.capability.includes("merge") || sourceStep.capability.includes("create-pdf") || sourceStep.capability.includes("optimize");
    const inputs: WorkflowInput[] = sourceStep.inputDocumentIds.map((documentId) => {
      const document = documents.find((item) => item.documentId === documentId);
      return document ? { kind: "original-document", documentId, fileName: document.asset.name, mimeType: document.asset.mimeType } : { kind: "collection", documentIds: sourceStep.inputDocumentIds };
    });
    const uniqueInputs: readonly WorkflowInput[] = inputs.length > 0 ? inputs : [{ kind: "collection", documentIds: collectionPlan.intent.documentIds }];
    const workflowRisk: WorkflowRisk = sourceStep.risk === "high" ? "high" : sourceStep.risk === "medium" ? "medium" : "low";
    return createWorkflowStep({
      id: sourceStep.stepId,
      type: collectionPlan.intent.outputPolicy === "individual" && (isTransform || isAnalysis) ? "foreach" : sourceStep.inputDocumentIds.length > 1 ? (isTransform ? "merge" : "foreach") : isAnalysis ? "analysis" : isTransform ? "transform" : "inspect",
      capability: `collection.${sourceStep.capability.toLowerCase().replaceAll(" ", "-")}`,
      inputs: uniqueInputs,
      dependencies: sourceStep.dependencies,
      expectedOutputs: sourceStep.outputDocumentIds.map((artifactId, index) => ({ artifactId, type: isAnalysis ? "analysis-result" : sourceStep.stepId.includes("validate") ? "final-result" : "derived-document", fileName: null, mimeType: null, terminal: sourceStep.stepId.includes("validate") && index === sourceStep.outputDocumentIds.length - 1 })),
      risk: workflowRisk,
      processingBoundary: sourceStep.processingBoundary,
      validationPlan: sourceStep.validationPlan.map((description, index) => ({ id: `${sourceStep.stepId}:validation:${index + 1}`, description, required: true, status: "pending", message: null })),
      provenance: { sourceDocumentIds: sourceStep.inputDocumentIds, parentArtifactIds: [], originatingStepId: sourceStep.stepId, sourceType: "original", location: null, confidence: "high" },
      failurePolicy: collectionPlan.intent.outputPolicy === "individual" ? "skip_failed_document" : "fail_fast",
      retryPolicy: "never",
      cancellationPolicy: sourceStep.supportsCancellation ? "cancellable" : "finish-current-step",
      resourceClass: isAnalysis ? "ai" : isTransform ? "document" : "light",
      requiresConfirmation: sourceStep.requiresConfirmation,
      foreachDocumentIds: collectionPlan.intent.outputPolicy === "individual" ? sourceStep.inputDocumentIds : undefined,
    });
  });
  const definition: WorkflowDefinition = {
    workflowId: collectionPlan.workflowId,
    contractVersion: WORKFLOW_CONTRACT_VERSION,
    goal,
    steps,
    failurePolicy: collectionPlan.intent.outputPolicy === "individual" ? "skip_failed_document" : "fail_fast",
    requiresConfirmation: collectionPlan.requiresConfirmation,
    processingBoundary: collectionPlan.processingBoundary,
    warnings: collectionPlan.warnings,
  };
  return buildWorkflowPlan(definition);
}

export function planWorkflowForAsset(document: FileAsset, goal: string): WorkflowPlan {
  const normalized = goal.trim().toLowerCase();
  const workflowId = stableId(`${document.id}|${normalized}|${WORKFLOW_CONTRACT_VERSION}`);
  const warnings: string[] = [];
  const steps: WorkflowStep[] = [];
  const inspectId = `${workflowId}:inspect`;
  steps.push(workflowStepFor(inspectId, "inspect", document.category === "office" ? "office.package.inspect" : document.category === "pdf" ? "pdf.inspect" : "image.inspect", document, []));
  let previous = inspectId;
  const hasOcr = /ocr|searchable/.test(normalized) && document.category === "pdf";
  const hasExtract = /extract|invoice number|amount|vendor|date/.test(normalized);
  const hasOptimize = /optim|compress|smaller|under \d/.test(normalized) && (document.category === "pdf" || document.category === "image");
  const hasConvert = /convert|to pdf|to png|to jpg|to webp/.test(normalized);
  const hasSummary = /summar|understand|ask|answer/.test(normalized);
  const hasAction = /redact|remove blank|rotate|delete|crop|resize|annotat/.test(normalized);
  if (hasOcr) { const id = `${workflowId}:ocr`; steps.push(workflowStepFor(id, "transform", "pdf.ocr.recognize", document, [previous], { resourceClass: "ocr", retryPolicy: "bounded-retryable", expectedOutputs: [{ artifactId: `${id}:result`, type: "derived-document", fileName: null, mimeType: "application/pdf", terminal: false }] })); previous = id; }
  if (hasExtract) { const id = `${workflowId}:extract`; steps.push(workflowStepFor(id, "analysis", document.category === "office" ? "office.text.extract" : "pdf.text.extract", document, [previous], { resourceClass: "document", expectedOutputs: [{ artifactId: `${id}:result`, type: "structured-extraction", fileName: null, mimeType: "application/json", terminal: false }] })); previous = id; }
  if (hasAction) { const id = `${workflowId}:review`; steps.push(workflowStepFor(id, "review", "pdf.action.review", document, [previous], { risk: "high", requiresConfirmation: true, failurePolicy: "require_manual_review", resourceClass: "document" })); previous = id; warnings.push("This goal contains a potentially destructive action and requires human review before execution."); }
  if (hasOptimize) { const id = `${workflowId}:optimize`; steps.push(workflowStepFor(id, "transform", document.category === "image" ? "image.compress.target_size" : "pdf.optimize.target_size", document, [previous], { risk: "medium", resourceClass: "optimization", expectedOutputs: [{ artifactId: `${id}:result`, type: "derived-document", fileName: null, mimeType: document.category === "image" ? document.mimeType : "application/pdf", terminal: false }] })); previous = id; }
  if (hasConvert) {
    const officeUnsupported = document.category === "office" && /pdf/.test(normalized);
    if (officeUnsupported) warnings.push("Faithful Office-to-PDF conversion is unavailable in the browser-local engine; no fabricated output is offered.");
    else { const id = `${workflowId}:convert`; steps.push(workflowStepFor(id, "transform", "conversion.execute", document, [previous], { resourceClass: "document", expectedOutputs: [{ artifactId: `${id}:result`, type: "derived-document", fileName: null, mimeType: /png/.test(normalized) ? "image/png" : /jpg|jpeg/.test(normalized) ? "image/jpeg" : "application/pdf", terminal: false }] })); previous = id; }
  }
  if (hasSummary) { const id = `${workflowId}:summary`; steps.push(workflowStepFor(id, "analysis", "ai.document.analyze", document, [previous], { risk: "medium", processingBoundary: "browser-local-to-ai-gateway", requiresConfirmation: true, resourceClass: "ai", expectedOutputs: [{ artifactId: `${id}:result`, type: "summary", fileName: null, mimeType: "application/json", terminal: false }] })); previous = id; warnings.push("AI-assisted analysis requires explicit consent and sends bounded structured context through the optional gateway."); }
  const validateId = `${workflowId}:validate`;
  steps.push(workflowStepFor(validateId, "validate", "validation", document, [previous], { resourceClass: "light", expectedOutputs: [{ artifactId: `${validateId}:result`, type: "final-result", fileName: null, mimeType: null, terminal: true }] }));
  const unsupported = document.category === "office" && /convert/.test(normalized) && /pdf/.test(normalized);
  if (!hasOcr && !hasExtract && !hasOptimize && !hasConvert && !hasSummary && !hasAction && !/inspect|review|analy/.test(normalized)) warnings.push("The goal is ambiguous; the plan is limited to validated inspection until a clearer operation is provided.");
  if (unsupported) warnings.push("Unsupported workflow: Office package inspection and bounded TXT extraction remain available as alternatives.");
  const definition: WorkflowDefinition = { workflowId, contractVersion: WORKFLOW_CONTRACT_VERSION, goal, steps: unsupported ? steps.map((step) => ({ ...step, state: "blocked" as WorkflowStepState })) : steps, failurePolicy: hasAction || hasSummary ? "require_manual_review" : "continue_best_effort", requiresConfirmation: hasAction || hasSummary, processingBoundary: aggregateBoundary(steps), warnings };
  return buildWorkflowPlan(definition);
}
