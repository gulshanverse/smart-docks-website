# Phase 7: Safe document actions

**Status:** Implemented as a bounded, browser-local document-actions layer on top of SmartDocs Phase 1–6 PDF inspection, page intelligence, OCR, and AI understanding.

## Purpose and boundary

Phase 7 turns a reviewed intent into a **document action plan**. The plan is data, not executable code. It contains a stable source document identifier, stable page identities, bounded target regions, evidence labels, preservation impact, risk, preview requirements, and confirmation requirements. The plan is validated before it reaches the authoring function.

The original `File` remains immutable. Every accepted plan creates a new PDF in browser memory, reopens it with PDF.js, checks page count and output readability, and exposes a download only after validation succeeds. If authoring, reopening, or redaction validation fails, the candidate is discarded and the source remains available.

> AI can recommend a structured action proposal; it cannot execute one. Only a reviewed action that has passed the local planner and an explicit confirmation step may reach the deterministic PDF author.

## Implemented action registry

| Action | Authoring path | Risk and validation |
|---|---|---|
| Region redaction | PDF.js raster render with a black overlay, then a new image-backed page | High impact; target coordinates are checked against page geometry; optional exact text is checked for absence through bounded PDF.js extraction. |
| Region highlight | pdf-lib translucent rectangle | Low impact; page reopen and page-count validation. |
| Add text | pdf-lib standard-font text draw | Low impact; bounded text and font size; page reopen and page-count validation. |
| Note | pdf-lib bounded note rectangle and text | Low impact; bounded text, region, and font size. |
| Shape | pdf-lib rectangle, line, or arrow | Low impact; bounded shape and region. |
| Crop | pdf-lib crop box | Medium impact; coordinates must be inside the source page. |
| Resize | pdf-lib named A4, A5, Letter, or Legal page size | Medium impact; named sizes only and no silent content stretching. |
| Basic metadata update | pdf-lib title, author, subject, creator, and producer fields | Low impact; only explicitly supplied basic fields are changed. |
| Basic metadata removal | Clears supported basic fields and sets creation date to the epoch | Medium impact; nonstandard metadata streams remain unknown and are disclosed. |

Existing page delete, extract, reorder, and rotate tools remain available in the established Page intelligence workspace. Phase 7 action plans can represent those types for future proposal integration, while the new editor currently exposes the region, annotation, geometry, and metadata actions above.

## Action plans and provenance

`src/domain/actions/types.ts` defines `phase7-action-plan-v1`, the `pdf-points-bottom-left` coordinate model, page identities, target rectangles, bounded parameters, evidence categories, and preservation impacts. The page identity is derived as `${documentId}:page:${pageNumber}` and is checked against the current source document and exact page count.

`src/domain/actions/planner.ts` validates page numbers, region positivity, bounded coordinate limits, annotation text length, font-size limits, shape membership, metadata target shape, maximum action count, and action ownership. It deduplicates equivalent queued actions and rejects conflicts such as delete-plus-annotation, crop-plus-fixed-coordinate annotation, and rotation-plus-fixed-coordinate annotation. High-risk and unknown-impact actions carry a visible confirmation requirement.

The planner also exposes an AI-proposal validator. An AI proposal must be labeled with `evidence.source = "ai"` and `processingBoundary = "server-assisted"`; it is then revalidated as a normal action before it could be copied into a user review queue. The deterministic executor never accepts a gateway response directly.

## Coordinate semantics

Regions are expressed in PDF points. The origin is the bottom-left of the unrotated page. `src/domain/actions/coordinates.ts` maps viewport rectangles into this model, accounts for 0°, 90°, 180°, and 270° page rotations, clamps only through an explicit utility, and provides named page-size helpers. The planner rejects negative or non-positive geometry; the executor performs a second check against the actual rendered page width and height.

The current browser editor exposes numeric PDF-point fields and a local text-match helper. The helper searches PDF.js text content only, reports bounded page-local matches and approximate rectangles, and requires each match to be individually queued for review. It does not pretend to solve general visual layout, handwriting, or OCR alignment.

## Review, execution, and recovery

The editor queue is ephemeral React state. The user can add actions, remove individual actions, clear the queue, inspect the action summary, preview the source page, and open a separate confirmation dialog. High-impact redaction explains that the page will be rasterized for genuine visual removal and that highly sensitive or forensic documents need independent verification.

During execution, the UI reports page-level progress and allows cancellation. Cancellation aborts the PDF.js rendering path, discards partial output, and leaves the source untouched. For redaction, the page is rendered locally, the requested region is painted over in the raster output, and the page is embedded into a newly authored PDF. If an exact target string was supplied, the candidate is reopened and passed through the existing bounded local text extraction path; a remaining target rejects the candidate.

Validated output includes a safe sanitized filename such as `document-redacted.pdf`, `document-highlighted.pdf`, `document-annotated.pdf`, or `document-edited.pdf`. The output is ephemeral until the user downloads it or chooses `Continue editing`, which passes it through the existing intake and page-workspace recovery path. Undo and redo restore prior validated result snapshots; they do not attempt unsafe inverse editing of PDF internals.

## Workflow and registry integration

Phase 7 adds explicit `pdf.action.plan`, `pdf.action.review`, `pdf.action.execute`, `pdf.action.validate`, `pdf.redaction.review`, `pdf.redaction.execute`, and `pdf.redaction.validate` workflow steps. Implemented action tools are registered as browser-local tools with explicit parameters for stable page identity, geometry, review, and validation. The optional Phase 6 AI gateway remains server-assisted only for semantic understanding and proposal generation; it is not part of PDF authoring.

## Intentional limitations

This milestone does not promise universal Acrobat-compatible object editing. It does not rewrite arbitrary content streams, fonts, annotations, forms, bookmarks, embedded files, JavaScript, xref structures, or nonstandard metadata. Redaction is genuine for the supported rasterized-page path, but rasterization can remove searchable text and unsupported interactive features; the UI discloses that impact. No result is presented as a legal, forensic, or archival guarantee.

Multi-document knowledge bases, autonomous actions, background queues, cloud processing, accounts, sharing, billing, and office-document editing remain outside the Phase 7 boundary.

## References

1. [PDF.js API documentation](https://mozilla.github.io/pdf.js/api/)
2. [pdf-lib API repository](https://github.com/Hopding/pdf-lib)
3. [SmartDocs Phase 4 preservation architecture](./phase-4-advanced-pdf-engine.md)
4. [SmartDocs Phase 5 OCR and searchable-PDF architecture](./phase-5-ocr-searchable-pdf.md)
5. [SmartDocs Phase 6 AI document intelligence](./phase-6-ai-document-intelligence.md)
