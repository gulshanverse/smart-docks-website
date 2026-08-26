# Phase 6 browser verification

**Date:** 2026-08-26

**Environment:** Chromium in the sandbox, Vite development server on `127.0.0.1:4179`, SmartDocs repository at the Phase 6 working tree, committed synthetic fixtures only. The local gateway ran separately on `127.0.0.1:8787` with sandbox-only provider credentials for compatibility smoke testing; no credential was written to the repository.

## Scenario matrix

| Scenario | Evidence | Result |
|---|---|---|
| Load application and inspect Phase 6 entry point | Fresh Vite app loaded; `Understand document` tab visible beside existing PDF tools | Passed |
| Upload text-native fixture | `tests/fixtures/text-fixture.pdf` uploaded through the existing PDF intake | Passed; PDF remained local and rendered in the page workspace |
| Default mock provider | Provider visibly labeled `Deterministic mock · local test mode`; panel says no document content leaves browser | Passed |
| Mock overview | Overview completed with bounded context metadata, validated result, and source chips | Passed |
| Source-page navigation | Clicking the Page 2 provenance chip selected Page 2 in the existing workspace and displayed `Showing source page 2 from the verified AI reference.` | Passed |
| External provider consent | Selecting `Configured AI gateway · external` displayed a consent dialog explaining bounded context, no original bytes, ephemeral results, and validation | Passed; no request occurred before consent |
| Gateway proxy and request | Vite proxy forwarded `/api/ai/document` to the standalone gateway after restart; gateway smoke returned HTTP 200 with a completed validated ask envelope | Passed in controlled synthetic smoke |
| Provider failure state | Earlier timeout was displayed as `Provider unavailable` with one retry message; the UI did not fabricate a result | Passed |
| Narrow-layout review | The tested browser viewport showed the AI panel and result content without obvious horizontal overflow | Passed for the tested viewport; additional device matrix remains future work |

## Network and privacy evidence

The mock flow made no external AI request. The gateway flow showed only the approved `/api/ai/document` route in the application design. The browser adapter sends JSON context, not a `File`, `ArrayBuffer`, base64 PDF, image payload, credential, or provider key. The gateway’s server logs contain only request ID, operation, status/outcome, and duration. The synthetic request was bounded to one page, one text block, a short query, and the Phase 6 context version.

The browser intentionally exposes the distinction between local/mock and external/gateway modes. External mode requires consent each time the provider boundary is entered after a new browser session or operation state. The result banner identifies validated AI output and still directs the user to verify important information against the source page.

## Regression checks

The existing local PDF inspection, page workspace, PDF core tabs, OCR + search entry point, and source recovery remained available after the Phase 6 tab was mounted. Phase 6 uses the same existing PDF viewer navigation callback rather than creating a second viewer. Pure TypeScript tests and the production build were rerun after the integration edits; the final release gate records the exact command outcomes.

## Limitations

This is not a claim that an external provider is available in every deployment. A static build without a separately deployed gateway supports local/mock mode only. The browser smoke request used a sandbox provider endpoint and synthetic data; production providers, origin configuration, HTTPS, distributed rate limiting, and operational monitoring require deployment-specific setup. Scanned documents may require the existing local OCR preparation before semantic operations and can be more CPU-intensive than text-native fixtures.

## Gateway negative-path smoke

A synthetic HTTP check against the standalone gateway returned `400 invalid-schema` for missing consent, an obvious raw-byte field, and an over-limit context. An exact development origin received the configured CORS header, while a foreign origin received no allow-origin header. A zero-content rate test returned `429 rate-limit` after the configured ten-request process-local bucket was exceeded. These checks exercised only synthetic data and did not invoke the model on invalid requests.
