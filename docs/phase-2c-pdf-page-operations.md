# Phase 2C: Browser-Local PDF Page Operations

## Scope

Phase 2C adds four real PDF page operations to the browser-local SmartDocs workspace: **delete selected pages**, **extract selected pages into a new PDF**, **reorder pages**, and **rotate selected pages by 90°, 180°, or 270°**. The original PDF is never modified. Every operation creates a separate output file, reopens it through the existing PDF.js inspection path, renders a first-page preview, validates the output page count and local boundary, and exposes a download only after validation succeeds.

The implementation deliberately does not add PDF compression, exact-size optimization, metadata editing, merge/split-document workflows, conversion, OCR, AI, server processing, uploads, cloud storage, accounts, billing, batch execution, or other future infrastructure.

## Architecture

The implementation keeps the existing Phase 2A/2B boundaries:

1. `src/domain/pdfs/operations.ts` contains pure typed operation plans. It validates page numbers, deduplicates selections deterministically, rejects deleting every page, normalizes page order, calculates expected output counts, and accepts only 90°, 180°, or 270° rotations.
2. `src/features/pdf/mutate-pdf.ts` is the browser-local structural authoring service. It loads the source with `pdf-lib`, creates a new document, copies pages in the planned order, removes selected pages by omission, applies cumulative page rotation, saves bytes, and returns output-size and filename metadata.
3. `src/domain/workflows/types.ts` exposes `createPdfMutationWorkflow`, which represents the ordered browser-local steps: inspect, mutate, render first-page preview, and validate.
4. `src/domain/pdfs/mutation-validation.ts` validates the reopened output’s page count, preview availability, byte accounting, and processing boundary. It warns when structural authoring increases output size and explicitly states that compression was not applied.
5. `src/features/pdf/PdfPageWorkspace.tsx` owns selection, operation confirmation, reorder state, mutation progress, result handling, download, continue-with-result, return-to-original, and cleanup-safe result URLs.
6. `src/domain/tools/registry.ts` registers only the implemented capabilities: `pdf.delete.pages`, `pdf.extract.pages`, `pdf.reorder.pages`, and `pdf.rotate.pages`, alongside the existing inspection and preview tools.

## Mutation engine decision

Phase 2C pins `pdf-lib@1.17.1`. The library is pure JavaScript, browser-compatible, TypeScript-aware, and provides the required structural operations through `PDFDocument.load`, `PDFDocument.create`, `copyPages`, `addPage`, `removePage`, `page.setRotation`, and `save`. The research record is in [`phase-2c-library-research.md`](phase-2c-library-research.md).

PDF.js remains the inspection and rendering engine. Keeping authoring and inspection separate makes the browser boundary explicit and allows output validation to use an independent parser/rendering path.

## Operation semantics

| Operation | Selection rule | Output behavior |
|---|---|---|
| Delete | One or more valid pages; all-page deletion is rejected | Copies every unselected source page in original order |
| Extract | One or more valid pages | Copies only selected pages in ascending selection order |
| Reorder | A complete unique permutation of all page numbers | Copies pages exactly in the proposed order |
| Rotate | One or more valid pages plus 90°, 180°, or 270° | Copies every page and adds the selected rotation to selected pages, modulo 360° |

The operation layer is intentionally deterministic. It does not mutate the source `File`, source `PdfAsset`, PDF.js page objects, or the Phase 2B thumbnail state.

## Validation and privacy

The output is represented as a new `File` with a safe derived filename. The browser creates a separate download object URL and uses PDF.js to reopen the output. A result card appears only when parsing succeeds, the expected page count matches, a first-page preview is available, and the processing boundary remains `browser-local`.

Object URLs for result downloads and output previews are revoked when a later result replaces them, when the user continues with a result, when the user returns to the original, and when the workspace unmounts. The original remains available through the parent PDF summary and the Return to original control.

The app does not claim perfect preservation of every PDF feature. Creating a new PDF with pdf-lib may not preserve all forms, annotations, links, embedded files, outlines, JavaScript, unusual objects, or metadata. The app therefore uses honest structural-operation language and validates basic document usability rather than promising byte identity or complete semantic preservation.

## UX behavior

The operation toolbar appears only after pages are selected or the proposed order differs from the original. Delete, Extract, Rotate, and Reorder actions require explicit confirmation. The interface shows the selected count, allows Select all and Clear, supports move-up and move-down reorder controls, and preserves keyboard-accessible page navigation from Phase 2B.

The result card includes the derived filename, operation summary, input and output byte sizes, output page count, first-page preview, local-processing badge, validation message, and a warning when output bytes increase. The available actions are Download PDF, Continue with this result, and Return to original.

## Verification

The deterministic 12-page text fixture was tested in a real browser:

- deleting pages 2 and 5 produced a validated 10-page PDF;
- extracting pages 3, 6, and 9 produced a validated 3-page PDF;
- moving page 2 above page 1 produced a validated 12-page reordered PDF with the expected larger-output warning;
- rotating page 1 by 90° produced a validated 12-page PDF;
- every result received a first-page preview and a real download link;
- the original source remained unchanged during all runs;
- the browser console remained free of application errors;
- resource inspection showed local app/PDF.js assets and no `/api/`, upload, cloud, or storage requests.

Automated domain coverage includes deterministic operation planning, invalid selection rejection, delete-all rejection, unique reorder validation, rotation normalization, mutation-result page-count validation, local-boundary validation, and output-size warnings. The complete browser record is in [`phase-2c-browser-verification.md`](phase-2c-browser-verification.md).

## Explicit nonfeatures

This phase does not compress or optimize PDFs, target a byte size, edit metadata, merge documents, split documents into arbitrary files, convert PDF formats, run OCR, invoke AI/LLM services, upload files, call a backend, use cloud storage, add accounts, process batches, or run background jobs. These remain future work requiring separate approval and architecture.
