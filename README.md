# SmartDocs

## One file. One clear goal.

SmartDocs is an intent-first workspace for turning a human file goal into a verified result. **Phase 2B extends the first real vertical slice:** browser-local image target-size optimization plus browser-local PDF intake, bounded inspection, heuristic classification, first-page preview, page-by-page intelligence, and validation.

> No image or PDF is uploaded to a server by the current application. Processing happens locally in the browser.

## What works now

| Capability | Status |
|---|---|
| Vite + React + strict TypeScript application foundation | Implemented |
| JPEG, PNG, and WebP file picker | Implemented |
| PDF file picker and keyboard-accessible drag-and-drop intake | Implemented |
| Keyboard-accessible drag-and-drop intake surface | Implemented |
| MIME and image-signature checks | Implemented |
| PDF signature validation and separate 50 MiB browser-local limit | Implemented |
| PDF version, page count, page dimensions, bounded text, and raster inspection | Implemented |
| Deterministic text, scanned, mixed, unknown, protected, and invalid PDF states | Implemented |
| PDF.js first-page preview with Vite worker and object URL cleanup | Implemented |
| Typed PDF page model with measured geometry, text, and raster signals | Implemented |
| Lazy browser-local page previews and bounded thumbnail rail | Implemented |
| Page navigation, selected-page metadata, page hints, and keyboard controls | Implemented |
| Image preview, filename, dimensions, MIME type, and byte size | Implemented |
| Deterministic phrases such as “make this image under 100KB” | Implemented |
| Decimal byte convention: 1 KB = 1,000 bytes; 1 MB = 1,000,000 bytes | Implemented |
| Extensible tool registry with `image.compress.target_size`, `pdf.inspect`, `pdf.inspect.page`, and `pdf.render.preview` | Implemented |
| Typed image and PDF workflow models with validation steps | Implemented |
| Browser-local adaptive encoding and target-size search | Implemented |
| Deterministic resize recovery when compression alone is not acceptable | Implemented |
| Original-dimensions control with Allow resizing recovery action | Implemented |
| Strategy metadata: original-preserved, compression-only, resize-and-compress | Implemented |
| Output decode validation, target check, dimensions, and reduction metrics | Implemented |
| Downloadable optimized result and reset workflow | Implemented |
| Honest no-file, unsupported-format, invalid-image, decode, oversized, ambiguous, and unsupported-goal states | Implemented |
| PDF compression/optimization, editing, merge/split/rotate, conversion, OCR, AI/LLM, DOCX/XLSX/PPTX, backend, cloud storage, accounts, billing, and batch workflows | Not implemented |

The current workflow does not invent application-specific requirements. For example, “make this suitable for my exam” is not treated as a known target; the user is asked for an exact size instead.

## How the first workflow works

```text
Image file
  ↓
MIME and signature validation
  ↓
Local image inspection
  ↓
Natural-language target parsing
  ↓
Typed workflow plan
  ↓
Compression-first candidate search
  ↓
Bounded resize recovery when necessary
  ↓
Decode, byte, target, and dimension validation
  ↓
Preview, metrics, and download
```

The optimizer first tries to **minimize quality loss at the original dimensions**. If compression cannot reach the target at the quality floor, it evaluates a bounded set of dimension scales and selects the smallest necessary reduction that reaches the target. JPEG and WebP use measured quality candidates. PNG transparency is preserved by retaining PNG as a candidate and using WebP only as an alternative format that supports alpha. If the target is not reasonably achievable after the resize policy, the result is labeled as best quality available and explains the tradeoff instead of silently destroying the image.

If the original image is already under the requested target, SmartDocs preserves the original bytes rather than re-encoding it into a larger file. Result metadata communicates whether the strategy was `original-preserved`, `compression-only`, or `resize-and-compress`. When resizing is used, the result shows original and final dimensions and explains why.

## Privacy and security boundary

The application does not send image or PDF files to an API or cloud storage. It validates image and PDF content signatures, enforces separate 25 MiB image and 50 MiB PDF input limits, bounds PDF page/text inspection, uses browser object URLs for previews, avoids injecting filenames as HTML, and revokes generated object URLs when the workflow is reset or unmounted.

This is a browser-local privacy boundary. It is not a claim about server retention because the current phase has no server processing.

## Repository structure

```text
.
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── domain/
│   │   ├── files/       # typed asset model and intake limits
│   │   ├── intents/     # deterministic goal parser
│   │   ├── tools/       # real tool registry
│   │   ├── pdfs/        # PDF heuristics, pure helpers, and validation
│   │   ├── workflows/   # workflow and validation models
│   ├── features/
│   │   ├── compression/ # local encoding and candidate selection
│   │   ├── intake/      # MIME, signature, decode, and metadata inspection
│   │   └── pdf/         # lazy PDF.js inspection and preview service
│   ├── lib/             # byte, extension, ID, and metric helpers
│   ├── styles/          # design tokens and application styles
│   └── tests/           # domain and optimizer-selection tests
└── docs/
    ├── phase-1-browser-verification.md
    ├── phase-1.5-browser-verification.md
    ├── phase-2-pdf-architecture.md
    ├── phase-2-research-notes.md
    ├── phase-2a-pdf-implementation.md
    ├── phase-2a-browser-verification.md
    ├── phase-2b-pdf-workspace.md
    ├── phase-2b-browser-verification.md
    ├── repository-audit.md
    └── phase-0.5-final-report.md
```

The old portfolio-era root `script.js` and `styles.css` files were removed because they are no longer part of the application runtime. The previous portfolio remains recoverable through Git history.

## Run locally

Install dependencies with pnpm and start Vite:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite. The production build can be previewed with:

```bash
pnpm build
pnpm preview
```

## Test and quality checks

Run the strict TypeScript check, unit tests, and production build:

```bash
pnpm typecheck
pnpm test
pnpm build
```

The current automated tests cover decimal KB/MB conversion, human-readable byte formatting, reduction percentages, valid and ambiguous intent parsing, unsupported goals, compression candidate selection for achievable and impossible targets, aspect-ratio-preserving resize dimensions, deterministic quality decisions, PDF signature and version parsing, page-dimension normalization, the independent PDF size gate, bounded classification states, document and page workflow steps, page geometry and orientation, paper-size hints, bounded sampling, text-signal normalization, page hints, default selection, and validation with or without a preview.

## Browser verification

Phase 1.5 was verified with a real 1600 × 1000, 1.6 MB JPEG fixture. The browser accepted `make this image under 50KB`, reported that compression alone was not acceptable, resized to 704 × 440, reached 23.5 KB, verified the output, exposed a real download, and allowed the user to re-run with original dimensions before choosing Allow resizing. The original-under-target behavior and no-file recovery path remain intact.

See [`docs/phase-1.5-browser-verification.md`](docs/phase-1.5-browser-verification.md) for the image verification record, [`docs/phase-2a-browser-verification.md`](docs/phase-2a-browser-verification.md) for document-level PDF verification, and [`docs/phase-2b-browser-verification.md`](docs/phase-2b-browser-verification.md) for page-workspace verification.

## Roadmap

The Phase 2 PDF architecture spike is documented in [`docs/phase-2-pdf-architecture.md`](docs/phase-2-pdf-architecture.md), the browser-local foundation in [`docs/phase-2a-pdf-implementation.md`](docs/phase-2a-pdf-implementation.md), and the page workspace in [`docs/phase-2b-pdf-workspace.md`](docs/phase-2b-pdf-workspace.md). PDF transformation, OCR, document conversion, AI-assisted planning, accounts, cloud storage, backend workers, billing, batch processing, audio/video, and other infrastructure remain outside the current implementation scope until separately approved.

## License

This project is licensed under the MIT License.
