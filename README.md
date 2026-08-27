# SmartDocs

## One file. One clear goal.

SmartDocs is an intent-first, local-first workspace for turning human image, PDF, or supported Office document goals into measured and verified results. **Phase 16 hardens the complete Phase 1–15 product into a defensible v1.0 release candidate** with audit coverage, production checks, security review, performance review, end-to-end browser verification, and fixed persistent-record cleanup.

> Document bytes remain in local browser memory. Local PDF authoring does not upload source files. Optional Phase 6 AI understanding uses only an explicit, bounded JSON context through a separately configured gateway; provider keys remain server-side.

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
| DOCX/PPTX/XLSX intake with bounded OOXML package validation and local classification | Implemented with explicit limits |
| DOCX bounded text and interpreted structure preview with TXT export | Implemented with fidelity limits |
| PPTX bounded slide text and structural slide preview with TXT export | Implemented with fidelity limits |
| XLSX bounded sheet/cell preview, hidden-sheet state, formulas, ranges, and TXT export | Implemented with fidelity limits |
| Macro-enabled package warnings, legacy binary Office rejection, external-link/OLE signals, and decompression bounds | Implemented with explicit limits |
| Office → PDF faithful conversion | Unavailable until an independently verified browser-local renderer exists |
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
| Reviewable Phase 7 action plans with stable page identities, coordinate validation, text-match discovery, redaction, highlight, annotations, crop, resize, basic metadata actions, cancellation, validated outputs, recovery, and bounded undo/redo | Implemented with explicit limits |
| Shared Phase 8 conversion planner with deterministic intent parsing, capability discovery, ordered image collections, PDF page selection, quality/resolution/page geometry settings, target-size measurement, collision-safe names, progress, cancellation, and unified result history | Implemented with explicit limits |
| Browser-local PDF → JPEG/PNG/WebP page conversion with bounded resolution and per-page validation | Implemented |
| Browser-local JPEG/PNG/WebP → PDF and image-to-image conversion with explicit fit/background/transparency behavior | Implemented with explicit limits |
| Unified document workspace with format-aware overview, capability discovery, normalized intent, reviewable plans, explicit state transitions, and specialized-engine handoff | Implemented with explicit limits |
| Phase 11 bounded multi-document collections with add/remove/reorder/select, deterministic compatibility, collection intent, dependency graphs, controlled PDF merge, ordered image-to-PDF, bounded PDF/Office search, validated outputs, per-session history, and local-only limits | Implemented with explicit limits |
| Phase 12 natural-language workflow goals, versioned DAG contracts, topological validation, visual step review, collection `FOR EACH` planning, bounded scheduler, cancellation/failure propagation, privacy disclosure, artifact provenance, and specialized-engine handoff | Implemented with explicit limits |
| Phase 13 structured extraction with bounded schemas, deterministic-first field extraction, normalization, validation, field-level provenance, confidence/warnings, duplicate/conflict detection, collection aggregation, JSON/CSV export, and reviewable Extract Data workspace | Implemented with explicit limits |
| Phase 14 resumable automation sessions, metadata-only checkpoints, failure isolation, safe retries, human review, quality gates, reconciliation, evidence graph, audit timeline, partial-result preservation, and final package manifests | Implemented with explicit limits |
| Phase 15 persistent local projects with IndexedDB storage, explicit document-save consent, immutable originals, document versions, workflow metadata, history, safe metadata import/export, cleanup, and recovery | Implemented with explicit limits |
| Phase 16 final production hardening, source inventory, regression/integration audit, security audit, performance audit, browser verification, persistent-record cleanup, release-readiness decision, and v1.0 candidate documentation | Completed within documented local-first scope |
| Faithful Office rendering/round-trips, Office → PDF conversion, HTML conversion, ZIP packaging, object-level PDF compression, cloud OCR, autonomous actions, backend queues, accounts, billing, and public sharing | Not implemented or explicitly unavailable |

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

The Phase 2 tools remain available beside optimization: ordered merge, exact-range split, PDF-to-image rendering, JPEG/PNG-to-PDF authoring, page delete/extract/reorder/rotate, and conservative blank-page review/removal. Split ranges are parsed exactly and are never silently clamped. Phase 8 consolidates the PDF/image conversion seam into the Convert tab with explicit pages, format, quality, resolution, page geometry, target-size, ordering, progress, and validated result controls. Multi-page image conversion offers individual real downloads rather than an unimplemented ZIP dependency.

Blank-page detection measures bounded text, raster operators, and rendered non-background pixel occupancy. Candidates require user review and explicit confirmation before removal. Large blank-page scans use a deterministic sample of no more than 50 pages, and the UI states that additional pages require manual review.

WebP is supported for PDF-to-image rendering where browser canvas encoding succeeds. WebP-to-PDF is supported through a browser-local canvas normalization to PNG before pdf-lib authoring; the original WebP metadata is not preserved. Basic title, author, subject, creator, producer, and creation date fields are best-effort only. SmartDocs does not claim universal preservation or removal of forms, annotations, links, bookmarks, embedded files, JavaScript, unusual objects, or every metadata stream.

## Architecture

The domain layer in `src/domain/pdfs/document-analysis.ts` owns bounded Phase 4 document-analysis contracts, page-role/OCR-readiness heuristics, preservation-risk derivation, insights, advanced plans, and intelligence snapshots. `src/domain/pdfs/preservation.ts` owns source-versus-candidate feature comparison and critical-loss rejection. `src/domain/ocr/` owns provider-neutral OCR types, bounded planning, text search, deterministic understanding, and searchable-candidate validation. `src/domain/ai/` owns versioned provider-neutral contracts, schemas, bounded context, deterministic retrieval, prompts, normalization, provenance, and runtime validation. `src/features/ai/` owns local preparation, the deterministic mock, the credential-free gateway adapter, operation orchestration, and the accessible AI panel. `src/domain/actions/` owns Phase 7 action contracts, planning, coordinate mapping, and bounded undo/redo history; `src/features/pdf/PdfActionsPanel.tsx` owns review, confirmation, deterministic authoring, redaction checks, and recovery. `src/domain/conversions/` owns Phase 8 format contracts, capability discovery, intent planning, target-size semantics, validation, and deterministic naming. `src/features/conversion/` owns image/PDF adapters and the lazy Convert panel. `server/ai-gateway.mjs` is the minimal optional server boundary. `src/domain/pdfs/optimization.ts` owns optimization policies, candidate generation, target-aware ranking, reduction measurements, quality decisions, preservation-aware result construction, and best-effort output. `src/domain/intents/parse-intent.ts` owns deterministic image, PDF, and conversion goal parsing. `src/domain/tools/registry.ts` exposes only actual capabilities. `src/domain/workflows/types.ts` maps conversion intent/capability/plan/preview/execute/validate/cleanup/history alongside analysis, OCR planning/recognition, searchable-PDF authoring, local search, deterministic understanding, AI preparation/retrieval/operations/validation, optimization, preservation validation, comparison, and preview to explicit bounded steps. `src/domain/unified/` owns Phase 10 normalized intent, capability discovery, workflow-plan composition, provenance/result contracts, and the invalid-transition-resistant workflow state machine. `src/features/unified/UnifiedWorkspace.tsx` owns the shared overview, goal entry, plan review, processing-boundary display, confirmation, and state feedback while handing execution to specialized engines. `src/domain/collections/` owns Phase 11 collection contracts, compatibility evaluation, duplicate fingerprints, bounded collection limits, workflow graph planning, and collection state transitions. `src/features/collections/` owns multi-file intake, selection/reordering, controlled PDF/image execution, bounded cross-document search, validated individual downloads, and memory-only session history. `src/domain/workflows/orchestration.ts` owns the Phase 12 versioned workflow contract, deterministic single-asset and collection DAG planning, `FOR EACH` adaptation, topological validation, state transitions, conditions, ephemeral artifacts, and bounded scheduler. `src/features/workflows/WorkflowWorkspace.tsx` owns the goal entry, dependency graph, step review, privacy disclosure, run handoff, and session history. `src/domain/extraction/` owns the Phase 13 versioned contracts, bounded reusable schemas, deterministic extraction, normalization, provenance validation, collection aggregation, and exports. `src/features/extraction/` owns the deterministic extraction planner and first-class Extract Data review workspace. `src/domain/automation/` owns the Phase 14 versioned automation contract, metadata-only sessions, checkpoints, recovery, retry policies, quality gates, reconciliation, evidence links, audit events, and final manifests. `src/features/automation/AutomationWorkspace.tsx` owns the human-supervised automation review and recovery surface. `src/domain/projects/` owns the Phase 15 versioned project, document, version, storage, import/export, retention, and migration contracts. `src/features/storage/indexeddb.ts` provides asynchronous IndexedDB persistence, and `src/features/projects/ProjectsWorkspace.tsx` owns project creation, explicit save, document library, history, metadata export/import, and safe deletion. Phase 16 audit findings and release controls are recorded in [`docs/phase-16-final-production-hardening.md`](docs/phase-16-final-production-hardening.md), [`docs/phase-16-security-audit.md`](docs/phase-16-security-audit.md), [`docs/phase-16-performance-audit.md`](docs/phase-16-performance-audit.md), [`docs/phase-16-browser-verification.md`](docs/phase-16-browser-verification.md), and [`docs/phase-16-release-readiness.md`](docs/phase-16-release-readiness.md). See also [`docs/phase-13-advanced-extraction.md`](docs/phase-13-advanced-extraction.md), [`docs/phase-14-automation-reliability.md`](docs/phase-14-automation-reliability.md), [`docs/phase-15-persistent-project-workspace.md`](docs/phase-15-persistent-project-workspace.md), and [`docs/phase-15-security.md`](docs/phase-15-security.md).

PDF.js is the inspection and rendering authority. pdf-lib `1.17.1` is the structural authoring authority for copying pages, creating PDFs, setting supported basic metadata, embedding JPEG/PNG data, and appending the bounded invisible OCR text layer. Tesseract.js `7.0.0` is the pinned browser-local OCR adapter; its worker, core/WASM variants, and English traineddata are copied under same-origin `public/ocr/` resources so the provider does not use CDN defaults. Heavy optimization and OCR UI/services are lazy-loaded so the initial app bundle remains lean. Each generated PDF is reopened through PDF.js before success or download is offered.

## Privacy, security, and resource boundary

The application validates file signatures, enforces local file-size, page, OCR, text, context, query, action-count, coordinate, conversion-file/page/pixel, and model-resource limits, rejects protected or unusable PDFs, constructs safe filenames, avoids filename HTML injection, and keeps PDF processing, OCR, retrieval, context construction, Phase 7 authoring, and Phase 8 conversion in the browser. PDF.js tasks are destroyed and canvases cleared in cleanup blocks; the reusable OCR worker is terminated on cancellation and unmount. Generated preview and download object URLs are revoked when replaced or unmounted. Bounded analysis and AI results avoid retaining unbounded full text, and PDF JavaScript is never executed. Same-origin OCR assets are static application resources, not a remote service. The optional gateway receives only explicit, bounded JSON context after consent; provider keys remain server-only. Phase 7 proposals are never executed directly, and redaction candidates require review, confirmation, reopen checks, and text-absence validation where exact text is supplied. No database, cloud storage, authentication, billing, analytics, or permanent AI-result store is part of this milestone.

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
│   │   ├── actions/     # action plans, coordinate mapping, proposal checks, undo/redo history
│   │   ├── ai/          # context, retrieval, schemas, provenance, prompts, validation
│   │   ├── conversions/ # format contracts, capabilities, planning, validation, naming
│   │   ├── office/      # bounded Office asset, analysis, and capability contracts
│   │   ├── files/       # typed assets and browser-local limits
│   │   ├── intents/     # deterministic image and PDF goal parsing
│   │   ├── pdfs/        # inspection, page, core, preservation, and optimization contracts
│   │   ├── ocr/         # provider-neutral OCR, planning, search, and understanding contracts
│   │   ├── tools/       # actual capability registry
│   │   ├── workflows/   # typed workflow models and steps
│   │   ├── unified/     # single-document orchestration contracts and state machine
│   │   └── collections/ # multi-document contracts, compatibility, limits, and planning
│   ├── features/
│   │   ├── compression/ # local image encoding and candidate selection
│   │   ├── intake/      # signature, decode, and metadata inspection
│   │   ├── pdf/         # PDF.js workspace, rendering, authoring, optimization, safe actions
│   │   ├── ocr/         # Tesseract adapter, recognition, extraction, searchable-PDF authoring
│   │   ├── ai/          # mock/gateway providers, preparation, orchestration, and panel
│   │   ├── conversion/  # image/PDF adapters and universal conversion panel
│   │   ├── office/      # lazy OOXML package reader, format inspection, and Office workspace
│   │   ├── collections/ # controlled collection intake, execution, search, and history
│   │   └── styles/      # design tokens and application styles
│   └── tests/           # deterministic domain and optimization tests
├── tests/fixtures/      # deterministic PDF, image, and synthetic Office fixtures
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

The automated suite covers byte units, image intent and candidate behavior, PDF signature and inspection foundations, bounded sampling, page operations, exact split ranges, merge and image-to-PDF plans, safe filenames, conservative blank classification, reviewed-removal invariants, unified workflow mappings, target parsing, quality policies, candidate generation/ranking, target-achieved and best-effort result states, core output validation, Phase 4 page roles and OCR readiness, preservation-risk blockers, source-versus-candidate critical-loss comparison, bounded intelligence snapshots, preservation-status mapping, advanced workflow steps, Phase 5 OCR planning/page bounds, searchable eligibility, local text extraction/search, sensitive-value exclusion, deterministic understanding, searchable-PDF workflows, candidate validation, Phase 6 bounded context, deterministic retrieval, prompt-injection defense, schemas, normalization, workflow/tool boundaries, malformed results, and provenance rejection, Phase 7 action identity, conflict, geometry, redaction workflow, planner, and history behavior, Phase 8 conversion intent parsing, capability discovery, page-range planning, batch limits, explicit conflicts, ordered image collections, naming, signatures, output validation, target measurement, size-growth reporting, and workflow steps, Phase 9 bounded Office ZIP safety, OOXML fixture inspection, and Office workflow contracts, and Phase 11 collection compatibility, duplicate metadata, bounded plans, dependency transitions, ordered batch planning, and collection result contracts.

The deterministic fixture generators are `tests/fixtures/generate_pdf_fixtures.py`, `tests/fixtures/generate_phase6_fixtures.py`, `tests/fixtures/generate_phase7_fixtures.py`, and `tests/fixtures/generate_phase9_fixtures.py`. They produce the earlier image/PDF fixtures, high-resolution scanned fixtures for measurable Phase 3 compression tests, the Phase 4 feature-preservation fixture, synthetic Phase 6 invoice, receipt, contract, conflict, missing-field, prompt-injection, and table-like PDFs, and a two-page Phase 7 redaction fixture with fictional values. The Phase 7 fixture supports local text-match discovery, page-one redaction, output validation, and unchanged-page recovery checks. Phase 8 reuses the deterministic `image-a.png`, `image-b.jpg`, `image-c.png`, `multipage-fixture.pdf`, and `landscape-fixture.pdf` corpus for conversion checks. Phase 9 adds synthetic `phase9-word.docx`, `phase9-presentation.pptx`, and `phase9-workbook.xlsx` packages with bounded text, slides, sheets, formulas, hidden-sheet, merged-cell, and warning signals. Phase 10 adds deterministic planner/state tests. No fixture embeds remote OCR, provider credentials, or model data. Existing tracked fixture binaries should not be regenerated casually because PDF metadata identifiers can create unrelated binary churn.

## Verification records

The Phase 3 architecture, quality policy, preservation boundary, resource lifecycle, and library references are in [`docs/phase-3-smart-pdf-optimization.md`](docs/phase-3-smart-pdf-optimization.md). Phase 4 architecture, PDF.js capability boundaries, preservation validation, and security/resource decisions are in [`docs/phase-4-advanced-pdf-engine.md`](docs/phase-4-advanced-pdf-engine.md), with browser evidence in [`docs/phase-4-browser-verification.md`](docs/phase-4-browser-verification.md). Phase 5 OCR engine research is recorded in [`docs/phase-5-ocr-engine-research.md`](docs/phase-5-ocr-engine-research.md), with the architecture and browser records in the Phase 5 documents. Phase 6 architecture, security, provider research, and browser evidence are in [`docs/phase-6-ai-document-intelligence.md`](docs/phase-6-ai-document-intelligence.md), [`docs/phase-6-ai-security.md`](docs/phase-6-ai-security.md), [`docs/phase-6-provider-research.md`](docs/phase-6-provider-research.md), and [`docs/phase-6-browser-verification.md`](docs/phase-6-browser-verification.md). Phase 7 action architecture, security, and browser evidence are in [`docs/phase-7-safe-document-actions.md`](docs/phase-7-safe-document-actions.md), [`docs/phase-7-action-security.md`](docs/phase-7-action-security.md), and [`docs/phase-7-browser-verification.md`](docs/phase-7-browser-verification.md). Phase 8 conversion architecture, security, and browser evidence are in [`docs/phase-8-universal-conversion.md`](docs/phase-8-universal-conversion.md), [`docs/phase-8-conversion-security.md`](docs/phase-8-conversion-security.md), and [`docs/phase-8-browser-verification.md`](docs/phase-8-browser-verification.md). Phase 9 Office research, architecture, security, and browser evidence are in [`docs/phase-9-office-library-research.md`](docs/phase-9-office-library-research.md), [`docs/phase-9-office-document-engine.md`](docs/phase-9-office-document-engine.md), [`docs/phase-9-office-security.md`](docs/phase-9-office-security.md), and [`docs/phase-9-office-browser-verification.md`](docs/phase-9-office-browser-verification.md). Phase 10 unified workspace, workflow, security, and browser evidence are in [`docs/phase-10-unified-workspace.md`](docs/phase-10-unified-workspace.md), [`docs/phase-10-workflow-architecture.md`](docs/phase-10-workflow-architecture.md), [`docs/phase-10-security.md`](docs/phase-10-security.md), and [`docs/phase-10-browser-verification.md`](docs/phase-10-browser-verification.md). Phase 11 collection architecture, security, and browser evidence are in [`docs/phase-11-collection-workspace.md`](docs/phase-11-collection-workspace.md), [`docs/phase-11-collection-security.md`](docs/phase-11-collection-security.md), and [`docs/phase-11-browser-verification.md`](docs/phase-11-browser-verification.md).

## Phase 10 unified document workspace

Phase 10 adds a shared document overview, capability pills, deterministic `phase10-intent-v1` normalization, explicit workflow-plan steps, risk and processing-boundary display, review/confirmation controls, an explicit workflow state machine, and delegation to the existing specialized PDF, OCR, AI, action, conversion, and Office workspaces. Phase 11 extends that shell with a memory-only, bounded multi-document collection workspace. Collections retain stable source IDs and explicit ordering, evaluate compatibility before planning, expose dependency-aware plans, execute only verified PDF merge and ordered image-to-PDF batch paths in this milestone, search bounded PDF/Office content with source-specific provenance, retain validated individual downloads, and record ephemeral session history without document bytes. The collection layer does not duplicate specialized engines.

## Roadmap boundary

Phase 16 final production hardening and v1.0 release readiness is the final planned milestone. It extends Phase 12 orchestration, Phase 13 extraction, and Phase 14 automation with local IndexedDB-backed projects, explicit persistence consent, immutable original documents, validated document versions, project history, workflow recovery metadata, metadata-only import/export, migration and retention state, and safe deletion. See [`docs/phase-16-release-readiness.md`](docs/phase-16-release-readiness.md), [`docs/phase-16-security-audit.md`](docs/phase-16-security-audit.md), and [`docs/phase-16-performance-audit.md`](docs/phase-16-performance-audit.md). It does not pretend to provide arbitrary code execution, unbounded batch queues, universal Office round-trips, formula recalculation, ZIP packaging, object-level PDF compression, cloud conversion, autonomous actions, or forensic metadata guarantees. Unsupported executor capabilities fail honestly. Phase 16 is the final planned milestone; no Phase 17 is created.

## v1.0.0 release and CI

The current package version is **1.0.0**. Dependencies are pinned to exact tested versions and the repository pins pnpm `11.21.0`. The GitHub Actions workflow runs on pull requests and pushes to `main` with frozen installation, typecheck, real ESLint linting, deterministic tests, and production build.

The Vite proxy to `http://127.0.0.1:8787` is for local development and `vite preview` only. A production deployment must provide an explicit `VITE_AI_GATEWAY_URL` pointing to a managed gateway, while provider credentials remain server-side. The frontend must not be configured with provider API keys. The AI gateway continues to accept only bounded, consented, provenance-validated structured context.

## License

This project is licensed under the MIT License. pdf-lib `1.17.1` is used under its MIT license. Tesseract.js `7.0.0` is used under Apache-2.0, and its bundled English language data is distributed under the package’s documented MIT license. PDF.js is used for browser-side parsing and rendering under its project license. fflate `0.8.3` is used under the MIT license for bounded browser-local OOXML ZIP inflation. Library research and source links are documented in [`docs/phase-2c-library-research.md`](docs/phase-2c-library-research.md), [`docs/phase-5-ocr-engine-research.md`](docs/phase-5-ocr-engine-research.md), [`docs/phase-9-office-library-research.md`](docs/phase-9-office-library-research.md), and the Phase 3/4 architecture documents.
