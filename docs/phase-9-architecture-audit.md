# Phase 9 — Repository architecture audit

## Current architecture

SmartDocs is a single React/Vite application with a shared browser-local file intake and a typed intent → plan → execute → validate → result workflow. The canonical file model is `src/domain/files/types.ts`, where `FileAsset` currently discriminates images and PDFs. `src/features/intake/inspect-file.ts` dispatches PDF candidates to PDF.js inspection and all other files to image inspection. `src/features/pdf/` owns PDF.js inspection/rendering and pdf-lib authoring; `src/features/conversion/` owns Phase 8 PDF/image adapters; `src/domain/conversions/` owns conversion contracts, capabilities, planning, naming, and validation.

`src/domain/tools/registry.ts` is the capability registry and `src/domain/workflows/types.ts` is the explicit workflow registry. The top-level `src/App.tsx` owns the immutable current file reference, source/result object URL lifecycle, notices, recovery chaining, and mounting of PDF workspaces/tools. Existing PDF continuation enters the same intake boundary through `handleFile`, so a validated Office-generated PDF must use that path rather than inventing a second PDF workspace.

## Existing assumptions

The current intake accepts JPEG, PNG, WebP, and PDF. Several UI labels and legacy Phase 2 descriptions refer specifically to images or PDFs, and the existing optimization path is image/PDF-specific. PDF fields such as page count, points, PDF.js geometry, and PDF classification must not be added to Office assets as if they were universal. Office assets need a separate classification and analysis model for paragraphs, slides, sheets, cells, relationships, formulas, and package warnings.

The existing privacy boundary is browser-local for file bytes. The optional Phase 6 gateway accepts only bounded JSON context after explicit consent. Office binaries must not cross that boundary. Object URLs are owned by the relevant component and revoked on replacement/unmount. Office inspection must follow the same lifecycle and must never execute macros, Office scripts, document JavaScript, external relationships, or embedded objects.

## Smallest safe Phase 9 abstraction

Add an `OfficeAsset` branch to the existing `FileAsset` union with a category-specific `OfficeDocumentAnalysis` payload and a bounded `OfficeCapabilitySet`. Keep the immutable `File` reference in the existing top-level ref rather than duplicating it in React state. Add `inspectOfficeFile(file)` as a lazy intake adapter, backed by a focused ZIP package reader and format-specific XML inspectors. Add `OfficeWorkspace` as a first-class panel beside the existing PDF tools; it will render Overview, Text, Slides, Sheets, and Convert sections only when relevant to the inspected type.

The safe implemented subset will be DOCX/PPTX/XLSX structural inspection, bounded extraction, interpreted previews, explicit warnings, and TXT export. OOXML-to-PDF conversion will be represented as an honest unavailable capability because no faithful browser-local Office renderer was verified. The extension point will carry a future server-worker plan without silently changing the current processing boundary. Any future validated Office-generated PDF must call the existing `handleFile`/PDF intake flow.

## Security and test implications

The package reader must bound archive size, entry count, compressed and uncompressed bytes, XML bytes, relationships, and extracted text/cells/slides. It must reject unsafe paths, unsupported compression/encryption, malformed central directories, suspicious external relationships, macro-enabled packages for conversion, and invalid required OOXML markers. Synthetic fixtures must be generated locally and must not contain copyrighted Office documents. Existing Phase 1–8 tests and browser workflows remain regression gates.
