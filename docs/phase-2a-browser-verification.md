# Phase 2A Browser Verification

## Text PDF

On the local Vite app, `tests/fixtures/text-fixture.pdf` uploaded successfully through the visible file picker. PDF.js loaded the document in the browser, rendered a first-page preview, detected `2 pages`, reported `Text PDF`, showed `Text layer: Detected`, displayed `A4 · Portrait`, exposed PDF version `1.3` and PDF.js `6.2.108` in Details, and showed the browser-local privacy label. The initial run exposed a stale `Rendering preview` status, which was corrected by clearing the stage in the intake cleanup path.
## Scanned PDF

After a clean reload, `tests/fixtures/scanned-fixture.pdf` uploaded successfully. The live app showed a first-page preview, `2 pages`, `Likely scanned PDF`, `Text layer: Not detected`, `A4 · Portrait`, PDF version `1.3`, PDF.js `6.2.108`, and the local-processing label. The UI also displayed the heuristic-classification warning rather than claiming certainty.
## Mixed PDF and network boundary

`tests/fixtures/mixed-fixture.pdf` replaced the scanned fixture successfully. The app rendered the first page, reported `2 pages`, `Mixed PDF`, `Text layer: Detected`, `A4 · Portrait`, version `1.3`, and the pinned engine version. Resource inspection showed PDF.js and its worker loading locally, with no `/api/` or `/upload` resource. The PDF blob remained a browser-local object URL; no server processing endpoint was used.
## Invalid PDF

Replacing the mixed fixture with `tests/fixtures/invalid-fixture.pdf` rejected the file using the signature check, restored the empty intake state, and showed a clear recovery message. The browser console showed no application error; only the standard React DevTools informational message and the prior resource inspection output were present.

## Final text-PDF retest

After the workflow-validation integration, `text-fixture.pdf` was uploaded again. The card showed `Text PDF`, `2 pages`, `Text layer: Detected`, `A4 · Portrait`, the first-page preview, and the validation message `PDF loaded, classified, and first-page preview rendered locally.` No stale `Rendering preview` processing strip remained after inspection completed.

## Oversized PDF

A temporary 51 MiB file beginning with a valid PDF signature was accepted by the browser upload harness and rejected before PDF.js parsing. The app showed `PDF is too large for browser-local inspection.` with the 50 MB memory-bound explanation and smaller-file recovery. The first attempt from `/tmp` was correctly blocked by the upload harness path policy; the same test file was copied into the allowed home directory and then exercised successfully.

## Image regression

The existing `/home/ubuntu/phase15-noisy.jpg` fixture was accepted after the PDF changes. The app displayed the local image preview, filename, `1600 × 1000`, JPEG type, and `1.6 MB` size. The goal-entry interaction was then exercised; the 50KB target was parsed as `Target understood: ≤ 50 KB`, and the local optimizer entered its measured `Optimizing` state. It completed with a verified downloadable JPEG at `23.5 KB`, `704 × 440`, `98.5%` reduction, and `Target achieved`, while explaining the bounded resize recovery. The browser console had no application errors. At the available 1280px browser viewport, the document had no horizontal overflow (`scrollWidth` 1265px and `clientWidth` 1265px).
