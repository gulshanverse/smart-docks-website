import type { ImageAsset, PdfAsset, ProcessingBoundary } from "../files/types";
import { FIRST_PAGE_RENDER_SCALE, MAX_PDF_SAMPLE_PAGES, MAX_PDF_TEXT_CHARS } from "../../features/pdf/config";
import type { ImageCompressionIntent } from "../intents/parse-intent";
import type { PdfInspectionValidation } from "../pdfs/types";

export type WorkflowStepId = "image.compress.target_size" | "pdf.inspect" | "pdf.inspect.page" | "pdf.render.preview" | "validation";

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

export interface PdfPageInspectionWorkflow {
  input: PdfAsset;
  pageNumber: number;
  processingBoundary: "browser-local";
  steps: readonly [
    { id: "pdf.inspect.page"; pageNumber: number; textSampleLimit: number },
    { id: "pdf.render.preview"; pageNumber: number; renderScale: number },
  ];
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
      { id: "pdf.inspect", samplePages: MAX_PDF_SAMPLE_PAGES, textSampleLimit: MAX_PDF_TEXT_CHARS },
      { id: "pdf.render.preview", pageNumber: 1, renderScale: FIRST_PAGE_RENDER_SCALE },
      { id: "validation" },
    ],
  };
}

export function createPdfPageInspectionWorkflow(input: PdfAsset, pageNumber: number): PdfPageInspectionWorkflow {
  return {
    input,
    pageNumber,
    processingBoundary: "browser-local",
    steps: [
      { id: "pdf.inspect.page", pageNumber, textSampleLimit: MAX_PDF_TEXT_CHARS },
      { id: "pdf.render.preview", pageNumber, renderScale: FIRST_PAGE_RENDER_SCALE },
    ],
  };
}
