import type { ProcessingBoundary } from "../files/types";
import type { PdfCoreOperation } from "./core";

export interface CorePdfValidation {
  valid: boolean;
  operation: PdfCoreOperation;
  expectedPageCount: number;
  actualPageCount: number;
  previewAvailable: boolean;
  processingBoundary: ProcessingBoundary;
  inputBytes: number;
  outputBytes: number;
  warnings: string[];
  message: string;
}

export function validateCorePdfOutput(options: { operation: PdfCoreOperation; expectedPageCount: number; actualPageCount: number; previewAvailable: boolean; inputBytes: number; outputBytes: number; processingBoundary: ProcessingBoundary; warnings?: readonly string[] }): CorePdfValidation {
  const warnings = [...(options.warnings ?? [])];
  if (options.outputBytes > options.inputBytes) warnings.push("The generated PDF is larger than the input; no compression was applied.");
  const valid = options.expectedPageCount === options.actualPageCount && options.previewAvailable && options.processingBoundary === "browser-local";
  if (options.expectedPageCount !== options.actualPageCount) warnings.push(`Expected ${options.expectedPageCount} pages but PDF.js found ${options.actualPageCount}.`);
  if (!options.previewAvailable) warnings.push("PDF.js could not render the first-page preview.");
  return { ...options, valid, warnings, message: valid ? "PDF validation successful. The new document opened and previewed locally." : "PDF validation failed. The download is not offered as a validated result." };
}
