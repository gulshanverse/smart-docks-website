import type { PdfDocumentAnalysis, PdfSignalStatus } from "./document-analysis";

export interface PdfFeatureChange {
  feature: string;
  before: string;
  after: string;
  status: "preserved" | "changed" | "unknown" | "blocked";
}

export interface PdfPreservationValidation {
  valid: boolean;
  status: "preservation-safe" | "preservation-warning" | "preservation-blocked";
  warnings: string[];
  changes: PdfFeatureChange[];
  criticalFailures: string[];
}

function statusValue(value: PdfSignalStatus | number | null): string {
  return value === null ? "unknown" : String(value);
}

function compareSignal(changes: PdfFeatureChange[], feature: string, before: PdfSignalStatus, after: PdfSignalStatus, critical: boolean, failures: string[]): void {
  if (before === "detected" && after !== "detected") {
    changes.push({ feature, before, after, status: critical ? "blocked" : "changed" });
    if (critical) failures.push(`${feature} was detected before processing but not detected after processing.`);
    return;
  }
  if (before === "unknown" || after === "unknown") changes.push({ feature, before, after, status: "unknown" });
  else changes.push({ feature, before, after, status: before === after ? "preserved" : "changed" });
}

function compareCount(changes: PdfFeatureChange[], feature: string, before: number | null, after: number | null, critical: boolean, failures: string[]): void {
  const beforeValue = statusValue(before);
  const afterValue = statusValue(after);
  if (before !== null && after !== null && after < before && critical) failures.push(`${feature} decreased from ${before} to ${after}.`);
  changes.push({ feature, before: beforeValue, after: afterValue, status: before === null || after === null ? "unknown" : before === after ? "preserved" : after < before && critical ? "blocked" : "changed" });
}

export function comparePdfDocumentFeatures(before: PdfDocumentAnalysis, after: PdfDocumentAnalysis): PdfPreservationValidation {
  const changes: PdfFeatureChange[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  changes.push({ feature: "page count", before: String(before.pageCount), after: String(after.pageCount), status: before.pageCount === after.pageCount ? "preserved" : "blocked" });
  if (before.pageCount !== after.pageCount) failures.push(`Page count changed from ${before.pageCount} to ${after.pageCount}.`);
  compareSignal(changes, "searchable text", before.features.text, after.features.text, true, failures);
  compareCount(changes, "annotations", before.features.annotationCount, after.features.annotationCount, true, failures);
  compareCount(changes, "links", before.features.linkCount, after.features.linkCount, true, failures);
  compareCount(changes, "form fields", before.features.formFieldCount, after.features.formFieldCount, true, failures);
  compareSignal(changes, "forms", before.features.forms, after.features.forms, true, failures);
  compareSignal(changes, "bookmarks", before.features.bookmarks, after.features.bookmarks, true, failures);
  compareSignal(changes, "embedded files", before.features.embeddedFiles, after.features.embeddedFiles, true, failures);
  compareSignal(changes, "JavaScript signals", before.features.javascript, after.features.javascript, false, failures);
  compareSignal(changes, "metadata", before.features.metadata, after.features.metadata, false, failures);
  compareSignal(changes, "page labels", before.features.pageLabels, after.features.pageLabels, false, failures);
  const beforeGeometry = before.pages.map((page) => `${page.pageNumber}:${page.widthPoints}x${page.heightPoints}:${page.rotation}`).join("|");
  const afterGeometry = after.pages.map((page) => `${page.pageNumber}:${page.widthPoints}x${page.heightPoints}:${page.rotation}`).join("|");
  changes.push({ feature: "sampled page geometry", before: beforeGeometry || "unknown", after: afterGeometry || "unknown", status: beforeGeometry && afterGeometry ? beforeGeometry === afterGeometry ? "preserved" : "changed" : "unknown" });
  if (before.features.javascript === "detected") warnings.push("JavaScript/action signals were detected. SmartDocs did not execute them and does not remove them.");
  if (before.features.embeddedFiles === "detected") warnings.push("Embedded files were detected; they were not modified by this browser-local path.");
  if (before.features.bookmarks === "detected") warnings.push("Bookmarks/outlines require preservation review after structural rewrites.");
  const valid = failures.length === 0;
  const status = valid ? warnings.length > 0 ? "preservation-warning" : "preservation-safe" : "preservation-blocked";
  return { valid, status, warnings, changes, criticalFailures: failures };
}
