# Phase 8 — Conversion matrix

The matrix below is the user-facing capability boundary for the browser-local universal conversion engine. A path is supported only when the planner can create an explicit plan and the adapter can reopen or decode the generated output for validation.

| Source | Target | Supported | Settings | Validation and delivery | Important limits |
|---|---|---:|---|---|---|
| PDF | JPEG | Yes | `all` or explicit pages, 72/150/200/300 DPI, quality, per-page target size | JPEG signature/MIME, dimensions, pixel budget, target-size state; individual page downloads | Rasterizes appearance; text, links, forms, annotations, bookmarks, and other PDF objects are not editable in the image |
| PDF | PNG | Yes | `all` or explicit pages, 72/150/200/300 DPI, target-size best effort | PNG signature/MIME, dimensions, pixel budget, target-size state; individual page downloads | Rasterizes appearance; large DPI/page selections are bounded |
| PDF | WebP | Conditional | `all` or explicit pages, 72/150/200/300 DPI, quality, target-size best effort | WebP signature/MIME and decoded dimensions are checked; path is rejected if browser canvas cannot encode WebP | Browser canvas support varies; no ZIP packaging is added |
| JPEG | PDF | Yes | A4/A5/Letter/Legal/original-size page, orientation, contain/cover/fit-width/fit-height, margin, background | `%PDF` signature, expected page count, geometry, PDF.js reopen/preview | Image-only PDF; metadata may be removed; no searchable text layer |
| PNG | PDF | Yes | A4/A5/Letter/Legal/original-size page, orientation, contain/cover/fit-width/fit-height, margin, background | `%PDF` signature, expected page count, geometry, PDF.js reopen/preview | Transparency is composed according to the selected background; no searchable text layer |
| WebP | PDF | Yes, normalized | Same page settings as JPEG/PNG | WebP is converted through browser canvas to a white-background PNG, then the PDF is reopened through PDF.js | Requires canvas WebP decode; original WebP metadata is not preserved |
| JPEG | PNG | Yes | Quality and target-size best effort | PNG signature/MIME, dimensions, pixel budget | Canvas conversion may remove metadata |
| JPEG | WebP | Conditional | Quality and target-size best effort | WebP signature/MIME and decoded dimensions | Browser canvas WebP encoding must succeed |
| PNG | JPEG | Yes | Quality, target-size best effort, white or black background | JPEG signature/MIME, dimensions, pixel budget | Transparency is flattened; metadata may be removed |
| PNG | WebP | Conditional | Quality and target-size best effort | WebP signature/MIME and decoded dimensions | Browser canvas WebP encoding must succeed |
| WebP | JPEG | Yes | Quality, target-size best effort, white or black background | JPEG signature/MIME, dimensions, pixel budget | Metadata may be removed |
| WebP | PNG | Yes | Target-size best effort | PNG signature/MIME, dimensions, pixel budget | Metadata may be removed |
| JPEG/PNG/WebP collection | PDF | Yes | Ordered files, page geometry, fit, margin, background | Expected page count equals ordered input count; `%PDF` signature, geometry, PDF.js reopen/preview | Order is preserved; PDF is image-only; output is downloaded as one PDF |
| Mixed PDF and image collection | Any | No | — | Planner error before execution | Mixed collection semantics are intentionally rejected |
| PDF/image | DOCX/PPTX/XLSX/HTML/ZIP | No | — | Planner error before execution | Universal office round-trips, archive packaging, and cloud conversion are outside Phase 8 |

## Target-size semantics

`KB` and `MB` use decimal units: 1 KB is 1,000 bytes and 1 MB is 1,000,000 bytes. The engine tries bounded quality candidates only where the adapter supports quality changes. A result can be `targetAchieved`, `bestEffort`, or unspecified when no target was requested. A best-effort result reports measured bytes and never claims an unattained target.

A target scope can be `per file`, `per page`, `total`, or `unspecified`, depending on the source and plan. The planner rejects target scopes that do not match the operation, invalid or zero byte targets, and workloads beyond the configured file/page/pixel limits. Size growth is disclosed when conversion produces larger bytes than the selected source.

## Preservation semantics

PDF-to-image preserves the rendered page appearance only. Image-to-PDF preserves the decoded image appearance within the selected page geometry and fit policy but does not preserve a searchable text layer, arbitrary metadata, or interactive PDF objects. JPEG cannot preserve alpha; the user-visible background setting is the explicit policy. No source is modified, and output links appear only after validation.
