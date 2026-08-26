import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PdfRect } from "../../domain/actions/types";
import { MAX_TEXT_LENGTH } from "../../domain/actions/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfTextMatch { pageNumber: number; text: string; rect: PdfRect; }

export async function findPdfTextMatches(file: File, query: string, maxMatches = 24): Promise<PdfTextMatch[]> {
  const normalizedQuery = query.trim().slice(0, MAX_TEXT_LENGTH);
  if (!normalizedQuery) return [];
  const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useWorkerFetch: true });
  const pdf = await task.promise;
  const matches: PdfTextMatch[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages && matches.length < maxMatches; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1, rotation: 0 });
        const content = await page.getTextContent({ disableNormalization: false });
        for (const item of content.items) {
          if (matches.length >= maxMatches || !("str" in item) || typeof item.str !== "string") break;
          if (!item.str.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase())) continue;
          const transform = "transform" in item && Array.isArray(item.transform) ? item.transform : [1, 0, 0, 12, 0, 0];
          const height = Math.max(8, Math.abs(Number(transform[3])) || Number((item as { height?: number }).height) || 12);
          const width = Math.max(12, Number((item as { width?: number }).width) || normalizedQuery.length * height * 0.45);
          matches.push({ pageNumber, text: item.str.slice(0, 300), rect: { x: Math.max(0, Number(transform[4]) || 0), y: Math.max(0, viewport.height - (Number(transform[5]) || 0) - height), width: Math.min(width, viewport.width), height: Math.min(height, viewport.height) } });
        }
      } finally { page.cleanup(); }
    }
  } finally { await task.destroy().catch(() => undefined); }
  return matches;
}
