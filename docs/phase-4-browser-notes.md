
## Phase 4 live check — text fixture intake

The local Vite browser session successfully loaded `text-fixture.pdf` (1.4 KB, 2 pages, text layer detected, A4 portrait) through the existing local intake and page workspace. The lazy Optimize PDF panel mounted with goal parsing, four quality policies, basic metadata policy, and a real Analyze and optimize PDF action. No backend upload or external document processor was involved in this check. The advanced analysis action is the next verification step; no result is offered before analysis and validation.

## Text PDF advanced analysis

`text-fixture.pdf` completed the advanced analysis flow in the browser. The UI reported 2 pages, text on both sampled pages, no raster pages, 4 basic metadata fields, OCR probably unnecessary, likely text-heavy page structure, and a medium preservation-risk warning with full-page rasterization blocked. The no-target result preserved the original bytes at 1.5 KB, remained two pages, reopened successfully with PDF.js, and offered download/chaining only after validation. The report correctly showed unknown bookmarks/embedded-files rather than inventing absence.

## Feature-preservation fixture — 2026-08-26

Loaded `feature-preservation-fixture.pdf` in the local Vite app and ran **Analyze and optimize PDF**. The UI reported a 1.6 KB, 2-page text PDF with 2 text pages, 0 raster pages, OCR probably unnecessary, and high preservation risk. Bounded advanced signals reported 1 annotation, 1 link, 0 forms, 4 metadata fields, JavaScript not detected, and bookmarks/embedded files unknown. The UI explicitly stated that link annotations must be preserved or the candidate rejected and blocked `full-page-rasterization`.

The validated result preserved the original as a 2-page, 1.6 KB PDF with 0.0% reduction, one validated candidate, safe preservation, text preserved, pages 2 → 2, and unknown → unknown bookmarks/embedded-file status. The output remained downloadable and PDF.js validation succeeded. This confirms conservative fallback when a text/link document has no safe destructive optimization path.

## Refreshed high-resolution scanned fixture — 2026-08-26

On the cache-busted refreshed app, loaded `large-scanned-fixture.pdf` (5.34 MB, 3 pages). Intake classified it as a likely scanned PDF with no text layer, A4 portrait dimensions, and raster page signals. The advanced analysis completed locally and reported **low preservation risk**, 3 raster pages, 0 text pages, **OCR likely useful**, searchable text not detected, vector signals not detected, 0 annotations/links/forms, unknown bookmarks/embedded files, 4 metadata fields, and 0 high-resolution pages. The likely structure was page 1 cover and pages 2–3 scan; the plan strategy was optimize eligible raster with no destructive operation blocked.

The run completed without a target using the refreshed implementation. It produced a 1.00 MB validated PDF from 5.34 MB, an 81.2% measured reduction, 3 pages → 3 pages, and 3 validated candidates. The chosen strategy was image quality and resolution at the Good policy. The result reported safe preservation, text/links/forms preserved, bookmarks/embedded files unknown, metadata preserved, and PDF.js validation success. The UI explicitly said OCR would likely improve searchability but no OCR was run.

## Refreshed mixed-fixture hybrid run — 2026-08-26

Loaded `mixed-fixture.pdf` (9.5 KB, 2 pages) and ran the refreshed Phase 4 flow. Analysis reported a mixed PDF with one text page, one raster page, OCR likely useful, searchable text detected, and likely structure groups of page 1 text-heavy and page 2 scan. The hybrid plan optimized eligible images while preserving text pages.

The validated candidate retained 2 pages and searchable text, with links/forms preserved, bookmarks/embedded files unknown, metadata preserved, and PDF.js validation successful. Because the generated output was larger than the 9.5 KB source (59.9 KB), the measured reduction was honestly shown as 0.0% and the result warned that preserving the original may be preferable. This confirms that hybrid processing does not claim a reduction when the measured bytes increase.

## Refreshed 100-page sampling fixture — 2026-08-26

Loaded `sampling-fixture.pdf` (35.6 KB, 100 pages). Intake reported the exact 100-page count and the existing bounded classification note. The advanced analysis reported **5 sampled pages of 100**, exact page count 100, 5 text pages, OCR probably unnecessary, likely text-heavy groups for pages 1–2, 50, and 99–100, and a preservation-first structure strategy with full-page rasterization blocked.

The no-target run preserved the original as a validated 36.4 KB, 100-page output with 0.0% reduction and one validated candidate. The result explicitly retained searchable text, pages 100 → 100, metadata preserved, bookmarks/embedded files unknown, and stated that analysis was sampled while the authoritative count remained 100. No full-document text or all-page rasterization was claimed.

## Refreshed browser resource and layout check — 2026-08-26

The refreshed app console contained only the normal React DevTools informational message and the intentional local DOM-triggered test action; no runtime error was observed. The browser performance-resource check returned `external: []` and `suspicious: []` for URLs matching `api`, `upload`, `cloud`, `storage`, `googleapis`, or `gstatic`. At the available desktop viewport, `clientWidth` and `scrollWidth` were both 1265 pixels, so no horizontal overflow was detected.

## Representative-render validation — 2026-08-26

After adding candidate-level representative rendering, reran the small `text-fixture.pdf`. The validated result reported `Representative pages rendered: 1, 2.` It preserved the original at 1.5 KB, remained 2 pages, retained text/links/forms/metadata statuses, kept bookmarks and embedded files unknown, and exposed the validated download. This confirms the PDF.js render-validation path succeeds on the current local browser and does not block the conservative text fallback.
