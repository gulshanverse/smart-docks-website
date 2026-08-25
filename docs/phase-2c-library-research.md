# Phase 2C Mutation Library Research

## Decision

Phase 2C uses `pdf-lib` version `1.17.1`, pinned in `package.json` and `pnpm-lock.yaml`. The library is used only for browser-local structural page mutation; PDF.js remains responsible for parsing, inspection, and rendering.

## Verified capabilities

The official pdf-lib documentation describes loading existing PDFs, creating new PDFs, adding/inserting/removing pages, copying pages, modifying pages, setting metadata, and saving bytes. Its examples show `PDFDocument.load`, `PDFDocument.create`, `copyPages`, `addPage`, `insertPage`, `removePage`, `page.setRotation`, and `pdfDoc.save` [1]. The project README states that pdf-lib is written in TypeScript, compiled to pure JavaScript without native dependencies, and tested in browsers and React environments [2].

The published npm package reports built-in TypeScript declarations and version `1.17.1`; the package page describes browser support and the available page features [3]. The GitHub repository reports an MIT license [4].

## Preservation limitations

Structural copying preserves page content through pdf-lib’s copy-page mechanism, but this implementation does not claim complete preservation of every PDF feature. Forms, annotations, links, embedded files, outlines/bookmarks, JavaScript, unusual objects, and metadata may not all survive creation of a new document. Phase 2C documents this limitation and does not expose a metadata editor or promise pixel-perfect equivalence. The app reopens every output through PDF.js and refuses to provide a success/download result when parsing or first-page preview validation fails.

## References

[1]: https://pdf-lib.js.org/ "PDF-LIB official documentation"
[2]: https://github.com/Hopding/pdf-lib "Hopding/pdf-lib GitHub repository README"
[3]: https://www.npmjs.com/package/pdf-lib "pdf-lib npm package"
[4]: https://github.com/Hopding/pdf-lib "Hopding/pdf-lib repository and MIT license"
