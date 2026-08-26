# SmartDocs Phase 4: Advanced PDF Intelligence Foundation

## Scope and delivery boundary

SmartDocs Phase 4 extends the existing browser-local image, PDF core, and Smart PDF Optimization workflows with a **bounded document-intelligence foundation**. It measures document structure and preservation signals before optimization, derives a conservative plan, validates generated candidates independently, and keeps the original PDF recoverable. The milestone is intentionally not an OCR engine, an AI/LLM system, or a universal PDF object rewriter.

> The product promise for this milestone is measured local inspection and preservation-first decision support—not semantic understanding or guaranteed rewriting of every PDF object.

All PDF bytes remain in browser memory. The implementation has no backend, cloud processor, account system, billing path, batch queue, sharing flow, analytics request, or remote document API. The browser-local boundary is represented in the domain contracts, tool registry, workflow records, UI copy, and result validation.

## User-facing workflow

The existing **Optimize PDF** panel now runs a staged flow. It first performs the Phase 3 optimization analysis, then opens the same source with the Phase 4 PDF.js service. The service reports exact page count, representative sampled pages, bounded text signals, raster/vector/font-use hints, metadata, page geometry, layout density, likely page roles, document-feature signals, OCR readiness, preservation risk, and a recommendation. The user can disclose advanced signals and likely structure through keyboard-accessible `details`/`summary` controls.

The optimization plan is derived only after the advanced analysis is available. Text/vector content, detected forms, links, annotations, bookmarks, embedded files, and other features that cannot be measured authoritatively are not silently destroyed. When the preservation policy blocks destructive rasterization, the panel retains a non-destructive candidate. If a generated candidate fails its independent preservation comparison, that candidate is revoked and rejected while later candidates continue to be tested. If all generated candidates fail, the original PDF is independently reopened and retained as the safe fallback.

| Stage | Browser-local action | Delivery condition |
|---|---|---|
| Intake | Validate the PDF signature, size boundary, and existing PDF inspection result | Invalid or protected inputs are rejected before optimization |
| Bounded analysis | Sample every page only within the existing sample bound; otherwise inspect pages 1, 2, middle, penultimate, and last | Exact page count is reported separately from sampled-page coverage |
| Advanced plan | Derive OCR readiness, page roles, document insights, preservation risk, and blocked operations | Weak or unavailable evidence remains `unknown` |
| Candidate generation | Reuse the Phase 3 sequential raster/hybrid authoring path only where the plan permits it | No blind xref, content-stream, font, or annotation rewriting |
| Candidate validation | Reopen each output with PDF.js, inspect it again, compare source and candidate feature signals, and require page/text preservation | Candidates with critical feature loss are rejected |
| Result | Select only from independently validated candidates; expose warnings, feature statuses, preview, download, and continuation | Original remains recoverable and download is offered only after validation |

## Architecture and source inventory

The implementation separates pure policy from browser APIs. The domain layer contains serializable contracts and deterministic derivations. The feature layer owns PDF.js loading, page inspection, cleanup, and integration with the existing optimization service. The panel coordinates the two layers without creating a second optimizer.

| File | Responsibility |
|---|---|
| `src/domain/pdfs/document-analysis.ts` | `PdfDocumentAnalysis`, feature/status types, bounded text/layout/image/font contracts, page roles, OCR readiness, structure groups, insights, preservation risk, advanced plans, and `DocumentIntelligenceSnapshot` |
| `src/features/pdf/analyze-pdf-document.ts` | Browser-local PDF.js opening, deterministic sampling, bounded page inspection, metadata/catalog signals, cleanup, progress, cancellation, and assembly of the domain model |
| `src/domain/pdfs/preservation.ts` | Source-versus-candidate comparison for page count, text, annotations, links, form fields, forms, bookmarks, embedded files, JavaScript signals, metadata, page labels, and sampled geometry |
| `src/domain/pdfs/optimization.ts` | Existing Phase 3 policies and candidate generation plus Phase 4-aware plan/result contracts and result-level feature status mapping |
| `src/features/pdf/PdfOptimizationPanel.tsx` | Advanced-analysis UI, preservation-risk gating, per-candidate rejection, safe fallback, result reporting, URL cleanup, and continuation into the existing workspace |
| `src/domain/workflows/types.ts` | Typed advanced-analysis and preservation-aware optimization step sequences |
| `src/domain/tools/registry.ts` | Registry entries for implemented Phase 4 analysis, planning, comparison, validation, and snapshot tools only |
| `tests/fixtures/generate_pdf_fixtures.py` | Reproducible source fixtures, including the small feature-preservation fixture with metadata, link annotation, and outline-generation attempts |

## Bounded analysis model

The analysis service reads the source signature and complete local bytes only after the existing 50 MiB PDF boundary check. PDF.js opens the bytes with a browser worker. For a document within `MAX_PDF_SAMPLE_PAGES`, every page is inspected. For a larger document, the sample is deterministic: pages 1, 2, the ceiling of half the document, the penultimate page, and the last page, with duplicates removed. The existing Phase 3 optimization page boundary remains 120 pages for a full candidate run.

Per sampled page, the service records the display viewport, rotation, bounded text statistics, a bounded text sample, up to 24 compact text blocks, line/block counts, raster-image operator count, vector-drawing operator count, font-use operator count, annotation/link/form counts when page annotations are readable, high-resolution hints, likely role, role confidence, and OCR-readiness hint. Text is capped at the existing 2,000-character analysis limit and per-page sample text is capped at 800 characters. Text blocks are capped at 24 per page; page records, image signals, and other arrays have explicit caps in the domain model.

The document-level result contains the exact page count and sample coverage, but it does not pretend that sampled signals describe every uninspected page. Document-level counts for annotations, links, and form fields are therefore conservative for large PDFs. Embedded image intrinsic dimensions and bytes remain unknown in this safe path. Font-use operators are a signal that fonts were used; embedded/subset status remains unknown and no font is rewritten. Whitespace and repeated-header/footer detection remain unknown because the milestone does not add a full visual layout engine.

## PDF.js API surface and capability boundary

PDF.js is the inspection and rendering authority. Its official documentation describes a document object from which metadata and individual pages can be fetched, and its examples show promise-based `getDocument`, `getPage`, `getViewport`, and `render` usage [1] [2]. The installed PDF.js 6.2.108 declarations were checked while implementing Phase 4. The service uses the following documented surface.

| PDF.js surface | Phase 4 use | What SmartDocs does not infer |
|---|---|---|
| `getDocument({ data, useWorkerFetch: true })` and loading-task `promise` | Open local bytes in the PDF.js worker and detect password/protected failures | It does not execute document JavaScript or trust a document action |
| `numPages`, `getPage`, `getViewport` | Exact page count, sampled page access, dimensions, orientation, and rotation | A sampled page is not proof about an uninspected page |
| `getTextContent` | Bounded text item/character statistics, samples, blocks, and line-density hints | It is not OCR, semantic extraction, translation, table extraction, or a full-text store |
| `getOperatorList` and `OPS` values | Raster-image, vector-drawing, and font-use operator signals | Operator counts are not universal embedded-object inventories |
| `getAnnotations({ intent: "display" })` | Bounded annotation, link, and widget/form-field counts | A failure or unsampled page is `unknown`, not “none” |
| `getMetadata` | Basic information/XMP-advisory field signals | It is not universal metadata-stream enumeration or stripping |
| `getOutline` | Bookmark/outline signal when returned | `null`/failure remains `unknown`; no bookmark tree is rewritten |
| `getAttachments` | Embedded-file signal when returned | A null/failed catalog response is not treated as absence |
| `getJSActions` | JavaScript/action signal | PDF JavaScript is never executed |
| `getPageLabels` and `getMarkInfo` | Page-label and mark-information capability boundary | No accessibility conformance or semantic tagging claim is made |
| `PDFPageProxy.cleanup()` and loading-task `destroy()` | Release page and document resources in cleanup paths | Cleanup does not make arbitrary third-party PDFs safe to rewrite |

The service deliberately converts failed or unavailable catalog/page reads into `unknown` where the model cannot support a safe negative claim. A small feature fixture was verified in the browser as having one annotation and one link, while its bookmark and embedded-file status remained unknown, confirming that the UI does not invent absent features.

## Document intelligence and OCR readiness

The document-intelligence layer is a structured snapshot, not a model-generated summary. It retains file identity and size, PDF version, classification and confidence label, exact and sampled page counts, page roles, text status and bounded counts, density signals, media counts, feature statuses, OCR readiness, structure groups, optimization opportunities, preservation-risk level, and recommendation. It excludes `textPages`, full text, text samples, and text blocks. The snapshot is safe to pass between the local workflow steps because it contains bounded signals rather than document content.

Page-role heuristics are intentionally modest. A first image-heavy page may be labeled `cover`; image-heavy pages with little or no text may be labeled `scan`; text-dense pages may be `text-heavy`; pages with mixed evidence may be `mixed`; and insufficient evidence becomes `unknown`. Confidence is represented separately. OCR readiness follows the same boundary: image-only pages with useful raster evidence are labeled `ocr-likely-useful`, pages with searchable text are labeled `ocr-probably-unnecessary`, and insufficient evidence is `ocr-uncertain` or `unknown`.

> Phase 4 answers “would an OCR engine likely be useful?” It does not perform OCR, produce recognized text, or claim semantic understanding.

## Preservation-risk planning

`derivePreservationRisk` combines the measured classification, forms, links, annotations, embedded files, bookmarks, JavaScript signals, encryption, and vector/text signals. Detected encryption blocks optimization. Detected forms block full-page rasterization. Text/vector preservation blocks full-page rasterization. Links, annotations, bookmarks, embedded files, and JavaScript raise warnings and require post-generation comparison. The risk level is `low`, `medium`, `high`, or `unknown`, with an explicit `preservation-safe`, `preservation-warning`, or `preservation-blocked` status.

The plan is a policy gate rather than a claim that pdf-lib can safely preserve every PDF feature through every authoring route. The existing Phase 3 generator remains responsible for raster candidates and hybrid page copying. Phase 4 adds a candidate-level check around it rather than manipulating cross-reference tables, content streams, fonts, annotations, or indirect objects blindly.

## Candidate validation and result semantics

Every generated candidate is converted to a new local `File`, reopened through the existing intake/PDF.js path, and checked for expected page count, preview availability, non-empty output, and text detectability when the source contained text. The candidate is also rendered on a bounded representative set—first, middle of the deterministic sample, and last—using a temporary canvas that is cleared immediately. When advanced source analysis is available, the candidate is analyzed again and passed to `comparePdfDocumentFeatures`.

The comparison treats changes to page count, detected searchable text, detected annotations, detected links, detected form fields/forms, detected bookmarks, and detected embedded files as critical. Critical loss makes the candidate invalid and records a rejection warning. JavaScript, metadata, page labels, and sampled geometry are reported as changed, preserved, or unknown according to the available signals; they are not silently presented as universally preserved. Candidate-specific preview URLs are revoked when validation fails, temporary representative-render canvases are cleared after each render, and non-selected validated previews are revoked after selection.

The final result distinguishes the candidate’s preservation status from its target-size state. It reports text, links, forms, bookmarks, metadata, and page-count statuses where measured. Metadata removal is reported as `removed` only when a detected basic metadata signal becomes not detected; otherwise it remains preserved, changed, or unknown. General optimizer warnings and preservation-specific warnings remain separate in the result contract so the UI can explain both.

## Security, privacy, and resource policy

The source is validated before expensive work and is never mutated. Input and optimization page limits are enforced. File names are normalized through the existing safe-filename helper. PDF JavaScript signals are inspected but never executed. No URL is fetched from document content. No document bytes or text are logged, uploaded, or sent to a remote service. The browser-local result uses Blob URLs, and preview/download URLs are revoked when replaced or unmounted.

PDF.js page resources are cleaned after each sampled page. Loading tasks are destroyed in `finally` blocks. Raster optimization remains sequential: one page render, one canvas, one encoded image, and one authoring step are handled at a time. Large documents are sampled; large scanned PDFs can still be CPU- and memory-intensive, so cancellation remains visible and preserves the source. The implementation makes no mobile-performance claim because verification was performed in the available desktop browser environment.

## Verification status and deliberate limitations

The automated suite contains 39 passing tests. In addition to the Phase 1–3 coverage, it verifies page roles, OCR readiness, high-risk destructive-path blocking, critical link-loss comparison, bounded snapshot serialization, preservation-status mapping, metadata removal semantics, and advanced workflow step mapping.

Browser verification covered text, scanned/high-resolution, mixed, 100-page sampling, cancellation, target-achieved/best-effort behavior, original recovery, Phase 2 delete regression, operation chaining, local downloadable outputs, and the new feature-preservation fixture. The feature fixture visibly reported one link and one annotation, retained unknown bookmark/embedded-file status, blocked full-page rasterization, preserved the original as a validated 2-page fallback, and offered a valid download. Final scenario evidence is recorded in [`phase-4-browser-verification.md`](phase-4-browser-verification.md); early working observations are retained in [`phase-4-browser-notes.md`](phase-4-browser-notes.md).

This milestone does not implement OCR, AI/LLM planning, semantic extraction, translation, table extraction, universal object-level compression, font subsetting, lossless stream recompression, arbitrary embedded-image replacement, guaranteed metadata stripping, document editing, DOCX/PPTX/XLSX conversion, backend/cloud processing, accounts, billing, sharing, batch queues, or analytics. Those are future product work and are not represented as implemented capabilities.

## References

[1]: https://mozilla.github.io/pdf.js/api/ "PDF.js official API documentation"

[2]: https://mozilla.github.io/pdf.js/examples/ "PDF.js official browser examples"

[3]: https://github.com/mozilla/pdf.js/blob/master/src/display/api.js "PDF.js display API source and inline API contracts"

[4]: https://pdf-lib.js.org/docs/api/classes/pdfdocument "pdf-lib official PDFDocument API documentation"

[5]: https://github.com/Hopding/pdf-lib "pdf-lib official GitHub repository and license"
