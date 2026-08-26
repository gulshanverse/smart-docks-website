import type { PdfRect } from "./types";

export type PageRotation = 0 | 90 | 180 | 270;
export interface PageGeometry { width: number; height: number; rotation: PageRotation; }
export interface ViewportRect { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number; }

export function clampRect(rect: PdfRect, geometry: Pick<PageGeometry, "width" | "height">): PdfRect | null {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.max(0, Math.min(rect.x, geometry.width));
  const y = Math.max(0, Math.min(rect.y, geometry.height));
  const right = Math.min(geometry.width, Math.max(x, rect.x + rect.width));
  const top = Math.min(geometry.height, Math.max(y, rect.y + rect.height));
  if (right <= x || top <= y) return null;
  return { x, y, width: right - x, height: top - y };
}

export function viewportToPdf(rect: ViewportRect, geometry: PageGeometry): PdfRect | null {
  if (rect.viewportWidth <= 0 || rect.viewportHeight <= 0) return null;
  const displayedWidth = geometry.rotation === 90 || geometry.rotation === 270 ? geometry.height : geometry.width;
  const displayedHeight = geometry.rotation === 90 || geometry.rotation === 270 ? geometry.width : geometry.height;
  const scaleX = displayedWidth / rect.viewportWidth;
  const scaleY = displayedHeight / rect.viewportHeight;
  const left = rect.x * scaleX;
  const right = (rect.x + rect.width) * scaleX;
  const topFromViewport = rect.y * scaleY;
  const bottomFromViewport = (rect.y + rect.height) * scaleY;
  const displayed = { x: left, y: displayedHeight - bottomFromViewport, width: right - left, height: bottomFromViewport - topFromViewport };
  const mapped = mapDisplayedToPdf(displayed, geometry);
  return clampRect(mapped, geometry);
}

function mapDisplayedToPdf(rect: PdfRect, geometry: PageGeometry): PdfRect {
  if (geometry.rotation === 0) return rect;
  if (geometry.rotation === 90) return { x: geometry.width - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width };
  if (geometry.rotation === 180) return { x: geometry.width - rect.x - rect.width, y: geometry.height - rect.y - rect.height, width: rect.width, height: rect.height };
  return { x: rect.y, y: geometry.height - rect.x - rect.width, width: rect.height, height: rect.width };
}

export function rotatedPageSize(geometry: PageGeometry): { width: number; height: number } {
  return geometry.rotation === 90 || geometry.rotation === 270 ? { width: geometry.height, height: geometry.width } : { width: geometry.width, height: geometry.height };
}
