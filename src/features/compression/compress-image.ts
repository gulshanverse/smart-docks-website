import { reductionPercent } from "../../lib/file-utils";
import type { ImageAsset } from "../../domain/files/types";
import type { ImageCompressionIntent } from "../../domain/intents/parse-intent";
import type { ImageDimensions, QualityDecision, ValidationResult, OptimizationStrategy } from "../../domain/workflows/validation";
import { selectCandidate } from "./select-candidate";

export type CompressionStage = "preparing" | "analyzing" | "optimizing" | "checking";

export interface CompressionOptions {
  allowResize?: boolean;
}

export interface CompressionOutcome {
  blob: Blob;
  previewUrl: string;
  downloadUrl: string;
  filename: string;
  validation: ValidationResult;
  targetLabel: string;
  quality: number;
  resizeAvailable: boolean;
  warning?: string;
}

type Candidate = {
  blob: Blob;
  mimeType: string;
  quality: number;
  bytes: number;
};

type CompressionAttempt = {
  candidate: Candidate;
  targetAchieved: boolean;
};

const QUALITY_FLOOR = 0.45;
const QUALITY_CEILING = 0.95;
const QUALITY_ITERATIONS = 6;
const RESIZE_SCALES = [0.84, 0.7, 0.56, 0.44, 0.35] as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded by the browser."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("The browser could not encode this image."));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

async function inspectEncodedBlob(blob: Blob): Promise<ImageDimensions> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getCandidateMimeTypes(sourceMime: string): readonly string[] {
  if (sourceMime === "image/png") return ["image/png", "image/webp"];
  if (sourceMime === "image/webp") return ["image/webp", "image/jpeg"];
  return ["image/jpeg", "image/webp"];
}

async function findBestForMime(canvas: HTMLCanvasElement, mimeType: string, targetBytes: number, onStage: (stage: CompressionStage) => void): Promise<{ accepted?: Candidate; floor: Candidate }> {
  let low = QUALITY_FLOOR;
  let high = QUALITY_CEILING;
  const floorBlob = await canvasToBlob(canvas, mimeType, QUALITY_FLOOR);
  const floorCandidate: Candidate = { blob: floorBlob, mimeType, quality: QUALITY_FLOOR, bytes: floorBlob.size };
  let accepted: Candidate | undefined = floorCandidate.bytes <= targetBytes ? floorCandidate : undefined;

  if (!accepted) {
    for (let iteration = 0; iteration < QUALITY_ITERATIONS; iteration += 1) {
      onStage("optimizing");
      const quality = (low + high) / 2;
      const blob = await canvasToBlob(canvas, mimeType, quality);
      const candidate: Candidate = { blob, mimeType, quality, bytes: blob.size };
      if (candidate.bytes <= targetBytes) {
        accepted = candidate;
        low = quality;
      } else {
        high = quality;
      }
      if (Math.abs(high - low) < 0.012) break;
    }
  }

  const bestQualityBlob = await canvasToBlob(canvas, mimeType, QUALITY_CEILING);
  const bestQualityCandidate: Candidate = {
    blob: bestQualityBlob,
    mimeType,
    quality: QUALITY_CEILING,
    bytes: bestQualityBlob.size,
  };
  const floor = bestQualityCandidate.bytes < floorCandidate.bytes * 0.98 ? bestQualityCandidate : floorCandidate;
  return { accepted, floor };
}

async function optimizeCanvas(canvas: HTMLCanvasElement, targetBytes: number, sourceMime: string, onStage: (stage: CompressionStage) => void): Promise<CompressionAttempt> {
  const acceptedCandidates: Candidate[] = [];
  const floorCandidates: Candidate[] = [];
  for (const mimeType of getCandidateMimeTypes(sourceMime)) {
    const result = await findBestForMime(canvas, mimeType, targetBytes, onStage);
    if (result.accepted) acceptedCandidates.push(result.accepted);
    floorCandidates.push(result.floor);
  }

  const candidates = acceptedCandidates.length > 0 ? acceptedCandidates : floorCandidates;
  const selection = selectCandidate(candidates, targetBytes, sourceMime);
  const candidate = candidates.find((item) => item.bytes === selection.candidate.bytes && item.quality === selection.candidate.quality && item.mimeType === selection.candidate.mimeType) ?? candidates[0];
  return { candidate, targetAchieved: selection.targetAchieved };
}

function drawSource(canvas: HTMLCanvasElement, sourceImage: HTMLImageElement, dimensions: ImageDimensions): void {
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser does not provide a canvas context for local image processing.");
  context.clearRect(0, 0, dimensions.width, dimensions.height);
  context.drawImage(sourceImage, 0, 0, dimensions.width, dimensions.height);
}

export function scaledDimensions(original: ImageDimensions, scale: number): ImageDimensions {
  return {
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  };
}

export function qualityDecision(quality: number, mimeType: string, preserved: boolean, targetAchieved: boolean): QualityDecision {
  if (preserved) return "preserved";
  if (mimeType === "image/png" || quality >= 0.75) return "good";
  if (targetAchieved && quality >= 0.55) return "acceptable";
  return "best-effort";
}

function extensionForMime(mimeType: string): string {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

async function createOutcome(args: {
  asset: ImageAsset;
  intent: ImageCompressionIntent;
  blob: Blob;
  dimensions: ImageDimensions;
  strategy: OptimizationStrategy;
  quality: number;
  message: string;
  warning?: string;
  resizeAvailable: boolean;
  qualityDecision: QualityDecision;
}): Promise<CompressionOutcome> {
  const { asset, intent, blob, dimensions, strategy, quality, message, warning, resizeAvailable } = args;
  const mimeType = blob.type || asset.mimeType;
  const validation: ValidationResult = {
    valid: blob.size > 0 && dimensions.width > 0 && dimensions.height > 0 && Boolean(mimeType),
    targetAchieved: blob.size <= intent.targetBytes,
    targetBytes: intent.targetBytes,
    outputBytes: blob.size,
    originalBytes: asset.sizeBytes,
    reductionPercent: reductionPercent(asset.sizeBytes, blob.size),
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    originalDimensions: { width: asset.width, height: asset.height },
    finalDimensions: dimensions,
    optimizationStrategy: strategy,
    qualityDecision: args.qualityDecision,
    resizeApplied: dimensions.width !== asset.width || dimensions.height !== asset.height,
    message,
  };
  const extension = extensionForMime(mimeType);
  const filename = `${asset.name.replace(/\.[^/.]+$/, "")}-optimized.${extension}`;
  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    downloadUrl: URL.createObjectURL(blob),
    filename,
    validation,
    targetLabel: intent.targetLabel,
    quality,
    resizeAvailable,
    warning,
  };
}

export async function compressImage(asset: ImageAsset, intent: ImageCompressionIntent, onStage: (stage: CompressionStage) => void, options: CompressionOptions = {}): Promise<CompressionOutcome> {
  const allowResize = options.allowResize ?? true;
  onStage("preparing");
  const sourceImage = await loadImage(asset.previewUrl);
  onStage("analyzing");
  const originalDimensions: ImageDimensions = { width: sourceImage.naturalWidth, height: sourceImage.naturalHeight };

  if (asset.sizeBytes <= intent.targetBytes) {
    const originalBlob = await fetch(asset.previewUrl).then((response) => response.blob());
    onStage("checking");
    return createOutcome({
      asset,
      intent,
      blob: originalBlob,
      dimensions: originalDimensions,
      strategy: "original-preserved",
      quality: 1,
      qualityDecision: "preserved",
      message: "The original image was already within the requested target, so it was preserved.",
      resizeAvailable: false,
    });
  }

  const canvas = document.createElement("canvas");
  drawSource(canvas, sourceImage, originalDimensions);
  const compressionOnly = await optimizeCanvas(canvas, intent.targetBytes, asset.mimeType, onStage);
  onStage("checking");
  const originalAttemptDimensions = await inspectEncodedBlob(compressionOnly.candidate.blob);

  if (compressionOnly.targetAchieved) {
    return createOutcome({
      asset,
      intent,
      blob: compressionOnly.candidate.blob,
      dimensions: originalAttemptDimensions,
      strategy: "compression-only",
      quality: compressionOnly.candidate.quality,
      qualityDecision: qualityDecision(compressionOnly.candidate.quality, compressionOnly.candidate.mimeType, false, true),
      message: "Target achieved with compression only; original dimensions were preserved.",
      resizeAvailable: false,
    });
  }

  const compressionOnlySize = compressionOnly.candidate.bytes;
  if (!allowResize) {
    return createOutcome({
      asset,
      intent,
      blob: compressionOnly.candidate.blob,
      dimensions: originalAttemptDimensions,
      strategy: "compression-only",
      quality: compressionOnly.candidate.quality,
      qualityDecision: "best-effort",
      message: `At the original dimensions, the best acceptable result is ${Math.round(compressionOnlySize / 1000)}KB.`,
      warning: `Compression alone couldn't reach ${intent.targetLabel} without significant quality loss.`,
      resizeAvailable: true,
    });
  }

  for (const scale of RESIZE_SCALES) {
    const dimensions = scaledDimensions(originalDimensions, scale);
    drawSource(canvas, sourceImage, dimensions);
    const resizedAttempt = await optimizeCanvas(canvas, intent.targetBytes, asset.mimeType, onStage);
    if (!resizedAttempt.targetAchieved) continue;
    const finalDimensions = await inspectEncodedBlob(resizedAttempt.candidate.blob);
    return createOutcome({
      asset,
      intent,
      blob: resizedAttempt.candidate.blob,
      dimensions: finalDimensions,
      strategy: "resize-and-compress",
      quality: resizedAttempt.candidate.quality,
      qualityDecision: qualityDecision(resizedAttempt.candidate.quality, resizedAttempt.candidate.mimeType, false, true),
      message: `SmartDocs reduced dimensions from ${originalDimensions.width} × ${originalDimensions.height} to ${finalDimensions.width} × ${finalDimensions.height} to reach your target.`,
      warning: `Compression alone couldn't reach ${intent.targetLabel} without significant quality loss.`,
      resizeAvailable: true,
    });
  }

  const originalResultDimensions = await inspectEncodedBlob(compressionOnly.candidate.blob);
  return createOutcome({
    asset,
    intent,
    blob: compressionOnly.candidate.blob,
    dimensions: originalResultDimensions,
    strategy: "compression-only",
    quality: compressionOnly.candidate.quality,
    qualityDecision: "best-effort",
    message: `Even after evaluating careful dimension reductions, the best acceptable result is ${Math.round(compressionOnlySize / 1000)}KB.`,
    warning: `We couldn't reach ${intent.targetLabel} without making the image significantly less readable.`,
    resizeAvailable: true,
  });
}
