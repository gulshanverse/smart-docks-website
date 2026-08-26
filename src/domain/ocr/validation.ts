import type { PdfDocumentAnalysis } from "../pdfs/document-analysis";
import { comparePdfDocumentFeatures } from "../pdfs/preservation";
import type { OcrDocumentResult, OcrPlan, SearchablePdfValidation } from "./types";

function sameNumber(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1;
}

export function validateSearchablePdfCandidate(source: PdfDocumentAnalysis, candidate: PdfDocumentAnalysis, plan: OcrPlan, ocr: OcrDocumentResult, representativePages: number[]): SearchablePdfValidation {
  const warnings: string[] = [];
  const preservation = comparePdfDocumentFeatures(source, candidate);
  warnings.push(...preservation.warnings, ...preservation.criticalFailures);
  const dimensionsPreserved = source.pageDimensions.every((sourcePage) => {
    const candidatePage = candidate.pageDimensions.find((page) => page.pageNumber === sourcePage.pageNumber);
    return Boolean(candidatePage && sameNumber(candidatePage.widthPoints, sourcePage.widthPoints) && sameNumber(candidatePage.heightPoints, sourcePage.heightPoints));
  });
  const orientationPreserved = source.pages.every((sourcePage) => {
    const candidatePage = candidate.pages.find((page) => page.pageNumber === sourcePage.pageNumber);
    return Boolean(candidatePage && candidatePage.orientation === sourcePage.orientation);
  });
  if (candidate.pageCount !== source.pageCount) warnings.push(`Searchable PDF page count changed from ${source.pageCount} to ${candidate.pageCount}.`);
  if (!dimensionsPreserved) warnings.push("One or more sampled page dimensions changed.");
  if (!orientationPreserved) warnings.push("One or more sampled page orientations changed.");
  if (ocr.failedPages.length > 0) warnings.push("Searchable PDF authoring was blocked because one or more planned OCR pages failed.");
  if (plan.plannedPages.some((pageNumber) => !ocr.processedPages.includes(pageNumber))) warnings.push("Searchable PDF authoring was blocked because not every planned page completed OCR.");
  if (candidate.textPresence !== "detected" || candidate.text.boundedCharacterCount <= 0) warnings.push("The reopened candidate did not expose searchable text through PDF.js.");
  if (representativePages.length === 0) warnings.push("No representative page render completed for the candidate.");
  const valid = candidate.pageCount === source.pageCount && dimensionsPreserved && orientationPreserved && ocr.failedPages.length === 0 && plan.plannedPages.every((pageNumber) => ocr.processedPages.includes(pageNumber)) && candidate.textPresence === "detected" && candidate.text.boundedCharacterCount > 0 && representativePages.length > 0;
  const criticalFailures = [...preservation.criticalFailures, ...(candidate.pageCount !== source.pageCount ? [`Page count changed from ${source.pageCount} to ${candidate.pageCount}.`] : []), ...(!dimensionsPreserved ? ["Sampled page dimensions changed."] : []), ...(!orientationPreserved ? ["Sampled page orientations changed."] : []), ...(!plan.plannedPages.every((pageNumber) => ocr.processedPages.includes(pageNumber)) ? ["Not every planned page completed OCR."] : []), ...(ocr.failedPages.length > 0 ? ["One or more OCR pages failed."] : []), ...(candidate.textPresence !== "detected" || candidate.text.boundedCharacterCount <= 0 ? ["The reopened candidate has no searchable text."] : []), ...(representativePages.length === 0 ? ["No representative page render completed."] : [])];
  return { sourcePageCount: source.pageCount, candidatePageCount: candidate.pageCount, sourceTextPresence: source.textPresence === "detected" ? "detected" : source.textPresence === "not-detected" ? "not-detected" : "unknown", candidateTextPresence: candidate.textPresence === "detected" ? "detected" : candidate.textPresence === "not-detected" ? "not-detected" : "unknown", sourceCharacterCount: source.text.boundedCharacterCount, candidateCharacterCount: candidate.text.boundedCharacterCount, dimensionsPreserved, orientationPreserved, representativePagesRendered: representativePages, featureChanges: preservation.changes, criticalFailures, status: valid && criticalFailures.length === 0 ? "valid" : criticalFailures.length > 0 ? "invalid" : "unknown", warnings };
}
