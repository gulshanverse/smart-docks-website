import type { ConversionBackground, ConversionOutput, ConversionPlan, ConversionQuality } from "../../domain/conversions/types";
import { mimeForConversionFormat } from "../../domain/conversions/types";
import { conversionFilename } from "../../domain/conversions/naming";
import { validateImageOutput } from "../../domain/conversions/validation";

interface ImageConversionOptions {
  signal?: AbortSignal;
  outputIndex?: number;
  onProgress?: (completed: number, total: number) => void;
}

const qualityForPreset: Record<ConversionQuality, number> = {
  maximum: 0.95,
  high: 0.88,
  balanced: 0.76,
  small: 0.62,
  "smallest-practical": 0.48,
};

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The conversion was cancelled.", "AbortError");
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name}: The browser could not decode this image.`)); };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode this image.")), mimeType, mimeType === "image/png" ? undefined : quality);
  });
}

function drawCanvas(image: HTMLImageElement, targetFormat: ConversionPlan["outputFormat"], background: ConversionBackground | null): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser does not provide a canvas context for local conversion.");
  if (targetFormat === "jpeg") {
    context.fillStyle = background === "black" ? "#000000" : "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function encodeForTarget(canvas: HTMLCanvasElement, plan: ConversionPlan): Promise<{ blob: Blob; targetAchieved: boolean | null; quality: number }> {
  const mimeType = mimeForConversionFormat(plan.outputFormat);
  const requestedQuality = qualityForPreset[plan.quality];
  if (!plan.targetSize || plan.outputFormat === "png") {
    const blob = await canvasToBlob(canvas, mimeType, requestedQuality);
    return { blob, targetAchieved: plan.targetSize ? blob.size <= plan.targetSize.bytes : null, quality: requestedQuality };
  }
  const attempts: Blob[] = [];
  const qualityCandidates = [requestedQuality, 0.72, 0.58, 0.45].filter((value, index, values) => values.indexOf(value) === index).sort((a, b) => b - a);
  for (const quality of qualityCandidates) {
    const blob = await canvasToBlob(canvas, mimeType, quality);
    attempts.push(blob);
    if (blob.size <= plan.targetSize.bytes) return { blob, targetAchieved: true, quality };
  }
  const smallest = attempts.at(-1);
  if (!smallest) throw new Error("No image candidate was encoded.");
  return { blob: smallest, targetAchieved: false, quality: qualityCandidates.at(-1) ?? requestedQuality };
}

export async function convertImageFile(file: File, plan: ConversionPlan, options: ImageConversionOptions = {}): Promise<ConversionOutput> {
  if (plan.operation !== "image-to-image") throw new Error("The image adapter received a non-image conversion plan.");
  abortIfNeeded(options.signal);
  const loaded = await loadImage(file);
  let canvas: HTMLCanvasElement | null = null;
  try {
    abortIfNeeded(options.signal);
    canvas = drawCanvas(loaded.image, plan.outputFormat, plan.background);
    const encoded = await encodeForTarget(canvas, plan);
    const expectedFormat = plan.outputFormat === "jpeg" || plan.outputFormat === "png" || plan.outputFormat === "webp" ? plan.outputFormat : "jpeg";
    if (plan.outputFormat === "webp" && encoded.blob.type !== "image/webp") throw new Error("WebP encoding is unavailable in this browser.");
    const bytes = new Uint8Array(await encoded.blob.arrayBuffer());
    const validation = validateImageOutput({ bytes, mimeType: encoded.blob.type, width: loaded.image.naturalWidth, height: loaded.image.naturalHeight, expectedFormat, maxPixelDimension: plan.validationPolicy.maxPixelDimension, maxTotalPixels: plan.validationPolicy.maxTotalPixels });
    if (!validation.valid) throw new Error(`${file.name}: ${validation.message}`);
    const warnings = ["Image metadata may be removed during canvas conversion."];
    if (plan.outputFormat === "jpeg" && file.type === "image/png") warnings.push("JPEG does not support transparency; the selected background was applied.");
    if (plan.targetSize && !encoded.targetAchieved) warnings.push(`Best effort: the smallest tested output was ${Math.round(encoded.blob.size / 1000)} KB, above ${plan.targetSize.label}.`);
    return { outputId: `${plan.planId}-${options.outputIndex ?? 0}`, filename: conversionFilename(file.name, plan.outputFormat), mimeType: encoded.blob.type, bytes: encoded.blob.size, width: loaded.image.naturalWidth, height: loaded.image.naturalHeight, pageCount: null, blob: encoded.blob, validation, warnings };
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    URL.revokeObjectURL(loaded.url);
    options.onProgress?.((options.outputIndex ?? 0) + 1, plan.validationPolicy.expectedOutputCount);
  }
}

export function imageConversionTargetState(outputs: readonly ConversionOutput[], plan: ConversionPlan): boolean | null {
  if (!plan.targetSize) return null;
  if (plan.targetSize.scope === "per-file") return outputs.every((output) => output.bytes <= plan.targetSize!.bytes);
  return outputs.reduce((sum, output) => sum + output.bytes, 0) <= plan.targetSize.bytes;
}
