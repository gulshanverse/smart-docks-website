# SmartDocs

## One file. One clear goal.

SmartDocs is an intent-first, local-first workspace for turning a human image or PDF goal into a measured and verified result. **Phase 6 adds bounded, provenance-validated AI document intelligence** on top of the completed Phase 1–5 image, PDF core, optimization, advanced analysis, OCR, searchable-PDF, local search, and deterministic understanding flows.

> Document bytes remain in local browser memory. SmartDocs does not upload image or PDF data to a server, API, cloud processor, database, analytics service, or remote storage service.

## What works now

| Capability | Status |
|---|---|
| Vite + React + strict TypeScript application foundation | Implemented |
| JPEG, PNG, and WebP image intake with signature checks | Implemented |
| PDF intake, signature validation, version/page/dimension inspection, bounded text and raster signals | Implemented |
| Separate browser-local image and PDF size limits | Implemented |
| PDF.js first-page preview, page workspace, lazy thumbnails, keyboard navigation, page metadata, and page hints | Implemented |
| Browser-local PDF delete, extract, reorder, and cumulative 90°/180°/270° rotation | Implemented |
| Merge two or more PDFs with ordered inputs and validated page-count output | Implemented |
| Split by exact comma-separated page ranges with honest invalid/out-of-range recovery | Implemented |
| PDF → JPG, PNG, or WebP page rendering with sequential bounded processing | Implemented |
| JPEG/PNG → PDF with ordered A4 fit-centered pages | Implemented |
| Conservative blank-page detection, review, and explicit removal | Implemented |
| Basic best-effort metadata snapshot/preservation for merge and supported optimization authoring | Implemented with limits |
| Unified core operation plans, tool registry, workflow steps, and output validation | Implemented |
| Validated PDF result previews, downloads, continuation into the page workspace, and recoverable originals | Implemented |
| Image target-size optimization with adaptive encoding, resize recovery, and byte/dimension validation | Implemented |
| PDF analysis with bounded text/raster sampling and optimization-opportunity reporting | Implemented |
| Scanned/image-heavy PDF quality-mode optimization with actual JPEG candidate measurement | Implemented |
| Mixed PDF hybrid path preserving detectable text pages and optimizing eligible raster-only pages | Implemented with limits |
| Exact PDF target-size parsing, target-achieved, best-effort, original-preserved, and cancellation states | Implemented |
| Bounded advanced PDF analysis: page roles, layout/structure hints, text samples/blocks, raster/vector/font signals, metadata, links, annotations, forms, bookmarks, embedded files, JavaScript signals, and page labels | Implemented with explicit Unknown states and sampling limits |
| OCR readiness assessment and bounded serializable document-intelligence snapshots that exclude document text content | Implemented |
| Preservation-risk planning, destructive-path blocking, candidate re-analysis, and source-versus-candidate feature comparison | Implemented |
| Browser-local English OCR in a pinned Tesseract.js worker with same-origin WASM/core/traineddata resources | Implemented with explicit page, language, and model limits |
| Deterministic OCR planning, page-level results, progress, cancellation, partial-failure reporting, and bounded text retention | Implemented |
| Validated searchable-PDF authoring with invisible text layer, original-page appearance preservation, reopen/render checks, and feature comparison | Implemented with font/encoding and geometry limits |
| Local OCR/text extraction, bounded page-aware search, `.txt` export, and deterministic document-understanding signals | Implemented |
| Bounded AI classification, summaries, schema-aware extraction, Q&A, structure, entities, tables, provenance, consent, and source-page navigation | Implemented with local mock and optional server gateway |
| Automatic language detection, translation, redaction, universal searchable-PDF reconstruction, universal object-level PDF compression, cloud OCR, backend queues, accounts, billing, batch queues, and public sharing | Not implemented |

## Smart PDF Optimization

Open **Optimize PDF** after adding a PDF. Enter a target such as `compress this PDF under 1MB`, choose **Maximum quality**, **Balanced**, **Smaller file**, or **Smallest practical**, and choose whether to preserve basic metadata when available. The parser uses decimal units: 1 KB is 1,000 bytes and 1 MB is 1,000,000 bytes.

The optimizer analyzes a bounded page sample before choosing a path. Text and vector PDFs are preservation-first and are not silently rasterized. Scanned PDFs are rendered one page at a time into JPEG-backed candidate PDFs. Mixed PDFs use a hybrid policy that can recompress eligible raster-only pages while copying pages with detectable text. Every candidate is measured and reopened with PDF.js before it can be selected.

The target is a hard byte constraint. SmartDocs shows **Target achieved** only when the measured result is at or below the requested target. If the documented quality floor cannot reach the target, the UI reports **Best effort** with the actual measured size and warning. If the input already satisfies the target, SmartDocs preserves the original bytes. A cancellation action stops future work and removes partial candidates without modifying the source.

The result comparison shows original and optimized first-page previews, byte sizes, reduction percentage, page count, target state, strategy, quality decision, candidate count, warnings, a real download, and `Continue editing this PDF`. After chaining, `Return to original PDF` remains available at the application level.

## Phase 4 advanced PDF document intelligence

Phase 4 adds a **bounded, deterministic inspection layer** rather than an AI or OCR engine. The browser opens the source with PDF.js, samples no more than the existing bounded page limit, and records compact signals for page geometry, text presence, bounded text blocks and samples, raster/vector operator hints, font-use hints, image/high-resolution hints, layout density, likely page roles, and document-level metadata and catalog features. Large documents report the exact page count while making the sampled-page boundary explicit.

The analysis service uses PDF.js catalog and page APIs for metadata, outlines, attachments, JavaScript-action signals, page labels, mark information, and annotations. A `null`, failed, or unavailable signal is represented as **Unknown** rather than treated as absence. PDF JavaScript is never executed. The generated intelligence snapshot retains identity, counts, roles, densities, feature statuses, OCR readiness, structure groups, recommendations, and risk level; it deliberately excludes full text, text samples, and text blocks.

Before a candidate can be selected, the candidate is reopened with PDF.js and re-analyzed. Changes to page count, detected searchable text, annotations, links, form fields, bookmarks, or embedded files make the candidate invalid. If all generated candidates fail, the original bytes are independently reopened and retained as the safe fallback. Destructive rasterization is blocked when the preservation plan cannot justify it. This is a preservation policy and validation layer, not universal object-level PDF rewriting; unsupported or weakly measurable features remain unchanged or cause a conservative fallback.

## Phase 5 OCR and searchable PDFs

Open **OCR + search** after adding a PDF. SmartDocs analyzes the source locally, makes a bounded plan, and either extracts existing searchable text or recognizes eligible scanned pages with the bundled English Tesseract.js worker. OCR is limited to 24 planned pages per run, processes pages sequentially, does not auto-detect languages, and retains only bounded text/results in browser memory. The original file is never overwritten.

A searchable candidate is created with pdf-lib by copying source pages and adding an invisible text layer mapped from OCR bounding boxes. The candidate is reopened through PDF.js, representative pages are rendered, candidate text is checked, page geometry is compared, and Phase 4 feature-preservation rules are applied before a download is offered. Encoding failures are handled conservatively; no unsafe content-stream, xref, font, form, annotation, or link surgery is attempted.

The OCR workspace also provides bounded local text extraction for text-native PDFs, page-aware search, clipboard copy when browser permission allows, `.txt` export, and deterministic document-understanding signals such as likely type, heading-like lines, table-like regions, signature-like regions, and sensitive-content presence. Sensitive matches are represented as kinds/counts only; values are not persisted or displayed as a redaction feature. This is deterministic document analysis, not AI/LLM understanding.

## PDF core behavior

The Phase 2 tools remain available beside optimization: ordered merge, exact-range split, PDF-to-image rendering, JPEG/PNG-to-PDF authoring, page delete/extract/reorder/rotate, and conservative blank-page review/removal. Split ranges are parsed exactly and are never silently clamped. Multi-page image conversion offers individual real downloads rather than an unimplemented ZIP dependency.

Blank-page detection measures bounded text, raster operators, and rendered non-background pixel occupancy. Candidates require user review and explicit confirmation before removal. Large blank-page scans use a deterministic sample of no more than 50 pages, and the UI states that additional pages require manual review.

WebP is supported for PDF-to-image rendering where browser canvas encoding succeeds. WebP-to-PDF is intentionally not offered because the verified pdf-lib authoring path does not safely embed WebP. Basic title, author, subject, creator, producer, and creation date fields are best-effort only. SmartDocs does not claim universal preservation or removal of forms, annotations, links, bookmarks, embedded files, JavaScript, unusual objects, or every metadata stream.

## Architecture

The domain layer in `src/domain/pdfs/document-analysis.ts` owns bounded Phase 4 document-analysis contracts, page-role/OCR-readiness heuristics, preservation-risk derivation, insights, advanced plans, and intelligence snapshots. `src/domain/pdfs/preservation.ts` owns source-versus-candidate feature comparison and critical-loss rejection. `src/domain/ocr/` owns provider-neutral OCR types, bounded planning, text search, deterministic understanding, and searchable-candidate validation. `src/domain/ai/` owns versioned provider-neutral contracts, schemas, bounded context, deterministic retrieval, prompts, normalization, provenance, and runtime validation. `src/features/ai/` owns local preparation, the deterministic mock, the credential-free gateway adapter, operation orchestration, and the accessible AI panel. `server/ai-gateway.mjs` is the minimal optional server boundary. `src/domain/pdfs/optimization.ts` owns optimization policies, candidate generation, target-aware ranking, reduction measurements, quality decisions, preservation-aware result construction, and best-effort output. `src/domain/intents/parse-intent.ts` owns deterministic image and PDF target-language parsing. `src/domain/tools/registry.ts` exposes only actual capabilities. `src/domain/workflows/types.ts` maps analysis, OCR planning/recognition, searchable-PDF authoring, local search, deterministic understanding, AI preparation/retrieval/operations/validation, optimization, preservation validation, comparison, and preview to explicit bounded steps.

PDF.js is the inspection and rendering authority. pdf-lib `1.17.1` is the structural authoring authority for copying pages, creating PDFs, setting supported basic metadata, embedding JPEG/PNG data, and appending the bounded invisible OCR text layer. Tesseract.js `7.0.0` is the pinned browser-local OCR adapter; its worker, core/WASM variants, and English traineddata are copied under same-origin `public/ocr/` resources so the provider does not use CDN defaults. Heavy optimization and OCR UI/services are lazy-loaded so the initial app bundle remains lean. Each generated PDF is reopened through PDF.js before success or download is offered.

## Privacy, security, and resource boundary

The application validates file signatures, enforces local file-size, page, OCR, text, context, query, and model-resource limits, rejects protected or unusable PDFs, constructs safe filenames, avoids filename HTML injection, and keeps PDF processing, OCR, retrieval, and context construction in the browser. PDF.js tasks are destroyed and canvases cleared in cleanup blocks; the reusable OCR worker is terminated on cancellation and unmount. Generated preview and download object URLs are revoked when replaced or unmounted. Bounded analysis and AI results avoid retaining unbounded full text, and PDF JavaScript is never executed. Same-origin OCR assets are static application resources, not a remote service. The optional gateway receives only explicit, bounded JSON context after consent; provider keys remain server-only. No database, cloud storage, authentication, billing, analytics, or permanent AI-result store is part of this milestone.

The quality policy is intentionally bounded. The optimizer does not reduce quality indefinitely to satisfy an arbitrary target. High-resolution scanned PDFs can still be CPU- and memory-intensive; users can cancel, and the result warnings explain when a target is not reachable.

## Repository structure

```text
.
├── index.html
├── package.json
├── pnpm-lock.yaml
├── public/ocr/         # same-origin Tesseract worker, core/WASM, and English data
├── server/ai-gateway.mjs # optional credential-bearing bounded AI gateway
├── src/
│   ├── App.tsx
│   ├── domain/
│   │   ├── ai/          # context, retrieval, schemas, provenance, prompts, validation
│   │   ├── files/       # typed assets and browser-local limits
│   │   ├── intents/     # deterministic image and PDF goal parsing
│   │   ├── pdfs/        # inspection, page, core, preservation, and optimization contracts
│   │   ├── ocr/         # provider-neutral OCR, planning, search, and understanding contracts
│   │   ├── tools/       # actual capability registry
│   │   └── workflows/   # typed workflow models and steps
│   ├── features/
│   │   ├── compression/ # local image encoding and candidate selection
│   │   ├── intake/      # signature, decode, and metadata inspection
│   │   ├── pdf/         # PDF.js workspace, rendering, authoring, optimization
│   │   ├── ocr/         # Tesseract adapter, recognition, extraction, searchable-PDF authoring
│   │   ├── ai/          # mock/gateway providers, preparation, orchestration, and panel
│   │   └── styles/      # design tokens and application styles
│   └── tests/           # deterministic domain and optimization tests
├── tests/fixtures/      # deterministic PDF and image fixtures
└── docs/                # architecture, library, and browser verification records
```

## Run locally

```bash
pnpm install
pnpm dev
```

To preview a production build:

```bash
pnpm build
pnpm preview
```

## Tests and quality checks

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

The automated suite covers byte units, image intent and candidate behavior, PDF signature and inspection foundations, bounded sampling, page operations, exact split ranges, merge and image-to-PDF plans, safe filenames, conservative blank classification, reviewed-removal invariants, unified workflow mappings, target parsing, quality policies, candidate generation/ranking, target-achieved and best-effort result states, core output validation, Phase 4 page roles and OCR readiness, preservation-risk blockers, source-versus-candidate critical-loss comparison, bounded intelligence snapshots, preservation-status mapping, advanced workflow steps, Phase 5 OCR planning/page bounds, searchable eligibility, local text extraction/search, sensitive-value exclusion, deterministic understanding, searchable-PDF workflows, candidate validation, and Phase 6 bounded context, deterministic retrieval, prompt-injection defense, schemas, normalization, workflow/tool boundaries, malformed results, and provenance rejection.

The deterministic fixture generators are `tests/fixtures/generate_pdf_fixtures.py` and `tests/fixtures/generate_phase6_fixtures.py`. They produce the earlier image/PDF fixtures, high-resolution scanned fixtures for measurable Phase 3 compression tests, the Phase 4 feature-preservation fixture, and synthetic Phase 6 invoice, receipt, contract, conflict, missing-field, prompt-injection, and table-like PDFs. No fixture embeds remote OCR, provider credentials, or model data. Existing tracked fixture binaries should not be regenerated casually because PDF metadata identifiers can create unrelated binary churn.

## Verification records

The Phase 3 architecture, quality policy, preservation boundary, resource lifecycle, and library references are in [`docs/phase-3-smart-pdf-optimization.md`](docs/phase-3-smart-pdf-optimization.md). Phase 4 architecture, PDF.js capability boundaries, preservation validation, and security/resource decisions are in [`docs/phase-4-advanced-pdf-engine.md`](docs/phase-4-advanced-pdf-engine.md), with browser evidence in [`docs/phase-4-browser-verification.md`](docs/phase-4-browser-verification.md). Phase 5 OCR engine research is recorded in [`docs/phase-5-ocr-engine-research.md`](docs/phase-5-ocr-engine-research.md), with the architecture and browser records in the Phase 5 documents. Phase 6 architecture, security, provider research, and browser evidence are in [`docs/phase-6-ai-document-intelligence.md`](docs/phase-6-ai-document-intelligence.md), [`docs/phase-6-ai-security.md`](docs/phase-6-ai-security.md), [`docs/phase-6-provider-research.md`](docs/phase-6-provider-research.md), and [`docs/phase-6-browser-verification.md`](docs/phase-6-browser-verification.md).

## Roadmap boundary

Phase 6 browser-local OCR plus optional bounded AI document intelligence is the current milestone. It establishes English OCR, local text extraction/search, validated searchable-PDF authoring, deterministic structure signals, provenance-validated classification/summaries/extraction/Q&A/structure, explicit external consent, and source-page navigation without pretending to provide automatic language detection, translation, redaction, autonomous actions, or universal PDF object rewriting. The next recommended work remains separate: additional language packs, richer PDF editing, cloud processing beyond the minimal gateway, cloud storage, batch execution, public sharing, authentication, billing, analytics, and multi-document knowledge bases.

## License

This project is licensed under the MIT License. pdf-lib `1.17.1` is used under its MIT license. Tesseract.js `7.0.0` is used under Apache-2.0, and its bundled English language data is distributed under the package’s documented MIT license. PDF.js is used for browser-side parsing and rendering under its project license. Library research and source links are documented in [`docs/phase-2c-library-research.md`](docs/phase-2c-library-research.md), [`docs/phase-5-ocr-engine-research.md`](docs/phase-5-ocr-engine-research.md), and the Phase 3/4 architecture documents.
