# Phase 5 browser notes (working log)

## 2026-08-26 local OCR smoke test

Environment: Vite development server at `http://127.0.0.1:4178/?phase5=ocr-smoke-20260826-2`, Chromium sandbox, scanned fixture `tests/fixtures/scanned-fixture.pdf`.

The OCR + search tab loaded after adding same-origin bundled Tesseract.js resources. The plan reported 2 OCR pages, 0 skipped, and the recommendation `ocr first`. A real local worker run completed with 2 recognized pages, 0 skipped, 0 failed, 52 reported text characters, and 468 ms elapsed time. The recognized text was shown in the bounded local text viewer and deterministic understanding reported a likely scanned document, no heading-like lines, no table-like regions, and no retained sensitive values.

The first searchable-PDF authoring attempt exposed `WinAnsi cannot encode "\\n" (0x000a)` from a multiline OCR fragment. The authoring path was corrected to normalize line breaks/whitespace and use an ASCII fallback only when the standard WinAnsi font cannot encode a fragment. The retry succeeded: the searchable PDF was reopened, rendered on 2 representative pages, text/preservation checks passed, the result was marked `Validated`, and a browser download URL was offered. The preservation report showed page count, annotations, links, forms, metadata, JavaScript signals, and sampled geometry preserved; searchable text changed from not detected to detected as intended. The output filename was `scanned-fixture-searchable.pdf`.

The initial Phase 5 lazy-tab blank page was traced to default PDF.js imports in the new OCR services; both were changed to namespace imports. Production bundling then passed and the OCR tab loaded normally.

Pending checks: local search interaction, text-native no-OCR path, cancellation, chaining, privacy/resource request review, larger bounded pages, and final documentation/release gates.

## Text-native extraction and local search

The same refreshed app loaded `tests/fixtures/text-fixture.pdf` and reported detected text on 2 pages. The Phase 5 local plan correctly reported `0 OCR pages · 0 skipped · recommendation: not needed`. The action label changed to `Extract searchable text`; extraction completed locally with 2 recognized pages, 198 bounded characters, and no OCR worker invocation. The text viewer contained both page labels and source text, and the summary reported the source as searchable without creating a new searchable candidate.

After submitting the query `reproducible`, local search returned 2 page-aware matches with excerpts on pages 1 and 2. The deterministic understanding section displayed unknown document type, zero heading/table/sensitive signals, and the explicit no-retention note.

## Cancellation attempt

A scheduled safe-cancel click was issued against the scanned 2-page fixture. The fixture completed in approximately 488 ms before cancellation could interrupt a page, so the result remained a complete 2/2 OCR run with no searchable output authored. The UI cancellation control is present during progress; a larger high-resolution or bounded multi-page fixture is still required for an observable mid-run cancellation check.

## High-resolution cancellation

On `large-scanned-fixture.pdf` (5.1 MB, 3 pages), the OCR plan reported 3 OCR pages and no skipped pages. A scheduled cancel during the active worker run produced the visible status `OCR cancelled. The original PDF remains unchanged.` and `OCR cancelled; partial output discarded.` No recognized result or searchable download was offered. This provides the observable cancellation and recovery evidence that the small 2-page fixture could not provide.

## Resource boundary

The refreshed browser resource check returned `external: []` and `apiLike: []` after local OCR and cancellation. The observed application resources were same-origin Vite modules; no upload, cloud, storage, Google, CDN, or jsDelivr request was recorded. The OCR provider’s shipped resource URLs are configured under `/ocr/` for production and are not remote processing endpoints.

## Searchable result chaining

The 5.1 MB three-page scan completed OCR with 3/3 pages recognized, 669 bounded characters, and approximately 16.5 seconds elapsed. Searchable-PDF authoring passed with `large-scanned-fixture-searchable.pdf`, 3 representative renders validated, and preservation checks for page count, searchable text change, annotations, links, forms, metadata, JavaScript signals, and geometry. `Continue editing` replaced the current asset with the validated searchable file, re-inspected it as a 3-page text PDF, and exposed `Return to original PDF`; the original scan remained recoverable.
