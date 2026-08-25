# SmartDocs

## One file. One clear goal.

SmartDocs is an intent-first browser workspace for turning a human file goal into a verified result. **Phase 2 completes the browser-local PDF core platform** while preserving the existing image target-size optimizer and the Phase 2A–2C PDF foundation.

> Current document processing reads local `File` objects in the browser. The application does not upload image or PDF bytes to a server, API, cloud processor, database, or storage service.

## What works now

| Capability | Status |
|---|---|
| Vite + React + strict TypeScript application foundation | Implemented |
| JPEG, PNG, and WebP image intake with signature checks | Implemented |
| PDF intake, signature validation, version/page/dimension inspection, bounded text and raster signals | Implemented |
| Separate 25 MiB image and 50 MiB PDF browser-local limits | Implemented |
| PDF.js first-page preview, page workspace, lazy thumbnails, keyboard navigation, page metadata, and page hints | Implemented |
| Browser-local PDF delete, extract, reorder, and cumulative 90°/180°/270° rotation | Implemented |
| Merge two or more PDFs with ordered inputs and validated page-count output | Implemented |
| Split by exact comma-separated page ranges with honest invalid/out-of-range recovery | Implemented |
| PDF → JPG, PNG, or WebP page rendering with sequential bounded processing | Implemented |
| JPEG/PNG → PDF with ordered A4 fit-centered pages | Implemented |
| Conservative blank-page detection, review, and explicit removal | Implemented |
| Basic best-effort metadata snapshot/preservation for merge only | Implemented with limits |
| Unified core operation plans, tool registry, workflow steps, and output validation | Implemented |
| Validated PDF result previews, downloads, continuation into the page workspace, and recoverable originals | Implemented |
| Image target-size optimization, adaptive encoding, resize recovery, and actual byte/dimension validation | Implemented |
| PDF compression, target-size PDF optimization, OCR, AI/LLM planning, semantic extraction, backend/cloud processing, accounts, billing, batch queues, and public sharing | Not implemented |

## PDF core behavior

The shared Phase 2 panel provides Merge PDFs, Split PDF, PDF → images, Images → PDF, and Blank pages. Merge ordering is controlled by the user. Split ranges are parsed exactly; page numbers are never silently clamped. Multi-page image conversion offers individual real downloads instead of an unimplemented ZIP dependency.

Blank-page detection measures sampled text, raster operators, and rendered non-background pixel occupancy. It is intentionally conservative. Candidates are shown for review, and removal requires explicit checkbox confirmation. PDFs with more than 50 pages receive a deterministic sample of no more than 50 pages, and the UI states that additional pages require manual review.

WebP is supported for PDF-to-image rendering where browser canvas encoding succeeds. WebP-to-PDF is intentionally not offered because the verified pdf-lib authoring path does not safely embed WebP. Merge may copy basic title, author, subject, creator, producer, and creation date from the first source when requested. Split warns that basic source metadata is not copied. No feature claims universal preservation of forms, annotations, links, bookmarks, embedded files, JavaScript, unusual objects, or all metadata.

## Architecture

The domain layer in `src/domain/pdfs/core.ts` owns pure plans, range parsing, safe filenames, blank-page invariants, and metadata snapshot types. `src/domain/tools/registry.ts` exposes only real capabilities. `src/domain/workflows/types.ts` maps each operation to an explicit workflow step, including `pdf.detect.blank_pages` and `pdf.remove.blank_pages`.

PDF.js is the inspection and rendering authority. pdf-lib 1.17.1 is the structural authoring authority for copying pages, creating PDFs, rotations, basic metadata, and embedding JPEG/PNG images. Core services are dynamically imported so merge, split, image authoring, and raster conversion remain lazy. Every generated PDF is reopened with PDF.js before a success state or download link is offered.

## Privacy and security boundary

Processing stays within the browser-local boundary for this phase. The application validates signatures, enforces file limits, rejects protected or unusable PDFs, constructs safe output filenames, avoids filename HTML injection, and revokes generated object URLs and destroys PDF.js sessions during cleanup. This boundary is specific to the current application and is not a promise about an unapproved future server architecture.

## Repository structure

```text
.
├── index.html
├── package.json
├── pnpm-lock.yaml
├── src/
│   ├── App.tsx
│   ├── domain/
│   │   ├── files/       # typed asset model and intake limits
│   │   ├── intents/     # deterministic image goal parser
│   │   ├── pdfs/        # inspection, page, core plans, and validation
│   │   ├── tools/       # actual capability registry
│   │   └── workflows/   # typed workflow models and steps
│   ├── features/
│   │   ├── compression/ # local image encoding and candidate selection
│   │   ├── intake/      # signature, decode, and metadata inspection
│   │   └── pdf/         # PDF.js workspace, rendering, and pdf-lib authoring
│   ├── styles/          # design tokens and application styles
│   └── tests/           # domain and core-plan tests
├── tests/fixtures/      # deterministic PDF and image fixtures
└── docs/                # phase architecture, research, and verification records
```

## Run locally

Install dependencies with pnpm and start Vite:

```bash
pnpm install
pnpm dev
```

The production build can be previewed with:

```bash
pnpm build
pnpm preview
```

## Test and quality checks

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

The automated suite covers image intent and candidate behavior, PDF signature and inspection foundations, bounded sampling, page operations, exact split ranges, merge and image-to-PDF plans, safe filenames, conservative blank classification, bounded large-document blank scans, reviewed-removal invariants, unified workflow mappings, and core output validation. The fixture generator is `tests/fixtures/generate_pdf_fixtures.py`.

## Verification records

The complete Phase 2 architecture and limitation record is in [`docs/phase-2-pdf-core-platform.md`](docs/phase-2-pdf-core-platform.md). Browser, console, network, resource, fixture, and regression evidence is in [`docs/phase-2-final-browser-verification.md`](docs/phase-2-final-browser-verification.md). Earlier foundation records remain available for Phase 2A, 2B, and 2C history.

## Phase 3 boundary

Phase 3 was **not started**. The recommended next milestone is **Smart PDF Optimization**, subject to separate approval and explicit requirements for compression, target-size search, quality trade-offs, and preservation policy. OCR, AI/LLM planning, semantic extraction, backend processing, cloud storage, batch execution, and public sharing remain outside this delivery.

## License

This project is licensed under the MIT License. pdf-lib 1.17.1 is used under its MIT license; the project’s PDF library decision is documented with source links in [`docs/phase-2c-library-research.md`](docs/phase-2c-library-research.md).
