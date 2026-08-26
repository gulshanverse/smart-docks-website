# Phase 5 OCR engine research notes

## Candidate comparison

| Candidate | Browser/WASM and scope | License | Phase 5 assessment |
|---|---|---|---|
| Tesseract.js 7.0.0 | Official repository describes a JavaScript library wrapping a WebAssembly port of Tesseract for browser and Node.js. It exposes a worker API, recommends reusing one worker for multiple images, and supports language data through `createWorker`. It explicitly does not support PDF files or modify Tesseract recognition models; SmartDocs can render PDF pages through PDF.js and author a searchable result separately. | Apache-2.0 for the wrapper repository. Underlying Tesseract is Apache-2.0; Tesseract documents Leptonica as BSD-2-Clause. | Selected candidate for the first local OCR provider because the license is compatible with the existing MIT project, the worker/WASM model matches the browser-local requirement, and PDF.js already supplies page rasterization. Pin exact package version and bundle worker/core/language resources locally; do not use CDN assets. |
| Scribe.js | Official repository supports OCR/text extraction from images and PDFs and can write invisible text layers into PDFs. It requires same-origin browser assets and no CDN import. | AGPL-3.0 | Technically capable, but the copyleft license is not a safe default for the existing MIT SmartDocs distribution without an explicit licensing decision. Do not add it for this milestone. |
| Ocrad.js | Official repository is an Emscripten JavaScript OCR port with a worker file and GPL-3.0 license. Its repository is old/small and describes rule-based recognition with materially narrower practical scope than Tesseract. | GPL-3.0 | Not selected because of license compatibility and maintenance/language limitations. |

## Official evidence

Tesseract.js’s official README states that it works in the browser and Node.js, wraps a WebAssembly port of Tesseract, exposes `createWorker`, supports more than 100 languages through language files, and recommends creating one worker for multiple images and terminating it at the end. The same README explicitly states that Tesseract.js does not support PDF files; SmartDocs therefore keeps PDF.js as the renderer and treats OCR as an image-page provider.

The README’s v6 notes state that non-text output formats are disabled by default and that v6 reduced memory usage and fixed a previous memory leak. The project’s npm page reports Tesseract.js `7.0.0` as the latest package version found by the research search on 2025-12-15; verify package metadata at install time and pin the exact resolved version in `package.json`/lockfile rather than relying on a floating range.

Tesseract’s official repository documents Apache-2.0 licensing, LSTM-based recognition in the current engine, UTF-8 support, more than 100 languages, and the need for traineddata files. It also documents plain text, hOCR, PDF, invisible-text-only PDF, TSV, ALTO, and PAGE output at the engine level; the browser wrapper’s PDF limitation means SmartDocs will not depend on the native CLI PDF output.

Scribe.js’s official repository confirms its browser PDF/OCR/searchable-PDF capabilities and same-origin requirement, but its AGPL-3.0 license makes it unsuitable as the default dependency for this MIT project. Ocrad.js’s official repository identifies GPL-3.0 licensing and a small older codebase; it is not selected.

A live registry query on 2026-08-26 returned Tesseract.js `7.0.0` as the latest version, with Apache-2.0 licensing and a package `dist.unpackedSize` of 1,411,341 bytes. Its dependency graph includes `tesseract.js-core@^7.0.0`, `wasm-feature-detect`, and browser/runtime helpers. These values are package metadata, not a full deployed bundle or language-model size; actual browser payload and first-run memory must be measured after installation and local resource bundling.

The official Tesseract.js language-data repository states that language files are published as separate `@tesseract.js-data/{lang}` packages and that developers may host local copies rather than using a CDN. Its default `4.0.0_best_int` data is integerized LSTM data; the official Tesseract documentation describes `tessdata_fast` as the fastest/smaller option, `tessdata_best` as slower and more accurate on evaluation data, and the regular `tessdata` set as supporting legacy plus LSTM. For a bounded first milestone, SmartDocs should use LSTM-only English data and explicitly measure its installed/bundled size; Hindi (`hin`) is listed by the official language documentation and can be added as a separately selected local package when its size and browser performance are verified. Automatic language detection should not be claimed.

The installed Tesseract.js browser defaults point to a jsDelivr worker, while the official local-installation documentation says `workerPath`, `corePath`, and `langPath` can be overridden. SmartDocs must pass local same-origin asset paths explicitly and must not use the defaults. The browser worker is created from the configured path, and the core package contains multiple WASM variants; the implementation should expose only the locally bundled resources that are actually shipped.

## Sources

[1]: https://github.com/naptha/tesseract.js/ "Tesseract.js official repository and README"
[2]: https://www.npmjs.com/package/tesseract.js "Tesseract.js package metadata"
[3]: https://github.com/tesseract-ocr/tesseract "Tesseract OCR official repository and license"
[4]: https://github.com/scribeocr/scribe.js/ "Scribe.js official repository"
[5]: https://github.com/antimatter15/ocrad.js/ "Ocrad.js official repository"
