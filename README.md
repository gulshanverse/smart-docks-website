# SmartDocs

## One file. One clear goal.

SmartDocs is an intent-first, browser-local workspace for turning a human image or PDF goal into a measured and verified result. **Phase 3 adds Smart PDF Optimization** on top of the completed Phase 2 PDF core platform while preserving the existing image target-size optimizer.

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
| OCR, AI/LLM planning, semantic extraction, translation, universal object-level PDF compression, backend/cloud processing, accounts, billing, batch queues, and public sharing | Not implemented |

## Smart PDF Optimization

Open **Optimize PDF** after adding a PDF. Enter a target such as `compress this PDF under 1MB`, choose **Maximum quality**, **Balanced**, **Smaller file**, or **Smallest practical**, and choose whether to preserve basic metadata when available. The parser uses decimal units: 1 KB is 1,000 bytes and 1 MB is 1,000,000 bytes.

The optimizer analyzes a bounded page sample before choosing a path. Text and vector PDFs are preservation-first and are not silently rasterized. Scanned PDFs are rendered one page at a time into JPEG-backed candidate PDFs. Mixed PDFs use a hybrid policy that can recompress eligible raster-only pages while copying pages with detectable text. Every candidate is measured and reopened with PDF.js before it can be selected.

The target is a hard byte constraint. SmartDocs shows **Target achieved** only when the measured result is at or below the requested target. If the documented quality floor cannot reach the target, the UI reports **Best effort** with the actual measured size and warning. If the input already satisfies the target, SmartDocs preserves the original bytes. A cancellation action stops future work and removes partial candidates without modifying the source.

The result comparison shows original and optimized first-page previews, byte sizes, reduction percentage, page count, target state, strategy, quality decision, candidate count, warnings, a real download, and `Continue editing this PDF`. After chaining, `Return to original PDF` remains available at the application level.

## PDF core behavior

The Phase 2 tools remain available beside optimization: ordered merge, exact-range split, PDF-to-image rendering, JPEG/PNG-to-PDF authoring, page delete/extract/reorder/rotate, and conservative blank-page review/removal. Split ranges are parsed exactly and are never silently clamped. Multi-page image conversion offers individual real downloads rather than an unimplemented ZIP dependency.

Blank-page detection measures bounded text, raster operators, and rendered non-background pixel occupancy. Candidates require user review and explicit confirmation before removal. Large blank-page scans use a deterministic sample of no more than 50 pages, and the UI states that additional pages require manual review.

WebP is supported for PDF-to-image rendering where browser canvas encoding succeeds. WebP-to-PDF is intentionally not offered because the verified pdf-lib authoring path does not safely embed WebP. Basic title, author, subject, creator, producer, and creation date fields are best-effort only. SmartDocs does not claim universal preservation or removal of forms, annotations, links, bookmarks, embedded files, JavaScript, unusual objects, or every metadata stream.

## Architecture

The domain layer in `src/domain/pdfs/optimization.ts` owns optimization intent-independent policies, analysis/result types, candidate generation, target-aware ranking, reduction measurements, quality decisions, and best-effort result construction. `src/domain/intents/parse-intent.ts` owns deterministic image and PDF target-language parsing. `src/domain/tools/registry.ts` exposes only actual capabilities. `src/domain/workflows/types.ts` maps optimization to explicit inspection, analysis, optimization, validation, and preview steps.

PDF.js is the inspection and rendering authority. pdf-lib `1.17.1` is the structural authoring authority for copying pages, creating PDFs, setting supported basic metadata, and embedding JPEG/PNG data. Heavy optimization UI and services are lazy-loaded so the initial app bundle remains lean. Each generated PDF is reopened through PDF.js before success or download is offered.

## Privacy, security, and resource boundary

The application validates file signatures, enforces local file-size and page limits, rejects protected or unusable PDFs, constructs safe filenames, avoids filename HTML injection, and keeps all document processing in the browser. PDF.js tasks are destroyed and canvases cleared in cleanup blocks. Generated preview and download object URLs are revoked when replaced or unmounted. No remote worker, server queue, database, cloud storage, authentication, billing, or analytics is part of this milestone.

The quality policy is intentionally bounded. The optimizer does not reduce quality indefinitely to satisfy an arbitrary target. High-resolution scanned PDFs can still be CPU- and memory-intensive; users can cancel, and the result warnings explain when a target is not reachable.

## Repository structure

```text
.
├── index.html
├── package.json
├── pnpm-lock.yaml
├── src/
│   ├── App.tsx
│   ├── domain/
│   │   ├── files/       # typed assets and browser-local limits
│   │   ├── intents/     # deterministic image and PDF goal parsing
│   │   ├── pdfs/        # inspection, page, core, and optimization contracts
│   │   ├── tools/       # actual capability registry
│   │   └── workflows/   # typed workflow models and steps
│   ├── features/
│   │   ├── compression/ # local image encoding and candidate selection
│   │   ├── intake/      # signature, decode, and metadata inspection
│   │   └── pdf/         # PDF.js workspace, rendering, authoring, optimization
│   ├── styles/          # design tokens and application styles
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

The automated suite covers byte units, image intent and candidate behavior, PDF signature and inspection foundations, bounded sampling, page operations, exact split ranges, merge and image-to-PDF plans, safe filenames, conservative blank classification, reviewed-removal invariants, unified workflow mappings, target parsing, quality policies, candidate generation/ranking, target-achieved and best-effort result states, and core output validation.

The deterministic fixture generator is `tests/fixtures/generate_pdf_fixtures.py`. It produces Phase 2 fixtures plus high-resolution scanned fixtures for measurable Phase 3 compression tests. Existing tracked Phase 2 fixture binaries should not be regenerated casually because PDF metadata identifiers can create unrelated binary churn.

## Verification records

The Phase 3 architecture, quality policy, preservation boundary, resource lifecycle, and library references are in [`docs/phase-3-smart-pdf-optimization.md`](docs/phase-3-smart-pdf-optimization.md). The final browser verification record is in [`docs/phase-3-final-browser-verification.md`](docs/phase-3-final-browser-verification.md). Working notes from the local scanned, mixed, text, cancellation, and 100-page checks are in [`docs/phase-3-browser-notes.md`](docs/phase-3-browser-notes.md). Phase 2 history remains in the earlier architecture, research, and verification documents.

## Roadmap boundary

Phase 3 Smart PDF Optimization is the current milestone. The next recommended milestone is **Phase 4: advanced PDF optimization and document intelligence**, beginning with preservation and compatibility work for forms, annotations, links, bookmarks, fonts, embedded files, and object-level image replacement. OCR, AI/LLM planning, semantic extraction, translation, backend processing, cloud storage, batch execution, public sharing, authentication, billing, and analytics remain outside this delivery.

## License

This project is licensed under the MIT License. pdf-lib `1.17.1` is used under its MIT license. PDF.js is used for browser-side parsing and rendering under its project license. Library research and source links are documented in [`docs/phase-2c-library-research.md`](docs/phase-2c-library-research.md) and the Phase 3 architecture document.
