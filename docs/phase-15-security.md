# Phase 15 — Security Review

Phase 15 keeps project state local by default and introduces no account, cloud, analytics, synchronization, or remote document-processing service. Persistent document bytes are written only after the user explicitly selects **Save to project**. Temporary intake remains separate from durable project data.

IndexedDB records are versioned and bounded. Metadata exports exclude original bytes. Stored bytes are kept in a dedicated `document-bytes` record kind, while temporary object URLs, worker instances, canvases, abort controllers, raw prompts, API keys, OCR buffers, and PDF JavaScript state are not persisted.

Imports are untrusted data. The importer validates the contract version, required arrays, metadata-only byte policy, and total package size, creates a fresh local project identity, disables AI by default, and never executes imported workflows, URLs, capabilities, provider configuration, macros, PDF JavaScript, or arbitrary commands. Only currently registered capabilities can be invoked through the existing application.

The implementation uses no `eval`, `Function` constructor, dynamic executable import, upload endpoint, raw-byte telemetry, or document analytics path. Existing PDF.js and Office package safety rules remain authoritative. Project deletion removes project metadata and document records without mutating the current temporary intake or changing the original source object in memory.

Known limitation: this milestone uses an ephemeral in-memory fallback only when IndexedDB is unavailable, primarily to keep domain tests deterministic. In supported browsers, persistence is asynchronous and IndexedDB-backed. Durable crash recovery is bounded to metadata and explicitly saved files; active workers and partial outputs are intentionally discarded.
