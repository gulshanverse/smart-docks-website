import type { ImageAsset, PdfAsset, ProcessingBoundary } from "../files/types";
import { FIRST_PAGE_RENDER_SCALE, MAX_PDF_SAMPLE_PAGES, MAX_PDF_TEXT_CHARS } from "../../features/pdf/config";
import type { ImageCompressionIntent } from "../intents/parse-intent";
import type { PdfInspectionValidation } from "../pdfs/types";
import type { PdfOperationPlan, PdfOperationType } from "../pdfs/operations";
import type { ImageToPdfPlan, PdfBlankDetectionPlan, PdfBlankRemovalPlan, PdfImageRenderPlan, PdfMergePlan, PdfSplitPlan, PdfCoreOperation } from "../pdfs/core";
import type { PdfOptimizationIntent, PdfOptimizationPlan } from "../pdfs/optimization";
import type { DocumentIntelligenceSnapshot, PdfAdvancedOptimizationPlan, PdfDocumentAnalysis } from "../pdfs/document-analysis";

export type WorkflowStepId = "image.compress.target_size" | "pdf.inspect" | "pdf.inspect.page" | "pdf.render.preview" | "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages" | "pdf.merge" | "pdf.split" | "pdf.render.images" | "image.create.pdf" | "pdf.detect.blank_pages" | "pdf.remove.blank_pages" | "pdf.analyze.optimization" | "pdf.optimize.target_size" | "pdf.analyze.advanced" | "pdf.analyze.features" | "pdf.analyze.structure" | "pdf.extract.bounded_text" | "pdf.analyze.layout" | "pdf.analyze.ocr_readiness" | "pdf.plan.optimization" | "pdf.generate.candidates" | "pdf.validate.preservation" | "pdf.compare" | "intelligence.snapshot" | "validation";

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

export interface PdfMutationWorkflow {
  input: PdfAsset;
  plan: PdfOperationPlan;
  processingBoundary: "browser-local";
  steps: readonly [
    { id: "pdf.inspect" },
    { id: "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages"; operation: PdfOperationType },
    { id: "pdf.render.preview"; pageNumber: 1; renderScale: number },
    { id: "validation" },
  ];
}

export interface PdfOptimizationWorkflow {
  input: PdfAsset;
  intent: PdfOptimizationIntent;
  plan: PdfOptimizationPlan;
  advancedPlan?: PdfAdvancedOptimizationPlan;
  processingBoundary: "browser-local";
  steps: readonly { id: WorkflowStepId; operation?: string; pageNumber?: number; renderScale?: number }[];
}

export interface PdfAdvancedAnalysisWorkflow {
  input: PdfAsset;
  analysis: PdfDocumentAnalysis;
  intelligenceSnapshot: DocumentIntelligenceSnapshot;
  processingBoundary: "browser-local";
  steps: readonly { id: WorkflowStepId; operation?: string }[];
}

export interface PdfCoreWorkflow {
  processingBoundary: "browser-local";
  operation: PdfCoreOperation;
  plan: PdfMergePlan | PdfSplitPlan | PdfImageRenderPlan | ImageToPdfPlan | PdfBlankDetectionPlan | PdfBlankRemovalPlan;
  steps: readonly { id: WorkflowStepId; operation?: PdfCoreOperation }[];
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

export function createPdfMutationWorkflow(input: PdfAsset, plan: PdfOperationPlan): PdfMutationWorkflow {
  const operationId = `pdf.${plan.operation.type.replace("_pages", ".pages")}` as "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages";
  return {
    input,
    plan,
    processingBoundary: "browser-local",
    steps: [
      { id: "pdf.inspect" },
      { id: operationId, operation: plan.operation.type },
      { id: "pdf.render.preview", pageNumber: 1, renderScale: FIRST_PAGE_RENDER_SCALE },
      { id: "validation" },
    ],
  };
}

export function createPdfOptimizationWorkflow(input: PdfAsset, intent: PdfOptimizationIntent, plan: PdfOptimizationPlan, advancedPlan?: PdfAdvancedOptimizationPlan): PdfOptimizationWorkflow {
  return {
    input,
    intent,
    plan,
    advancedPlan,
    processingBoundary: "browser-local",
    steps: advancedPlan ? [
      { id: "pdf.inspect" },
      { id: "pdf.analyze.features" },
      { id: "pdf.analyze.structure" },
      { id: "pdf.analyze.optimization" },
      { id: "pdf.plan.optimization" },
      { id: "pdf.generate.candidates" },
      { id: "pdf.validate.preservation" },
      { id: "pdf.compare" },
      { id: "validation" },
      { id: "pdf.render.preview", pageNumber: 1, renderScale: FIRST_PAGE_RENDER_SCALE },
    ] : [
      { id: "pdf.inspect" },
      { id: "pdf.analyze.optimization" },
      { id: "pdf.optimize.target_size" },
      { id: "validation" },
      { id: "pdf.render.preview", pageNumber: 1, renderScale: FIRST_PAGE_RENDER_SCALE },
    ],
  };
}

export function createPdfAdvancedAnalysisWorkflow(input: PdfAsset, analysis: PdfDocumentAnalysis, intelligenceSnapshot: DocumentIntelligenceSnapshot): PdfAdvancedAnalysisWorkflow {
  return {
    input,
    analysis,
    intelligenceSnapshot,
    processingBoundary: "browser-local",
    steps: [
      { id: "pdf.inspect" },
      { id: "pdf.analyze.advanced" },
      { id: "pdf.extract.bounded_text" },
      { id: "pdf.analyze.layout" },
      { id: "pdf.analyze.structure" },
      { id: "pdf.analyze.ocr_readiness" },
      { id: "intelligence.snapshot" },
      { id: "validation" },
    ],
  };
}

export function createPdfCoreWorkflow(operation: PdfCoreOperation, plan: PdfMergePlan | PdfSplitPlan | PdfImageRenderPlan | ImageToPdfPlan | PdfBlankDetectionPlan | PdfBlankRemovalPlan): PdfCoreWorkflow {
  const operationId: WorkflowStepId = operation === "merge" ? "pdf.merge" : operation === "split" ? "pdf.split" : operation === "render_images" ? "pdf.render.images" : operation === "create_pdf" ? "image.create.pdf" : operation === "detect_blank_pages" ? "pdf.detect.blank_pages" : "pdf.remove.blank_pages";
  return { processingBoundary: "browser-local", operation, plan, steps: [{ id: "pdf.inspect", operation }, { id: operationId, operation }, { id: "validation", operation }, { id: "pdf.render.preview", operation }] };
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
