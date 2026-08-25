import { reductionPercent } from "../../lib/file-utils";
import type { FileAsset } from "../../domain/files/types";
import type { ImageCompressionIntent } from "../../domain/intents/parse-intent";
import type { ValidationResult } from "../../domain/workflows/validation";
import { selectCandidate } from "./select-candidate";

export type CompressionStage = "preparing" | "analyzing" | "optimizing" | "checking";

export interface CompressionOutcome {
  blob: Blob;
  previewUrl: string;
  downloadUrl: string;
  filename: string;
  validation: ValidationResult;
  targetLabel: string;
  quality: number;
  warning?: string;
}

type Candidate = {
  blob: Blob;
  mimeType: string;
  quality: number;
  bytes: number;
};

const QUALITY_FLOOR = 0.45;
const QUALITY_CEILING = 0.95;
const QUALITY_ITERATIONS = 8;

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

async function inspectEncodedBlob(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function candidateScore(candidate: Candidate, sourceMime: string): number {
  const formatBonus = candidate.mimeType === sourceMime ? 0.03 : 0;
  return candidate.quality + formatBonus;
}

function getCandidateMimeTypes(asset: FileAsset): readonly string[] {
  if (asset.mimeType === "image/png") {
    return ["image/png", "image/webp"];
  }
  if (asset.mimeType === "image/webp") {
    return ["image/webp", "image/jpeg"];
  }
  return ["image/jpeg", "image/webp"];
}

async function findBestForMime(canvas: HTMLCanvasElement, mimeType: string, targetBytes: number, onStage: (stage: CompressionStage) => void): Promise<{ accepted?: Candidate; floor: Candidate }> {
  let low = QUALITY_FLOOR;
  let high = QUALITY_CEILING;
  let floor = await canvasToBlob(canvas, mimeType, QUALITY_FLOOR);
  let floorCandidate: Candidate = { blob: floor, mimeType, quality: QUALITY_FLOOR, bytes: floor.size };
  let accepted: Candidate | undefined;

  if (floor.size <= targetBytes) {
    accepted = floorCandidate;
  } else {
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
      if (Math.abs(high - low) < 0.01) break;
    }
  }

  const ceilingBlob = await canvasToBlob(canvas, mimeType, QUALITY_CEILING);
  const ceilingCandidate: Candidate = {
    blob: ceilingBlob,
    mimeType,
    quality: QUALITY_CEILING,
    bytes: ceilingBlob.size,
  };
  if (candidateScore(ceilingCandidate, mimeType) > candidateScore(floorCandidate, mimeType) && ceilingCandidate.bytes < floorCandidate.bytes * 0.98) {
    floorCandidate = ceilingCandidate;
  }

  return { accepted, floor: floorCandidate };
}

export async function compressImage(asset: FileAsset, intent: ImageCompressionIntent, onStage: (stage: CompressionStage) => void): Promise<CompressionOutcome> {
  onStage("preparing");
  const sourceImage = await loadImage(asset.previewUrl);
  onStage("analyzing");

  if (asset.sizeBytes <= intent.targetBytes) {
    const originalBlob = await fetch(asset.previewUrl).then((response) => response.blob());
    onStage("checking");
    const dimensions = await inspectEncodedBlob(originalBlob);
    const validation: ValidationResult = {
      valid: originalBlob.size > 0 && dimensions.width > 0 && dimensions.height > 0 && Boolean(originalBlob.type),
      targetAchieved: true,
      targetBytes: intent.targetBytes,
      outputBytes: originalBlob.size,
      originalBytes: asset.sizeBytes,
      reductionPercent: reductionPercent(asset.sizeBytes, originalBlob.size),
      mimeType: originalBlob.type || asset.mimeType,
      width: dimensions.width,
      height: dimensions.height,
      message: "The original image was already within the requested target, so it was preserved.",
    };
    const previewUrl = URL.createObjectURL(originalBlob);
    const downloadUrl = URL.createObjectURL(originalBlob);
    const extension = originalBlob.type === "image/png" ? "png" : originalBlob.type === "image/webp" ? "webp" : "jpg";
    return {
      blob: originalBlob,
      previewUrl,
      downloadUrl,
      filename: `${asset.name.replace(/\.[^/.]+$/, "")}-optimized.${extension}`,
      validation,
      targetLabel: intent.targetLabel,
      quality: 1,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser does not provide a canvas context for local image processing.");
  context.drawImage(sourceImage, 0, 0);

  const acceptedCandidates: Candidate[] = [];
  const floorCandidates: Candidate[] = [];
  for (const mimeType of getCandidateMimeTypes(asset)) {
    const result = await findBestForMime(canvas, mimeType, intent.targetBytes, onStage);
    if (result.accepted) acceptedCandidates.push(result.accepted);
    floorCandidates.push(result.floor);
  }

  const candidates = acceptedCandidates.length > 0 ? acceptedCandidates : floorCandidates;
  const selection = selectCandidate(candidates, intent.targetBytes, asset.mimeType);
  const candidate = candidates.find((item) => item.bytes === selection.candidate.bytes && item.quality === selection.candidate.quality && item.mimeType === selection.candidate.mimeType) ?? candidates[0];

  onStage("checking");
  const dimensions = await inspectEncodedBlob(candidate.blob);
  const targetAchieved = selection.targetAchieved;
  const validation: ValidationResult = {
    valid: candidate.blob.size > 0 && dimensions.width > 0 && dimensions.height > 0 && Boolean(candidate.blob.type),
    targetAchieved,
    targetBytes: intent.targetBytes,
    outputBytes: candidate.blob.size,
    originalBytes: asset.sizeBytes,
    reductionPercent: reductionPercent(asset.sizeBytes, candidate.blob.size),
    mimeType: candidate.blob.type,
    width: dimensions.width,
    height: dimensions.height,
    message: targetAchieved
      ? "Target achieved and output decoded successfully."
      : "Reaching that target would significantly reduce image quality. This is the best quality-preserving result available without resizing.",
  };

  const extension = candidate.blob.type === "image/png" ? "png" : candidate.blob.type === "image/webp" ? "webp" : "jpg";
  const filename = `${asset.name.replace(/\.[^/.]+$/, "")}-optimized.${extension}`;
  const previewUrl = URL.createObjectURL(candidate.blob);
  const downloadUrl = URL.createObjectURL(candidate.blob);

  return {
    blob: candidate.blob,
    previewUrl,
    downloadUrl,
    filename,
    validation,
    targetLabel: intent.targetLabel,
    quality: candidate.quality,
    warning: targetAchieved ? undefined : validation.message,
  };
}
