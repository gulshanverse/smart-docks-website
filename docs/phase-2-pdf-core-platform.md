# SmartDocs Phase 2 PDF Core Platform

## Purpose and boundary

Phase 2 completes the browser-local PDF core platform for SmartDocs. The milestone preserves the existing image optimizer and Phase 2A–2C PDF intake, inspection, page workspace, deletion, extraction, reorder, and rotation workflows, then adds the remaining structural and conversion primitives required for a useful all-in-one PDF foundation. The implementation intentionally stops before compression, target-size PDF optimization, OCR, AI/LLM features, semantic extraction, backend processing, cloud storage, accounts, billing, batch queues, or public sharing.

> A generated result is offered only after it is reopened and independently inspected with PDF.js in the browser. The original input remains recoverable and is never modified in place.

## Implemented operation surface

| Operation | Browser-local behavior | Result validation | Important limitation |
|---|---|---|---|
| Merge PDFs | Loads two or more validated PDFs with pdf-lib, copies pages in the user-controlled order, and emits one PDF | Reopens the output with PDF.js, checks page count, boundary, and preview availability | Structural copying does not promise universal preservation of annotations, forms, links, bookmarks, embedded files, JavaScript, or unusual objects |
| Split PDF | Parses exact comma-separated page ranges without clamping and creates one PDF per range | Reopens every output and validates each expected page count | Basic source metadata is not copied by split; overlapping ranges are allowed when explicitly entered |
| PDF to JPG, PNG, or WebP | Renders selected PDF pages sequentially with PDF.js onto bounded canvases | The operation exposes real image blobs and individual downloads; no screenshot substitute or fake ZIP is created | Multi-page output is intentionally offered as individual downloads; high resolution increases memory use |
| JPEG/PNG to PDF | Embeds each image on a centered A4 page while preserving aspect ratio and input order | Reopens the generated PDF with PDF.js and checks expected page count and preview | WebP-to-PDF is rejected because the verified authoring path does not safely embed WebP; image metadata is not copied |
| Blank-page review | Measures sampled text, raster operators, and rendered non-background pixel ratio with a conservative heuristic | Candidate signals are shown for review before mutation | No page is removed by classification alone; PDFs over 50 pages use a bounded sample rather than an all-page render |
| Blank-page removal | Uses only the user-confirmed candidate checkboxes, then reuses the existing page mutation engine | Reopens the result and validates the retained page count | The heuristic is not semantic understanding and requires human review, especially for scans |
| Metadata behavior | Merge may copy basic title, author, subject, creator, producer, and creation date from the first source when requested | Metadata is best effort and warnings remain visible | This is not a metadata editor or a universal preservation guarantee |

The merge UI keeps its metadata checkbox local to merge. Split explicitly reports that basic source metadata is not copied, and image-to-PDF uses no metadata-preservation claim. This avoids presenting a broader capability than the implementation verifies.

## Architecture and responsibilities

The domain layer in `src/domain/pdfs/core.ts` defines pure operation plans, exact range parsing, safe filenames, conservative blank-page classifications, basic metadata snapshots, and the bounded detection/removal invariants. It contains no document bytes, DOM calls, network calls, or PDF library imports. The tool registry in `src/domain/tools/registry.ts` exposes only actual capabilities, including the verified JPEG/PNG image-to-PDF contract. The workflow layer maps every core operation to a distinct workflow step; blank detection maps to `pdf.detect.blank_pages` and reviewed removal maps to `pdf.remove.blank_pages`, rather than falling through to an unrelated image operation.

The UI in `PdfCoreTools.tsx` is mounted at the shared application workspace rather than inside the PDF asset card. Consequently, merge and image-to-PDF remain available with no selected PDF, while split, PDF-to-image, and blank review are enabled only when a validated PDF is present. Core result cards expose download and **Continue editing this PDF** actions. Continuing invokes the same local intake path used for an uploaded file, and the existing page workspace continues to provide a return-to-original path for its own mutation chain.

`src/features/pdf/core-operations.ts` is the structural authoring boundary. It dynamically imports pdf-lib so the initial app bundle remains smaller, validates protected, invalid, oversized, or empty PDFs before mutation, and produces explicit output contracts. `src/features/pdf/render-pdf-images.ts` is the PDF.js rendering boundary. It dynamically loads with the core tool, processes pages sequentially, bounds canvas dimensions, clears canvas memory, cleans page objects, and destroys the loading task in a `finally` path.

## Library decision

PDF.js remains responsible for parsing, text and operator inspection, page geometry, and actual raster rendering. pdf-lib 1.17.1 is used only for structural authoring. The official pdf-lib documentation verifies loading, creating, copying, adding, removing, rotating, and saving PDF pages; its repository describes a browser-oriented pure-JavaScript implementation, and the published package includes TypeScript declarations [1] [2] [3]. The repository identifies the project under the MIT license [2].

The separation is deliberate. PDF.js is the inspection and rendering authority, while pdf-lib is the authoring authority. Every generated PDF crosses back through PDF.js before a success state or download link is presented. This catches malformed outputs and prevents the UI from reporting a result merely because a library returned bytes.

## Validation and recovery

Every core PDF result carries its operation, expected page count, input and output byte counts, filename, warnings, and browser-local boundary. The shared validator rejects an output when the page count is wrong, the output cannot be reopened, the preview is unavailable in a result path that requires one, or the processing boundary is not browser-local. Outputs that are larger than their inputs receive a visible warning; Phase 2 does not attempt compression and does not label a larger output as optimized.

Invalid signatures, protected PDFs, unsupported WebP-to-PDF input, oversized files, malformed page ranges, empty selections, attempts to delete every page, and failed library operations return honest recovery messages. Filenames are sanitized into safe local names and never injected as HTML. Original files are held in local state and browser memory only. Core result URLs, previews, image blobs, page previews, and PDF.js sessions are revoked or destroyed on replacement, reset, unmount, or failed validation.

## Limits and performance behavior

The application keeps the existing 25 MiB image and 50 MiB PDF browser-local limits. PDF inspection uses bounded page and text sampling. PDF-to-image conversion processes one page at a time, and multi-page images are offered individually rather than introducing a ZIP dependency without a tested need. Blank-page detection scans all pages only when the PDF has 50 pages or fewer. A larger PDF receives a deterministic sample of no more than 50 pages and the UI states that additional pages require manual review. The renderer also rejects an explicit request for more than 50 blank-review pages.

The initial production bundle remains separated from pdf-lib and the raster-conversion code. The final build keeps core services in lazy chunks while the PDF.js worker remains a separately served worker asset. The app avoids simultaneous page renders and releases canvas dimensions immediately after encoding.

## Security and privacy boundary

All document bytes are read from local `File` objects. There is no `/api/`, upload endpoint, cloud processing, database, authentication, analytics, or server worker in this milestone. The final browser network check recorded no non-local resource requests after the external font references were removed. This is a browser-local processing guarantee for the current application, not a claim about a future server architecture.

The app treats filenames and PDF contents as data, uses safe filename construction, rejects protected inputs rather than attempting password bypasses, and does not claim to preserve PDF features it has not verified. A PDF can contain active or unusual structures that do not survive structural authoring; users should retain the original when those features matter.

## Fixtures and tests

The fixture generator creates small reproducible inputs for text, scanned, mixed, multipage, bounded sampling, blank-page, landscape, merge-order, and JPEG/PNG image-to-PDF scenarios. The pure domain suite covers exact range parsing, merge counts, image-to-PDF plans, safe filenames, blank classification, bounded large-document plans, reviewed removal invariants, core result validation, and every core workflow mapping. The final automated gates recorded passing TypeScript, 27 Vitest tests, production build, and whitespace checks before commit.

## Phase 3 boundary

Phase 3 is not started by this milestone. The recommended next milestone is **Smart PDF Optimization**, which may investigate target-size compression, quality/size trade-offs, output-size search, and a separately approved preservation policy. OCR, AI/LLM planning, semantic extraction, cloud processing, batch execution, and all other transformations remain outside this Phase 2 implementation.

## References

[1]: https://pdf-lib.js.org/ "pdf-lib official documentation"
[2]: https://github.com/Hopding/pdf-lib "Hopding/pdf-lib GitHub repository and MIT license"
[3]: https://www.npmjs.com/package/pdf-lib "pdf-lib npm package"
