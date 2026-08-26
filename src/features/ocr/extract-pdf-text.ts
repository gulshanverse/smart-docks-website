import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";
import { MAX_OCR_PAGE_TEXT_CHARS, MAX_OCR_PAGES_PER_RUN, type OcrDocumentResult, type OcrPageResult } from "../../domain/ocr/types";
import type { PdfDocumentAnalysis } from "../../domain/pdfs/document-analysis";
import { OcrCancelledError } from "./recognize-pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OcrCancelledError();
}

async function openPdf(data: Uint8Array): Promise<{ pdf: PDFDocumentProxy; task: ReturnType<typeof pdfjsLib.getDocument> }> {
  const task = pdfjsLib.getDocument({ data, useWorkerFetch: true });
  try {
    return { pdf: await task.promise, task };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    throw error;
  }
}

export async function extractPdfText(file: File, analysis: PdfDocumentAnalysis, onProgress?: (progress: { pageNumber: number; pageTotal: number; message: string }) => void, signal?: AbortSignal): Promise<OcrDocumentResult> {
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local text-extraction limit.");
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfCancelled(signal);
  const { pdf, task } = await openPdf(data);
  const started = performance.now();
  const pages: OcrPageResult[] = [];
  const processCount = Math.min(pdf.numPages, MAX_OCR_PAGES_PER_RUN);
  const processedPages: number[] = [];
  const skippedPages: number[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      throwIfCancelled(signal);
      if (pageNumber > processCount) {
        skippedPages.push(pageNumber);
        pages.push({ pageNumber, status: "skipped", text: "", characterCount: 0, blocks: [], lines: [], words: [], boundingBoxes: [], confidence: { value: null, metric: "unavailable", note: "Existing PDF text does not carry OCR confidence." }, language: "eng", processingTimeMs: null, failure: null, sourceRole: analysis.pages.find((page) => page.pageNumber === pageNumber)?.role ?? null, renderedWidth: null, renderedHeight: null });
        continue;
      }
      const page = await pdf.getPage(pageNumber);
      const pageStarted = performance.now();
      try {
        const content = await page.getTextContent({ disableNormalization: false });
        const text = content.items.map((item) => {
          const value = item as unknown as { str?: string };
          return value.str ?? "";
        }).join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_OCR_PAGE_TEXT_CHARS);
        const pageResult: OcrPageResult = { pageNumber, status: text ? "completed" : "skipped", text, characterCount: text.length, blocks: [], lines: [], words: text ? [{ text, box: null, confidence: { value: null, metric: "unavailable", note: "Existing PDF text does not carry OCR confidence." } }] : [], boundingBoxes: [], confidence: { value: null, metric: "unavailable", note: "Existing PDF text does not carry OCR confidence." }, language: "eng", processingTimeMs: Math.round(performance.now() - pageStarted), failure: null, sourceRole: analysis.pages.find((candidate) => candidate.pageNumber === pageNumber)?.role ?? null, renderedWidth: null, renderedHeight: null };
        pages.push(pageResult);
        if (text) processedPages.push(pageNumber); else skippedPages.push(pageNumber);
        onProgress?.({ pageNumber, pageTotal: pdf.numPages, message: `Extracted local text from page ${pageNumber} of ${pdf.numPages}.` });
      } finally {
        page.cleanup();
      }
    }
    const warnings = [...(pdf.numPages > processCount ? [`Text extraction is bounded to ${MAX_OCR_PAGES_PER_RUN} pages; ${pdf.numPages - processCount} pages were not extracted.`] : [])];
    const boundedTextCharacterCount = Math.min(24 * MAX_OCR_PAGE_TEXT_CHARS, pages.reduce((sum, page) => sum + page.text.length, 0));
    return { documentId: analysis.fileName, fileName: file.name, pageCount: pdf.numPages, processedPages, skippedPages, failedPages: [], language: "eng", textPresence: processedPages.length > 0 ? "detected" : "not-detected", pages, boundedTextCharacterCount, processingTimeMs: Math.round(performance.now() - started), cancelled: false, searchablePdfAvailable: false, warnings, processingBoundary: "browser-local" };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

export function textResultToFile(result: OcrDocumentResult): File {
  return new File([toArrayBuffer(new TextEncoder().encode(result.pages.filter((page) => page.text).map((page) => `[Page ${page.pageNumber}]\n${page.text}`).join("\n\n")))], `${result.fileName.replace(/\.pdf$/i, "")}-text.txt`, { type: "text/plain" });
}
