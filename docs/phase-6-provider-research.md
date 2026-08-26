# Phase 6 AI provider research

Date: 2026-08-26. Author: Manus AI.

## Decision

Use a provider-neutral SmartDocs AI contract with a minimal server-side gateway. The gateway is the only component allowed to hold provider credentials or call an external model. The browser sends a bounded `AiDocumentContext` and an explicit operation only after consent; it never sends raw PDF bytes, PDF JavaScript, xref data, full images, or an API key.

For the first adapter, use the Manus built-in OpenAI-compatible proxy in server-side code through the injected `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` environment variables. Select `gpt-5-mini` centrally for the initial low-cost workhorse profile, while keeping provider and model in server configuration rather than frontend contracts. The live sandbox catalog on 2026-08-26 reported `gpt-5-mini` with a 400,000-token context window, JSON Schema structured-output support, tool support, vision support, no streaming, and pricing of $0.25 input / $2.00 output per one million tokens. The production gateway will still use explicit context and output limits far below the provider maximum.

The browser-facing implementation will also include a deterministic mock provider for tests and local development when no gateway credentials are configured. The mock is not presented as real AI and must be explicitly labeled. Live-provider behavior remains opt-in through the gateway and consent UI.

## Evidence and trade-offs

| Criterion | Finding | Decision |
|---|---|---|
| Structured output | OpenAI Structured Outputs is designed to make model responses adhere to supplied JSON Schema; strict schemas and `additionalProperties: false` are recommended by the official guide [1]. | Use strict JSON-schema-shaped operations and validate again in SmartDocs. |
| Browser security | OpenAI’s key-safety guidance says never to deploy an API key in browser/mobile code and to route requests through a backend [2]. | Keep all provider credentials and outbound calls in the gateway. |
| Current model | Live built-in catalog reported `gpt-5-mini` as a supported JSON-schema model with a large context window and lower cost than premium models. | Central default for summaries, classification, extraction, and Q&A; no model name in React/domain UI. |
| Streaming | Live catalog reported streaming unsupported for the built-in proxy models. | Use explicit `preparing`, `sending`, `validating`, and `completed` states; do not fake token streaming. |
| Privacy | The official production guidance recommends environment variables/secret management and avoiding keys in code or public repositories [3]. | Server environment only; bounded request body and privacy-safe logs. |
| Cost/latency | Official production guidance identifies model choice and generated token count as important latency/cost factors [3]. | Use deterministic retrieval first, cap context and output, and make the selected page/block count visible. |

## References

[1]: https://developers.openai.com/api/docs/guides/structured-outputs — OpenAI, “Structured model outputs.”
[2]: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety — OpenAI Help, “Best Practices for API Key Safety.”
[3]: https://developers.openai.com/api/docs/guides/production-best-practices — OpenAI Developers, “Production best practices.”
[4]: https://developers.openai.com/api/docs/models — OpenAI Developers, “Models.”
[5]: https://developers.openai.com/api/docs/guides/rate-limits — OpenAI Developers, “Rate limits.”

## Scope boundary

No provider connector, API key, cloud account, database, account system, vector database, embedding service, or live credential is added by this research record. The implementation must remain honest when the gateway is unavailable and must never silently switch providers.
