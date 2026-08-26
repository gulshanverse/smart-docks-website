# Phase 11 — Collection workspace architecture

## Purpose

Phase 11 extends the Phase 10 Unified Document Workspace from one source file to a controlled in-memory collection. The collection layer is an orchestration boundary, not a replacement for the specialized PDF, image, OCR, AI, conversion, or Office engines.

A collection keeps stable document IDs, immutable original `File` references, safe source metadata, explicit order, selection state, duplicate fingerprints, a collection goal, a deterministic intent, a bounded workflow plan, state, warnings, provenance, and ephemeral history. Document bytes are never copied into history objects or persisted.

## Compatibility and planning

`src/domain/collections/compatibility.ts` evaluates the full selected collection before planning. It does not infer compatibility from individual capabilities alone. PDF merge requires at least two PDFs; ordered image-to-PDF requires image-only inputs; PDF optimization is PDF-only; bounded search and document intelligence accept PDF and supported Office assets. Mixed incompatible inputs produce an explicit error rather than silently skipping or changing the goal.

`src/domain/collections/planner.ts` maps collection goals such as `merge these PDFs`, `convert these images into one PDF`, `optimize all PDFs under 2MB`, and `find invoice numbers in all these documents` into a typed collection intent and a bounded dependency graph. Every step names its capability, input IDs, output IDs, dependencies, risk, processing boundary, cancellation policy, confirmation requirement, and validation plan. The graph is deliberately small and typed; it is not an arbitrary DAG executor.

| Workflow | Inputs | Outputs | Validation |
|---|---|---|---|
| PDF merge | Two or more selected PDFs in explicit order | One PDF | Reopen with PDF.js and verify total page count |
| Ordered image collection | Selected JPEG, PNG, and WebP images | One PDF | Reopen with PDF.js and verify one page per input |
| Bounded collection search | PDF and/or DOCX/PPTX/XLSX | Source-specific matches | Validate query bounds, coverage, locations, and provenance |
| Collection inspection | Any supported selected assets | Analysis-only result | Reuse each format’s existing inspector |

## Execution and recovery

The collection workspace executes only the verified merge and ordered image-to-PDF paths in this milestone. Both paths call the existing PDF authoring functions and reopen their outputs through the existing intake/PDF.js validation seam. Individual real download URLs are created only after validation and are revoked when outputs are replaced, the collection is cleared, or the component unmounts.

The workspace retains the successful output when a later step fails. It displays validated, failed, cancelled, or not-started status per result and does not convert a partial outcome into a whole-collection success. Collection state transitions reject impossible paths such as `cancelled → completed`.

## Bounded limits

The current browser-local collection limits are deliberately conservative: 12 documents per collection, 120 total PDF pages for PDF-only batch planning, 24 OCR pages when a future collection step delegates to the existing OCR worker, 120,000 searchable characters, 100 matches, 12 outputs, eight graph depth levels, and 20 in-memory history entries. Heavy operations remain sequential and reuse existing cleanup and worker boundaries.

## Search and provenance

Collection search reuses the existing PDF analysis and text extraction modules through lazy imports and the Phase 9 Office `extractedText` and `sampledStructure` fields. PDF matches identify page numbers; Office matches identify the existing section, slide, sheet, cell, or structural location when available. It never fabricates Office page numbers. Search reports searched-document coverage and bounded-limit application.

## UX hierarchy

The collection workspace is mounted above the existing specialized workspaces. Users can add, select, reorder, remove, and clear documents; inspect basic metadata and warnings; enter one goal; review the compatibility-aware plan; run a supported workflow; download validated individual outputs; and inspect lightweight session history. The Phase 10 single-document workspace and Phase 1–9 specialized tools remain available below and continue to own their existing execution behavior.

## Explicit non-goals

This milestone does not add a database, cloud storage, automatic upload, ZIP generation, arbitrary workflow code, unbounded queues, full batch optimization/OCR/AI execution, Office rendering, Office-to-PDF conversion, semantic equivalence claims, or cross-session persistence. Unsupported collection operations remain visible as unsupported rather than being simulated.
