# Phase 6: AI document intelligence

**Status:** Implemented as a bounded, provider-neutral semantic layer on top of the completed Phase 4 PDF analysis and Phase 5 browser-local OCR/text workflows.

## Purpose and boundary

Phase 6 adds semantic document understanding without replacing the local PDF pipeline. PDF bytes, images, PDF.js objects, xref data, annotations, forms, and original file metadata remain in the browser. The browser first performs the existing bounded inspection and OCR/text extraction work, then constructs a versioned `phase6-context-v1` object containing only selected page text, bounded blocks, deterministic structure signals, OCR status, and provenance references.

The deterministic mock provider is the default local test mode. It never makes a network request and is clearly labeled in the UI. The optional gateway provider is a separate server boundary. It receives bounded JSON context only after the user explicitly consents; it never receives the original PDF bytes. Provider credentials are read only by the gateway process and are never placed in client code, Vite variables, committed files, or browser storage.

> Phase 6 is evidence-backed assistance, not autonomous document action. AI output is untrusted until its operation shape, length, confidence, source status, and page/block provenance pass validation.

## Supported operations

| Operation | User-facing result | Evidence behavior |
|---|---|---|
| `classify` | Probabilistic document type, confidence, reason, and evidence | Type is constrained to the registry; unsupported types remain `unknown`. |
| `summarize` | Short and detailed summaries, key points, purpose, important dates, entities, amounts, and warnings | Factual points carry source references; uncertainty and conflicts remain visible. |
| `extract` | Versioned generic, invoice, receipt, contract, resume, or other schema fields, entities, and tables | Raw values are retained alongside cautious normalization; missing fields are not invented. |
| `ask` | Question answering from selected local context | `supported`, `not-found`, `conflicting`, and `unknown` states are explicit. |
| `structure` | Title, sections, tables, and form-like signals | The result does not claim pixel-perfect table or form reconstruction. |

The interface exposes separate Overview, Extract, Ask, and Structure tabs. Results are ephemeral and can be cleared. No AI result mutates a PDF, changes page order, downloads a file, submits a form, or triggers an external action.

## Local preparation and retrieval

`prepare-ai-document.ts` reuses the Phase 4 analysis, Phase 5 text/OCR result, and deterministic structure snapshot. Preparation is cached for the current source document. A later Q&A operation refreshes only its deterministic retrieval slice, so changing a question does not repeat the expensive base analysis or OCR work. Retrieval uses bounded token and phrase matching with deterministic ranking; no embeddings, vector database, multi-document index, or remote retrieval service is used.

The context builder caps the number of selected pages and blocks, page text, query length, total characters, and estimated tokens. It marks truncation and skipped/failed OCR pages explicitly. Every block receives a stable page-local identifier, bounded offsets, source type, confidence, and an excerpt used to construct source references.

## Validation and provenance

The browser validates requests before dispatch and validates responses before display. The gateway independently checks the same major invariants before returning a completed response: version and consent, allowed operation, bounded context, page and block limits, source types, confidence values, response lengths, operation-specific arrays, and source references. A reference must point to a page in the supplied context and, when a block identifier is present, to the exact supplied block and bounded offsets. A fake page, block, offset, source type, or operation is rejected.

Source chips in the result view navigate to the existing PDF page workspace. The workspace selects the referenced page and displays a verification message such as `Showing source page 2 from the verified AI reference.` This keeps the source document authoritative and makes the measured/inferred/AI/unknown distinction visible rather than presenting generated prose as ground truth.

## Workflow and tool registry

Phase 6 adds explicit `ai.document.prepare`, `ai.document.retrieve`, `ai.document.classify`, `ai.document.summarize`, `ai.document.extract`, `ai.document.ask`, `ai.document.structure`, `ai.document.analyze`, and `ai.document.validate` concepts to the domain workflow/tool model. AI operations are marked `server-assisted` because the optional gateway is the first external boundary; all PDF parsing, OCR, local retrieval, and context construction remain `browser-local`.

The standalone gateway is intentionally minimal. It accepts `POST /api/ai/document`, supports exact-origin CORS, rejects oversized or malformed requests, applies a small per-process IP rate bucket, does not log body content, and uses a centrally configured model. In local development, Vite proxies `/api/ai` to `127.0.0.1:8787`; the gateway must be started separately with `pnpm ai:gateway`. A static production build does not provide this server automatically and therefore needs a separately deployed gateway with an exact `SMARTDOCS_ALLOWED_ORIGIN` value.

## Local commands

```bash
pnpm install
pnpm dev
pnpm ai:gateway
pnpm typecheck
pnpm test
pnpm build
```

For a local configured provider, set `SMARTDOCS_AI_BASE_URL`, `SMARTDOCS_AI_API_KEY`, and optionally `SMARTDOCS_AI_MODEL` in the gateway process environment. The repository contains no provider key. The default model is centrally selected by the gateway and is not configurable from the browser.

## Intentional limitations

The implementation does not provide automatic language detection, translation, redaction, cloud OCR, universal PDF object rewriting, multi-document knowledge bases, autonomous actions, background queues, accounts, sharing, billing, or permanent AI result storage. The gateway’s in-memory rate limiter and single-process runtime are suitable for a minimal local or single-instance boundary, not a claim of distributed production-grade abuse prevention.
