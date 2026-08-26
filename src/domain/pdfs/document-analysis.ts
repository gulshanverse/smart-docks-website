import type { ProcessingBoundary, PdfClassification } from "../files/types";
import type { PdfOptimizationIntent, PdfOptimizationPlan, PdfQualityMode } from "./optimization";

export const MAX_ANALYSIS_TEXT_BLOCKS = 24;
export const MAX_ANALYSIS_TEXT_SAMPLE_CHARS = 800;
export const MAX_ANALYSIS_PAGE_RECORDS = 50;
export const MAX_ANALYSIS_IMAGE_SIGNALS = 24;

export type PdfSignalStatus = "detected" | "likely-detected" | "not-detected" | "unknown";
export type PdfRiskLevel = "safe" | "low" | "medium" | "high" | "unknown";
export type PdfOcrReadiness = "ocr-likely-useful" | "ocr-probably-unnecessary" | "ocr-uncertain" | "unknown";
export type PdfPageRole = "cover" | "text-heavy" | "image-heavy" | "scan" | "mixed" | "form" | "table-like" | "diagram-like" | "blank" | "unknown";
export type PdfOptimizationOpportunity = "image-recompression" | "image-resolution" | "metadata-cleanup" | "safe-structural-preservation" | "none";

export interface PdfFieldSignal {
  status: PdfSignalStatus;
  value: string | null;
}

export interface PdfMetadataAnalysis {
  status: PdfSignalStatus;
  title: PdfFieldSignal;
  author: PdfFieldSignal;
  subject: PdfFieldSignal;
  keywords: PdfFieldSignal;
  creator: PdfFieldSignal;
  producer: PdfFieldSignal;
  creationDate: PdfFieldSignal;
  modificationDate: PdfFieldSignal;
  presentFieldCount: number;
}

export interface PdfFeatureSignals {
  text: PdfSignalStatus;
  rasterImages: PdfSignalStatus;
  vectorDrawing: PdfSignalStatus;
  annotations: PdfSignalStatus;
  links: PdfSignalStatus;
  forms: PdfSignalStatus;
  bookmarks: PdfSignalStatus;
  embeddedFiles: PdfSignalStatus;
  javascript: PdfSignalStatus;
  encryption: PdfSignalStatus;
  pageLabels: PdfSignalStatus;
  rotation: PdfSignalStatus;
  metadata: PdfSignalStatus;
  annotationCount: number | null;
  linkCount: number | null;
  formFieldCount: number | null;
  bookmarkCount: number | null;
  embeddedFileCount: number | null;
  pageLabelCount: number | null;
}

export interface PdfEmbeddedImageSignal {
  pageNumber: number;
  rasterOperatorCount: number;
  width: number | null;
  height: number | null;
  bitsPerComponent: number | null;
  colorSpace: string | null;
  compression: "unknown" | "pdf-image-operator";
  estimatedBytes: number | null;
}

export interface PdfImageAnalysis {
  status: PdfSignalStatus;
  sampledPages: number[];
  rasterPageCount: number;
  highResolutionPageCount: number;
  imageSignals: PdfEmbeddedImageSignal[];
  estimatedImageBytes: number | null;
  note: string;
}

export interface PdfFontAnalysis {
  status: PdfSignalStatus;
  count: number | null;
  embedded: PdfSignalStatus;
  subset: PdfSignalStatus;
  categories: string[];
  note: string;
}

export interface PdfTextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface PdfTextPageAnalysis {
  pageNumber: number;
  status: PdfSignalStatus;
  characterCount: number;
  itemCount: number;
  sample: string;
  blocks: PdfTextBlock[];
}

export interface PdfTextAnalysis {
  status: PdfSignalStatus;
  sampledPages: number[];
  pagesWithText: number;
  boundedCharacterCount: number;
  textPages: PdfTextPageAnalysis[];
  note: string;
}

export interface PdfLayoutSignals {
  textDensity: number | null;
  lineDensity: number | null;
  blockDensity: number | null;
  imageDensity: number | null;
  whitespace: "low" | "medium" | "high" | "unknown";
  repeatedHeaderFooter: PdfSignalStatus;
  note: string;
}

export interface PdfPageAnalysis {
  pageNumber: number;
  widthPoints: number;
  heightPoints: number;
  rotation: number;
  orientation: "portrait" | "landscape" | "square" | "unknown";
  textPresence: PdfSignalStatus;
  characterCount: number;
  rasterSignals: number;
  vectorSignals: number;
  annotationCount: number | null;
  linkCount: number | null;
  formFieldCount: number | null;
  imageHeavy: boolean;
  role: PdfPageRole;
  roleConfidence: "likely" | "uncertain";
  ocrReadiness: PdfOcrReadiness;
}

export interface PdfStructureGroup {
  startPage: number;
  endPage: number;
  role: PdfPageRole;
  confidence: "likely" | "uncertain";
}

export interface PdfStructureSignals {
  pageGroups: PdfStructureGroup[];
  sampledPageCount: number;
  exactPageCount: number;
  note: string;
}

export interface PdfPreservationRisk {
  level: PdfRiskLevel;
  status: "preservation-safe" | "preservation-warning" | "preservation-blocked";
  reasons: string[];
  blockedOperations: string[];
}

export interface PdfDocumentAnalysis {
  fileName: string;
  fileSizeBytes: number;
  pdfVersion: string | null;
  pageCount: number;
  classification: PdfClassification;
  textPresence: PdfSignalStatus;
  textPageCount: number;
  rasterPageCount: number;
  vectorSignals: PdfSignalStatus;
  pageDimensions: Array<{ pageNumber: number; widthPoints: number; heightPoints: number; rotation: number }>;
  pages: PdfPageAnalysis[];
  features: PdfFeatureSignals;
  metadata: PdfMetadataAnalysis;
  images: PdfImageAnalysis;
  fonts: PdfFontAnalysis;
  text: PdfTextAnalysis;
  layout: PdfLayoutSignals;
  structure: PdfStructureSignals;
  ocrReadiness: PdfOcrReadiness;
  preservationRisk: PdfPreservationRisk;
  optimizationOpportunities: PdfOptimizationOpportunity[];
  recommendation: string;
  insights: string[];
  warnings: string[];
  sampledPages: number[];
  pagesAnalyzed: number;
  processingBoundary: "browser-local";
}

export interface DocumentIntelligenceSnapshot {
  identity: { fileName: string; fileSizeBytes: number; pdfVersion: string | null; processingBoundary: "browser-local" };
  classification: { value: PdfClassification; confidence: "heuristic" | "unknown" };
  pages: { exactPageCount: number; sampledPageCount: number; roles: Array<{ pageNumber: number; role: string; confidence: string }> };
  textSignals: { status: string; sampledPages: number; boundedCharacterCount: number };
  layoutSignals: { textDensity: number | null; lineDensity: number | null; blockDensity: number | null; imageDensity: number | null };
  mediaSignals: { rasterPageCount: number; highResolutionPageCount: number; imageSignalCount: number };
  featureSignals: { text: string; links: string; forms: string; annotations: string; bookmarks: string; embeddedFiles: string; javascript: string; metadata: string };
  ocrReadiness: string;
  structureSignals: { groups: Array<{ startPage: number; endPage: number; role: string }> };
  optimizationSignals: { opportunities: string[]; riskLevel: string; recommendation: string };
}

export interface PdfOptimizationFeatureRequirement {
  feature: "text" | "fonts" | "links" | "annotations" | "forms" | "bookmarks" | "embedded-files" | "javascript" | "metadata" | "page-geometry";
  policy: "preserve" | "validate" | "block-destructive-path" | "unknown";
}

export interface PdfAdvancedOptimizationPlan {
  basePlan: PdfOptimizationPlan;
  strategy: "preserve-structure" | "optimize-eligible-raster" | "optimize-images-with-hybrid-preservation" | "blocked-preservation-risk";
  eligibleOperations: PdfOptimizationOpportunity[];
  blockedOperations: string[];
  preservationRequirements: PdfOptimizationFeatureRequirement[];
  expectedRisks: PdfPreservationRisk;
  validationRequirements: string[];
  recommendation: string;
  mode: PdfQualityMode;
  processingBoundary: ProcessingBoundary;
}

function signal(status: PdfSignalStatus, value: string | null = null): PdfFieldSignal {
  return { status, value };
}

export function emptyMetadataAnalysis(): PdfMetadataAnalysis {
  return { status: "unknown", title: signal("unknown"), author: signal("unknown"), subject: signal("unknown"), keywords: signal("unknown"), creator: signal("unknown"), producer: signal("unknown"), creationDate: signal("unknown"), modificationDate: signal("unknown"), presentFieldCount: 0 };
}

export function derivePreservationRisk(args: { classification: PdfClassification; features: Pick<PdfFeatureSignals, "forms" | "links" | "annotations" | "bookmarks" | "embeddedFiles" | "javascript" | "encryption">; vectorSignals: PdfSignalStatus; }): PdfPreservationRisk {
  const reasons: string[] = [];
  const blockedOperations: string[] = [];
  const block = (operation: string) => { if (!blockedOperations.includes(operation)) blockedOperations.push(operation); };
  if (args.features.encryption === "detected") {
    reasons.push("Password protection prevents safe inspection or optimization.");
    block("all-optimization");
    return { level: "high", status: "preservation-blocked", reasons, blockedOperations };
  }
  if (args.features.forms === "detected") {
    reasons.push("Interactive form fields require preservation and are not rasterized by default.");
    block("full-page-rasterization");
  }
  if (args.features.javascript === "detected") reasons.push("Document JavaScript/actions were detected; SmartDocs never executes them.");
  if (args.features.embeddedFiles === "detected") reasons.push("Embedded files are not modified by the browser-local optimizer.");
  if (args.features.links === "detected" || args.features.annotations === "detected") reasons.push("Annotations and links require feature-preservation validation.");
  if (args.features.bookmarks === "detected") reasons.push("Bookmarks/outlines require preservation validation after structural rewrites.");
  if (args.classification === "scanned" && reasons.length === 0) return { level: "low", status: "preservation-safe", reasons: ["Image-only pages are eligible for bounded raster optimization."], blockedOperations };
  if (args.classification === "mixed") return { level: reasons.length > 0 ? "medium" : "low", status: reasons.length > 0 ? "preservation-warning" : "preservation-safe", reasons: reasons.length ? reasons : ["Mixed pages use a hybrid preservation-first path."], blockedOperations };
  if (args.classification === "text" || args.vectorSignals === "detected") {
    reasons.push("Text/vector content must remain searchable and is preserved by default.");
    block("full-page-rasterization");
    return { level: reasons.length > 1 ? "high" : "medium", status: "preservation-warning", reasons, blockedOperations };
  }
  return { level: "unknown", status: "preservation-warning", reasons: ["Some document features could not be inspected authoritatively."], blockedOperations };
}

export function derivePageRole(page: Pick<PdfPageAnalysis, "pageNumber" | "characterCount" | "rasterSignals" | "annotationCount" | "formFieldCount" | "imageHeavy">, pageCount: number): { role: PdfPageRole; confidence: "likely" | "uncertain" } {
  if (page.formFieldCount && page.formFieldCount > 0) return { role: "form", confidence: "likely" };
  if (page.characterCount === 0 && page.rasterSignals === 0) return { role: "blank", confidence: "likely" };
  if (page.pageNumber === 1 && page.characterCount < 160 && page.rasterSignals > 0) return { role: "cover", confidence: "uncertain" };
  if (page.imageHeavy && page.characterCount === 0) return { role: "scan", confidence: "likely" };
  if (page.imageHeavy && page.characterCount > 0) return { role: "mixed", confidence: "likely" };
  if (page.characterCount > 900) return { role: "text-heavy", confidence: "likely" };
  if (page.characterCount > 300 && page.rasterSignals === 0) return { role: "text-heavy", confidence: "uncertain" };
  if (page.rasterSignals > 0) return { role: "image-heavy", confidence: "uncertain" };
  if (pageCount > 1 && page.characterCount > 0) return { role: "text-heavy", confidence: "uncertain" };
  return { role: "unknown", confidence: "uncertain" };
}

export function deriveOcrReadiness(textPresence: PdfSignalStatus, rasterSignals: number, characterCount: number): PdfOcrReadiness {
  if (rasterSignals > 0 && characterCount === 0) return "ocr-likely-useful";
  if (textPresence === "detected" && characterCount > 0) return "ocr-probably-unnecessary";
  if (rasterSignals > 0) return "ocr-uncertain";
  return "unknown";
}

export function buildAdvancedOptimizationPlan(analysis: PdfDocumentAnalysis, intent: PdfOptimizationIntent, basePlan: PdfOptimizationPlan): PdfAdvancedOptimizationPlan {
  const risk = analysis.preservationRisk;
  const requirements: PdfOptimizationFeatureRequirement[] = [
    { feature: "page-geometry", policy: "preserve" },
    { feature: "text", policy: analysis.textPresence === "detected" ? "validate" : "preserve" },
    { feature: "fonts", policy: "validate" },
    { feature: "links", policy: analysis.features.links === "detected" ? "validate" : "unknown" },
    { feature: "annotations", policy: analysis.features.annotations === "detected" ? "validate" : "unknown" },
    { feature: "forms", policy: analysis.features.forms === "detected" ? "block-destructive-path" : "unknown" },
    { feature: "bookmarks", policy: analysis.features.bookmarks === "detected" ? "validate" : "unknown" },
    { feature: "embedded-files", policy: analysis.features.embeddedFiles === "detected" ? "block-destructive-path" : "unknown" },
    { feature: "javascript", policy: analysis.features.javascript === "detected" ? "block-destructive-path" : "unknown" },
    { feature: "metadata", policy: "validate" },
  ];
  const blocked = [...risk.blockedOperations];
  const eligible = analysis.optimizationOpportunities.filter((value): value is PdfOptimizationOpportunity => value !== "none");
  const strategy = blocked.includes("full-page-rasterization") && analysis.classification !== "mixed" ? "preserve-structure" : analysis.classification === "mixed" ? "optimize-images-with-hybrid-preservation" : analysis.classification === "scanned" ? "optimize-eligible-raster" : "preserve-structure";
  return {
    basePlan,
    strategy: risk.status === "preservation-blocked" ? "blocked-preservation-risk" : strategy,
    eligibleOperations: eligible,
    blockedOperations: blocked,
    preservationRequirements: requirements,
    expectedRisks: risk,
    validationRequirements: ["page-count", "page-geometry", "text-extractability", "representative-render", "feature-preservation", "metadata-policy"],
    recommendation: analysis.recommendation,
    mode: intent.mode,
    processingBoundary: "browser-local",
  };
}

export function buildDocumentInsights(analysis: Pick<PdfDocumentAnalysis, "classification" | "textPageCount" | "rasterPageCount" | "pageCount" | "features" | "images" | "ocrReadiness" | "preservationRisk">): string[] {
  const insights: string[] = [];
  if (analysis.textPageCount > 0) insights.push("Searchable text was detected.");
  if (analysis.rasterPageCount > 0) insights.push(`${analysis.rasterPageCount} sampled page${analysis.rasterPageCount === 1 ? "" : "s"} contain raster image signals.`);
  if (analysis.images.highResolutionPageCount > 0) insights.push("Several sampled pages contain high-resolution raster content.");
  if (analysis.features.forms === "detected") insights.push("This document contains interactive form fields.");
  if (analysis.features.links === "detected") insights.push("Link annotations were detected and must be preserved or the candidate rejected.");
  if (analysis.classification === "text") insights.push("Optimization may have limited impact because this PDF is primarily text/vector content.");
  if (analysis.ocrReadiness === "ocr-likely-useful") insights.push("OCR would likely improve searchability on scanned pages; no OCR is run in Phase 4.");
  if (analysis.preservationRisk.status !== "preservation-safe") insights.push("The recommended path is conservative because preservation risk was detected.");
  if (insights.length === 0) insights.push(`The document contains ${analysis.pageCount} page${analysis.pageCount === 1 ? "" : "s"} with no high-confidence optimization opportunity in the bounded sample.`);
  return insights;
}
