# Phase 5 browser verification

Date: 2026-08-26  
Environment: Chromium sandbox, Vite development server at `http://127.0.0.1:4178`, browser-local SmartDocs workspace.

## Verification matrix

| Scenario | Fixture / action | Observed result | Status |
|---|---|---|---|
| OCR tab loading | Scanned PDF, lazy `OCR + search` tab | Tab loaded after the bundle was corrected to namespace-import PDF.js; no blank page remained | Pass |
| Browser-local English OCR | `tests/fixtures/scanned-fixture.pdf`, 2 pages | Local plan: 2 OCR pages, 0 skipped, `ocr first`; worker completed 2/2 pages, 0 failures, 52 bounded characters, about 468 ms | Pass |
| Searchable-PDF authoring | Same scanned fixture | First attempt exposed a WinAnsi newline encoding error; sanitizer/ASCII fallback was added. Retry produced `scanned-fixture-searchable.pdf`; PDF.js reopen, text, geometry, representative renders, and preservation checks passed | Pass after fix |
| Searchable-PDF preservation | Same generated candidate | 2 pages preserved; searchable text changed from not detected to detected; annotations, links, forms, metadata, JavaScript signals, and sampled geometry were preserved or remained explicitly unknown | Pass |
| Text-native no-OCR path | `tests/fixtures/text-fixture.pdf`, 2 pages | Plan: 0 OCR pages, 0 skipped, `not needed`; local PDF.js extraction returned 2 pages and 198 bounded characters without invoking the OCR worker; summary correctly labeled source as searchable | Pass |
| Local search | Query `reproducible` on extracted text | 2 page-aware matches with excerpts on pages 1 and 2 | Pass |
| Deterministic understanding | Text fixture and scanned fixture | Scanned fixture reported likely scanned document; text fixture reported unknown type; no sensitive values were displayed or retained | Pass |
| Cancellation | `tests/fixtures/large-scanned-fixture.pdf`, 5.1 MB, 3 pages | Safe cancel during active OCR produced `OCR cancelled. The original PDF remains unchanged.` and `OCR cancelled; partial output discarded.` No searchable output was offered | Pass |
| Resource/privacy boundary | `performance` resource inspection after OCR and cancellation | `external: []`; `apiLike: []`; no upload, cloud, storage, Google, CDN, or jsDelivr request observed | Pass |
| Existing Phase 1–4 flows | Inherited regression suite and browser workspace | Existing image, PDF core, optimization, page operation, preservation, and recovery paths remain mounted beside the OCR tab; automated regression suite remains green | Pass |

## Build and test evidence

The Phase 5 domain suite contains 44 passing tests. Strict TypeScript checking and production Vite bundling passed after the OCR integration and the searchable-PDF WinAnsi sanitizer fix. The OCR bundle is lazy-loaded; same-origin OCR worker/core/language resources are shipped under `public/ocr/` and no CDN fallback is configured by the provider.

## Limitations observed and retained intentionally

OCR is English-only in this milestone, uses a sequential bounded run of at most 24 planned pages, and does not perform automatic language detection. Recognition quality, reading order, Unicode coverage, handwriting support, table reconstruction, and exact text placement are not guaranteed. Text-native PDFs use extraction rather than unnecessary OCR. Search is bounded and ephemeral.

Searchable-PDF authoring is a conservative invisible text overlay over copied source pages. It does not rewrite xref tables, content streams, fonts, annotations, links, forms, bookmarks, embedded files, or JavaScript structures blindly. Encoding fragments that cannot be represented by the standard font are skipped rather than producing a false completeness claim. Generated candidates are rejected if critical preservation or validation checks fail.

The deterministic understanding layer reports heuristics only. It does not call an AI/LLM, persist sensitive values, redact documents, translate content, or infer facts beyond the bounded signals and OCR text available in memory. Hindi language data, cloud processing, server APIs, accounts, billing, batch queues, sharing, and DOCX/PPTX/XLSX conversion remain out of scope.

## Release checklist

- [x] OCR worker, core/WASM, and English traineddata use same-origin local resources.
- [x] Source PDF remains unchanged during OCR, authoring, cancellation, and validation failure.
- [x] Searchable output is offered only after PDF.js reopen, representative rendering, text, geometry, and preservation checks.
- [x] Local text extraction and page-aware search work without OCR on text-native PDFs.
- [x] OCR cancellation discards partial output.
- [x] No external/API-like browser requests were observed.
- [x] Final implementation and documentation remain within the Phase 5 boundary.
