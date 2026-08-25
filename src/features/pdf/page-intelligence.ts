import * as pdfjsLib from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PdfPageAsset } from "../../domain/pdfs/pages";
import { createPdfPageAsset, normalizePdfPageGeometry, normalizePdfPageText } from "../../domain/pdfs/pages";
import { FIRST_PAGE_RENDER_SCALE, MAX_PDF_TEXT_CHARS, PDFJS_VERSION } from "./config";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PAINT_IMAGE_OPERATORS = new Set<number>([
  pdfjsLib.OPS.paintImageMaskXObject,
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintInlineImageXObject,
]);

const MAX_MAIN_PREVIEW_WIDTH = 1600;
const MAX_MAIN_PREVIEW_HEIGHT = 2200;
const MAX_THUMBNAIL_SIZE = 260;

export interface PdfPageRenderOptions {
  kind: "preview" | "thumbnail";
}

export interface PdfPageSession {
  readonly pageCount: number;
  readonly engineVersion: string;
  inspectPage(pageNumber: number): Promise<PdfPageAsset>;
  renderPage(pageNumber: number, options: PdfPageRenderOptions): Promise<string>;
  revokeObjectUrl(url: string): void;
  close(): Promise<void>;
}

function hasRasterOperator(operatorList: { fnArray: number[] }): boolean {
  return operatorList.fnArray.some((operator) => PAINT_IMAGE_OPERATORS.has(operator));
}

function assertPageNumber(pageNumber: number, pageCount: number): void {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) throw new Error("page-unavailable");
}

async function inspectPageSignals(page: PDFPageProxy, pageNumber: number): Promise<PdfPageAsset> {
  const geometry = normalizePdfPageGeometry(page.getViewport({ scale: 1 }).viewBox);
  const textContent = await page.getTextContent({ disableNormalization: false });
  const text = normalizePdfPageText(textContent.items.map((item) => typeof item === "object" && "str" in item && typeof item.str === "string" ? item.str : ""), MAX_PDF_TEXT_CHARS);
  const operatorList = await page.getOperatorList();
  const hasRasterContent = hasRasterOperator(operatorList);
  return createPdfPageAsset(pageNumber, geometry, { hasText: text.hasText, textCharacterCount: text.textCharacterCount, hasRasterContent });
}

async function renderPageToUrl(page: PDFPageProxy, kind: PdfPageRenderOptions["kind"]): Promise<string> {
  const requestedScale = kind === "preview" ? FIRST_PAGE_RENDER_SCALE : 0.32;
  const initialViewport = page.getViewport({ scale: requestedScale });
  const maxWidth = kind === "preview" ? MAX_MAIN_PREVIEW_WIDTH : MAX_THUMBNAIL_SIZE;
  const maxHeight = kind === "preview" ? MAX_MAIN_PREVIEW_HEIGHT : MAX_THUMBNAIL_SIZE;
  const fitScale = Math.min(1, maxWidth / initialViewport.width, maxHeight / initialViewport.height);
  const viewport = page.getViewport({ scale: requestedScale * fitScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("preview-canvas-unavailable");
    await page.render({ canvas: null, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("preview-encode-failure")), "image/png");
    });
    return URL.createObjectURL(blob);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

export async function openPdfPageSession(file: File): Promise<PdfPageSession> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: true });
  let passwordRequired = false;
  loadingTask.onPassword = () => {
    passwordRequired = true;
    void loadingTask.destroy();
  };

  try {
    const pdf = await loadingTask.promise;
    if (passwordRequired) throw new Error("password-required");
    const objectUrls = new Set<string>();
    let closed = false;

    const session: PdfPageSession = {
      pageCount: pdf.numPages,
      engineVersion: PDFJS_VERSION,
      async inspectPage(pageNumber) {
        if (closed) throw new Error("page-session-closed");
        assertPageNumber(pageNumber, pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        try {
          return await inspectPageSignals(page, pageNumber);
        } catch (error) {
          page.cleanup();
          throw error;
        }
      },
      async renderPage(pageNumber, options) {
        if (closed) throw new Error("page-session-closed");
        assertPageNumber(pageNumber, pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        try {
          const url = await renderPageToUrl(page, options.kind);
          objectUrls.add(url);
          return url;
        } catch (error) {
          page.cleanup();
          throw error;
        }
      },
      revokeObjectUrl(url) {
        if (!objectUrls.has(url)) return;
        URL.revokeObjectURL(url);
        objectUrls.delete(url);
      },
      async close() {
        if (closed) return;
        closed = true;
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.clear();
        await loadingTask.destroy().catch(() => undefined);
      },
    };
    return session;
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    if (passwordRequired || (error instanceof Error && error.message === "password-required")) throw new Error("password-required");
    throw error;
  }
}
