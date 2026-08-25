import type { ProcessingBoundary } from "../files/types";

export const PDF_MUTATION_BOUNDARY: ProcessingBoundary = "browser-local";

export type PdfOperationType = "delete_pages" | "extract_pages" | "reorder_pages" | "rotate_pages";
export type PdfRotationDegrees = 90 | 180 | 270;

export interface PdfPageOperation {
  type: PdfOperationType;
  selectedPageNumbers: number[];
  parameters: {
    rotationDegrees?: PdfRotationDegrees;
    pageOrder?: number[];
  };
  processingBoundary: ProcessingBoundary;
}

export interface PdfOperationPlan {
  operation: PdfPageOperation;
  inputPageCount: number;
  selectedPages: number[];
  expectedOutputPageCount: number;
  expectedPageOrder: number[];
}

export interface OperationPlanError {
  code: "invalid-page-selection" | "cannot-delete-all-pages" | "invalid-page-order" | "invalid-rotation" | "no-pages-selected";
  message: string;
}

export type OperationPlanResult = { plan: PdfOperationPlan } | { error: OperationPlanError };

export function normalizeRotation(value: number): PdfRotationDegrees | null {
  if (value === 90 || value === 180 || value === 270) return value;
  return null;
}

export function validatePageNumbers(pageCount: number, pageNumbers: readonly number[]): OperationPlanError | null {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { code: "invalid-page-selection", message: "The PDF has no valid pages to operate on." };
  if (pageNumbers.length === 0) return { code: "no-pages-selected", message: "Select at least one page first." };
  if (pageNumbers.some((pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount)) {
    return { code: "invalid-page-selection", message: "One or more selected pages are outside the document." };
  }
  return null;
}

export function normalizeDocumentOrder(pageNumbers: readonly number[]): number[] {
  return [...new Set(pageNumbers)].sort((a, b) => a - b);
}

export function createDeletePlan(inputPageCount: number, selectedPageNumbers: readonly number[]): OperationPlanResult {
  const validation = validatePageNumbers(inputPageCount, selectedPageNumbers);
  if (validation) return { error: validation };
  const selectedPages = normalizeDocumentOrder(selectedPageNumbers);
  if (selectedPages.length >= inputPageCount) {
    return { error: { code: "cannot-delete-all-pages", message: "At least one page must remain. Select fewer pages to delete." } };
  }
  const expectedPageOrder = Array.from({ length: inputPageCount }, (_, index) => index + 1).filter((page) => !selectedPages.includes(page));
  return {
    plan: {
      operation: { type: "delete_pages", selectedPageNumbers: selectedPages, parameters: {}, processingBoundary: PDF_MUTATION_BOUNDARY },
      inputPageCount,
      selectedPages,
      expectedOutputPageCount: inputPageCount - selectedPages.length,
      expectedPageOrder,
    },
  };
}

export function createExtractPlan(inputPageCount: number, selectedPageNumbers: readonly number[]): OperationPlanResult {
  const validation = validatePageNumbers(inputPageCount, selectedPageNumbers);
  if (validation) return { error: validation };
  const selectedPages = normalizeDocumentOrder(selectedPageNumbers);
  return {
    plan: {
      operation: { type: "extract_pages", selectedPageNumbers: selectedPages, parameters: {}, processingBoundary: PDF_MUTATION_BOUNDARY },
      inputPageCount,
      selectedPages,
      expectedOutputPageCount: selectedPages.length,
      expectedPageOrder: selectedPages,
    },
  };
}

export function createReorderPlan(inputPageCount: number, pageOrder: readonly number[]): OperationPlanResult {
  if (!Number.isInteger(inputPageCount) || inputPageCount < 1) return { error: { code: "invalid-page-order", message: "The PDF has no valid pages to reorder." } };
  if (pageOrder.length !== inputPageCount || new Set(pageOrder).size !== inputPageCount || pageOrder.some((page) => !Number.isInteger(page) || page < 1 || page > inputPageCount)) {
    return { error: { code: "invalid-page-order", message: "The proposed page order must contain every page exactly once." } };
  }
  return {
    plan: {
      operation: { type: "reorder_pages", selectedPageNumbers: [], parameters: { pageOrder: [...pageOrder] }, processingBoundary: PDF_MUTATION_BOUNDARY },
      inputPageCount,
      selectedPages: [],
      expectedOutputPageCount: inputPageCount,
      expectedPageOrder: [...pageOrder],
    },
  };
}

export function createRotatePlan(inputPageCount: number, selectedPageNumbers: readonly number[], rotationDegrees: number): OperationPlanResult {
  const validation = validatePageNumbers(inputPageCount, selectedPageNumbers);
  if (validation) return { error: validation };
  const normalizedRotation = normalizeRotation(rotationDegrees);
  if (!normalizedRotation) return { error: { code: "invalid-rotation", message: "Rotation must be 90°, 180°, or 270°." } };
  const selectedPages = normalizeDocumentOrder(selectedPageNumbers);
  return {
    plan: {
      operation: { type: "rotate_pages", selectedPageNumbers: selectedPages, parameters: { rotationDegrees: normalizedRotation }, processingBoundary: PDF_MUTATION_BOUNDARY },
      inputPageCount,
      selectedPages,
      expectedOutputPageCount: inputPageCount,
      expectedPageOrder: Array.from({ length: inputPageCount }, (_, index) => index + 1),
    },
  };
}

export function describeOperation(plan: PdfOperationPlan): string {
  switch (plan.operation.type) {
    case "delete_pages": return `Deleted pages ${plan.selectedPages.join(", ")}.`;
    case "extract_pages": return `Extracted pages ${plan.selectedPages.join(", ")}.`;
    case "reorder_pages": return `Reordered pages to ${plan.expectedPageOrder.join("  ")}.`;
    case "rotate_pages": return `Rotated pages ${plan.selectedPages.join(", ")} by ${plan.operation.parameters.rotationDegrees}°.`;
  }
}
