# Phase 9 — Office security model

Office files are untrusted input. SmartDocs processes supported OOXML packages locally and treats every filename, MIME value, XML part, relationship, embedded object, formula, hyperlink, comment, and document instruction as data rather than executable instructions.

## Protective controls

| Threat | Control |
|---|---|
| Misleading extension or MIME | Expected OOXML ZIP markers and required package parts are validated before classification. |
| Malformed ZIP | EOCD and central-directory signatures, offsets, entry sizes, supported compression methods, and local headers are checked. |
| ZIP bomb/decompression exhaustion | Input, entry, XML, entry-count, total-decompressed, text, slide, and sheet-preview limits are enforced before and during inflation. |
| Path traversal | Absolute paths, backslashes, and unsafe `..` package paths are rejected. |
| Encryption | Encrypted ZIP entries and unsupported encrypted Office packages are rejected. |
| Macros/VBA | Macro-enabled formats and `vbaProject.bin` are warning-bearing inspection states; VBA and Office scripts are never executed. Conversion remains unavailable. |
| External relationships | External links and external workbook entries generate warnings; SmartDocs does not fetch remote targets. |
| Embedded objects | OLE/embedding entries are signaled and not executed. |
| Pathological XML | Selected parts are parsed only after byte limits; malformed XML fails safely and bounded text is retained. |
| Memory growth | Only bounded sampled paragraphs, slide text, and sheet cells enter the UI; millions of cells are not loaded into React state. |
| Privacy leakage | Office binaries remain in browser memory; no upload, analytics payload, remote font, CDN, or Office API is used. |
| Output confusion | Only validated bounded TXT extraction is downloadable. Office-to-PDF is explicitly unavailable rather than simulated. |

## Processing boundary

The Phase 9 path is:

`File → browser → bounded ZIP/package reader → selected XML parser → format-specific analysis → local preview/TXT result`.

The original Office `File` remains immutable and local. The optional Phase 6 AI gateway is not invoked by Office inspection and must never receive the Office binary. Any future server-assisted rendering must be an explicit user-consented operation with a bounded context and independently validated result; the current implementation does not silently switch boundaries.

## Non-goals

SmartDocs does not execute VBA, embedded Office scripts, document JavaScript, external hyperlinks, external data connections, formulas as code, OLE objects, or macros. It does not promise Microsoft Office compatibility, faithful rendering, fully preserved formatting, formula recalculation, chart preservation, print-area fidelity, comments/tracked-change fidelity, or Office-to-PDF conversion.

## Recovery

When a package fails validation or exceeds a limit, the application returns an explicit intake error and recovery suggestion. It does not offer a download, retain a partially trusted asset, or fabricate a result. Legacy `.doc`, `.ppt`, and `.xls` are classified as unsupported and users are directed to save as `.docx`, `.pptx`, or `.xlsx`.
