import type { UnifiedWorkflowState } from "./types";

const transitions: Record<UnifiedWorkflowState, readonly UnifiedWorkflowState[]> = {
  idle: ["intake"],
  intake: ["inspecting", "failed", "recoverable-error"],
  inspecting: ["planning", "failed", "recoverable-error"],
  planning: ["review", "failed", "recoverable-error"],
  review: ["awaiting-confirmation", "planning", "idle"],
  "awaiting-confirmation": ["running", "review", "idle"],
  running: ["cancelling", "validating", "failed", "recoverable-error"],
  cancelling: ["cancelled", "failed"],
  cancelled: ["idle", "review"],
  validating: ["completed", "failed", "recoverable-error"],
  completed: ["idle", "review"],
  failed: ["recoverable-error", "idle", "review"],
  "recoverable-error": ["review", "idle", "running"],
};

export function canTransition(from: UnifiedWorkflowState, to: UnifiedWorkflowState): boolean {
  return from === to || transitions[from].includes(to);
}

export function transitionWorkflowState(from: UnifiedWorkflowState, to: UnifiedWorkflowState): UnifiedWorkflowState {
  if (!canTransition(from, to)) throw new Error(`Invalid workflow transition: ${from} → ${to}`);
  return to;
}

export function workflowStateLabel(state: UnifiedWorkflowState): string {
  return state === "awaiting-confirmation" ? "Awaiting confirmation" : state.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
