import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { createFileId, getExtension } from "../../lib/file-utils";
import type { FileIntakeError, PdfAsset, PdfTextPresence } from "../../domain/files/types";
import { classifyPdf, type PdfInspectionSignals } from "../../domain/pdfs/types";
import { hasPdfSignature, isPdfWithinLocalInspectionLimit, normalizePageDimensions, readPdfVersion } from "../../domain/pdfs/helpers";
import { FIRST_PAGE_RENDER_SCALE, MAX_PDF_SAMPLE_PAGES, MAX_PDF_TEXT_CHARS } from "./config";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PAINT_IMAGE_OPERATORS = new Set<number>([
  pdfjsLib.OPS.paintImageMaskXObject,
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintInlineImageXObject,
]);

function pdfError(code: FileIntakeError["code"], title: string, message: string, recovery: string): FileIntakeError {
  return { code, title, message, recovery };
}

function samplePageNumbers(pageCount: number): number[] {
  if (pageCount <= MAX_PDF_SAMPLE_PAGES) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const candidates = [1, 2, Math.ceil(pageCount / 2), pageCount - 1, pageCount];
  return [...new Set(candidates.filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount))];
}

function hasRasterOperator(operatorList: { fnArray: number[] }): boolean {
  return operatorList.fnArray.some((operator) => PAINT_IMAGE_OPERATORS.has(operator));
}

type PdfTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

function textStats(textContent: PdfTextContent): { itemCount: number; characterCount: number } {
  let itemCount = 0;
  let characterCount = 0;
  for (const item of textContent.items) {
    const value = typeof item === "object" && "str" in item && typeof item.str === "string" ? item.str : "";
    if (!value.trim()) continue;
    itemCount += 1;
    characterCount = Math.min(MAX_PDF_TEXT_CHARS, characterCount + value.length);
    if (characterCount >= MAX_PDF_TEXT_CHARS) break;
  }
  return { itemCount, characterCount };
}

async function renderFirstPage(pdf: PDFDocumentProxy): Promise<string> {
  const page = await pdf.getPage(1);
  try {
    const viewport = page.getViewport({ scale: FIRST_PAGE_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(Math.ceil(viewport.width), 1600);
    canvas.height = Math.min(Math.ceil(viewport.height), 2200);
    const scaleX = canvas.width / viewport.width;
    const scaleY = canvas.height / viewport.height;
    const renderViewport = page.getViewport({ scale: FIRST_PAGE_RENDER_SCALE * Math.min(scaleX, scaleY) });
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not create a PDF preview canvas.");
    await page.render({ canvas: null, canvasContext: context, viewport: renderViewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The PDF preview could not be encoded.")), "image/png");
    });
    return URL.createObjectURL(blob);
  } finally {
    page.cleanup();
  }
}

export async function inspectPdfFile(file: File): Promise<PdfAsset | FileIntakeError> {
  if (!isPdfWithinLocalInspectionLimit(file.size)) {
    return pdfError(
      "oversized-pdf",
      "PDF is too large for browser-local inspection.",
      "SmartDocs currently limits PDF inspection to 50 MB so the browser can keep memory use bounded.",
      "Choose a smaller PDF. Larger PDF processing remains browser-local; optional AI understanding can use only a bounded text context through the configured gateway.",
    );
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!hasPdfSignature(header)) {
    return pdfError(
      "invalid-pdf",
      "This file is not a valid PDF.",
      "SmartDocs checked the file signature instead of trusting its filename or MIME label.",
      "Export the document again as a PDF and retry.",
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
  let passwordRequired = false;
  try {
    loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: true });
    loadingTask.onPassword = () => {
      passwordRequired = true;
      void loadingTask?.destroy();
    };
    const pdf = await loadingTask.promise;
    if (passwordRequired) throw new Error("password-required");

    const pageCount = pdf.numPages;
    const pageNumbers = samplePageNumbers(pageCount);
    let pagesWithText = 0;
    let textItemCount = 0;
    let boundedCharacterCount = 0;
    let rasterPages = 0;
    let firstPageHasRasterImage = false;
    const warnings: string[] = [];
    let pageDimensions = null as PdfAsset["pageDimensions"];

    for (const pageNumber of pageNumbers) {
      const page = await pdf.getPage(pageNumber);
      if (pageNumber === 1) pageDimensions = normalizePageDimensions(page.getViewport({ scale: 1 }).viewBox);
      const textContent = await page.getTextContent({ disableNormalization: false });
      const stats = textStats(textContent);
      if (stats.itemCount > 0) pagesWithText += 1;
      textItemCount += stats.itemCount;
      boundedCharacterCount = Math.min(MAX_PDF_TEXT_CHARS, boundedCharacterCount + stats.characterCount);
      const operatorList = await page.getOperatorList();
      const hasRaster = hasRasterOperator(operatorList);
      if (hasRaster) rasterPages += 1;
      if (pageNumber === 1) firstPageHasRasterImage = hasRaster;
      page.cleanup();
    }

    const signals: PdfInspectionSignals = {
      pageCount,
      pagesSampled: pageNumbers.length,
      pagesWithText,
      textItemCount,
      boundedCharacterCount,
      firstPageHasRasterImage,
      rasterPages,
      protected: false,
    };
    const classification = classifyPdf(signals);
    const textExtractable = textItemCount > 0;
    const textPresence: PdfTextPresence = textExtractable ? (boundedCharacterCount >= 12 ? "detected" : "limited") : "not-detected";
    let previewUrl: string | null = null;
    try {
      previewUrl = await renderFirstPage(pdf);
    } catch {
      warnings.push("The PDF loaded, but the browser could not render its first page preview.");
    }
    await loadingTask.destroy();
    loadingTask = null;

    if (pageNumbers.length < pageCount) warnings.push(`Classification sampled ${pageNumbers.length} of ${pageCount} pages.`);
    if (classification === "scanned" || classification === "mixed") warnings.push("This is a heuristic classification based on sampled text and raster signals.");

    return {
      id: createFileId(),
      name: file.name,
      sizeBytes: file.size,
      extension: getExtension(file.name),
      category: "pdf",
      mimeType: "application/pdf",
      processingBoundary: "browser-local",
      pdfVersion: readPdfVersion(header),
      pageCount,
      encrypted: false,
      passwordProtected: false,
      textPresence,
      textExtractable,
      classification,
      pageDimensions,
      previewUrl,
      capabilities: { inspect: true, renderPreview: true },
      warnings,
    };
  } catch (error) {
    if (loadingTask) await loadingTask.destroy().catch(() => undefined);
    if (passwordRequired || (error instanceof Error && error.message === "password-required")) {
      return pdfError(
        "pdf-protected",
        "This PDF is password protected.",
        "SmartDocs could not inspect a protected document without a password.",
        "Password-protected PDF support is coming later. The document was not uploaded.",
      );
    }
    return pdfError(
      "invalid-pdf",
      "SmartDocs could not inspect this PDF.",
      "The document could not be safely loaded or its pages could not be read.",
      "Try exporting the document again or choose another PDF.",
    );
  }
}
