# Phase 10 — Security and privacy boundary

Phase 10 preserves the local-first model established by earlier milestones. The unified planner handles metadata and bounded intent locally; it does not upload source documents or add persistence.

## Security rules

| Area | Policy |
|---|---|
| Source files | The original `File` remains immutable, local, and recoverable. |
| AI gateway | Only the existing Phase 6 bounded JSON context may cross the explicit gateway; raw PDF bytes, Office packages, full images, credentials, API keys, xref data, and PDF JavaScript do not. |
| AI actions | AI output is treated as a proposal, validated locally, reviewed by the user, and passed to the existing Phase 7 action planner. AI never mutates a document directly. |
| Office packages | Existing Phase 9 ZIP bounds, safe paths, macro warnings, external-link/OLE signals, and no-execution rules remain active. |
| Generated outputs | Existing format-specific validation must succeed before a download or continuation result is offered. Failed or partial candidates are discarded. |
| Filenames | Existing safe filename helpers are used; user-controlled names are not inserted as HTML. |
| Resources | Existing object URLs, PDF.js tasks/pages, canvases, OCR workers, abort controllers, and dynamic engines retain their existing owners and cleanup paths. |
| Persistence | No database, cloud storage, analytics, telemetry, account, queue, vector store, or permanent document history is added. |

The unified shell displays the processing boundary from the plan. Local workflows say **Browser-local**; AI-assisted workflows say **Browser-local + explicit AI gateway**. The UI never presents an AI gateway workflow as local-only.

## Unsupported operations

Faithful DOCX/PPTX/XLSX rendering and Office-to-PDF conversion remain unavailable. No screenshot conversion, automatic destructive action, arbitrary PDF JavaScript execution, or universal PDF object rewrite is introduced. Unsupported or ambiguous goals result in an explainable plan with no downloadable output.

## Recovery and cancellation

Cancellation and failed validation retain the original source, discard partial outputs, revoke temporary URLs where owned by the active result, and present an actionable state. The state machine prevents cancelled or failed workflows from becoming completed downloads.
