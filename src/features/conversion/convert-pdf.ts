import type { ConversionOutput, ConversionPlan, ConversionPageSize } from "../../domain/conversions/types";
import { mimeForConversionFormat } from "../../domain/conversions/types";
import { conversionFilename, pageConversionFilename } from "../../domain/conversions/naming";
import { validateImageOutput, hasPdfSignature } from "../../domain/conversions/validation";
import { createPdfImagePlan, type PdfImageFormat, type PdfImageResolution } from "../../domain/pdfs/core";
import { renderPdfImages } from "../pdf/render-pdf-images";

interface ConversionExecutionOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The conversion was cancelled.", "AbortError");
}

function pdfFormat(format: ConversionPlan["outputFormat"]): PdfImageFormat {
  if (format === "jpeg") return "jpg";
  if (format === "png") return "png";
  return "webp";
}

function pdfResolution(resolution: NonNullable<ConversionPlan["resolution"]>): PdfImageResolution {
  return resolution;
}

function qualityFor(plan: ConversionPlan): number {
  if (plan.quality === "maximum") return 0.95;
  if (plan.quality === "high") return 0.88;
  if (plan.quality === "small") return 0.62;
  if (plan.quality === "smallest-practical") return 0.48;
  return 0.76;
}

function loadBlobImage(blob: Blob): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The rendered page could not be decoded for target-size conversion.")); };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the rendered page.")), mimeType, mimeType === "image/png" ? undefined : quality));
}

async function reduceRenderedPage(blob: Blob, plan: ConversionPlan, signal?: AbortSignal): Promise<{ blob: Blob; targetAchieved: boolean | null }> {
  if (!plan.targetSize || plan.targetSize.scope !== "per-file" || plan.outputFormat === "png") return { blob, targetAchieved: plan.targetSize ? blob.size <= plan.targetSize.bytes : null };
  const loaded = await loadBlobImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = loaded.image.naturalWidth;
  canvas.height = loaded.image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) { URL.revokeObjectURL(loaded.url); throw new Error("Your browser does not provide a canvas context for page conversion."); }
  try {
    context.drawImage(loaded.image, 0, 0);
    const qualities = [qualityFor(plan), 0.72, 0.58, 0.45].filter((value, index, values) => values.indexOf(value) === index).sort((a, b) => b - a);
    let smallest = blob;
    for (const quality of qualities) {
      abortIfNeeded(signal);
      const candidate = await canvasToBlob(canvas, mimeForConversionFormat(plan.outputFormat), quality);
      if (candidate.size < smallest.size) smallest = candidate;
      if (candidate.size <= plan.targetSize.bytes) return { blob: candidate, targetAchieved: true };
    }
    return { blob: smallest, targetAchieved: false };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(loaded.url);
  }
}

export async function convertPdfToImages(file: File, plan: ConversionPlan, options: ConversionExecutionOptions = {}): Promise<ConversionOutput[]> {
  if (plan.operation !== "pdf-to-image" || plan.sourceFiles.length !== 1) throw new Error("The PDF adapter requires one PDF source.");
  if (!plan.resolution) throw new Error("A PDF image conversion requires a bounded resolution preset.");
  abortIfNeeded(options.signal);
  const sourcePageCount = plan.sourceFiles[0].pageCount ?? 0;
  const pdfPlan = createPdfImagePlan(plan.pageSelection.pageNumbers, sourcePageCount, pdfFormat(plan.outputFormat), pdfResolution(plan.resolution));
  if ("error" in pdfPlan) throw new Error(pdfPlan.error);
  const rendered = await renderPdfImages(file, pdfPlan.plan, { signal: options.signal, onProgress: options.onProgress, maxDimension: plan.validationPolicy.maxPixelDimension });
  const outputs: ConversionOutput[] = [];
  try {
    for (let index = 0; index < rendered.length; index += 1) {
      abortIfNeeded(options.signal);
      const page = rendered[index];
      const reduced = await reduceRenderedPage(page.blob, plan, options.signal);
      const bytes = new Uint8Array(await reduced.blob.arrayBuffer());
      const expectedFormat = plan.outputFormat === "jpeg" || plan.outputFormat === "png" || plan.outputFormat === "webp" ? plan.outputFormat : "png";
      if (plan.outputFormat === "webp" && reduced.blob.type !== "image/webp") throw new Error("WebP encoding is unavailable in this browser.");
      const validation = validateImageOutput({ bytes, mimeType: reduced.blob.type, width: page.width, height: page.height, expectedFormat, maxPixelDimension: plan.validationPolicy.maxPixelDimension, maxTotalPixels: plan.validationPolicy.maxTotalPixels });
      if (!validation.valid) throw new Error(`${file.name}, page ${page.pageNumber}: ${validation.message}`);
      const warnings: string[] = [...plan.warnings];
      if (plan.targetSize && !reduced.targetAchieved) warnings.push(`Best effort: page ${page.pageNumber} remained above ${plan.targetSize.label} after the bounded quality search.`);
      outputs.push({ outputId: `${plan.planId}-page-${page.pageNumber}`, filename: pageConversionFilename(file.name, page.pageNumber, sourcePageCount, expectedFormat), mimeType: reduced.blob.type, bytes: reduced.blob.size, width: page.width, height: page.height, pageCount: null, blob: reduced.blob, validation, warnings });
    }
    return outputs;
  } finally {
    rendered.forEach((page) => { if (page.blob.size > 0) { /* Blob ownership is transferred to the validated output. */ } });
  }
}

const PAGE_SIZES: Record<Exclude<ConversionPageSize, "original">, { width: number; height: number; label: string }> = {
  A4: { width: 595.28, height: 841.89, label: "A4" },
  A5: { width: 419.53, height: 595.28, label: "A5" },
  Letter: { width: 612, height: 792, label: "Letter" },
  Legal: { width: 612, height: 1008, label: "Legal" },
};

function pageSizeFor(plan: ConversionPlan, width: number, height: number): { width: number; height: number; label: string } {
  if (plan.pageSize === "original") return { width: Math.min(2_000, Math.max(72, width)), height: Math.min(2_000, Math.max(72, height)), label: "Original image size" };
  return PAGE_SIZES[plan.pageSize ?? "A4"];
}

function orientPage(size: { width: number; height: number }, orientation: ConversionPlan["orientation"]): { width: number; height: number } {
  const isLandscape = size.width > size.height;
  if (orientation === "landscape" && !isLandscape) return { width: size.height, height: size.width };
  if (orientation === "portrait" && isLandscape) return { width: size.height, height: size.width };
  return size;
}

function fitRect(imageWidth: number, imageHeight: number, pageWidth: number, pageHeight: number, margin: number, mode: NonNullable<ConversionPlan["fitMode"]>): { x: number; y: number; width: number; height: number } {
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const widthScale = availableWidth / imageWidth;
  const heightScale = availableHeight / imageHeight;
  const scale = mode === "cover" ? Math.max(widthScale, heightScale) : mode === "fit-width" ? widthScale : mode === "fit-height" ? heightScale : Math.min(widthScale, heightScale);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}

async function imageBytesForPdf(file: File, mimeType: string): Promise<{ bytes: Uint8Array; mimeType: "image/jpeg" | "image/png"; width: number; height: number; cleanup: () => void }> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  if (mimeType === "image/jpeg" || mimeType === "image/png") return { bytes: new Uint8Array(await file.arrayBuffer()), mimeType, width, height, cleanup: () => bitmap.close() };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error(`${file.name}: Canvas conversion is unavailable for WebP-to-PDF.`); }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await canvasToBlob(canvas, "image/png", 1);
  canvas.width = 0;
  canvas.height = 0;
  return { bytes: new Uint8Array(await png.arrayBuffer()), mimeType: "image/png", width, height, cleanup: () => undefined };
}

export async function convertImagesToPdf(files: readonly File[], plan: ConversionPlan, options: ConversionExecutionOptions = {}): Promise<{ bytes: Uint8Array; filename: string; pageCount: number; width: number; height: number; warnings: string[]; targetAchieved: boolean | null }> {
  if (plan.operation !== "image-to-pdf" || files.length !== plan.sourceFiles.length) throw new Error("The image-to-PDF adapter received an invalid ordered collection.");
  abortIfNeeded(options.signal);
  const { PDFDocument, rgb } = await import("pdf-lib");
  const output = await PDFDocument.create();
  const warnings = [...plan.warnings];
  if (plan.background === "transparent") warnings.push("PDF pages do not preserve transparency semantics; a white background was used.");
  let totalBytes = 0;
  let firstWidth = 0;
  let firstHeight = 0;
  for (let index = 0; index < files.length; index += 1) {
    abortIfNeeded(options.signal);
    const file = files[index];
    const source = plan.sourceFiles[index];
    const image = await imageBytesForPdf(file, source.mimeType);
    try {
      const embedded = image.mimeType === "image/jpeg" ? await output.embedJpg(image.bytes) : await output.embedPng(image.bytes);
      const baseSize = pageSizeFor(plan, image.width, image.height);
      const pageSize = orientPage(baseSize, plan.orientation === "auto" ? (image.width >= image.height ? "landscape" : "portrait") : plan.orientation);
      if (index === 0) { firstWidth = pageSize.width; firstHeight = pageSize.height; }
      const page = output.addPage([pageSize.width, pageSize.height]);
      if (plan.background === "black") { page.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: rgb(0, 0, 0) }); }
      const rect = fitRect(image.width, image.height, pageSize.width, pageSize.height, plan.marginPoints ?? 18, plan.fitMode ?? "contain");
      page.drawImage(embedded, rect);
      totalBytes += file.size;
      options.onProgress?.(index + 1, files.length);
    } finally {
      image.cleanup();
    }
  }
  output.setCreator("SmartDocs");
  output.setProducer("SmartDocs browser-local conversion engine");
  const bytes = await output.save({ useObjectStreams: false });
  const targetAchieved = plan.targetSize ? (plan.targetSize.scope === "total" ? bytes.byteLength <= plan.targetSize.bytes : false) : null;
  if (plan.targetSize && !targetAchieved) warnings.push(`Best effort: the generated PDF measured ${Math.round(bytes.byteLength / 1000)} KB against ${plan.targetSize.label}.`);
  if (!hasPdfSignature(bytes)) throw new Error("The generated PDF did not contain a valid PDF signature.");
  return { bytes, filename: conversionFilename(files[0]?.name ?? "images", "pdf"), pageCount: files.length, width: firstWidth, height: firstHeight, warnings, targetAchieved };
}
