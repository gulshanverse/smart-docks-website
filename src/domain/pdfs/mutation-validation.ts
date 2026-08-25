import type { ProcessingBoundary } from "../files/types";
import type { PdfOperationPlan } from "./operations";

export interface PdfMutationValidation {
  valid: boolean;
  operation: PdfOperationPlan["operation"]["type"];
  inputBytes: number;
  outputBytes: number;
  pageCount: number;
  expectedPageCount: number;
  previewAvailable: boolean;
  expectedPageOrder: number[];
  processingBoundary: ProcessingBoundary;
  message: string;
  warnings: string[];
}

export function validatePdfMutationResult(options: {
  plan: PdfOperationPlan;
  inputBytes: number;
  outputBytes: number;
  pageCount: number;
  previewAvailable: boolean;
  processingBoundary: ProcessingBoundary;
}): PdfMutationValidation {
  const { plan, inputBytes, outputBytes, pageCount, previewAvailable, processingBoundary } = options;
  const pageCountMatches = pageCount === plan.expectedOutputPageCount;
  const valid = pageCountMatches && previewAvailable && processingBoundary === "browser-local";
  const warnings: string[] = [];
  if (outputBytes > inputBytes) warnings.push("Page operations can make a PDF larger; no compression was applied.");
  if (!previewAvailable) warnings.push("The output could not be previewed by PDF.js.");
  if (!pageCountMatches) warnings.push(`Expected ${plan.expectedOutputPageCount} pages but found ${pageCount}.`);
  return {
    valid,
    operation: plan.operation.type,
    inputBytes,
    outputBytes,
    pageCount,
    expectedPageCount: plan.expectedOutputPageCount,
    previewAvailable,
    expectedPageOrder: [...plan.expectedPageOrder],
    processingBoundary,
    message: valid ? "New PDF parsed and first-page preview validated locally." : "The new PDF did not pass output validation and is not ready for download.",
    warnings,
  };
}
