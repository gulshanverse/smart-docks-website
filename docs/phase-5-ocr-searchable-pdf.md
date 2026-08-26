# Phase 5 OCR and searchable-PDF architecture

## Scope

Phase 5 extends SmartDocs’s completed browser-local Phase 4 PDF intelligence foundation with a bounded OCR and document-understanding workflow. The milestone is intentionally local, deterministic at the planning/understanding layer, preservation-first, and recoverable. It does not add a server, API, account, cloud queue, batch service, analytics, billing, public sharing, or AI/LLM provider.

The user’s original PDF remains an immutable `File` input. OCR and searchable-PDF outputs are new browser-memory files. A generated result is not offered for download until it has been reopened with PDF.js, rendered on representative pages, checked for extracted text and geometry, and compared against the source feature signals.

## OCR provider decision

SmartDocs uses **Tesseract.js `7.0.0`** through a provider-neutral adapter. Tesseract.js supplies a browser worker and WebAssembly port of Tesseract, while PDF.js remains responsible for opening and rasterizing PDF pages. This separation is deliberate: the Tesseract.js project documents that its wrapper does not support PDF files directly, so the application recognizes rendered page images rather than passing PDF bytes to the OCR engine.

The repository ships the worker script, the selected LSTM/SIMD core resources, and English traineddata under same-origin `public/ocr/` paths. The provider passes `workerPath`, `corePath`, and `langPath` explicitly; it never relies on Tesseract.js’s CDN defaults. The worker is reused for the sequential pages in one run and terminated during cancellation or cleanup. English is the only enabled language in this milestone. Hindi is represented in the UI as a planned local pack, not as an available runtime capability.

The selection was made after comparing Tesseract.js with Scribe.js and Ocrad.js. Scribe.js’s browser searchable-PDF capability is technically relevant but its AGPL-3.0 license requires a separate distribution decision for this MIT project. Ocrad.js is GPL-3.0 and has a narrower, older implementation profile. The detailed comparison, package metadata, and source URLs are recorded in [`phase-5-ocr-engine-research.md`](phase-5-ocr-engine-research.md).

## Bounded domain contracts

Provider-neutral contracts live in `src/domain/ocr/types.ts`. They describe language selections, page-level status, bounded words/lines/blocks/boxes, confidence as engine-reported or unavailable, page failures, recognition progress, OCR plans, searchable-PDF validation, local search results, and deterministic understanding results. The contracts preserve explicit `unknown`, `skipped`, `failed`, `cancelled`, and `not-needed` states rather than converting missing measurements into success.

The planner in `src/domain/ocr/planning.ts` consumes Phase 4 page roles, OCR readiness, text presence, and exact page counts. It skips pages where searchable text makes OCR unnecessary, plans only eligible pages, and stops at `MAX_OCR_PAGES_PER_RUN` (24). A document beyond the run bound receives an explicit review-limit outcome instead of silently processing only a prefix. Language availability is explicit; automatic language detection is not implemented.

OCR results are bounded by page count, maximum page text, maximum blocks/lines/words/boxes, and compact progress details. Recognition is sequential so memory pressure and cancellation behavior remain understandable. A page-level failure is retained as a bounded status and does not erase successful pages, but searchable-PDF authoring is blocked unless every planned page completes.

## Browser-local orchestration

`src/features/ocr/recognize-pdf.ts` opens the source using the same PDF.js worker convention as Phase 4, renders only planned pages at a bounded scale, transfers each canvas to the local Tesseract worker, maps recognized output into the provider-neutral contract, and clears the canvas after each page. The reusable worker reports initialization, language loading, recognition progress, and completion without logging document text. An `AbortSignal` terminates work safely; partial OCR results are returned only as an internal cancelled/failure state and are never offered as a searchable download.

`src/features/ocr/extract-pdf-text.ts` provides a no-OCR path for text-native PDFs. It uses PDF.js page text content, caps retained text, and reports per-page extraction status through the same result model. This means the OCR tab can support local copy/search for an already-searchable PDF without needlessly invoking the OCR engine.

## Searchable-PDF authoring

`src/features/ocr/create-searchable-pdf.ts` uses pdf-lib only through public page/font/operator APIs. It loads and copies the original pages, embeds a standard font, maps OCR pixel boxes into each source page’s point geometry, and appends invisible text operators. The visible raster/page appearance is not replaced. Text is normalized conservatively for line breaks and WinAnsi encoding; fragments that cannot be represented safely are skipped rather than mutating PDF internals or pretending complete fidelity.

Authoring uses a bounded progress/cancellation path. The candidate is saved to a new `File` with a sanitized `-searchable.pdf` name, reopened with PDF.js, and checked for page count, candidate text presence, sampled geometry/orientation, planned-page completion, and representative first/middle/last renders. The Phase 4 source-versus-candidate comparison blocks critical loss of detected text, annotations, links, forms, bookmarks, embedded files, or page count. Unknown source signals remain unknown and are not falsely reported as preserved or absent.

## Deterministic document understanding

`src/domain/ocr/understanding.ts` derives compact heuristics from Phase 4 signals and bounded OCR text. It can report a likely document type such as invoice, headings or section-like lines, table-like regions, signature-like regions, and sensitive-content signal kinds/counts. It does not retain sensitive values, perform redaction, or call an AI/LLM model. The result includes a `futureAiBoundary: "not-invoked"` marker to make that boundary inspectable.

`src/domain/ocr/search.ts` provides case-insensitive page-aware search over bounded OCR/extracted text with capped matches and excerpts. The UI supports local search, clipboard copy when browser permission allows, and `.txt` download. Search state is ephemeral React/browser memory and is not persisted.

## UI and chaining

`PdfOcrPanel` is mounted as an accessible `OCR + search` tab in `PdfCoreTools`. It exposes the local language choice, plan disclosure, real progress, safe cancellation, OCR/extraction action, searchable-PDF action only after successful recognition, local text viewer, search results, deterministic understanding signals, and validated download. `Continue editing` sends the newly created `File` through the existing PDF intake path so the Phase 2–4 page workspace can continue operating on the validated result while the application preserves a recoverable original source.

All controls are keyboard-accessible native buttons, labels, selects, inputs, textarea, progress, and disclosure summaries. The original merge, split, page, blank-page, image conversion, and optimization tabs remain unchanged and are still available beside OCR.

## Security and privacy

All PDF bytes, rendered canvases, OCR images, recognized text, and output files remain in browser memory. The application performs no upload and has no backend. Same-origin static OCR resources are application assets, not remote processing. PDF JavaScript is never executed. The OCR worker receives rendered page images, not a network destination, and no full text is logged. Sensitive-content analysis reports only bounded kinds/counts and explicitly does not redact or persist values.

Generated object URLs are revoked when replaced, when the source file changes, and on unmount. PDF.js loading/rendering tasks are cancelled or destroyed in cleanup paths. The OCR worker is terminated on cancellation and unmount. Candidate files are discarded when validation fails. Filename construction continues to use the existing safe local helper.

## Performance and limits

The source PDF remains subject to the existing 50 MiB browser-local input limit. OCR is capped at 24 planned pages per run, operates sequentially, renders at a bounded scale, and stores bounded text/results. English traineddata and the local OCR resources add a measurable static payload; the first-run worker/model initialization is intentionally visible through progress. Large or high-resolution documents can still be CPU- and memory-intensive; users can cancel, and the UI does not claim unbounded processing.

The OCR provider does not guarantee perfect recognition, reading order, Unicode coverage, table reconstruction, handwriting recognition, or exact visual text placement. pdf-lib’s standard-font layer is a conservative searchable overlay, not a complete PDF text-object reconstruction engine. If validation fails, no partial searchable file is offered.

## Explicitly out of scope

This milestone does not implement Hindi runtime data, automatic language detection, handwriting OCR, image redaction, translation, semantic AI/LLM extraction, cloud OCR, server-side processing, batch queues, DOCX/PPTX/XLSX conversion, or universal editing of PDF xref/content/font/annotation/form structures. Existing Phase 4 preservation rules remain the authority for blocking operations that cannot be measured safely.

## References

1. [Tesseract.js official repository and README](https://github.com/naptha/tesseract.js/)
2. [Tesseract.js local installation documentation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
3. [Tesseract.js package metadata](https://www.npmjs.com/package/tesseract.js)
4. [Tesseract OCR official repository](https://github.com/tesseract-ocr/tesseract)
5. [Tesseract.js language-data packages](https://www.npmjs.com/package/@tesseract.js-data/eng)
6. [PDF.js API documentation](https://mozilla.github.io/pdf.js/api/)
7. [pdf-lib API and repository](https://github.com/Hopding/pdf-lib)
