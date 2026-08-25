# Phase 2B PDF Workspace and Page Intelligence

**Author:** Manus AI
**Baseline:** Phase 2A commit `87e8d79`
**Scope:** Browser-local page intelligence and inspection workspace. No PDF page modification is included.

## Outcome

Phase 2B moves SmartDocs from a single first-page PDF preview to a document workspace that understands the PDF as a collection of pages. The browser can inspect individual pages on demand, render bounded previews and thumbnails, navigate through the authoritative page count, display selected-page metadata, and maintain informational page selection for future operations.

The stable Phase 2A document summary remains intact. PDF files remain local to the browser, and the image target-size workflow is not routed through the page workspace.

## Page model

`PdfPageAsset` is a reusable typed model that separates measured page facts from heuristic interpretation.

| Field | Meaning |
|---|---|
| `pageNumber` | Authoritative one-based page number |
| `widthPoints`, `heightPoints` | Normalized page dimensions derived from PDF.js page metadata |
| `orientation` | Measured `portrait`, `landscape`, or `square` relationship |
| `paperSizeHint` | Conservative `A4`, `Letter`, or `other` hint, including rotated A4/Letter recognition |
| `hasText` | Measured presence of non-empty text items in the bounded sample |
| `textCharacterCount` | Bounded meaningful character count, capped at 2,000 |
| `hasRasterContent` | Measured image-paint operator signal from the PDF.js operator list |
| `typeHint` | Heuristic `text`, `scanned`, `mixed`, `image-heavy`, or `unknown` interpretation |
| `previewState`, `previewUrl` | Main selected-page preview lifecycle and browser object URL |
| `thumbnailState`, `thumbnailUrl` | Lazy thumbnail lifecycle and browser object URL |
| `selected` | Informational selection state for the current workspace |
| `warnings` | Page-specific recovery or limitation messages |

The model deliberately does not contain full extracted text, PDF internals, mutation commands, or future operation results.

## Sampling policy

The Phase 2A document inspection remains the first bounded pass. It inspects all pages for documents with at most eight pages. For larger documents, it samples pages 1, 2, the middle page, the penultimate page, and the final page. The total page count reported by PDF.js remains authoritative regardless of the sampling set, and the document summary tells the user when sampling was used.

The page workspace then performs page-level inspection only for pages that are selected or whose thumbnail is visible. It does not precompute a page model for every page in a large document. Page text is reduced to presence and a 2,000-character cap; no document text is stored in React state.

## Thumbnail strategy

Thumbnails are created by `LazyPageThumbnail` with `IntersectionObserver` and a 160px root margin. If the browser does not provide `IntersectionObserver`, the component falls back to loading the thumbnail. Each thumbnail uses PDF.js locally, a bounded maximum dimension of 260px, aspect-ratio-preserving rendering, and a PNG object URL. Hidden pages remain lightweight placeholders until visible or selected.

The main selected-page preview uses a larger bounded render, with a maximum of approximately 1,600 by 2,200 pixels and the existing 1.25 render scale. Preview rendering is separate from thumbnail rendering so a thumbnail failure does not remove the document or prevent navigation.

## Navigation and selection

The workspace defaults to page 1. Previous and Next controls, direct page-number entry, thumbnail buttons, and Home/End and arrow-key handling provide simple navigation without creating an editor toolbar. The selected page is announced with a status such as “Page 2 of 12 selected.”

The current selection model supports one selected page and Clear selection. Selection is informational only: it does not delete, reorder, extract, rotate, merge, split, or otherwise modify a document. The page map and page number state are structured so future operations can consume selected page numbers without creating a second workflow system.

## Metadata and hints

The selected-page panel displays paper-size hint or normalized point dimensions, orientation, millimeter dimensions, text presence and sampled count, raster/image presence, and a user-friendly page hint. Page hints are intentionally qualified where appropriate: `Likely scanned page` and `Likely mixed page` reflect bounded signals rather than semantic certainty.

The document-level classification remains separate from page-level hints. A document can be labeled Mixed PDF based on its sampled document signals while each selected page independently reports Text page, Likely scanned page, Image-heavy page, or Unknown page type.

## Workflow and registry

The existing document workflow remains:

```text
pdf.inspect → pdf.render.preview → validation
```

Phase 2B adds the executed page-level contract:

```text
pdf.inspect.page → pdf.render.preview
```

The registry now contains the actual page-level capability `pdf.inspect.page` in addition to the Phase 2A `pdf.inspect` and `pdf.render.preview` tools. No future modification tool is registered.

## Memory management

The page session owns the PDF.js loading task and the object URLs created for thumbnails and selected-page previews. It provides explicit URL revocation for page switching and revokes all remaining thumbnail URLs when the session closes. Each render clears its canvas dimensions and calls `page.cleanup()` in a `finally` block. The workspace closes the page session when the file changes or the component unmounts.

The implementation avoids full-resolution rendering for thumbnails, all-page eager rasterization, full text retention, stale page objects, and unnecessary duplicate React page data. The page session does reopen the browser `File` after the Phase 2A pass so the existing Phase 2A asset contract stays unchanged; the first session is destroyed before the page workspace session is created.

## Accessibility and mobile behavior

Thumbnail controls are real buttons with accessible page labels and `aria-pressed` selected state. The main preview has an accessible page-specific alternative label. The page controls expose a keyboard-focusable navigation group with arrow, Home, and End handling. Clear selection and direct page entry remain keyboard reachable, and status text is announced with `aria-live` or `role="status"` where appropriate.

Desktop uses a main preview beside a bounded thumbnail rail. At mobile breakpoints, the layout stacks the main preview first and changes the thumbnail rail into a horizontal scroll area rather than a tall page list. The available browser verification viewport showed no horizontal overflow; dedicated device emulation remains a follow-up when a viewport-control harness is available.

## Error handling

A page or thumbnail render failure updates only that page to an error state and displays `Preview unavailable`, allowing navigation to continue. Invalid and protected document states remain owned by the Phase 2A intake boundary. Page numbers outside the authoritative count return a page-unavailable error without requesting an invalid PDF.js page.

## Performance observations

Observed fixture behavior is qualitative rather than a benchmark. The 12-page fixture produced a page-1 preview and rendered thumbnail rail without blocking navigation. The 100-page fixture reported `Classification sampled 5 of 100 pages`, kept the page count at 100, loaded the first visible thumbnail window, and left later thumbnails in `Scroll to load` until needed. No benchmark claims are made for memory, latency, or throughput.

## Fixtures and tests

The deterministic generator now creates `multipage-fixture.pdf` with 12 text pages and `sampling-fixture.pdf` with 100 text pages in addition to the Phase 2A text, scanned, mixed, invalid, and oversized fixtures. Unit tests cover geometry normalization including square and rotated paper hints, bounded sampling, text-signal normalization, page-type hints, default page asset state, browser-local page workflow steps, and all prior image/PDF domain tests.

The browser record is maintained in [`docs/phase-2b-browser-verification.md`](phase-2b-browser-verification.md).

## Security and privacy

All Phase 2A boundaries remain active: PDF signature validation, the 50 MiB limit, bounded document inspection, browser-local PDF.js processing, safe filename rendering, no upload, and resource cleanup. The page workspace adds bounded per-page work and does not execute arbitrary document scripts or expose PDF internals. The PDF.js worker is the only expected non-application resource involved in page rendering.

## Future operation compatibility

The page model and selected-page state are intentionally compatible with future page operations such as deletion, extraction, reordering, rotation, merging, splitting, or blank-page removal. Those operations are not implemented, are not exposed in the UI, and are not registered as tools in Phase 2B.

## Explicit nonfeatures

This phase does not compress PDFs, optimize PDFs to an exact target size, convert PDF to JPG or JPG to PDF, edit or mutate pages, delete or reorder pages, extract or merge documents, rotate pages, run OCR, translate, call AI or LLM services, upload to an API, use server workers, store files in the cloud, persist data in a database, authenticate users, share files publicly, batch process documents, or add billing.
