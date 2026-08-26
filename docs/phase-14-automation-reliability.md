# Phase 14 — Document Intelligence Automation & Reliability

**Contract:** `phase14-automation-v1`

Phase 14 turns the existing Phase 12 workflow engine and Phase 13 structured extraction system into a human-supervised, resumable automation layer. It does not replace the existing planners or specialized executors. Instead, it adds bounded session metadata, checkpoints, recovery, explicit retry policies, quality gates, cross-document reconciliation, evidence graph records, audit events, and a final deliverable manifest.

## Lifecycle

A session begins with a Phase 12 workflow plan and enters `planned`. The user reviews the plan; sensitive or destructive operations enter `review_required`. Approved work enters `running`. The session may be `paused`, `cancelled`, or `recoverable` after a failure. A final state is `completed`, `completed_with_warnings`, `partial`, `failed`, or `cancelled`. Invalid lifecycle transitions are rejected by the domain state machine.

Checkpoints contain workflow and step IDs, step status, validated artifact metadata, validation status, provenance IDs, warnings, retry counts, dependency metadata, and optional human-review state. They never contain original document bytes, raw PDF objects, OCR images, API keys, complete AI prompts, or complete AI responses. Restore preserves completed validated steps and explicitly avoids blindly rerunning them.

## Failure isolation and retries

A failure is represented independently from successful, blocked, cancelled, skipped, review-required, retryable, and validation-failed steps. Retry policies are deterministic and bounded. Local idempotent processing may use at most two attempts, AI gateway operations have one safe retry opportunity, and destructive operations such as redaction, deletion, metadata removal, destructive crop, or irreversible transformation are never automatically retried. The UI exposes pause, resume from checkpoint, retry-safe recovery, and cancellation without silently restarting completed branches.

## Human review and quality gates

Review is required when the Phase 12 plan requests confirmation, confidence is insufficient, required information is missing, results conflict, evidence is incomplete, preservation risk is high, or a destructive operation is proposed. The review surface states why review is required, what evidence exists, what is uncertain, what decision is needed, and what follows approval. AI cannot approve its own proposal.

Quality gates return `pass`, `fail`, `warning`, `unknown`, or `not_applicable`. Required failures prevent a verified completion claim. A workflow with unresolved warnings becomes `completed_with_warnings`; unresolved required failures become `needs_review` or `failed` rather than being relabeled as complete.

## Reconciliation and evidence

`src/domain/automation/reconciliation.ts` compares bounded Phase 13 records using exact/normalized equality, date normalization, numeric tolerance, duplicate keys, and missing-counterpart detection. A conflict produces an open discrepancy containing document IDs, field names, compared values, method, evidence references, severity, and status. The engine never selects a winner arbitrarily.

`src/domain/automation/evidence.ts` connects document, page/source reference, extracted field, workflow step, validation gates, and final deliverable. Evidence excerpts are bounded and must point to real source identifiers supplied by the existing extraction engine.

## Final package

A final deliverable records quality gates, evidence, reconciliation, warnings, artifact IDs, and verified/needs-review status. The package manifest is metadata-only and explicitly records that original bytes, raw prompts, API keys, and OCR images are excluded.

## Limits

| Resource | Limit |
|---|---:|
| Documents per session | 12 |
| Workflow steps | 100 |
| Concurrent branches | 2 |
| Extraction records | 100 |
| Audit events | 300 |
| Checkpoints | 40 |
| Evidence references per field | 8 |
| Evidence excerpt | 300 characters |
| Export size | 2 MB inherited from Phase 13 |

## Non-features

This milestone does not provide persistent cloud queues, arbitrary code execution, silent document uploads, autonomous approval of destructive actions, unbounded retries, legal or identity decisions, forensic metadata guarantees, or a second AI provider. Existing Phase 1–13 boundaries remain authoritative.
