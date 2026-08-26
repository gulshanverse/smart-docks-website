# Phase 9 Office library research

## Decision summary

SmartDocs adds only **fflate 0.8.3** for bounded local ZIP/DEFLATE access. It does not add a DOCX/PPTX/XLSX rendering engine, an Office authoring library, a CDN dependency, or an external conversion API.

| Candidate | Browser role | License/version evidence | Decision |
|---|---|---|---|
| Mammoth.js | DOCX semantic HTML/text interpretation | Repository reports BSD-2-Clause and release 1.12.1 [1] | Not added. Its own documentation warns that complex DOCX-to-HTML conversion is not exact and it favors semantic structure over styling. |
| SheetJS Community Edition | XLSX raw workbook parsing | Official docs describe browser `XLSX.read` inputs, sheet/row bounding, and unextracted features [2] | Not added. A raw parser does not provide faithful Excel rendering or PDF export; the safe Phase 9 inspector reads only bounded XML parts. |
| PptxGenJS | PPTX authoring/generation | Official repository documents browser/React/Vite generation [3] | Not added. Generation is not PPTX reading or faithful PowerPoint rendering. |
| fflate | ZIP/DEFLATE inflation for OOXML package inspection | Official repository reports MIT licensing and browser typed-array support; package docs report 0.8.3, zero dependencies, and a focused inflate footprint [4] [5] | Added lazily at version 0.8.3 for selected-entry bounded inflation. |

## Fidelity boundary

> “There’s a large mismatch between the structure used by .docx and the structure used by HTML, meaning that the conversion is unlikely to be perfect for more complicated documents.” — Mammoth.js documentation [1]

Mammoth is a credible DOCX semantic interpreter, but its documented behavior is not a basis for Word-faithful PDF conversion. SheetJS is a credible raw-data parser, but its official documentation states that not all codecs support all features and that additional styling, images, graphs, and PivotTables are a Pro feature [2]. PptxGenJS produces PPTX files but does not solve the required reader/renderer problem [3].

Accordingly, Phase 9 supports **parsed**, **structurally understood**, and **bounded previewed** Office files. It does not claim **faithful rendered** or **Office-preserving converted** output. DOCX/PPTX/XLSX → PDF is explicitly unavailable in the UI until a safe browser-local renderer is independently verified.

## References

[1]: https://github.com/mwilliamson/mammoth.js/ "Mammoth.js repository"
[2]: https://docs.sheetjs.com/docs/api/parse-options/ "SheetJS Community Edition — Reading Files"
[3]: https://github.com/gitbrent/PptxGenJS/ "PptxGenJS repository"
[4]: https://github.com/101arrowz/fflate/ "fflate repository"
[5]: https://www.npmjs.com/package/fflate "fflate npm package"
