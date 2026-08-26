# Phase 7 action security and recovery

**Status:** Implemented for the bounded browser-local action editor.

## Security posture

Phase 7 treats document actions as untrusted plans. A plan may come from a user form or, in a future integration, an AI proposal. It is never executable merely because it is syntactically valid. The planner checks source-document ownership, stable page identity, page bounds, positive region dimensions, bounded text, supported shapes and sizes, action count, conflicts, risk, and preservation impact before authoring.

The browser receives the original PDF as an immutable `File`. The authoring path reads bytes locally, creates a separate candidate, and never writes back to the original. The output is not offered for download until it can be reopened by PDF.js and the expected page count is confirmed. Temporary object URLs are owned by the editor and revoked on replacement or unmount.

## Redaction model

A redaction action is classified as high risk and always requires review and explicit confirmation. The supported implementation renders the target page locally, paints the selected region into the raster image, and embeds that raster into a newly authored PDF page. This is genuine visual redaction for the selected page: the underlying searchable text layer is not copied into that rasterized page.

The implementation is deliberately conservative. It does not claim that an arbitrary PDF is forensically sanitized. Interactive annotations, form fields, links, bookmarks, embedded files, nonstandard metadata, hidden layers, or unsupported content on a rasterized page may not be preserved. The UI warns that highly sensitive, legal, archival, or forensic documents require independent verification using an independent tool and workflow.

When the user supplies an exact target string from the local text-match helper, the candidate is reopened and passed through the existing bounded PDF.js text extraction path. A remaining target rejects the candidate. This is an additional check, not a universal proof of absence from every PDF layer.

## AI proposal separation

Phase 6 semantic AI results remain evidence-backed suggestions. The Phase 7 planner accepts an AI proposal only when it is explicitly labeled as AI evidence and server-assisted. The proposal is then treated as untrusted data and passed through the same local planner as a user action. There is no direct `AI result → PDF mutation` path, no automatic redaction, no autonomous download, and no external action.

## Data minimization and boundaries

PDF bytes, rendered canvases, page geometry, user-entered action parameters, and generated outputs remain in browser memory during local authoring. Text-match search uses local PDF.js text content and returns only bounded page-local match records. The Phase 6 gateway is not called by the local editor. If a future provider suggests actions, only bounded structured context and structured proposals may cross the already documented Phase 6 gateway; raw PDF bytes and credentials must remain outside that boundary.

The editor does not execute PDF JavaScript. It does not mutate source xref structures, arbitrary content streams, fonts, annotations, forms, bookmarks, embedded files, or nonstandard metadata. Named resize operations and basic metadata actions are intentionally limited to documented supported paths.

## Review and confirmation controls

The action queue is visible before mutation. Each row shows action type, page, region, reason, evidence class, risk, and preservation impact. The review surface can remove individual actions or clear all pending work. A second confirmation dialog explains that the new PDF is the only candidate being changed, that the original remains unchanged, and that redaction is destructive.

No action is executed while the plan is being edited. Conflicts such as deleting a page while applying fixed-coordinate annotations to the same page, cropping alongside fixed-coordinate actions, or rotating alongside untransformed fixed-coordinate actions are rejected rather than silently reordered.

## Failure and cancellation behavior

The authoring path checks `AbortSignal` before every page and during page rendering. Cancellation discards partial bytes and displays a recoverable message. Unsupported geometry, failed PDF.js rendering, output encoding failure, page-count changes, redaction text remaining detectable, and output reopen failures all reject the candidate. The source file and previous validated results remain available.

Undo and redo operate on bounded validated result snapshots. They do not attempt reverse mutation against PDF internals. History is capped in memory and is cleared with the component; it is not persisted to storage or transmitted.

## Output and privacy disclosure

Generated names are sanitized and action-specific. The result panel identifies the output as validated, reports page count and size, lists warnings, and states that the original remains unchanged. Users can download the new file or continue editing through the existing intake path. No action result is uploaded, persisted, or used for training by this application.

## References

1. [PDF.js API documentation](https://mozilla.github.io/pdf.js/api/)
2. [pdf-lib API repository](https://github.com/Hopding/pdf-lib)
3. [SmartDocs Phase 6 AI security boundary](./phase-6-ai-security.md)
4. [SmartDocs Phase 7 action architecture](./phase-7-safe-document-actions.md)
