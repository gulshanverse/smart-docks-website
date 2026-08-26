# Phase 10 — Browser verification

## Verification scope

Phase 10 browser verification covers the new unified shell above the existing specialized workspaces. The purpose is to confirm that the goal entry point produces an explainable plan, the plan exposes the correct processing boundary and risk, confirmation is required where appropriate, and execution remains delegated to the existing validated engine.

| Scenario | Expected evidence | Status |
|---|---|---|
| PDF upload | Unified overview shows PDF type, measured page count, source size, and available capability pills; existing PDF page workspace remains visible. | Pending live run |
| PDF target-size goal | Plan shows PDF inspection → optimization → validation, local boundary, preserved original, and specialized Optimize PDF handoff. | Pending live run |
| OCR/search goal | Plan shows inspection → OCR/searchable result → validation without inventing progress; existing OCR panel remains authoritative. | Pending live run |
| AI understanding goal | Plan visibly labels the AI gateway boundary and review requirement; no raw document upload is introduced. | Pending live run |
| Safe editing goal | Plan shows explicit confirmation and high risk before the existing Phase 7 action queue. | Pending live run |
| Office goal | DOCX/PPTX/XLSX overview and format-specific workspace remain visible; Office files receive no PDF page controls. | Pending live run |
| Office TXT extraction | Plan shows bounded Office inspection → extraction → validation; existing TXT export remains available. | Pending live run |
| Unsupported Office → PDF | Plan is rejected with an honest unavailable message and no download. | Pending live run |
| Image optimization | Unified plan hands off to the existing adaptive compression result and preserves image preview/download behavior. | Verified in Chromium |
| PDF/image conversion | Unified plan remains compatible with the Phase 8 conversion panel and ordered collection workflows. | Pending live run |
| Cancellation/recovery | Cancelled or failed workflow cannot become completed; original source remains recoverable. | State-machine tests passed |
| Narrow viewport | Overview, plan, confirmation buttons, and capability pills stack without horizontal overflow. | CSS coverage added; live run pending |

## Chromium evidence

On 2026-08-26, Chromium loaded the updated app successfully and accepted the deterministic local `image-a.png` fixture through the existing file chooser. The page displayed the new **Unified document workspace** with a detected Image overview, measured 640 × 420 dimensions, 2.5 KB source size, workflow state `Idle`, and capability pills derived from the registry for compression and image conversion. The existing Phase 8 conversion workspace remained visible below the unified shell with its ordered-image controls. The browser page contained no upload or cloud-processing control.

The goal `make this image under 100KB` was entered into the unified textarea and reviewed successfully. Chromium displayed workflow state `Review`, a two-step plan for target-size optimization and image validation, `Low risk`, `Browser-local`, `Original: Remains unchanged`, and `Expected: Validated optimized image`. The explicit `Run validated plan` control was available only after the review card rendered.

The reviewed plan was executed successfully. Chromium showed workflow state `Completed`, the unified success state, and the existing validated image result with `Target achieved`, decoded PNG output, original/optimized previews, measured bytes, unchanged dimensions, and a real download control. This verifies delegation from the unified shell into the existing optimizer rather than a duplicate execution path.

## Automated evidence

The Phase 10 deterministic suite covers image, PDF, Office, supported/unsupported goals, capability discovery, unified plan composition, confirmation policy, processing boundary, and impossible workflow transitions. Existing Phase 1–9 tests continue to run unchanged.

## Network boundary

The unified planner and shell contain no document upload, analytics, storage, or provider request. Local workflows remain browser-local. Existing AI gateway behavior remains opt-in and bounded by the Phase 6 context contract; raw binaries and credentials are excluded.

## Known limitation

The shell currently performs orchestration and validated handoff. Multi-step execution remains owned by the existing specialized engines; Phase 10 does not invent a duplicate executor or promise an atomic cross-engine transaction where the underlying engine does not provide one.
