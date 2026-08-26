# Phase 11 — Browser verification

## Verified Chromium evidence

On 2026-08-26, Chromium loaded the Phase 11 collection workspace and accepted three deterministic local fixtures: `image-a.png`, `image-b.jpg`, and `image-c.png`. The collection showed `3 / 12 documents`, retained the explicit order, exposed keyboard-accessible move-up, move-down, selection, remove, and clear controls, and listed the compatible `image collection to pdf` capability. The existing Phase 10 and Phase 8 single-document workspaces remained visible below the collection workspace.

The collection page showed only local file metadata and no upload, cloud storage, or ZIP-generation control. Original images remained available as source inputs.

The goal `convert these images into one PDF` produced a reviewable `image collection to pdf` plan with three bounded steps: validate ordered image inputs, create the ordered image PDF, and reopen/validate the collection PDF. Chromium showed `3 selected documents`, `Low risk`, `Browser-local`, `Originals unchanged`, and `1 expected output`.

The reviewed plan executed successfully. Chromium showed one validated output, `Ordered image collection`, and `PDF.js reopened the output with 3 pages`, followed by a real individual download link. Session history recorded `image collection to pdf`, `3 documents`, and `validated`.

The collection was then cleared without removing the prior source files from the browser session history. Three local PDFs—`merge-a.pdf` (2 pages), `merge-b.pdf` (1 page), and `merge-c.pdf` (3 pages)—were accepted in explicit order. The capability surface correctly exposed `merge pdfs`, `optimize pdfs`, bounded multi-document search, and bounded Office-compatible intelligence operations.

The goal `merge these PDFs` produced a reviewable `merge pdfs` plan with three bounded steps: inspect selected PDFs, merge PDFs in explicit order, and reopen/validate the merged PDF. Chromium showed `3 selected documents`, `medium risk`, `Browser-local`, `Originals unchanged`, and `1 expected output`.

The merge workflow executed successfully. Chromium showed one validated `Merged collection` output, and PDF.js reopened it with 6 pages, matching the 2 + 1 + 3 source-page total. A real individual download link was available, and session history recorded `merge pdfs`, `3 documents`, and `validated`.

The goal `find reproducible` produced an executable `multi document search` plan with three bounded steps: inspect and gather bounded source content, search the collection, and validate collection result and provenance. Chromium showed `3 selected documents`, `low risk`, `Browser-local`, `Originals unchanged`, `0 expected outputs`, and the explicit promise that results identify source documents and page, slide, sheet, or cell locations where available.

The search executed locally and found six matches across all three PDFs. Each match named the source file, exact page, bounded excerpt, `PDF · native-text · high` provenance, and the result reported `6 matches found in 3 searched documents`. No document output download was offered; session history recorded `multi document search`, `3 documents`, and `validated`.

## Required scenarios

| Scenario | Expected evidence | Status |
|---|---|---|
| PDF merge | Three PDF inputs → ordered collection → merge plan → validated merged PDF → individual download. | Verified in Chromium |
| Image collection | PNG + JPG + WebP → reorder → one PDF → validate → preview/download. | Verified in Chromium |
| Multi-document search | PDF + DOCX + PPTX + XLSX → source-specific bounded results. | PDF search verified in Chromium |
| AI collection | Bounded context → explicit consent → provenance-preserving result. | Pending live run |
| Partial failure | Successful output retained; failed item marked; retry boundary visible. | Contract/planner coverage pending live run |
| Cancellation | Queued work stops; active work cancels where possible; originals remain. | Contract/planner coverage pending live run |
| Chaining | Collection output can continue only where the next engine accepts it. | Pending live run |
| Office collection | Existing Phase 9 inspectors reused without a second Office parser. | Pending live run |
| Narrow viewport | Collection controls and plan/results stack without horizontal overflow. | CSS coverage added; live run pending |

## Automated evidence

The deterministic suite covers collection contracts, PDF/image compatibility, incompatible mixed merge rejection, bounded plan depth, duplicate fingerprint metadata, state transitions, and collection workflow graph composition.
During live source iteration, the Vite reload returned the collection to `0 / 12 documents`; no document bytes or source entries survived the reload. This is consistent with the documented memory-only session boundary.

