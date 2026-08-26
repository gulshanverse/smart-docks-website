# Phase 10 — Unified document workspace

## Purpose

Phase 10 turns the completed Phase 1–9 engines into one product experience without replacing them. The primary path is now:

> **One file → one workspace → one human goal → one validated plan → one execution handoff → one verified result → continue, recover, or inspect history.**

The unified workspace is an orchestration shell. PDF.js, pdf-lib, Tesseract.js, the AI boundary, the safe-action executor, the conversion adapters, and the Office inspector remain the authorities for their respective operations.

## Workspace hierarchy

The shell presents four shared layers: a validated document overview, capability discovery, natural-language goal entry, and a reviewable workflow plan. The specialized workspaces remain below it for PDF pages, optimization, OCR, understanding, editing, conversion, and Office-specific inspection.

| Layer | Responsibility |
|---|---|
| Intake | Classify the local source using the existing file model and preserve the immutable `File`. |
| Overview | Show only measured or detected facts appropriate to the format. PDFs use pages and geometry; Office files use sections, slides, sheets, formulas, and package signals. |
| Capability discovery | Read the existing tool registry and expose only implemented operations for the current asset. |
| Goal normalization | Convert bounded human language into a typed `phase10-intent-v1` representation. Deterministic parsers remain first; AI is never a silent replacement. |
| Plan review | Show steps, risk, processing boundary, confirmation policy, expected output, and validation requirements before execution. |
| Specialized handoff | Delegate to the existing engine rather than duplicating PDF/OCR/AI/action/conversion/Office execution. |
| Result and recovery | Preserve existing validated result previews, downloads, continuation, original recovery, and bounded session behavior. |

## Format-specific behavior

Images expose target-size optimization and supported image/PDF conversion. PDFs expose optimization, organization, conversion, OCR, local search, understanding, and safe editing according to the existing tools. DOCX, PPTX, and XLSX expose Office overview, bounded structure/content inspection, and TXT export. Office files never receive fabricated PDF page controls or screenshot-based conversion.

AI interpretation remains visually and semantically distinct from measured and detected facts. When a future or existing AI workflow uses the gateway, its plan boundary is shown as **browser-local + explicit AI gateway** rather than local-only.

## Accessibility and performance

The plan is composed of native headings, labels, textareas, buttons, ordered steps, status regions, and keyboard-reachable controls. The shell is responsive at narrow widths and respects reduced-motion preferences. Existing dynamic imports, PDF.js worker loading, OCR worker lifecycle, bounded inspection, sequential expensive work, and bounded context remain intact.

## Deliberate boundary

This milestone does not add accounts, storage, analytics, queues, cloud Office rendering, Office-to-PDF conversion, universal PDF rewriting, autonomous actions, or persistent document history. The workflow plan and state live in the current browser session only.
