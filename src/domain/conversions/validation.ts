import type { ConversionFormat, ConversionOutputValidation, ConversionPlan } from "./types";

function bytesStartWith(bytes: Uint8Array, values: readonly number[]): boolean {
  return values.every((value, index) => bytes[index] === value);
}

export function hasImageSignature(bytes: Uint8Array, format: Exclude<ConversionFormat, "pdf">): boolean {
  if (format === "jpeg") return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (format === "png") return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

export function validateImageOutput(args: {
  bytes: Uint8Array;
  mimeType: string;
  width: number | null;
  height: number | null;
  expectedFormat: Exclude<ConversionFormat, "pdf">;
  maxPixelDimension?: number;
  maxTotalPixels?: number;
}): ConversionOutputValidation {
  const { bytes, mimeType, width, height, expectedFormat } = args;
  const expectedMime = expectedFormat === "jpeg" ? "image/jpeg" : `image/${expectedFormat}`;
  const dimensionsValid = Number.isInteger(width) && Number.isInteger(height) && Number(width) > 0 && Number(height) > 0;
  const sizeValid = bytes.byteLength > 0;
  const mimeValid = mimeType === expectedMime;
  const signatureValid = hasImageSignature(bytes, expectedFormat);
  const pixelValid = dimensionsValid && Number(width) <= (args.maxPixelDimension ?? 3_000) && Number(height) <= (args.maxPixelDimension ?? 3_000) && Number(width) * Number(height) <= (args.maxTotalPixels ?? 24_000_000);
  const valid = sizeValid && mimeValid && signatureValid && dimensionsValid && pixelValid;
  return { valid, signatureValid, decoded: dimensionsValid, mimeValid, nonZeroBytes: sizeValid, dimensions: dimensionsValid ? { width: Number(width), height: Number(height) } : null, pageCount: null, expectedFormat, message: valid ? "Image decoded, matched the requested format, and passed dimension and signature checks." : "The image output failed format, signature, dimension, or non-zero-byte validation." };
}

export function validatePdfOutput(args: {
  bytes: Uint8Array;
  actualPageCount: number | null;
  expectedPageCount: number;
  previewAvailable: boolean;
  expectedDimensions?: { width: number; height: number } | null;
  actualDimensions?: { width: number; height: number } | null;
  plan: ConversionPlan;
}): ConversionOutputValidation {
  const signatureValid = hasPdfSignature(args.bytes);
  const nonZeroBytes = args.bytes.byteLength > 0;
  const pageCountValid = args.actualPageCount === args.expectedPageCount;
  const previewValid = args.previewAvailable;
  const dimensionsValid = !args.expectedDimensions || !args.actualDimensions || (Math.abs(args.expectedDimensions.width - args.actualDimensions.width) < 1 && Math.abs(args.expectedDimensions.height - args.actualDimensions.height) < 1);
  const valid = signatureValid && nonZeroBytes && pageCountValid && previewValid && dimensionsValid && args.plan.processingBoundary === "browser-local";
  return { valid, signatureValid, decoded: previewValid, mimeValid: true, nonZeroBytes, dimensions: args.actualDimensions ?? null, pageCount: args.actualPageCount, expectedFormat: "pdf", message: valid ? "PDF reopened through PDF.js and passed page-count, preview, geometry, and signature checks." : "The PDF output failed reopen, page-count, preview, geometry, or signature validation." };
}

export function targetAchieved(outputBytes: number, plan: ConversionPlan): boolean | null {
  if (!plan.targetSize) return null;
  return outputBytes <= plan.targetSize.bytes;
}

export function sizeDifferencePercent(inputBytes: number, outputBytes: number): number {
  if (inputBytes <= 0) return 0;
  return ((outputBytes - inputBytes) / inputBytes) * 100;
}
