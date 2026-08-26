# Phase 15 — Persistent Project Workspace & Durable State

**Contract:** `phase15-project-v1`

Phase 15 adds a durable local project layer above the existing Phase 1–14 document and automation engines. Temporary intake remains browser-memory-only until the user explicitly chooses **Save to project**. Saved originals are stored as bounded byte records in IndexedDB; metadata, versions, workflows, history, and settings are stored as separately versioned records.

## Project model

Projects contain stable IDs, names, descriptions, status, actual recorded storage usage, document and workflow counts, local-only settings, recovery state, migration state, and retention policy. The Projects workspace supports creation, reopening, selection, explicit document saving, metadata-only export, safe metadata import, project history, storage metrics, and deletion. Imported packages are treated as untrusted data and are never executed.

## Storage policy

`src/features/storage/indexeddb.ts` provides asynchronous CRUD, list, query, transactions, migration entry points, cleanup, and a bounded in-memory fallback for non-browser test environments. IndexedDB is the browser persistence authority. Metadata records are bounded to two megabytes; explicit document byte records are bounded to the existing 50 MB intake ceiling. `localStorage` is not used for document bytes, OCR output, PDFs, images, Office files, or workflow payloads.

## Immutable originals and versions

Saving a document creates a `ProjectDocument`, an immutable original `DocumentVersion`, a validated `ProjectArtifact`, and a dedicated byte record. The original version is never silently replaced. Future validated transformations can be represented as new versions with parent/source version IDs and provenance; failed, cancelled, or corrupt outputs are not accepted as validated versions.

## Recovery and import/export

Project workflows reference Phase 14 session IDs, checkpoints, retries, reviews, quality gates, reconciliation status, and final result metadata without persisting active workers, abort controllers, raw AI payloads, full prompts, or OCR buffers. Metadata-only export excludes original bytes. Imports validate contract version, required collections, size bounds, and byte-exclusion policy, then create a fresh local project identity with AI disabled by default. Imported workflows remain data until explicitly reviewed and recreated through registered capabilities.

## Limits

| Resource | Limit |
|---|---:|
| Projects | 50 |
| Documents per project | 12 |
| Versions per document | 20 |
| Workflows per project | 100 |
| History events | 300 |
| Metadata import size | 2 MB |
| Saved document bytes | 50 MB per document |

## Boundaries

This milestone does not add accounts, authentication, billing, subscriptions, collaboration, public sharing, cloud document storage, cloud queues, analytics, automatic synchronization, or a second AI provider. The Phase 6 gateway remains the only external AI boundary, and user consent is still required before it is used.
