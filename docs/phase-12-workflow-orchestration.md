# Phase 12 — Workflow Orchestration Engine

## Purpose

Phase 12 adds a single, reviewable orchestration layer above the existing SmartDocs image, PDF, OCR, Office, conversion, actions, AI, and collection engines. A user enters a natural-language goal; SmartDocs deterministically converts that request into a versioned dependency graph, exposes the graph and processing boundary for review, and only then hands supported steps to bounded browser-local executors.

The orchestration layer does not interpret arbitrary code, upload originals, or silently invent unsupported capabilities. Its contract is `phase12-workflow-v1`, and each step records inputs, dependencies, expected artifacts, risk, validation requirements, provenance, retry policy, cancellation policy, resource class, and processing boundary.

## Architecture

| Layer | Responsibility | Safety boundary |
| --- | --- | --- |
| Goal normalization | Maps common phrases such as “OCR then optimize” or “compress this image under 1MB” to known capabilities. | No arbitrary code execution or hidden tool selection. |
| DAG planner | Creates stable workflow IDs, step IDs, dependency edges, topological order, parallel-ready groups, terminal outputs, and warnings. | Cycles, missing dependencies, duplicate IDs, and invalid contracts fail validation. |
| Collection adapter | Adapts the Phase 11 collection planner into Phase 12 steps and preserves `FOR EACH` document identifiers for individual-output operations. | Collection limits, compatibility, ordering, duplicate disclosure, and unsupported operations remain explicit. |
| Review workspace | Shows the graph, selected-step details, risk, validation plan, and local-versus-AI boundary before execution. | Destructive and AI-assisted plans require review/confirmation. |
| Bounded scheduler | Executes dependency-ready steps with a maximum concurrency of two, cancellation support, failure propagation, and bounded result sets. | No unbounded queue, retry storm, or dependency bypass. |
| Specialized handoff | Dispatches supported capabilities to existing engines, including local image compression. | Unsupported executor capabilities fail honestly; originals remain unchanged. |

## Contract and state model

The workflow state machine separates planning, review, confirmation, execution, recovery, and terminal states. Step states independently track readiness, execution, validation, retry, failure, blocking, and cancellation. Invalid transitions throw rather than silently mutating state.

Every derived artifact is ephemeral metadata with a source document ID, parent artifact ID, originating step, source type, validation status, and provenance. Artifact metadata may be retained in session history, but source document bytes are not persisted by the orchestration layer.

## Collection orchestration

The adapter `planWorkflowForCollection` consumes the Phase 11 collection planner instead of duplicating collection compatibility logic. Merge and image-to-PDF paths remain single-output graph operations. Individual-output operations, such as optimizing each selected PDF, are represented as explicit per-document `foreach` steps whose `foreachDocumentIds` preserve the collection order and stable document IDs. Each generated step keeps its dependency edges and validation plan, so a reviewer can see whether work is per-document or collection-wide before any execution begins.

Unsupported collection operations remain reviewable but are not falsely marked executable. The planner carries forward collection warnings, output limits, risk, and `browser-local` or `browser-local-to-ai-gateway` boundaries.

## Execution handoff

The workspace accepts an executor callback. App-level orchestration invokes `runBoundedScheduler` with the reviewed plan. The scheduler starts only dependency-ready steps and emits step lifecycle events. The current application dispatches the supported `image.compress.target_size` capability to the existing, validated image compression engine. Inspection and final validation markers are deterministic orchestration stages; unsupported transformations fail with an explicit message rather than producing fabricated output. Existing PDF, OCR, Office, conversion, and AI workspaces remain the authoritative specialized surfaces for capabilities not yet exposed through the Phase 12 callback.

## Privacy and boundary disclosure

The workspace reports the count of browser-local steps, server-assisted/AI-gateway steps, whether external AI is used, and whether originals are uploaded. A gateway-bound step is never treated as local, and AI plans require explicit confirmation. The disclosure states that only bounded structured context may cross the optional gateway after confirmation; source originals remain in the browser unless a future, separately reviewed feature changes that boundary.

## Quality gates

The Phase 12 implementation is verified by deterministic unit tests for contract validation, cycle detection, topological sorting, condition evaluation, state transitions, single-asset chaining, collection `FOR EACH` adaptation, and bounded scheduler execution. Browser verification exercised a local PNG through asset intake, plan review, dependency graph rendering, boundary disclosure, scheduler execution, validated image output, and session history.

The release gates are:

```text
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

The repository must be committed as one Phase 12 feature commit and pushed only after all gates pass.
