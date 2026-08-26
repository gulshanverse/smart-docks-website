# Phase 9 — Office document intelligence engine

## Architecture

Phase 9 extends the existing `FileAsset` union with `OfficeAsset`; it does not create a parallel Office application. The intake path remains `inspectFile(file)`, with PDF detection first, image detection preserved, and OOXML extensions routed to a lazy Office inspector. Office assets retain the shared stable ID, filename, extension, byte size, processing boundary, validation status, immutable browser `File` reference, warnings, and capabilities.

The Office inspector uses a bounded ZIP central-directory reader and selected-entry DEFLATE inflation. It validates `[Content_Types].xml` plus the expected `word/document.xml`, `ppt/presentation.xml`, or `xl/workbook.xml` marker before parsing XML. All package and XML work remains in the browser. The initial application bundle does not eagerly import fflate or the Office inspector.

## Supported Office formats and operations

| Format | Supported operations | Preview semantics | Conversion |
|---|---|---|---|
| `.docx` | Intake, OOXML package validation, metadata, paragraph/heading/table/image/link/section signals, bounded text extraction, interpreted structure preview, bounded TXT export | Semantic/structural interpretation; not Word-faithful rendering | Office → PDF unavailable |
| `.pptx` | Intake, package validation, metadata, slide count, slide text, title signals, shape/image/chart signals, notes/theme/master signals, structural slide preview, bounded TXT export | Structural slide preview; not faithful PowerPoint rendering | Office → PDF unavailable |
| `.xlsx` | Intake, package validation, metadata, sheet listing, visible/hidden sheet state, used-range signals, bounded cell values/formulas, merged-cell signal, bounded TXT export | Bounded XML cell preview; not faithful Excel rendering | Office → PDF unavailable |
| `.doc`, `.ppt`, `.xls` | Explicit rejection as legacy binary Office formats | No unsafe parser is attempted | Unsupported |
| `.docm`, `.pptm`, `.xlsm` | Safe package inspection may be accepted with macro warning; macro execution is never performed | Warning-bearing structural inspection | Conversion unavailable |

## Bounded intelligence model

`OfficeDocumentAnalysis` separates `documentType`, `format`, OOXML version marker, file size, complexity, metadata, format-specific feature signals, warnings, capabilities, preservation risk, processing boundary, validation status, sampled structure, slide summaries, sheet previews, and extracted text. PDF-specific page geometry and classification fields are not reused for Office documents.

The inspector applies a 50 MiB input cap, 512-entry cap, per-entry compressed and uncompressed caps, a 100 MiB total decompressed cap, an 8 MiB XML cap, a 120,000-character text cap, a 30-row sheet-preview cap, a 64-cell-per-row preview cap, and a 50-slide cap. These limits are protective bounds, not performance promises.

## Workflow and UX

The existing workspace now accepts Office files beside images and PDFs. After intake, an adaptive Office workspace displays format, complexity, preservation risk, processing boundary, capability status, warnings, bounded text export, and the relevant Word, presentation, or spreadsheet preview. Image/PDF conversion and PDF tools remain isolated from Office assets through explicit category narrowing.

The Office → PDF capability is shown as **Unavailable** with an explanation rather than producing a screenshot-based or otherwise misleading PDF. This keeps the existing PDF intake boundary authoritative and leaves a future isolated server-worker extension point without silently changing the browser-local boundary. A future genuinely validated Office-generated PDF must enter the existing `handleFile`/PDF.js intake path.

## AI and OCR boundary

Office binaries are not passed to Phase 6 AI. Future AI use may adapt only bounded extracted paragraphs, slide text/metadata, or selected sheet/range cells into the existing context contract after explicit user choice. Embedded images produce readiness signals only; OCR is not automatic and must reuse the existing Phase 5 architecture.

## Validation and chaining

Every accepted Office package has validated ZIP markers, bounded entries, expected OOXML parts, parsed XML, and format-specific structural checks. TXT exports are derived only from bounded extracted text. No Office-to-PDF result is offered, so no unvalidated Office-created PDF can enter SmartDocs. Existing validated PDF results continue through the existing PDF workspace, OCR, AI, actions, optimization, and image conversion paths without duplicate PDF logic.
