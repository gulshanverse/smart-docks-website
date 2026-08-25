import type { PdfPageDimensions } from "../files/types";
import { MAX_PDF_INPUT_BYTES } from "../files/types";

const PDF_SIGNATURE = "%PDF-";

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.slice(0, PDF_SIGNATURE.length)) === PDF_SIGNATURE;
}

export function readPdfVersion(bytes: Uint8Array): string | null {
  const header = new TextDecoder().decode(bytes.slice(0, 32));
  const match = header.match(/^%PDF-(\d+\.\d+)/);
  return match?.[1] ?? null;
}

export function isPdfWithinLocalInspectionLimit(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes >= 0 && sizeBytes <= MAX_PDF_INPUT_BYTES;
}

export function normalizePageDimensions(view: readonly number[]): PdfPageDimensions {
  const widthPoints = Math.round(Math.abs((view[2] ?? 0) - (view[0] ?? 0)));
  const heightPoints = Math.round(Math.abs((view[3] ?? 0) - (view[1] ?? 0)));
  const orientation = widthPoints > heightPoints ? "Landscape" : "Portrait";
  const isA4 = Math.abs(widthPoints - 595) <= 8 && Math.abs(heightPoints - 842) <= 8;
  const isLetter = Math.abs(widthPoints - 612) <= 8 && Math.abs(heightPoints - 792) <= 8;
  const paper = isA4 ? "A4" : isLetter ? "Letter" : `${widthPoints} × ${heightPoints} pt`;
  return { widthPoints, heightPoints, label: `${paper} · ${orientation}` };
}
