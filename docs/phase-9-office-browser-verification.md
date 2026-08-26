# Phase 9 Office browser verification

## DOCX — verified in Chromium

The synthetic `tests/fixtures/phase9-word.docx` fixture was uploaded through the SmartDocs file chooser at `http://127.0.0.1:5173/`. The application classified it as a `.DOCX` Word document, reported a 1.0 KB local package, moderate complexity, and moderate preservation risk, and showed a Browser-local badge. The file input accepted the local fixture without a network step.

The Office workspace rendered an inspected and validated state with four paragraphs, an interpreted document structure preview, and the extracted fixture text. The preview displayed the heading and paragraph content plus bounded table cell text. The workspace explicitly labeled the preview as interpreted and warned that it is not Microsoft Word rendering fidelity. It also exposed a bounded TXT download and a capability list.

The capability list correctly marked bounded package inspection, bounded text extraction, and interpreted Word structure preview as available. Office → PDF was marked unavailable because no faithful browser-local Office renderer has been independently verified. No screenshot-based or fake PDF result was offered.

The first upload attempt through the automated file selector did not retain the file, so the control was focused and the same local fixture was uploaded again. The second upload dispatched correctly and produced the verified result above. No browser console errors were observed during the successful path.

## PPTX — verified in Chromium

The synthetic `tests/fixtures/phase9-presentation.pptx` fixture was uploaded after returning to the empty intake. SmartDocs classified it as a `.PPTX` PowerPoint presentation, reported two slides, moderate complexity, and moderate preservation risk, and rendered a structural slide preview. The preview showed the slide titles and bounded text, plus shape, image, and chart-signal counts. The capability list exposed bounded inspection, text extraction, and structural slide preview while explicitly marking Office → PDF unavailable. No faithful-rendering claim was made.

## XLSX — verified in Chromium

The synthetic `tests/fixtures/phase9-workbook.xlsx` fixture was uploaded after returning to the empty intake. SmartDocs classified it as a `.XLSX` Excel workbook, reported two sheets, and displayed the visible `Sales` sheet plus the hidden `Archive` sheet. The bounded preview showed the `Revenue` and `Units` headers, numeric values, the calculated value `300` with formula `A2/B2`, and the hidden-sheet value. The sheet range signals were displayed as `A1:C3` and `A1:A1`.

The capability list correctly marked bounded package inspection, bounded text extraction, and bounded sheet/cell preview as available. Office → PDF was explicitly unavailable and no fake spreadsheet snapshot was generated. The preview copy stated that only the first 30 rows and 64 cells per row are loaded into the interface.
