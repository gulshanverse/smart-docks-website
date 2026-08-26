# Phase 8 — Conversion security and preservation

## Local-only boundary

All Phase 8 conversion adapters run in the browser foreground. The conversion panel receives `File` objects from the existing local intake or the panel’s local selectors; it does not upload bytes, call an external converter, use a provider key, or rely on a cloud codec. The optional Phase 6 AI gateway remains unrelated to conversion and receives no raw PDF/image bytes.

Source files are immutable application inputs. Conversion creates new `Blob`/`File` outputs and never overwrites an original. A generated PDF can be continued through the existing workspace, which preserves the current source-recovery behavior. There is no permanent result store, analytics event, background queue, or server-side conversion process.

## Capability honesty

The capability registry lists the implemented image and PDF appearance paths only. A format label is not treated as proof that a browser can encode it: the output MIME and magic bytes are checked after encoding. WebP is offered only where canvas returns `image/webp`. Unsupported office, archive, and object-level PDF transformations are rejected rather than approximated.

The conversion planner rejects mixed source categories, unsupported target combinations, invalid ranges, excessive file/page/pixel workloads, and contradictory settings such as transparent output into JPEG or explicit orientation combined with original-image page sizing. Ambiguous natural-language goals are shown as ambiguous and require explicit controls.

## Validation

Every image output is checked for expected signature, MIME agreement, dimensions, pixel budget, and bounded size semantics. PDF output is checked for `%PDF` signature, expected page count, PDF.js reopen/preview availability, page geometry, and plan compatibility. A download link is created only after these checks pass.

Target sizes are measured constraints, not guarantees. The engine uses a bounded set of quality candidates. If the candidate floor remains above target, the UI reports **Best effort** with actual measured bytes. If conversion increases size, SmartDocs states that fact. No unbounded quality degradation or silent resizing is attempted.

## Rendering and authoring risks

PDF-to-image conversion rasterizes page appearance. Text, links, annotations, forms, bookmarks, and other interactive objects do not survive as editable objects. Image-to-PDF creates image-only pages; it does not add searchable text. JPEG cannot preserve transparency, so a white or black background must be selected. Canvas conversion may remove image metadata. WebP-to-PDF is normalized through a white-background PNG because pdf-lib’s verified embedding path accepts JPEG/PNG here.

PDF.js tasks and temporary canvases are cleaned up. Object URLs for previews and results are revoked on replacement and unmount. A cancellation signal stops future work, discards partial candidates, and leaves the source untouched. Conversion outputs are kept only in in-memory React state and temporary object URLs.

## Input and output handling

The existing intake signature and size limits remain authoritative. Generated names are sanitized and collision-safe. Source order is explicit and preserved in image-to-PDF plans. No filename is inserted as HTML. Preview and download actions use normal browser object URLs and do not expose secrets.

The conversion UI displays the processing boundary, expected output count, selected settings, warnings, and validation message. A user can review and rebuild the plan before execution. Conversion is not an autonomous external action; it is a visible, local file-authoring action with measured output.

## Intentional non-goals

Phase 8 does not promise universal office-file conversion, faithful editable round-trips, arbitrary image metadata preservation, forensic PDF sanitization, guaranteed target size for every input, ZIP packaging, cloud conversion, OCR during image-to-PDF, or background processing. Unsupported capabilities remain out of the registry and are surfaced as clear errors.
