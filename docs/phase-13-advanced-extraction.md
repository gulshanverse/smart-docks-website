# Phase 13 — Advanced Document Extraction & Structured Data

**Contract:** `phase13-extraction-v1`

Phase 13 turns SmartDocs into a bounded document-to-structured-data workspace. It accepts a document or bounded document collection, chooses a reusable schema, builds a deterministic Phase 12 workflow plan, extracts values from supplied local evidence, validates fields and provenance, exposes uncertainty, and exports validated records as JSON or CSV.

## Architecture

The implementation is split into four cooperating layers. `src/domain/extraction/types.ts` defines the versioned contracts, bounded JSON values, field types, evidence, confidence, statuses, warnings, conflicts, document results, collection results, aggregation rules, plans, and export results. `src/domain/extraction/schemas.ts` provides reusable invoice, receipt, contract, resume, form, financial-document, identity-document-signal, purchase-order, and generic-document schemas. `src/domain/extraction/deterministic.ts` performs label-aware extraction from bounded native text, OCR text, Office text, cell text, or image evidence and never invents source references. `src/domain/extraction/normalize.ts` handles explicit number, currency, percentage, date, email, phone, URL, boolean, enum, and string normalization. `src/domain/extraction/validation.ts` validates schema shape, required fields, field evidence, document identity, collection duplicates, collection conflicts, and bounded aggregation. `src/domain/extraction/export.ts` produces size-limited JSON and CSV only when records are present and within the export limit.

`src/features/extraction/planner.ts` is the Phase 13 planner. It consumes existing asset classification and text-availability signals, selects an appropriate schema from the goal or explicit schema choice, avoids OCR when text is available, keeps AI optional, and builds a reviewable Phase 12 DAG. A text-native path is inspect → deterministic → normalize → validate → provenance → export. A scanned path adds bounded text/OCR steps. An explicitly semantic path adds an AI-gateway step with a confirmation boundary. Collections add a bounded per-document extraction path and aggregation step.

`src/features/extraction/ExtractionWorkspace.tsx` is the first-class Extract Data workspace. It provides goal entry, schema selection, bounded source evidence, staged review, Phase 12 step display, local-versus-AI disclosure, field-level result rows, a field inspector, evidence excerpts, confidence and warning states, optional source-page navigation, and JSON/CSV downloads.

## Trust model

> An extracted value is never presented as authoritative when it is missing, conflicting, invalid, uncertain, or unsupported.

Every field carries a status, confidence category, method, source references, and bounded evidence. Missing values remain `null` and are surfaced as missing or unknown. Ambiguous dates remain unknown rather than being silently converted. Collection duplicates and conflicts remain visible; the aggregator does not select a winner without evidence. Identity-document extraction exposes only visible content signals and explicitly does not verify authenticity or identity.

The browser-local boundary is the default. AI is optional, server-assisted, requires explicit confirmation, and receives only bounded structured context through the existing Phase 6 gateway. Raw PDF bytes are not sent to the gateway. Existing OCR, PDF, Office, collection, and Phase 12 orchestration layers remain the source of truth for their respective capabilities.

## Bounded limits

| Resource | Limit |
|---|---:|
| Schema depth | 4 levels |
| Schema fields | 80 fields |
| Extracted records | 100 records |
| Collection documents | 12 documents |
| Evidence excerpt | 300 characters |
| Evidence per field | 8 references |
| Export size | 2 MB |

## Validation and export

The result state distinguishes validated, partial, failed, cancelled, empty, and conflict outcomes. JSON exports preserve the contract version, records, field evidence, collection status, duplicates, and conflicts. CSV exports flatten the bounded record fields and leave unavailable values empty rather than converting them to false or zero. Exports are size-limited and are rejected when no record is available or the limit is exceeded.

## Verification

Phase 13 tests cover schema contracts, deterministic invoice extraction, real evidence references, missing fields, provenance validation, duplicate and conflict detection, JSON and CSV export, text-native planning, OCR-required planning, and explicit AI-gateway planning. Existing Phase 1–12 tests remain part of the same deterministic suite.

## Explicit non-features

This milestone does not provide arbitrary code execution, legal interpretation, identity authenticity verification, universal Office rendering, formula recalculation, unbounded batch queues, silent AI authority, fake coordinates, unsupported source references, or forensic guarantees about every document object and metadata stream.
