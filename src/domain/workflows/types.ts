import type { ImageAsset, PdfAsset, ProcessingBoundary } from "../files/types";
import type { ImageCompressionIntent } from "../intents/parse-intent";
import type { PdfInspectionValidation } from "../pdfs/types";

export type WorkflowStepId = "image.compress.target_size" | "pdf.inspect" | "pdf.render.preview" | "validation";

export interface ImageCompressionWorkflow {
  input: ImageAsset;
  intent: ImageCompressionIntent;
  processingBoundary: ProcessingBoundary;
  steps: readonly [
    { id: "image.compress.target_size"; targetBytes: number; preserveQuality: boolean },
    { id: "validation" },
  ];
}

export interface PdfInspectionWorkflow {
  input: PdfAsset;
  processingBoundary: "browser-local";
  steps: readonly [
    { id: "pdf.inspect"; samplePages: number; textSampleLimit: number },
    { id: "pdf.render.preview"; pageNumber: 1; renderScale: number },
    { id: "validation" },
  ];
  validation?: PdfInspectionValidation;
}

export function createImageCompressionWorkflow(input: ImageAsset, intent: ImageCompressionIntent): ImageCompressionWorkflow {
  return {
    input,
    intent,
    processingBoundary: input.processingBoundary,
    steps: [
      { id: "image.compress.target_size", targetBytes: intent.targetBytes, preserveQuality: intent.preserveQuality },
      { id: "validation" },
    ],
  };
}

export function createPdfInspectionWorkflow(input: PdfAsset): PdfInspectionWorkflow {
  return {
    input,
    processingBoundary: "browser-local",
    steps: [
      { id: "pdf.inspect", samplePages: 8, textSampleLimit: 2_000 },
      { id: "pdf.render.preview", pageNumber: 1, renderScale: 1.25 },
      { id: "validation" },
    ],
  };
}
