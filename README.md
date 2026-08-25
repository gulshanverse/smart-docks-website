# SmartDocs

## One file. One goal. A clearer result.

SmartDocs is being shaped into an intent-first workspace for working with files. Instead of asking people to learn a catalogue of technical tools, the product direction is simple: **one file + one human goal → an intelligent workflow → a verified result**.

The repository is currently in **Phase 0.5: Repository Migration & Portfolio Cleanup**. This phase replaces the previous personal portfolio surface with an honest SmartDocs product shell. It intentionally does not process files yet.

> SmartDocs is a product foundation in progress, not a completed PDF or AI platform.

## Currently implemented

The current static shell includes the following:

| Area | Status |
|---|---|
| SmartDocs branding and neutral product language | Implemented |
| Responsive navigation between workspace, principles, and roadmap sections | Implemented |
| Warm-neutral visual foundation with graphite typography and restrained indigo accents | Implemented |
| Empty workspace state that clearly explains the current phase | Implemented |
| Product principles and staged roadmap | Implemented |
| Reduced-motion support and semantic landmarks | Implemented |
| File upload or drag-and-drop | Not implemented |
| Image compression or resizing | Not implemented |
| PDF tools and conversions | Not implemented |
| OCR, extraction, translation, or summaries | Not implemented |
| AI intent planning | Not implemented |
| Authentication, database, cloud storage, or backend processing | Not implemented |

Nothing is uploaded, processed, or stored by the current page.

## Product direction

The first real feature phase is planned around a narrow, measurable vertical slice:

```text
Image upload
  ↓
Natural-language goal
  ↓
Exact target-size interpretation
  ↓
Adaptive local compression
  ↓
Validation
  ↓
Before/after metrics and download
```

That workflow will be implemented only after its intent model, processing boundary, error behavior, and validation rules are approved. Later phases may add PDF workflows, OCR, document conversion, and AI-assisted understanding through isolated processing boundaries.

## Repository structure

```text
.
├── index.html                         # SmartDocs product shell
├── styles.css                         # Visual foundation and responsive styles
├── script.js                          # Shell-only navigation behavior
├── docs/
│   ├── repository-audit.md            # Verified Phase 0 repository audit
│   └── phase-0.5-migration-scope.md   # Migration boundary and preservation notes
└── README.md
```

## Run locally

This phase remains dependency-free. Serve the repository with any static HTTP server, for example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in a browser.

Opening `index.html` directly also renders the shell, although a local HTTP server is recommended for browser verification.

## Documentation

The repository audit is available in [`docs/repository-audit.md`](docs/repository-audit.md). The Phase 0.5 migration boundary is documented in [`docs/phase-0.5-migration-scope.md`](docs/phase-0.5-migration-scope.md).

## Planned work

The next phase should add a real image-only workflow with browser-local processing, typed file metadata, deterministic target-size parsing, adaptive compression, output validation, honest failure states, and downloadable results. It should not introduce a full backend, AI SDK, database, queue, or cloud storage until an actual workflow requires those boundaries.

## License

This project is licensed under the MIT License.
