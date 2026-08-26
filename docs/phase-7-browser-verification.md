
## Browser verification evidence

The existing workspace loaded the synthetic `phase6-invoice-fixture.pdf` and exposed a new **Edit PDF** tab alongside the Phase 4–6 tools. The editor displayed the local-only mutation boundary, bottom-left PDF-point coordinate model, action selector, page/region inputs, text-match search, and a pending-action review queue.

A synthetic region-redaction action was added to the review queue. The UI displayed a high-impact warning and required a separate `Review and apply` step followed by an explicit `Confirm and apply` dialog. After confirmation, SmartDocs created `phase6-invoice-fixture-redacted.pdf`, reopened it with PDF.js, confirmed the expected page count, verified that the selected text was not detected by the supported text-extraction path, and showed the message `New PDF created. The original remains unchanged.` The output also disclosed that the targeted page was rasterized for genuine visual redaction and that highly sensitive or forensic documents require independent verification.

No original PDF bytes were overwritten during this browser test. Undo/redo controls were visible on the validated result; no network boundary was involved in the local action flow.

The dedicated `phase7-redaction-fixture.pdf` was then loaded. Entering the fictional `redaction@example.test` query and running **Find matches** returned one bounded local match on page 1. Queueing that match produced a reviewed redaction action with page identity `page 1` and a measured PDF-point rectangle; no remote request was involved.
