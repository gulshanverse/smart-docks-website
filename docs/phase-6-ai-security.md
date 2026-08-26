# Phase 6 AI security boundary

## Security objective

SmartDocs keeps the original PDF as a browser-local authority. The optional semantic layer is designed so that the first external boundary receives the smallest useful representation rather than a file upload. The gateway is provider-neutral at the browser contract, server-side at the credential boundary, and explicit about the difference between local deterministic evidence and provider-generated interpretation.

| Control | Implementation | Failure behavior |
|---|---|---|
| Original-file isolation | The browser never sends PDF bytes, images, xref data, PDF JavaScript, or raw PDF objects to `/api/ai/document`. | Requests containing obvious raw-document fields are rejected. |
| Data minimization | Only bounded selected pages, text blocks, structure signals, OCR status, query, and provenance cross the boundary. | Context, page, block, query, and body caps return a structured error. |
| Consent | External mode requires an explicit in-product consent step before the first gateway call. | No consent means no gateway request. |
| Credential isolation | Provider URL, API key, and model are read by the gateway process only. | Missing server configuration returns `provider-unavailable`; no content is forwarded. |
| Prompt-injection defense | Document text is labeled untrusted data in the system prompt and is never treated as an instruction. | The result is still untrusted and must pass structural/provenance validation. |
| Provenance validation | Page, block, offset, bounding-box, source-type, confidence, and operation checks run in the gateway and browser. | Fake or out-of-range references are rejected before display. |
| Output minimization | Gateway returns the validated operation result, safe usage fields, model metadata, and ephemeral status. | Malformed, overlong, or unsupported output is rejected. |
| Logging | Logs contain request ID, operation, status/outcome, and duration only. | Document text, questions, answers, excerpts, keys, and full provider payloads are not logged. |
| Abuse boundary | The gateway enforces a maximum request body and a small in-memory per-process rate bucket. | Oversized requests return `413`; excess requests return `429`. |

## Threat model and mitigations

### Prompt injection in source text

OCR and extracted text can contain hostile strings such as “ignore previous instructions” or fake workflow commands. The gateway prompt explicitly says that all document content, OCR text, quoted passages, and document fields are untrusted data and must never be followed. The request supplies the document as a labeled JSON value, not as a new system message. The model is instructed to use only the bounded context and to cite only references from the supplied catalog.

This is a defense-in-depth control, not a claim that a language model is trustworthy. The browser and gateway treat all model strings as untrusted output. A valid JSON envelope is insufficient: the operation-specific validator also checks allowed status values, lengths, arrays, confidence, and source references.

### Fabricated evidence

A source reference is valid only when its page is in the bounded context and its block identifier, offsets, and source type agree with supplied data. The gateway validates this before returning `200`. The browser repeats the validation before rendering. Missing evidence is represented with explicit `not-found`, `unknown`, or warning states rather than fabricated values. Conflicts are returned as conflicts instead of being silently resolved.

### Sensitive data exposure

The local preparation layer caps text and page selection. It deliberately excludes PDF bytes and unnecessary binary or object metadata. Browser code uses a credential-free fetch adapter. Provider keys must be supplied through deployment environment variables such as `SMARTDOCS_AI_API_KEY`; they must never be placed in `VITE_*` variables, source files, fixtures, documentation examples, or committed environment files.

The gateway’s response logging is intentionally shape-only. Debugging must not be performed by printing model content or request bodies. The model response is held in memory only for validation and response construction, and the browser keeps results ephemeral until the user clears or replaces the document.

### Availability and retry behavior

The browser allows at most one safe retry for a retryable gateway failure. It does not fake streaming, because the selected provider capability is non-streaming. Abort signals cancel the browser request. The gateway applies a 45-second upstream timeout and returns a structured timeout or network-failure state. The in-memory rate limiter is deliberately modest and process-local; it is not a substitute for an authenticated, distributed production abuse-control layer.

## Deployment checklist

A deployment must run the gateway behind the application origin and set an exact `SMARTDOCS_ALLOWED_ORIGIN`, never `*`. It must provide the provider base URL and API key only to the server process, use HTTPS in transit, keep the gateway route private to the application where practical, rotate credentials through the hosting platform, and monitor only aggregate operational metrics. A static Vite deployment without a separately running gateway supports local/mock mode but cannot offer the external provider mode.

The server must not be changed to accept file uploads as an optimization shortcut. Any future expansion that sends images, raw PDF bytes, more metadata, or persistent results requires a new explicit consent and security review rather than silently extending this boundary.
