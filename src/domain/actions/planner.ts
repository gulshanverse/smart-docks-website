import { ACTION_IMPACTS, ACTION_PLAN_VERSION, MAX_ACTIONS, type ActionPlanResult, type ActionType, type DocumentAction, type PdfRect } from "./types";

function validRect(rect: PdfRect | undefined): boolean {
  if (!rect) return false;
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= 10_000 && rect.y + rect.height <= 10_000;
}

function actionKey(action: DocumentAction): string {
  const targetKey = action.targets.map((target) => `${target.page.sourcePageId}:${target.rect ? [target.rect.x, target.rect.y, target.rect.width, target.rect.height].join(",") : ""}:${target.text ?? ""}`).join("|");
  return `${action.actionType}:${targetKey}:${JSON.stringify(action.parameters)}`;
}

function pageNumbers(action: DocumentAction): number[] {
  return action.targets.map((target) => target.page.sourcePageNumber);
}

function validateAction(action: DocumentAction, sourceDocumentId: string, sourcePageCount: number): string | null {
  if (!action.actionId || !action.sourceDocumentId || action.sourceDocumentId !== sourceDocumentId) return "The action does not belong to the current source document.";
  if (!action.targets.length) return "Every action must target at least one page or region.";
  if (!ACTION_IMPACTS[action.actionType]) return "This action type is not implemented.";
  for (const target of action.targets) {
    if (!target.page.sourcePageId || !Number.isInteger(target.page.sourcePageNumber) || target.page.sourcePageNumber < 1 || target.page.sourcePageNumber > sourcePageCount) return "An action targets a page outside the immutable source document.";
    if (["redact-region", "highlight-region", "annotate-shape", "annotate-note", "crop-pages"].includes(action.actionType) && !validRect(target.rect ?? action.parameters.rect)) return "A region action needs a positive rectangle inside the canonical PDF coordinate bound.";
  }
  if (["add-text", "annotate-note"].includes(action.actionType)) {
    if (typeof action.parameters.text !== "string" || action.parameters.text.trim().length === 0 || action.parameters.text.length > 1_000) return "Text annotations must be non-empty and at most 1,000 characters.";
  }
  if (action.actionType === "add-text" && (!Number.isFinite(action.parameters.fontSize) || (action.parameters.fontSize ?? 0) < 6 || (action.parameters.fontSize ?? 0) > 72)) return "Text size must be between 6 and 72 PDF points.";
  if (action.actionType === "annotate-shape" && !["rectangle", "line", "arrow"].includes(action.parameters.shape ?? "")) return "Only rectangle, line, and arrow shapes are supported.";
  if (action.actionType === "rotate-pages" && ![90, 180, 270].includes(action.parameters.rotationDegrees ?? 0)) return "Rotation must be 90°, 180°, or 270°.";
  if (["update-metadata", "remove-basic-metadata"].includes(action.actionType) && action.targets.length !== 1) return "Metadata actions use the document target rather than multiple page targets.";
  return null;
}

function detectConflicts(actions: DocumentAction[]): string[] {
  const conflicts: string[] = [];
  const byPage = new Map<number, DocumentAction[]>();
  actions.forEach((action) => pageNumbers(action).forEach((page) => byPage.set(page, [...(byPage.get(page) ?? []), action])));
  for (const [page, pageActions] of byPage) {
    const types = new Set(pageActions.map((action) => action.actionType));
    if (types.has("delete-pages") && pageActions.some((action) => action.actionType !== "delete-pages")) conflicts.push(`Page ${page}: delete-pages conflicts with a page-targeted action.`);
    if (types.has("crop-pages") && (types.has("redact-region") || types.has("highlight-region") || types.has("annotate-shape") || types.has("annotate-note"))) conflicts.push(`Page ${page}: crop-pages conflicts with fixed-coordinate region actions.`);
    if (types.has("rotate-pages") && (types.has("redact-region") || types.has("highlight-region") || types.has("annotate-shape") || types.has("annotate-note") || types.has("add-text"))) conflicts.push(`Page ${page}: rotate-pages conflicts with coordinate-based actions; transform coordinates explicitly instead.`);
    if (types.has("reorder-pages") && pageActions.some((action) => action.actionType !== "reorder-pages")) conflicts.push(`Page ${page}: reorder-pages conflicts with page-targeted actions.`);
  }
  return conflicts;
}

export function planDocumentActions(sourceDocumentId: string, sourcePageCount: number, input: readonly DocumentAction[], planId = `plan-${Date.now()}`): ActionPlanResult {
  if (!sourceDocumentId || !Number.isInteger(sourcePageCount) || sourcePageCount < 1) return { error: { code: "invalid-action", message: "A valid source document and page count are required." } };
  if (input.length === 0) return { error: { code: "empty-plan", message: "Add at least one reviewed action before applying changes." } };
  if (input.length > MAX_ACTIONS) return { error: { code: "too-many-actions", message: `A plan may contain at most ${MAX_ACTIONS} actions.` } };
  const unique = new Map<string, DocumentAction>();
  for (const action of input) {
    const error = validateAction(action, sourceDocumentId, sourcePageCount);
    if (error) return { error: { code: "invalid-action", message: error } };
    unique.set(actionKey(action), action);
  }
  const actions = [...unique.values()];
  const conflicts = detectConflicts(actions);
  if (conflicts.length) return { error: { code: "conflict", message: conflicts.join(" ") } };
  const expectedPageCount = actions.some((action) => action.actionType === "delete-pages") ? sourcePageCount - new Set(actions.filter((action) => action.actionType === "delete-pages").flatMap(pageNumbers)).size : sourcePageCount;
  if (expectedPageCount < 1) return { error: { code: "invalid-action", message: "At least one page must remain after the action plan." } };
  const warnings = actions.filter((action) => action.preservationImpact === "high" || action.preservationImpact === "unknown").map((action) => `${action.actionType} has ${action.preservationImpact} preservation impact and requires review.`);
  return { plan: { version: ACTION_PLAN_VERSION, planId, sourceDocumentId, sourcePageCount, coordinateModel: "pdf-points-bottom-left", actions, expectedPageCount, conflicts: [], warnings, requiresHighRiskConfirmation: actions.some((action) => action.risk === "high" || action.risk === "unknown") } };
}

export function validateActionProposal(proposal: DocumentAction, sourceDocumentId: string, sourcePageCount: number): { valid: boolean; message?: string } {
  if (proposal.evidence.source !== "ai") return { valid: false, message: "An AI proposal must be labeled as AI-generated evidence." };
  if (proposal.processingBoundary !== "server-assisted") return { valid: false, message: "AI proposals must remain server-assisted suggestions until reviewed." };
  const result = planDocumentActions(sourceDocumentId, sourcePageCount, [proposal]);
  return "error" in result ? { valid: false, message: result.error.message } : { valid: true };
}

export function createUserAction(sourceDocumentId: string, actionType: ActionType, targets: DocumentAction["targets"], parameters: DocumentAction["parameters"], reason: string): DocumentAction {
  const policy = ACTION_IMPACTS[actionType];
  return { actionId: `${actionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, actionType, sourceDocumentId, targets, parameters, evidence: { source: "user", reason }, preservationImpact: policy.impact, risk: policy.risk, previewRequired: policy.previewRequired, confirmationRequired: true, processingBoundary: "browser-local" };
}
