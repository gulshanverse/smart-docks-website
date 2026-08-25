# Phase 2 PDF Research Notes

These notes preserve source-backed findings gathered before the architecture document is drafted.

## Official technology findings

| Source | Verified finding | Architecture relevance |
|---|---|---|
| [PDF.js home](https://mozilla.github.io/pdf.js/) | PDF.js describes itself as a general-purpose, web-standards-based platform for parsing and rendering PDFs. The project page states that PDF.js is licensed under Apache 2.0; documentation is CC BY-SA 2.5. | Strong candidate for browser-local inspection/rendering, subject to bundle size, worker setup, browser memory, and security patch cadence. |
| [qpdf official site](https://qpdf.sourceforge.io/) | qpdf is a C++ command-line tool/library for content-preserving PDF transformations, including inspection, structural operations, splitting/merging, linearization, and encryption. The site explicitly says qpdf does not render PDFs or perform text extraction. It is Apache 2.0. | Good structural inspection/normalization component in an isolated server worker; not sufficient as the only PDF engine for rendering or text extraction. |
| [pdf-lib official site](https://pdf-lib.js.org/) | pdf-lib is pure TypeScript/JavaScript with no native dependencies and works in browsers, Node, Deno, and React Native. It can create/modify PDFs, split/merge, and work with forms and embedded content. | Possible browser-local manipulation tool for controlled operations; not a complete parser/classifier/rendering/compression stack. Validate feature preservation before relying on it. |
| [PDFium official README](https://pdfium.googlesource.com/pdfium/+/master/README.md) | PDFium uses Chromium build tooling and Clang; it can be built with or without JavaScript and XFA. Its standalone test program reads, parses, and rasterizes PDF pages. The build is native and substantial. | High-capability native renderer/inspector, but too heavy for the current static browser MVP; better suited to a sandboxed worker/service if adopted. |
| [Ghostscript licensing](https://ghostscript.com/licensing/) and [Artifex licensing](https://artifex.com/licensing) | Ghostscript licensing is handled by Artifex. Artifex documents AGPLv3 and commercial licensing options, including restrictions around source disclosure for server-based services and a commercial path for proprietary SaaS/OEM use. | Powerful server-side conversion/optimization candidate, but licensing must be resolved before commercial integration. |

## Security findings

[OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) recommends allowlisting extensions, validating file content rather than trusting the Content-Type header, setting file-size limits, generating safe filenames, segregating storage, keeping uploads outside the webroot, and using antivirus/sandbox or CDR where available. These recommendations apply to PDF uploads because PDFs are untrusted parser input.

## Current repository findings

The stable repository is Vite + React + strict TypeScript with Vitest. The current `FileAsset`, intent parser, tool registry, workflow model, and validation model are image-specific. The existing local-processing boundary validates MIME/signatures, enforces a 25 MB limit, decodes images, uses object URLs, and revokes temporary URLs. PDF support should extend these domains through file-category capabilities and shared workflow/result contracts rather than introducing a second application architecture.

## Evidence limitations

The official sources above establish product scope and licensing, not benchmark numbers. Performance estimates in the final architecture document must therefore be labeled as qualitative planning ranges or unknowns, not measured facts. No production PDF dependency or user-facing PDF feature has been added during this spike.
