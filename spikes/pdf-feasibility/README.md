# PDF Feasibility Spike

This isolated spike does not modify the SmartDocs production UI or add a PDF dependency to the application. It generates a two-page mixed fixture, runs lightweight local inspection, extracts text, and rasterizes the first page.

## Run

From the repository root:

```bash
python3 spikes/pdf-feasibility/run_spike.py
```

The script uses the preinstalled Poppler command-line tools:

- `pdfinfo` for file size, PDF version, and page count.
- `pdftotext` for a first text-presence/text-extractability signal.
- `pdftoppm` for first-page raster rendering.

## Observed result

The generated fixture is a PDF 1.3 document with two pages. The first page contains extractable text; the second page is image-only. The spike reported `text_presence: true`, `text_extractable: true`, and a `mixed` classification hint, and rendered the first page to PNG.

This proves only that a small native-tool inspection/rendering path is feasible in the sandbox. It does not prove production safety, browser compatibility, PDF feature preservation, performance at large sizes, or a complete classification algorithm. Those remain architecture and security work for a separately approved implementation phase.
