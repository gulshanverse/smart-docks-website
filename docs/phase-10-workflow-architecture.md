# Phase 10 — Workflow architecture

## Shared contracts

`src/domain/unified/types.ts` defines the serializable `UnifiedIntent`, `UnifiedWorkflowStep`, `UnifiedWorkflowPlan`, `UnifiedWorkflowState`, `UnifiedProvenance`, and `UnifiedResult` contracts. Every plan records the source document ID, goal, operation, constraints, output expectations, processing boundary, evidence types, risk, confirmation policy, and validation plan.

`src/domain/unified/planner.ts` is deterministic and capability-aware. It reuses the existing image, PDF, and conversion intent parsers, inspects the file category, and checks the existing registry before describing a workflow. Unsupported Office-to-PDF requests become rejected plans with no downloadable output. It does not create a second executor.

## Plan lifecycle

The unified lifecycle is:

`idle → intake → inspecting → planning → review → awaiting-confirmation → running → validating → completed`.

Failure paths become `failed` or `recoverable-error`; cancellation becomes `cancelling → cancelled`. `src/domain/unified/state.ts` rejects impossible transitions such as `review → running` without confirmation and `cancelled → completed`.

Each step describes its capability, input, output, risk, boundary, cancellation behavior, confirmation requirement, and validation requirement. The UI renders the plan before handoff and distinguishes detected facts, user-selected constraints, measured results, OCR, AI, and unknown states through explicit labels.

## Existing-engine delegation

The shell delegates rather than duplicates:

| Goal family | Handoff |
|---|---|
| Image target size | Existing image compression workflow and adaptive encoder. |
| PDF target size | Existing optimization panel and candidate validation. |
| PDF conversion | Existing conversion/core tools and their output validation. |
| OCR/search | Existing OCR and local search panels. |
| Understanding | Existing Phase 6 AI panel and consent/bounded-context boundary. |
| Safe editing | Existing Phase 7 reviewed action planner and deterministic executor. |
| Office inspection | Existing Phase 9 bounded OOXML inspector and Office workspace. |

The current shell provides the shared review state and routes the request to the appropriate specialized workspace. Specialized panels remain available for power users.

## Result, provenance, and recovery

Generated files remain subject to their existing validation engines. A result cannot be offered before signature, reopen, geometry, text/preservation, dimensions, byte, or package checks appropriate to its format complete. Result provenance records the source document, operation, location when available, and evidence type. Original files are immutable and the existing session-level chain/recovery controls remain the source of truth for generated PDF results.

## Limits

The planner is intentionally bounded. It does not invent a page model for Office files, execute AI actions, recalculate spreadsheets, render Office layouts, upload binaries, create persistent history, or introduce a queue/database. Future multi-step executors may be added only by composing existing validated engines under the same review and confirmation rules.
