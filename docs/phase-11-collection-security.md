# Phase 11 — Collection security and privacy

## Browser-local source boundary

Collection intake receives `File` objects from the browser and retains them only in component memory. The collection never serializes or uploads source bytes, never creates a database record, and never writes document content to localStorage. The only persistent project artifacts are source code, deterministic fixtures, and documentation.

The current supported collection execution paths call the existing browser-local PDF authoring and validation functions. Search uses bounded extracted text and structure signals. Optional AI work remains subject to the Phase 6 explicit-consent gateway and may receive only bounded structured context; raw PDF bytes, raw Office packages, full images, credentials, and API keys are excluded.

## Untrusted document handling

Every file is inspected through the existing signature and format-specific intake path. Office packages continue to use the Phase 9 bounded ZIP reader; macros are never executed, external relationships are treated as signals, and remote resources are not fetched. PDF JavaScript is never executed. Collection goals and workflow plans are data only: a step must reference a registered, implemented capability, and the collection layer never evaluates user-provided code, AI callbacks, serialized functions, or shell commands.

## Bounds and resource control

The collection accepts at most 12 documents, limits PDF batch planning to 120 total pages, caps searchable content at 120,000 characters and 100 matches, caps outputs at 12, and retains at most 20 history entries. Search query input is limited to 160 characters and excerpts to 240 characters. Heavy PDF analysis and extraction are lazy-loaded and run sequentially. The implementation does not create an unbounded queue or retry indefinitely.

## Validation and download safety

Collection outputs are not offered for download until they are reopened through the existing intake/PDF.js validation seam and their expected page count is verified. Failed and cancelled results never receive a download link. Download URLs are tracked and revoked when the output set is replaced, the collection is cleared, or the component unmounts. ZIP packaging is not advertised because no validated ZIP engine exists.

## Provenance and state safety

Per-result provenance retains document identity, safe document name, format, and location when available. Office search does not invent page numbers. A failed dependency cannot be represented as a completed downstream result. Invalid collection transitions are rejected, including cancellation followed by completion. Partial success retains validated outputs and marks failed or cancelled work accurately.

Duplicate metadata is detected using bounded filename, size, modification time, and MIME fingerprints. Duplicates are disclosed and retained unless the user explicitly removes one. Filenames are rendered as text and passed through existing safe download naming behavior; they are never interpolated as HTML.

## Privacy audit checklist

| Check | Policy |
|---|---|
| Raw document upload | No automatic upload or `FormData` collection path |
| AI boundary | Bounded, consent-gated structured context only |
| Credentials | No client credential or provider-secret literals |
| History | Memory-only metadata; no document bytes |
| Object URLs | Revoked on replacement, clear, and unmount |
| PDF/Office execution | No PDF JavaScript, macro, or Office code execution |
| Unsupported capability | Explicit message; no fake download or silent fallback |
| Recovery | Originals remain unchanged; validated outputs remain available |
