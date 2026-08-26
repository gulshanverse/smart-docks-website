
## Browser smoke check: PDF to PNG

Using the committed `multipage-fixture.pdf` (12 pages), the Convert tab parsed the goal `convert pages 2-5 to PNG`, displayed an explicit `pdf-to-image · PNG · 4 outputs` plan, and showed the browser-local boundary before execution. The local run produced four separate outputs named `multipage-fixture-page-002.png` through `multipage-fixture-page-005.png`. Each output was reopened/decoded and displayed the validation state `Image decoded, matched the requested format, and passed dimension and signature checks.` The original PDF remained unchanged.

Evidence captured on the local Vite app at `http://127.0.0.1:5173/` on 2026-08-26. No external provider request was involved.

## Browser smoke check: image-to-PDF and ordered collection

The browser accepted a three-file local selection (`image-a.png`, `image-b.jpg`, `image-c.png`) through the ordered image chooser. The Convert tab displayed all three pages in source order with individual earlier/later/remove controls. Clicking **Move image-b.jpg earlier** placed `image-b.jpg` first, followed by `image-a.png` and `image-c.png`, while retaining the collection. The page settings accepted explicit `Letter` page size, `Landscape` orientation, `Fit width`, and a `24`-point margin. The reviewed plan showed `image-to-pdf · PDF · 3 outputs`, `21.4 KB` input, and the browser-local boundary. Execution produced `image-b.pdf` at `25.1 KB`, `792 × 612`, and `3 pages`; PDF.js reopened it and displayed the passed page-count, preview, geometry, and signature validation message. The chain recorded `image-b.jpg, image-a.png, image-c.png → image-b.pdf`. Clicking **Continue with this PDF in SmartDocs** handed off the generated file; the main workspace then classified it as a 3-page, Letter, Landscape, image-only PDF with a first-page preview. The original files remained unchanged.

## Browser smoke check: image-to-JPEG

Using the committed `image-a.png` active source, the Convert tab was switched to `JPG`, the plan was rebuilt, and **Convert and validate** was run. The UI produced `image-a.jpg` at `640 × 420`, reopened the output through the image decoder, confirmed the requested MIME/signature and dimensions, displayed a preview, and exposed a real download link. The result reported that the JPEG output was larger than the PNG input and that canvas conversion may remove metadata; the transparency/background warning was visible. The ephemeral conversion chain appended `image-a.png → image-a.jpg` after the prior PDF conversion chain.

## Browser smoke check: image to PDF

Using the committed `image-a.png`, the Convert tab presented an ordered one-image collection and explicit A4, orientation, fit, margin, and background settings. The reviewed `image-to-pdf · PDF · 1 output` plan executed locally and produced `image-a.pdf`. SmartDocs reopened the output through PDF.js and displayed `PDF reopened through PDF.js and passed page-count, preview, geometry, and signature checks.` It also honestly warned that the PDF was larger than the source image and retained the conversion in the ephemeral chain history. The source image remained unchanged.
