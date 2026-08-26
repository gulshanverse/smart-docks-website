# SmartDocs Phase 3: Smart PDF Optimization

## Scope and delivery boundary

SmartDocs Phase 3 adds a browser-local PDF optimization milestone on top of the completed Phase 2 PDF core platform. The feature accepts a validated PDF, analyzes bounded document signals, selects a deterministic quality policy, generates one or more measured candidates when the document is scanned or image-heavy, reopens candidates with PDF.js, and offers only a validated result. The original `File` object remains untouched and recoverable throughout the workflow.

The implementation is intentionally narrower than a universal PDF compressor. Text and vector PDFs use a preservation-first path. Scanned PDFs can be rasterized sequentially into JPEG-backed pages at bounded quality and resolution policies. Mixed PDFs use a hybrid path: raster pages without detectable text may be recompressed, while pages containing text are copied without default rasterization. The result surface reports this distinction rather than claiming that every embedded image in every PDF object was rewritten.

> All document bytes remain in browser memory. No PDF or image is uploaded to a server, API, cloud processor, database, analytics service, or remote storage service.

## User-facing workflow

The top-level workspace now exposes an **Optimize PDF** tab beside the Phase 2 merge, split, conversion, and blank-page tools. A user may enter an exact target such as `compress this PDF under 1MB`, choose a quality policy, and decide whether basic metadata should be preserved when available. A request without a target, such as `compress this PDF`, is accepted as a quality-policy request and does not invent a byte target.

The visible workflow is deliberately staged. The first action analyzes the PDF and reports its measured size, page count, sampled pages, text pages, raster pages, classification, and likely opportunities. The second action runs the deterministic candidate plan. The interface displays actual stage detail and percentage calculations only when a real completed/total count exists. A visible cancel action aborts future candidate work and removes partial candidates; it never replaces the source document.

| User state | Actual behavior | Delivery rule |
|---|---|---|
| No PDF | Shows the optimizer entry panel with an intake prompt | No processing is started |
| Ambiguous goal | Uses the selected quality policy without inventing a target | The result is labeled without a hard target |
| Exact target | Parses decimal KB/MB into bytes and treats the target as a hard constraint | “Target achieved” appears only when measured output bytes are at or below the target |
| Text/vector PDF | Preserves the original bytes and checks the output through PDF.js | No default rasterization or false compression claim |
| Scanned/image-heavy PDF | Tests bounded JPEG quality/resolution candidates sequentially | Highest-quality target-meeting valid candidate wins; otherwise best effort is explicit |
| Mixed PDF | Copies text pages and recompresses eligible image-only pages | Result warns that the path is hybrid and not universal embedded-image rewriting |
| Cancelled run | Aborts candidate selection and clears partial result state | Original remains unchanged and no partial download is offered |

## Domain model

The pure domain contracts live in `src/domain/pdfs/optimization.ts`. They define `PdfOptimizationAnalysis`, `PdfOptimizationIntent`, `PdfOptimizationPlan`, candidate specifications, candidate result measurements, progress stages, metadata policy, quality decisions, and the final result metrics. The domain also owns deterministic quality policies, candidate generation, reduction percentage calculation, target-aware candidate ranking, and best-effort result construction.

The intent parser in `src/domain/intents/parse-intent.ts` now supports PDF target language alongside the existing image parser. It recognizes `under`, `below`, `less than`, `smaller than`, `compress to`, `to`, `≤`, and bare numeric KB/MB phrases. SmartDocs uses decimal units: 1 KB is 1,000 bytes and 1 MB is 1,000,000 bytes. Unsupported units are not silently converted.

The workflow layer adds `PdfOptimizationWorkflow` with explicit steps: `pdf.inspect`, `pdf.analyze.optimization`, `pdf.optimize.target_size`, `validation`, and `pdf.render.preview`. The tool registry advertises `pdf.analyze.optimization` and `pdf.optimize.target_size` only with the `browser-local` processing boundary and PDF input format.

## Analysis and classification

`src/features/pdf/optimize-pdf.ts` opens the document through PDF.js, checks the PDF signature and 50 MiB intake boundary, and inspects pages sequentially. For each sampled page it reads bounded text content, checks PDF.js operator lists for raster-image operators, and records page display dimensions. It never retains the full extracted text in the optimization model.

Small documents are sampled completely. Larger documents use a deterministic sample of no more than eight pages for optimization analysis. The optimization engine accepts at most 120 pages for a full candidate run. The 100-page fixture was verified to analyze five sample pages and take the preservation-first text path without rendering all 100 pages. The existing Phase 2 page workspace retains its own lazy-preview behavior and is not replaced by this analysis.

The analysis is informative rather than an oracle. `text`, `scanned`, `mixed`, `unknown`, `protected`, and `invalid` remain the existing classification vocabulary. A scanned classification means that the bounded signals support an image-heavy policy; it does not prove that every page is visually equivalent or that every PDF object is a raster image.

## Candidate policies and target search

The deterministic quality policies are:

| Policy | JPEG quality | Render scale | Intended decision |
|---|---:|---:|---|
| Maximum quality | 0.90 | 100% | Excellent |
| Balanced | 0.78 | 78% | Good |
| Smaller file | 0.68 | 62% | Acceptable |
| Smallest practical | 0.56 | 48% | Best effort floor |

For scanned PDFs, the selected mode generates an ordered subset of these candidates, from the selected policy toward smaller settings. Each candidate is encoded, measured, and independently reopened. Candidate selection first filters candidates meeting the target, then chooses the highest quality decision and lowest measured byte count as a deterministic tie-break. If no valid candidate reaches the target, the UI selects the best valid candidate and marks the result `best-effort`.

The quality floor is intentionally conservative. The optimizer does not keep reducing quality until it reaches an arbitrary target. This prevents a target-size request from silently producing an unreadable document. A target larger than the input preserves the original bytes; a target that cannot be reached within the floor reports the gap.

## Actual PDF construction

For scanned PDFs, PDF.js renders each page to a bounded canvas sequentially. The canvas is encoded as JPEG at the candidate quality, embedded into a new PDF page with pdf-lib, and then released immediately. The new page uses the original page display dimensions. The engine never uses screenshots of the application interface as PDF content.

For mixed PDFs, the same sequential renderer is used only on a page with raster operators and no detectable text. Pages containing text or pages without eligible raster-only signals are copied structurally through pdf-lib. This is a preservation-first hybrid rather than an all-object optimizer.

For text/vector/unknown PDFs, the candidate is the original byte sequence. This is a deliberate honest result: the current browser-local implementation does not claim to rewrite fonts, content streams, annotations, or embedded images in arbitrary PDFs while preserving all semantics.

## Metadata behavior

The user may preserve basic metadata when available. The optimizer reads and applies basic title, author, subject, creator, producer, and creation date fields through pdf-lib. Alternatively, the user may choose the limited `remove-non-essential` policy, which clears selected basic fields and sets SmartDocs as creator/producer where supported.

This is not universal metadata stripping or preservation. Forms, annotations, links, outlines/bookmarks, embedded files, JavaScript, unusual indirect objects, document-level actions, and every metadata stream are outside the guarantee. The result warnings state this boundary. The Phase 2 merge and split metadata behavior remains unchanged.

## Validation and result lifecycle

Each generated candidate is converted to a new local `File`, passed through the existing intake path, reopened by PDF.js, and checked for the expected page count, preview availability, processing boundary, and text detectability when the source contained text. Candidates failing validation are rejected before selection. The final result includes original bytes, output bytes, target bytes when supplied, reduction bytes, reduction percentage, page count, strategy, quality decision, candidate count, warnings, and `validated` status.

The result card displays side-by-side first-page previews, measured sizes, reduction percentage, target state, strategy, quality decision, warnings, a real download URL, and `Continue editing this PDF`. Continuing a result passes it through normal PDF intake and page-workspace inspection. At the application level, the first PDF source is retained as an original snapshot; the user can return to it after chaining. Generated preview and download object URLs are revoked when replaced or unmounted.

The cancellation controller checks between analysis pages, candidate boundaries, render boundaries, and validation boundaries. PDF.js tasks are destroyed and canvases are cleared in `finally` blocks. No background service, queue, worker server, or cloud job is involved.

## Libraries and licensing

PDF.js remains the inspection and rendering authority because it exposes PDF parsing, text extraction, operator inspection, and browser canvas rendering [1]. pdf-lib `1.17.1` remains the structural authoring authority for creating PDFs, copying pages, setting basic metadata, embedding JPEG/PNG data, and saving bytes [2] [3]. pdf-lib is distributed under the MIT license [4]. Both libraries are used as browser-side JavaScript dependencies; no native PDF binary or server process is required by this milestone.

## Privacy, security, and performance

The application validates the PDF signature before expensive work, rejects invalid or password-protected inputs, enforces the existing 50 MiB PDF boundary and the 120-page optimization boundary, constructs safe filenames, avoids HTML interpolation of file names, and keeps processing on the local origin. The final browser verification checks that no `/api/`, `/upload`, cloud, or external document-processing request is made.

Sequential rendering is a deliberate memory policy. Only one PDF page and one canvas are active during rasterization, output candidates are processed one at a time, and large-document analysis is sampled. The optimizer does not claim mobile-device testing; the browser verification was performed in the available desktop browser environment. High-resolution raster documents may still be CPU- and memory-intensive, and users can cancel a run.

## Deliberate limitations and Phase 4 boundary

This milestone does not implement universal object-level PDF compression, font subsetting, lossless stream recompression, image extraction/replacement inside arbitrary content streams, OCR, AI/LLM planning, translation, semantic extraction, table extraction, document editing, backend processing, cloud storage, batch queues, public sharing, authentication, billing, or analytics. It also does not provide a guaranteed target for every PDF. Those exclusions are intentional and are not represented as hidden or fake controls.

The next recommended milestone is **Phase 4: advanced PDF optimization and document intelligence**, subject to separate approval. It should begin with a preservation and compatibility strategy for forms, annotations, links, bookmarks, fonts, embedded files, and object-level image replacement before adding any broader automation.

## References

[1]: https://mozilla.github.io/pdf.js/ "PDF.js official project documentation"

[2]: https://pdf-lib.js.org/ "pdf-lib official documentation"

[3]: https://www.npmjs.com/package/pdf-lib "pdf-lib npm package"

[4]: https://github.com/Hopding/pdf-lib "pdf-lib GitHub repository and MIT license"
