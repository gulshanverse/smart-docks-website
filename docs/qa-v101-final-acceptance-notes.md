# SmartDocs Final Acceptance QA Notes

## Tested commit

Target commit: 2f2357b57fdc1cd19ed37840086d9fc0e42d24b7. Repository was clean before testing. The full local gate suite passed: frozen-lockfile install, typecheck, lint, 97/97 tests, production build, production audit, and git diff check.

## Fresh-browser primary journey

Fresh Chromium production preview opened at `http://127.0.0.1:4173/?acceptance=clean`.

- First-time user can see Workspace, Tools, Projects, How it works, Processed locally, upload surface, starter tasks, goal composer, and Generate path in the initial page content.
- Real fixture uploaded: `tests/fixtures/text-fixture.pdf` (1.4 KB, 2 pages).
- PDF was inspected and rendered locally. UI showed PDF detected, text layer detected, A4 portrait, and PDF.js inspection locally.
- Goal entered: `Compress this PDF under 1 MB`.
- Review plan executed successfully after using the measured Review plan control. The plan showed inspect, target-size optimization, validation, browser-local processing, original preservation, and verified-before-download metadata.
- Run plan executed. The application showed the unified success message `Your document is ready. The verified result is shown below.` but no result panel, preview, download, or generated PDF appeared. A separate notice said `PDF target understood` and directed the user to Optimize PDF below. This is a confirmed P1 product defect: the default unified path presents success without an actual result and leaves the user at a dead end for the requested compression task.

## QA notes

The run action is wired to the existing `runWorkflow` branch for PDF, which only sets a notice and returns true; the unified layer therefore marks the task completed even though no output exists. No fake download was offered, but the success state is misleading and the requested primary journey cannot complete through the default product path.

Further required QA remains: direct PDF optimization representative output, second PDF workflow, invalid/malformed input, projects/persistence, advanced tools, AI consent, network/privacy, responsive/accessibility, visual/performance, and exact-commit CI status.

## Targeted P1 fix and post-fix verification

The confirmed P1 was fixed without duplicating the PDF engine. Unified PDF plans now open the existing Optimize PDF workspace, pass the real goal into its existing optimization path, and update unified state only after the optimizer produces a validated result or a truthful failure.

Post-fix Chromium verification used the same real fixture and request. The unified plan showed the requested PDF target, Run this plan opened the advanced optimizer, the existing optimizer ran locally, and a validated result appeared with original and optimized previews, 1.5 KB result size, 0.0% reduction because the original already satisfied the <= 1.00 MB target, preserved-text/link/form/metadata status, representative page renders, and the real `text-fixture-optimized.pdf` download link. Fetching the download URL returned HTTP 200, `application/pdf`, and 1,454 bytes.

Malformed-input verification used `tests/fixtures/invalid-fixture.pdf`. SmartDocs rejected it with `This file is not a valid PDF.` and explained that the signature was checked instead of trusting the filename or MIME label. No asset, plan, result, or download was exposed.

The fresh browser resource log contained only same-origin application assets and no external resources. Dedicated Firefox, WebKit, mobile/tablet viewport, automated screen-reader, full PDF/OCR/merge/conversion/extraction/project journey matrix, and remote CI completion for the fix remain NOT VERIFIED.

## Classification after fix

The original P1 is fixed and the primary PDF compression path now produces a real validated downloadable result. No P0 finding was observed. Remaining gaps are verification limitations or lower-priority product polish, not confirmed release-blocking defects.
