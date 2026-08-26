# Phase 3 Browser Notes

During local verification on `http://127.0.0.1:4178`, the new `Optimize PDF` tab loaded lazily and retained the existing Phase 2 tabs. The deterministic `large-scanned-fixture.pdf` (5,339,402 bytes, 3 pages) was analyzed as `scanned`, with three raster pages and no text pages. A balanced request of `compress this PDF under 1MB` produced a validated 491,376-byte, three-page PDF, an observed reduction of 90.8%, and a `Target achieved` state. The result provided a real download URL, an independent PDF.js preview, and a `Continue editing this PDF` action.

An intentionally impossible `compress this PDF under 5KB` request on the small scanned fixture produced a validated best-effort result with an explicit target-not-reached warning rather than claiming success. A text fixture produced an `Original preserved` result with text-preserving strategy and no destructive rasterization. The current browser run showed no React update-depth failure during these checks.

The browser test also showed that a target above the original size preserves the original bytes and reports the preservation honestly. Additional final verification is still required for mixed PDFs, cancellation, source recovery, 100-page bounded analysis, network/console evidence, and Phase 2 regression paths.

The mixed fixture loaded as a two-page `mixed` PDF with a detected text page and a second image page. The optimizer panel loaded as the active default tab, and the application copy now identifies the PDF core plus optimization surface. The mixed candidate run remains pending.

The mixed fixture was analyzed as `mixed` with one text page and one raster page. A 7 KB target produced a validated 59,907-byte best-effort result, reported text/vector pages copied and image-heavy pages recompressed, and did not claim target success. An immediate cancel test on the 5.34 MB, three-page scanned fixture displayed both the cancelled status and safe-cancellation notice; no partial result card or download remained.

The 100-page sampling fixture remained usable. Optimization analysis reported five sampled pages out of 100, a text classification, zero raster pages in the sample, and a preservation-first result that retained all 100 pages. The UI explicitly warned that analysis was sampled and that optimization was bounded; no all-page raster run occurred.

The final resource-timing check returned an empty list for resources outside the local origin and blob URLs. The console showed only the normal React DevTools informational message and the recorded test commands; no unhandled optimizer or update-depth errors were observed. The existing twelve-page Phase 2 fixture loaded after optimization changes, and two page-workspace checkboxes were selected to prepare a minimal delete regression.

The existing Phase 2 page workspace regression passed after loading the optimizer: two selected pages were confirmed for deletion from the twelve-page fixture, producing a validated ten-page PDF with a real download, `Continue with this result`, and `Return to original`. The optimization panel remained mounted beside the workspace without affecting the mutation flow.

The final resource-timing check returned `external: []` and `remoteDocumentLike: []`; all 200 observed network resources were on the local Vite origin. This is the final local-only evidence for the current browser session.
