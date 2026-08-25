# Phase 2A PDF Implementation

**Author:** Manus AI  
**Scope:** Browser-local PDF intake, inspection, deterministic classification, first-page preview, validation, and PDF-aware UX.

## Outcome

Phase 2A adds a real PDF intake foundation to SmartDocs without pretending that PDF transformation is available. A user can select or drop a PDF, have the browser validate its signature, inspect bounded metadata, classify it using deterministic heuristics, render a first-page preview, and review the result. The file remains in the browser; there is no upload route, server worker, API call, cloud storage, database, account, or batch process.

The existing JPEG, PNG, and WebP image optimization workflow remains separate and unchanged in behavior. PDF goals are captured in the same workspace, but the application deliberately does not create a fake compression, conversion, editing, OCR, or AI result.

## Architecture

The implementation extends the existing shared file and workflow domains instead of introducing a second application architecture.

| Layer | Phase 2A responsibility | Boundary |
|---|---|---|
| Shared file domain | `ImageAsset | PdfAsset`, PDF metadata, capabilities, limits, and structured intake errors | Pure TypeScript |
| PDF domain | Classification signals, text-presence states, pure signature/version/page-dimension helpers, validation result | Pure TypeScript |
| Intake dispatcher | Reads a small header, routes PDF candidates, and lazy-loads the PDF inspector only for PDF candidates | Browser-local |
| PDF inspector | Uses PDF.js to parse bounded page/text/operator signals and render page 1 | Browser-local |
| Workflow contract | `pdf.inspect → pdf.render.preview → validation` with browser-local processing | Browser-local |
| React UX | PDF-aware intake card, metadata, preview, honest unavailable-transform notice, recovery states | Browser-local |

PDF candidates are identified from the declared MIME type, the `.pdf` extension, or the first bytes. The dispatcher performs the inexpensive header read before dynamically importing the heavier PDF.js inspector. A file named `.pdf` but lacking the `%PDF-` signature is rejected rather than trusted.

## PDF.js selection and Vite worker setup

The implementation pins **`pdfjs-dist@6.2.108`** in `package.json`. PDF.js is an appropriate fit for this phase because the official project describes it as a web-standards-based platform for parsing and rendering PDFs, and it is licensed under Apache 2.0 [1]. The version is pinned to keep the browser behavior and worker integration reproducible; upgrades should be deliberate and re-verified against the fixture suite.

Vite receives the worker as a URL import:

```ts
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
```

The full inspector is loaded through a dynamic import from the PDF branch of the intake dispatcher. This keeps the initial application chunk smaller while retaining a production build artifact for the PDF.js worker and a separate inspector chunk.

## Browser-local processing boundary

The browser reads the selected `File`, checks its bytes, and passes an in-memory `Uint8Array` to PDF.js. The first-page preview is encoded to a PNG object URL for display. Object URLs for both the input preview and generated result previews are revoked on reset and component unmount; the PDF inspector also cleans sampled pages and destroys the PDF.js loading task.

> The application does not upload the selected PDF. “Processed locally” means the current inspection and preview work is performed inside the user’s browser. It does not claim anything about a future server-assisted phase.

The implementation does not request passwords, crack encryption, or send protected documents elsewhere. A password callback marks the document as protected, destroys the loading task, and returns a dedicated recovery state.

## Deliberate PDF input limit

PDF inspection is limited to **50 MiB (`50 * 1024 * 1024` bytes)**. This is a separate limit from the existing 25 MiB image limit because PDF parsing and rendering can expand compressed streams into substantially larger in-memory structures. The limit is an explicit browser-safety boundary for this phase, not a statement that larger PDFs are inherently invalid. The UI presents the limit as 50 MB for readability, while the domain constant and tests preserve the binary value exactly.

The inspector also bounds work within an accepted file. It samples every page for documents with at most eight pages; larger documents use a bounded set of first, second, middle, penultimate, and final pages. Text character accounting is capped at 2,000 characters, and only counts and presence signals are retained. Only page 1 is raster-rendered for the preview.

## Inspection fields

The resulting `PdfAsset` exposes only values the browser actually measured or derived from bounded signals.

| Field | Behavior |
|---|---|
| PDF version | Parsed from the initial `%PDF-x.y` header when declared; otherwise `Not declared` |
| Page count | Read from PDF.js after successful parsing |
| First-page dimensions | Derived from page 1 points and labeled as A4, Letter, or point dimensions with orientation |
| Text presence | `Detected`, `Limited`, or `Not detected` based on bounded text items and characters |
| Text extractability | Boolean indicating whether any non-empty text item was observed |
| Raster signals | Operator-list image paint evidence on sampled pages |
| First-page preview | PNG object URL from a controlled page-1 render, or unavailable with a warning |
| Processing boundary | Always `browser-local` for this phase |
| Warnings | Sampling note and heuristic note where applicable |

The application stores no full extracted document text. It uses text only as a bounded inspection signal.

## Classification heuristic and limitations

Classification is deterministic but intentionally qualified. The possible states are `text`, `scanned`, `mixed`, `unknown`, `protected`, and `invalid`.

| Result | Condition in the bounded signal model |
|---|---|
| `protected` | PDF.js requests a password or the protected signal is set |
| `invalid` | No usable page sample or the document fails signature/parsing checks |
| `mixed` | Meaningful text is present, raster evidence exists, and not every sampled page has text |
| `text` | Meaningful bounded text is present without raster evidence indicating a mixed document |
| `scanned` | Raster evidence exists without meaningful bounded text |
| `unknown` | The file parsed but the bounded signals do not support a stronger label |

“Meaningful” is intentionally conservative: the current heuristic requires non-empty text items and at least 12 bounded characters. Raster evidence comes from PDF.js operator lists rather than a claim about visual semantics. A classification is therefore a useful inspection hint, not a semantic guarantee. Sampling can miss an unusual page, PDFs can contain hidden or decorative text, and an image-like page may use constructs not represented by the current operator set.

## Validation and result architecture

`validatePdfInspection(asset)` returns a typed inspection validation object with the document type, page count, preview availability, classification, protected state, processing boundary, and an honest message. A parsed document remains valid when its first-page preview is unavailable, because preview rendering is a separate capability; the result message states that limitation. A protected or invalid result is not presented as an accepted usable document.

The workflow contract is:

```text
pdf.inspect
  → pdf.render.preview
  → validation
```

The tool registry contains only the capabilities implemented in this phase: `pdf.inspect` and `pdf.render.preview`. No PDF compression, optimization, conversion, editing, merge, split, rotation, OCR, translation, AI, or upload tool is registered.

## Security and resource model

PDFs are treated as untrusted parser input. The intake path allowlists the supported PDF category, checks the file signature rather than relying on the filename or MIME label, enforces the independent size limit, bounds page and text sampling, limits the preview to one page, and cleans PDF.js resources. These controls follow the general direction of OWASP’s file-upload guidance, which recommends content validation, allowlists, size limits, safe handling, and sandboxing or content disarm where available [2].

This static application does not claim to replace a hardened server-side PDF sandbox. Future server-assisted processing, if approved, must isolate native engines and resolve deployment, licensing, patching, and retention requirements before accepting uploads. The architecture spike records that qpdf is structural and does not render or extract text [3], while native renderers and conversion engines carry additional operational and licensing considerations.

## Fixtures and verification

The reproducible generator is `tests/fixtures/generate_pdf_fixtures.py`. It creates the following local fixtures:

| Fixture | Purpose |
|---|---|
| `text-fixture.pdf` | Two-page text PDF with A4 pages |
| `scanned-fixture.pdf` | Two-page image-only PDF |
| `mixed-fixture.pdf` | Text and image pages to exercise mixed classification |
| `invalid-fixture.pdf` | Deterministic non-PDF bytes with a `.pdf` filename |
| `oversized-fixture.pdf` | Large fixture for the independent PDF-size boundary |
| `scan-page.png` | Source image used by the scanned and mixed fixtures |

The pure Vitest suite covers signature and version parsing, page-dimension normalization, size-limit behavior, text/scanned/mixed/unknown/protected classification signals, preview-unavailable validation, local workflow steps, and the existing image domain behavior. Browser verification used the actual Vite app and PDF.js worker: text, scanned, mixed, and invalid fixtures were uploaded through the file input; all valid fixtures rendered page 1 and displayed measured metadata; the invalid fixture produced a clear signature-rejection state; and resource inspection found PDF.js and its worker but no `/api/` or `/upload` request.

## Explicit nonfeatures

Phase 2A does **not** compress or optimize PDFs, meet an exact PDF byte target, convert PDF to images or other formats, edit pages, merge or split documents, rotate pages, run OCR, translate text, call AI/LLM services, upload files, persist documents, or use backend/server/cloud infrastructure. The UI says this directly instead of showing disabled-looking transformation controls or inventing a result.

## References

[1]: https://mozilla.github.io/pdf.js/ "PDF.js official project page"

[2]: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html "OWASP File Upload Cheat Sheet"

[3]: https://qpdf.sourceforge.io/ "qpdf official project page"
