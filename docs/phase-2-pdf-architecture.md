# SmartDocs Phase 2 — PDF Architecture Spike

**Status:** Research and isolated feasibility spike complete; production PDF features intentionally not implemented.  
**Author:** **Manus AI**  
**Stable application baseline:** Phase 1 `3ec5a1a`; Phase 1.5 `ac45146`

> **Recommendation in one sentence:** Make PDF inspection and first-page preview browser-local for the MVP, but reserve target-size PDF transformation for a later hybrid architecture with an isolated server worker and explicit licensing, security, and validation boundaries.

## 1. Current architecture compatibility

The stable application is a Vite + React + strict TypeScript client with Vitest unit tests. Its product contract is:

```text
One file + one human goal
  → intent
  → workflow
  → processing
  → validation
  → result
```

Phase 1 and Phase 1.5 prove this contract with image target-size compression and smart resize recovery. The existing implementation has a narrow image-specific `FileAsset`, a deterministic image intent parser, an image-only tool registry entry named `image.compress.target_size`, an image workflow tuple, and image-oriented validation fields such as dimensions, MIME type, bytes, optimization strategy, and quality decision.

PDF should **extend this architecture rather than create a second application**. The current file boundary should become a discriminated union with shared identity and lifecycle fields, while image and PDF assets own their format-specific metadata and capabilities. The first PDF work should be an inspection capability, not a production compressor.

```text
FileAssetBase
  ├── ImageAsset
  │     └── image.compress.target_size
  └── PdfAsset
        ├── pdf.inspect
        ├── pdf.render.preview
        └── pdf.compress.target_size  (future, not this spike)
```

The current browser-local privacy claim is accurate for images. It must not automatically be copied to future server-assisted PDF operations. The UI should derive its privacy label from the selected workflow’s processing boundary.

## 2. PDF requirements

Before any transformation, SmartDocs needs a bounded inspection result. It does not need to understand every PDF feature to make a useful first classification, but it must know enough to avoid making false claims.

| Metadata | Why it matters | MVP requirement |
|---|---|---|
| File size | Target comparison, memory guard, UX | Required |
| PDF version | Compatibility and output policy | Required when available |
| Page count | User-facing summary and validation invariant | Required |
| Page boxes and dimensions | Preserve layout and detect pathological pages | Required per page or bounded sample |
| Encryption/password state | Determines whether inspection can proceed | Required |
| Extractable text signal | Distinguishes text, scan, and mixed documents | Required |
| Text character count/sample | Explain detection without storing document content | Useful, bounded |
| Image object count and dimensions | Predict whether image optimization is relevant | Useful for classification; bounded |
| Vector/content-stream signal | Helps distinguish text/vector pages from image-only pages | Useful, not an MVP gate |
| Metadata | Safe display and optional removal policy | Read-only MVP; removal later |
| Annotations/forms | Preservation risk during rewrite | Detect and mark as sensitive |
| Embedded files and JavaScript | Security and unsupported-feature gates | Detect and reject or sandbox |
| Linearization/object streams | Structural optimization opportunities | Server-side phase |

A conceptual future model should keep sensitive raw content out of the metadata object:

```ts
type PdfClassification =
  | "text"
  | "scanned"
  | "image-heavy"
  | "mixed"
  | "password-protected"
  | "corrupt"
  | "unsupported";

type PdfSecurityState =
  | "none"
  | "encrypted-open"
  | "password-required"
  | "javascript-present"
  | "embedded-files-present"
  | "unknown";

interface PdfDimensions {
  widthPoints: number;
  heightPoints: number;
}

interface PdfMetadata {
  category: "pdf";
  sizeBytes: number;
  pdfVersion?: string;
  pageCount?: number;
  pageDimensions?: PdfDimensions[];
  classification: PdfClassification;
  hasExtractableText: boolean;
  textCharacterCount?: number;
  imageCount?: number;
  imageOnlyPageCount?: number;
  hasAnnotations?: boolean;
  hasForms?: boolean;
  security: PdfSecurityState;
  inspectable: boolean;
  warnings: string[];
}
```

The model is deliberately conceptual. It avoids pretending that image counts, text counts, or feature flags are perfectly available from every engine.

## 3. PDF classification

Classification should be deterministic and explainable. It should be calculated from bounded inspection signals rather than AI.

| Classification | Deterministic signal | User-facing meaning |
|---|---|---|
| Text PDF | Most sampled pages have extractable text and low image-only ratio | Text can usually remain intact during safe structural optimization |
| Scanned PDF | Pages are image-only or have negligible extractable text, with large raster content | Image recompression/resizing may provide most size reduction; OCR is separate |
| Image-heavy PDF | Text may exist, but image objects dominate page resources or byte weight | Optimize images carefully while preserving page geometry |
| Mixed PDF | Some pages have text while others are image-only, or both coexist materially | Use per-resource policy and stronger validation |
| Password-protected PDF | Parser reports encryption requiring a password | Ask for a password only through an explicit secure flow; do not brute force |
| Corrupt/invalid PDF | Header or parser fails, page tree cannot be opened, or validation fails | Explain that the file cannot be safely inspected and preserve the original |

A first classifier should use a text extraction signal, page count, page dimensions, image-only page count, and parser security flags. It should avoid using file extension or `Content-Type` as proof of PDF content. OWASP specifically advises validating file type rather than trusting a spoofable `Content-Type` header, setting size limits, and isolating uploaded files and processing [7].

## 4. Browser-local analysis

### Strengths

Browser-local inspection keeps sensitive documents on the user’s device, matches the existing image privacy model, avoids upload latency, and can provide an immediate page count, first-page preview, and basic text-presence signal. PDF.js describes itself as a general-purpose, web-standards-based platform for parsing and rendering PDFs and is licensed under Apache 2.0 [1].

### Constraints

PDF parsing and rendering are substantially more memory- and CPU-intensive than the current image workflow. Large page trees, embedded fonts, huge page dimensions, malformed objects, encrypted documents, JavaScript/XFA, annotations, forms, and unusual filters can create compatibility and resource risks. A browser tab also has less predictable memory than a dedicated worker. Mobile devices are the highest-risk environment for large scanned documents.

Browser-local analysis is therefore appropriate for a **bounded preflight**: signature check, file-size limit, page count, security flags, first-page rendering, and a conservative text-presence classification. It is not sufficient evidence for a universal browser-local PDF compressor.

## 5. Server-side analysis

A server worker can use mature native engines, set process-level memory and CPU limits, run in a disposable sandbox, capture structured diagnostics, and handle large PDFs more predictably. It also permits page-by-page validation and engine combinations that would be impractical to ship in the current Vite bundle.

The cost is a different privacy boundary: the file must leave the browser and be retained temporarily somewhere. The product must disclose upload, retention, deletion, region, and failure semantics. The service also inherits parser vulnerabilities and needs patching, sandboxing, resource quotas, safe storage, and malware/content-disarm controls. Server processing should never run in the web process or against a shared writable webroot.

## 6. Hybrid architecture

A hybrid path separates **preflight** from **heavy transformation**:

```text
Browser
  → validate signature and size
  → local PDF.js inspection/preview where safe
  → classify and show privacy boundary
  → ask for exact goal

Secure PDF worker (only for approved operations)
  → receive short-lived upload
  → verify type again
  → inspect in sandbox
  → structural pass
  → image/resource pass
  → validate invariants
  → return result and diagnostics
  → delete temporary input/output
```

The hybrid model offers the strongest long-term user experience because a simple PDF can receive instant local feedback while complex or large documents use a controlled worker. It also avoids making browser memory a universal product limit.

## 7. Architecture comparison

| Approach | Performance | Browser/mobile | Memory | Privacy | Security | Complexity | Scalability | Recommendation |
|---|---|---|---|---|---|---|---|---|
| Browser-local only | Good for small/simple PDFs; unpredictable for large scans | Strong desktop fit; weak for large mobile files | Shared tab memory; difficult to bound precisely | Best: no upload | Parser runs in user context; still needs patching and feature gates | Low initial, high edge-case complexity | Limited by client device | Use for inspection and preview, not universal compression |
| Secure server worker | Predictable native throughput and quotas | Works on thin clients; network/upload latency | Process limits are enforceable | Requires transparent upload/retention | Strongest if sandboxed, patched, isolated, and resource-limited | Medium/high | Strong with queues and autoscaling | Use for heavy transformation after licensing/security work |
| Hybrid | Fast preflight plus robust heavy path | Best overall | Client bounded; server bounded | Mixed and must be explicit per operation | Defense in depth | Highest product design complexity | Strong | Long-term platform recommendation |

## 8. Technology comparison

| Technology | Best role | Runtime | Licensing | Important limits | Recommendation |
|---|---|---|---|---|---|
| PDF.js | Parse/render pages, text-layer signals, browser preview | Browser/JS worker | Apache 2.0; docs CC BY-SA 2.5 [1] | Not a complete optimizer or safe universal rewrite engine; bundle/worker/memory considerations | Candidate for local preflight and preview |
| pdf-lib | Controlled JS creation/modification, split/merge, forms, metadata | Browser, Node, Deno, React Native | MIT license in the official repository [3] | Pure JS does not equal complete parser, renderer, or feature-preserving compressor; verify unsupported features and encryption behavior | Candidate for narrow client-side manipulations, not the primary compressor |
| qpdf | Structural inspection, content-preserving transformations, linearization, encryption, split/merge | Native C++/CLI | Apache 2.0 [2] | Official site explicitly says it does not render PDFs or perform text extraction [2] | Strong structural component in a server worker |
| PDFium | Native parse/render/rasterization and broad PDF behavior | Native C++/Chromium toolchain | Review Chromium/PDFium and bundled dependency notices per build | Heavy build/toolchain; complex embedder surface; optional JavaScript/XFA require strict policy [6] | Long-term native rendering/validation candidate if operationally justified |
| Ghostscript | Conversion, rendering, distillation, optimization | Native server process | Artifex licensing is AGPLv3 or commercial; commercial SaaS/OEM use needs licensing review [4] [5] | Powerful but license and security boundary are material; not a browser dependency | Consider only behind a sandbox and after legal approval |
| MuPDF/PyMuPDF | High-performance native parsing, rendering, and manipulation | Native/server or Python bindings | Artifex documents AGPLv3 and commercial licensing paths [5] | Same licensing and sandbox concerns; binding/package choices matter | Possible server worker option after licensing review |
| Poppler tools | Practical inspection/text/render spike | Native CLI | Distribution/license review required per build and linked components | Not a complete product API or target-size optimizer | Suitable for isolated feasibility tests, not selected as platform contract |

No technology should be selected merely because it is popular. The final choice must be made against a corpus of representative PDFs, feature-preservation tests, license review, and security review.

## 9. Licensing

PDF.js and qpdf provide permissive Apache 2.0 paths for their respective scopes [1] [2]. pdf-lib’s official repository is MIT-licensed and advertises browser and Node support [3]. These licenses are operationally simpler for a commercial product, but dependency notices and bundled worker assets still need to be preserved.

Artifex’s official licensing page describes AGPLv3 restrictions and commercial licensing options for Ghostscript, MuPDF, and related products. It states that server-based applications that cannot satisfy AGPL source-disclosure requirements need a commercial license [5]. This is a product/legal decision, not a purely technical dependency decision.

PDFium should be treated as a native Chromium-derived component with a build-time license inventory rather than assumed to be a single-license drop-in. Its official build requires Chromium tooling, GN/Ninja, and Clang, which materially increases operational and compliance work [6].

Before any production dependency is added, create an SBOM/license report that includes direct and transitive dependencies, worker files, native binaries, fonts, and codec libraries.

## 10. Security boundaries

PDFs are untrusted input. The future system should:

1. Validate magic bytes and parseability; do not trust extension or `Content-Type` alone.
2. Enforce separate limits for uploaded bytes, page count, page dimensions, object count where available, extracted text, and processing time.
3. Keep input and output outside the webroot, use generated identifiers, and make downloads authorization-aware.
4. Run native parsers in a disposable, least-privileged sandbox with no network, read-only resources, CPU/memory quotas, wall-clock timeout, and process-tree cleanup.
5. Disable PDF JavaScript, XFA, embedded-file extraction, external network references, and unsafe actions by default. PDFium’s official build options show that JavaScript and XFA are configurable features, reinforcing that they should be deliberate policy choices rather than accidental defaults [6].
6. Treat annotations, forms, signatures, attachments, and encryption as preservation-sensitive features. Do not rewrite them silently.
7. Keep parser dependencies patched and fuzz-tested; retain malformed-file fixtures and regression cases.
8. Run malware scanning and content-disarm/reconstruction where the product’s threat model requires it. OWASP recommends antivirus/sandbox or CDR where available and recommends secure storage segregation [7].
9. Never render untrusted PDF content into a privileged origin with access to application secrets.

## 11. Privacy

The current image workflow is fully local. PDF **inspection and first-page preview** can realistically remain local for bounded files using a worker-backed PDF.js path, with a browser-only label.

PDF target-size transformation should not be called local until it is demonstrably executed in the browser for the selected feature set. The recommended future hybrid model should display an explicit boundary such as:

> **Inspection stays in your browser. Optimization uses a secure temporary worker. The uploaded file is deleted after validation.**

The product must document maximum retention, deletion timing, region, logging policy, whether extracted text is persisted, and whether outputs are encrypted in transit and at rest.

## 12. PDF compression strategy

PDF compression is not equivalent to ZIP compression. A safe future pipeline should classify first and apply the least destructive strategy for the document type.

| PDF type | First strategy | Avoid by default |
|---|---|---|
| Text-heavy | Structural cleanup, duplicate-resource reuse, object-stream/linearization policy, metadata policy, font subset review | Rasterizing pages or replacing text with images |
| Image-heavy | Inspect embedded image codecs/dimensions, deduplicate resources, recompress or resize images only when safe, preserve page geometry | Re-encoding every image blindly or changing color/transparency without validation |
| Scanned | Treat each page image as the primary content; controlled DPI/quality ladder; preserve page boxes and orientation | OCR as an implicit side effect; aggressive downsampling that makes text unreadable |
| Mixed | Per-page/resource policy with stronger validation and a conservative fallback | One global quality setting for all pages |
| Forms/annotations/signatures | Preserve or reject with explanation; use a no-op or structural-only path | Flattening, removing, or invalidating fields/signatures silently |

Structural transformations should be separated from image transformations so failures can be attributed and rolled back. Metadata removal must be an explicit user-visible policy because metadata may be legally or operationally important.

## 13. Exact target-size strategy

For a future goal such as “make this PDF under 2MB,” use the same intent model as images but a more conservative workflow:

```text
Inspect
  → classify
  → choose safe strategy
  → structural candidate
  → image/resource candidate ladder
  → validate invariants
  → measure bytes
  → iterate within bounded budget
  → return best result or honest impossibility
```

The candidate ladder should prioritize preservation:

1. Preserve original if already under target.
2. Structural-only candidate.
3. Metadata policy candidate if the user allows it.
4. Image recompression at high quality.
5. Image resize/DPI reduction only for image-heavy or scanned pages.
6. A bounded lower-quality candidate only with an explicit best-effort warning.

The optimizer should minimize the quality and geometry change subject to output bytes being at or below the target. It must return the best validated result when the target is impossible, not silently replace readable text with a raster image. Each candidate needs a deterministic reason code and a measured byte result.

## 14. Quality validation strategy

A future PDF result is valid only when the output opens and the requested invariants remain true:

```ts
interface PdfValidationResult {
  valid: boolean;
  targetAchieved: boolean;
  targetBytes: number;
  outputBytes: number;
  originalBytes: number;
  pageCountPreserved: boolean;
  pageDimensionsPreserved: boolean;
  textExtractabilityPreserved: boolean | "not-applicable";
  annotationsPreserved: boolean | "unsupported";
  formsPreserved: boolean | "unsupported";
  renderCheck: "passed" | "failed" | "not-run";
  optimizationStrategy: "original-preserved" | "structural" | "image-recompression" | "resize-and-recompress" | "best-effort";
  warnings: string[];
}
```

Minimum checks are: reopen the output, preserve page count, preserve page dimensions within an explicit tolerance, preserve extractability when it existed, render representative or all pages depending on risk, keep images decodable, preserve supported annotations/forms, and confirm output bytes. Visual regression should use raster comparisons or human-review queues for high-risk documents, not an invented perceptual score.

## 15. Conceptual UX states

The first PDF workflow should reuse the image workspace vocabulary but make the processing boundary explicit:

```text
PDF selected
  → inspecting locally
  → PDF detected: 84 pages · scanned · 42.8 MB
  → goal accepted: ≤ 2 MB
  → recommended: Smart compression
  → processing boundary shown
  → validating page count/text/rendering
  → verified result or actionable failure
```

A result should show original size, final size, page count, classification, target, strategy, warnings, and download. It should not expose codec parameters. A large or unsupported file should be told why it cannot continue and whether the recovery is to enter a password, remove unsupported features, choose a smaller file, or use a secure worker.

No full PDF UI is implemented by this spike.

## 16. Failure states and recovery

| Failure | Safe response | Recovery |
|---|---|---|
| Not a PDF / corrupt header | Stop before parser work | Choose another file |
| Encrypted/password-protected | Do not brute-force or claim classification | Ask user to provide password through an explicit secure flow, or download original |
| JavaScript/XFA/embedded files | Mark as sensitive/unsupported by default | Offer inspection-only or preserve original |
| Unsupported annotations/forms/signatures | Do not silently flatten | Download original or use a preservation-capable worker |
| Browser memory limit | Stop before tab instability | Use secure worker or smaller PDF |
| Processing timeout | Kill worker/task and retain original | Retry with safe lower scope or server path |
| Target impossible | Return best validated result with measured tradeoff | Allow less aggressive target or explicit best effort |
| Quality degradation risk | Do not claim success solely from bytes | Show validation warnings and preserve original option |
| Download/storage error | Keep result in memory only until successful link creation | Retry download; never expose temp storage paths |

## 17. Performance considerations

The following are qualitative planning estimates, not benchmarks. Actual behavior depends on page count, fonts, embedded images, filters, encryption, device memory, and engine choice.

| Input size | Browser-local inspection | Browser-local transformation | Secure worker recommendation |
|---|---|---|---|
| 10 MB | Reasonable for bounded preflight on modern desktop; mobile still needs page/timeout limits | Possible only for a narrow tested feature set | Optional fallback |
| 50 MB | Possible but memory-sensitive; use worker and page sampling | Not a safe universal default | Preferred for transformation |
| 100 MB | Treat as high-risk client input | Avoid as browser-default transformation | Required for production transformation |
| 500 MB | Do not load blindly in a tab | Not appropriate for client-local MVP | Server worker with streaming/quota policy only |

No benchmark numbers are claimed. The isolated spike only proves a 5.5 KB mixed PDF can be inspected and its first page rasterized with local native tools. Before production, benchmark a corpus containing text-heavy, scanned, image-heavy, mixed, encrypted, annotated, form, malformed, and large documents across desktop and mobile hardware.

## 18. Isolated feasibility spike

`spikes/pdf-feasibility/` contains a deliberately separate proof of feasibility. It generates a two-page PDF with one text page and one image-only page, then runs:

- `pdfinfo`: version, page count, and file metadata.
- `pdftotext`: text presence and extractability signal.
- `pdftoppm`: first-page raster rendering.

Observed output:

```json
{
  "file_size_bytes": 5530,
  "pdf_version": "1.3",
  "page_count": 2,
  "text_presence": true,
  "text_extractable": true,
  "classification_hint": "mixed"
}
```

The spike does not add a PDF dependency to the Vite app, does not alter the user-facing UI, and does not claim production safety or PDF feature preservation.

## 19. Recommended MVP architecture

The first production PDF phase should be deliberately narrow:

1. Generalize the file model to support a PDF category without breaking image assets.
2. Add a browser-local `pdf.inspect` capability using a pinned, worker-backed PDF.js dependency.
3. Support signature validation, size/page limits, page count, PDF version, first-page preview, text-presence signal, and security/unsupported-feature flags.
4. Keep inspection and preview local for bounded inputs.
5. Do not ship PDF target-size compression in the same first implementation unless a separate spike proves feature preservation and quality validation on a corpus.
6. If target-size transformation is approved, implement it as a secure worker behind an explicit upload/privacy boundary rather than pretending the browser can safely handle every PDF.

This MVP keeps user trust high, gives SmartDocs real PDF awareness, and avoids prematurely adding backend infrastructure to the current application.

## 20. Recommended long-term architecture

The long-term platform should be hybrid:

- Browser: file signature validation, bounded preflight, local first-page preview, goal parsing, progress/status, and privacy explanation.
- Secure worker: engine-specific inspection, structural optimization, image/resource optimization, rendering, validation, and deletion.
- Workflow layer: common intent, tool registry, workflow state, validation result, and recovery reasons across image and PDF.
- Operations: queue with quotas, timeout/memory isolation, per-engine version pinning, corpus regression tests, audit-safe logs without raw document content, and license/SBOM tracking.

A likely engine composition is PDF.js for browser preview, qpdf for structural operations, and a vetted native renderer/optimizer such as PDFium, Ghostscript, or MuPDF only after security and licensing approval. The product should keep engine choice behind a tool adapter so it can replace a component without changing the user-facing workflow contract.

## 21. Implementation phases after approval

| Phase | Scope | Exit gate |
|---|---|---|
| 2A | Generalized file/capability model and local PDF inspection spike integrated behind tests | Phase 1/1.5 regression suite green; no PDF transformation |
| 2B | PDF.js worker preview, page count, security flags, bounded classification | Corpus classification accuracy and mobile memory review |
| 2C | Secure worker prototype for structural inspection/normalization | Sandbox, timeout, deletion, license, and validation review |
| 2D | Narrow target-size transformation for a declared subset | Corpus feature-preservation and quality gates pass |
| 2E | Expand formats/features only with explicit support matrix | Each feature has tests, failure states, and legal approval |

## 22. Risks

The largest risks are silent feature loss, parser vulnerabilities, memory exhaustion, licensing mistakes, and user confusion about privacy boundaries. A PDF that opens in one viewer may still lose annotations, forms, signatures, font behavior, JavaScript, attachments, or text extractability after a rewrite. “Smaller” must never be treated as “valid” without an invariant-based validation pass.

The main operational risk is treating a native PDF engine as a normal web dependency. Native engines require sandboxing, patching, observability, corpus testing, and a license inventory. The main product risk is promising a universal “make it under X MB” operation before the system can explain which content was changed.

## 23. Open questions

1. Which PDF feature matrix should SmartDocs promise in the first supported subset?
2. Will the product accept encrypted PDFs if the user supplies a password, and where may that password exist in memory?
3. What temporary upload retention and deletion SLA is acceptable for secure-worker operations?
4. Which regions and processors are allowed for document data?
5. Is commercial licensing for Ghostscript or MuPDF acceptable, or should the first worker use Apache/MIT components plus a different renderer?
6. What corpus represents the target customers: scanned forms, office exports, academic papers, invoices, or mixed government documents?
7. How will signatures and legal documents be handled so “optimization” never invalidates a critical signature without a clear warning?
8. What page-count, pixel-area, embedded-file, and processing-time limits should be product defaults?
9. Should text extraction stay local even when transformation is server-side, and how will the UI explain the split?
10. What measurable quality threshold is sufficient for scanned text readability without claiming perceptual AI scoring?

## References

[1]: https://mozilla.github.io/pdf.js/ "PDF.js home and license"

[2]: https://qpdf.sourceforge.io/ "QPDF official project site"

[3]: https://github.com/Hopding/pdf-lib "pdf-lib official repository and MIT license"

[4]: https://ghostscript.com/licensing/ "Ghostscript licensing page"

[5]: https://artifex.com/licensing "Artifex licensing overview for AGPL and commercial options"

[6]: https://pdfium.googlesource.com/pdfium/+/master/README.md "PDFium official README and build guidance"

[7]: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html "OWASP File Upload Cheat Sheet"
