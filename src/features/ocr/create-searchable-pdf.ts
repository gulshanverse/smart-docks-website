import { PDFDocument, StandardFonts, TextRenderingMode, beginText, endText, popGraphicsState, pushGraphicsState, setFontAndSize, setTextMatrix, setTextRenderingMode, showText } from "pdf-lib";
import type { PdfDocumentAnalysis } from "../../domain/pdfs/document-analysis";
import { safeCoreFilename } from "../../domain/pdfs/core";
import { validateSearchablePdfCandidate } from "../../domain/ocr/validation";
import type { OcrLineResult, OcrPageResult, OcrSearchablePdfRequest, SearchablePdfValidation } from "../../domain/ocr/types";
import { OcrCancelledError } from "./recognize-pdf";
import { analyzePdfDocument, validatePdfRepresentativeRenders } from "../pdf/analyze-pdf-document";

export interface SearchablePdfOutput {
  file: File;
  validation: SearchablePdfValidation;
  previewPages: number[];
}

export class SearchablePdfValidationError extends Error {
  readonly validation: SearchablePdfValidation;

  constructor(validation: SearchablePdfValidation) {
    super("The searchable PDF failed independent validation and was not offered as a result.");
    this.name = "SearchablePdfValidationError";
    this.validation = validation;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OcrCancelledError();
}

function emit(request: OcrSearchablePdfRequest, progress: Parameters<NonNullable<OcrSearchablePdfRequest["onProgress"]>>[0]): void {
  request.onProgress?.(progress);
}

function linesForPage(page: OcrPageResult): OcrLineResult[] {
  if (page.lines.length > 0) return page.lines;
  return page.blocks.flatMap((block) => block.lines);
}

function addInvisibleLine(page: ReturnType<PDFDocument["getPage"]>, line: OcrLineResult, source: OcrPageResult, widthPoints: number, heightPoints: number, fontName: string, encode: (text: string) => ReturnType<Awaited<ReturnType<PDFDocument["embedFont"]>>["encodeText"]>): void {
  const normalizedText = line.text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedText || !line.box || !source.renderedWidth || !source.renderedHeight) return;
  const x = Math.max(0, Math.min(widthPoints, (line.box.left / source.renderedWidth) * widthPoints));
  const y = Math.max(0, Math.min(heightPoints, heightPoints - ((line.box.top + Math.max(1, line.box.height)) / source.renderedHeight) * heightPoints));
  const fontSize = Math.max(2, Math.min(48, (Math.max(1, line.box.height) / source.renderedHeight) * heightPoints * 1.12));
  let encodedText;
  try {
    encodedText = encode(normalizedText);
  } catch {
    const asciiFallback = normalizedText.replace(/[^\x20-\x7E]/g, "");
    if (!asciiFallback) return;
    try { encodedText = encode(asciiFallback); } catch { return; }
  }
  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setTextRenderingMode(TextRenderingMode.Invisible),
    setFontAndSize(fontName, fontSize),
    setTextMatrix(1, 0, 0, 1, x, y),
    showText(encodedText),
    endText(),
    popGraphicsState(),
  );
}

export async function createSearchablePdf(request: OcrSearchablePdfRequest): Promise<SearchablePdfOutput> {
  throwIfCancelled(request.signal);
  if (!request.plan.supported) throw new Error("The selected OCR language is not available in this local browser build.");
  if (request.plan.recommendation === "review-limit") throw new Error("Searchable-PDF authoring is bounded to a complete local OCR run; review the page limit before continuing.");
  if (request.result.failedPages.length > 0) throw new Error("Searchable-PDF authoring is blocked until every planned OCR page completes successfully.");
  if (!request.plan.plannedPages.every((pageNumber) => request.result.processedPages.includes(pageNumber))) throw new Error("Searchable-PDF authoring is blocked until every planned OCR page completes successfully.");

  const sourceBytes = new Uint8Array(await request.source.arrayBuffer());
  throwIfCancelled(request.signal);
  const document = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pageResults = new Map(request.result.pages.map((page) => [page.pageNumber, page]));
  const pages = document.getPages();
  emit(request, { phase: "authoring", pageTotal: pages.length, message: "Adding an invisible local OCR text layer while preserving the scanned page appearance." });
  for (let index = 0; index < pages.length; index += 1) {
    throwIfCancelled(request.signal);
    const pageNumber = index + 1;
    const page = pages[index];
    const pageResult = pageResults.get(pageNumber);
    if (!pageResult || pageResult.status !== "completed") continue;
    const widthPoints = page.getWidth();
    const heightPoints = page.getHeight();
    for (const line of linesForPage(pageResult)) addInvisibleLine(page, line, pageResult, widthPoints, heightPoints, font.name, (text) => font.encodeText(text));
    emit(request, { phase: "authoring", pageNumber, pageTotal: pages.length, message: `Added OCR text layer for page ${pageNumber} of ${pages.length}.` });
  }
  throwIfCancelled(request.signal);
  const outputBytes = await document.save({ useObjectStreams: true, addDefaultPage: false });
  const file = new File([toArrayBuffer(outputBytes)], safeCoreFilename(request.source.name, "searchable", "pdf"), { type: "application/pdf" });
  emit(request, { phase: "validating", pageTotal: pages.length, message: "Reopening the searchable PDF and validating text, geometry, and representative renders." });
  const candidateAnalysis = await analyzePdfDocument(file, undefined, undefined, request.signal);
  const previewPages = await validatePdfRepresentativeRenders(file, request.signal);
  const validation = validateSearchablePdfCandidate(request.analysis, candidateAnalysis, request.plan, request.result, previewPages);
  if (validation.status !== "valid") throw new SearchablePdfValidationError(validation);
  emit(request, { phase: "complete", pageTotal: pages.length, message: "Searchable PDF validated locally and ready for download." });
  return { file, validation, previewPages };
}
