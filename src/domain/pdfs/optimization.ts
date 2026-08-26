import type { PdfAsset, PdfClassification, ProcessingBoundary } from "../files/types";
import type { DocumentIntelligenceSnapshot, PdfAdvancedOptimizationPlan, PdfDocumentAnalysis } from "./document-analysis";

export const PDF_OPTIMIZATION_BOUNDARY: ProcessingBoundary = "browser-local";
export const MAX_OPTIMIZATION_CANDIDATES = 5;
export const MAX_OPTIMIZATION_PAGES = 120;
export const MAX_OPTIMIZATION_SAMPLE_PAGES = 8;

export type PdfQualityMode = "maximum" | "balanced" | "smaller" | "smallest";
export type PdfOptimizationStrategy = "original-preserved" | "image-quality" | "image-resolution" | "image-quality-and-resolution" | "conservative-preservation";
export type PdfOptimizationQualityDecision = "preserved" | "excellent" | "good" | "acceptable" | "best-effort";
export type PdfOptimizationOperation = "pdf.optimize.target_size";
export type PdfOptimizationMetadataPolicy = "preserve" | "remove-non-essential";

export interface PdfOptimizationIntent {
  operation: PdfOptimizationOperation;
  targetBytes: number | null;
  targetLabel: string | null;
  mode: PdfQualityMode;
  sourceType: "pdf";
}

export interface PdfOptimizationAnalysis {
  inputBytes: number;
  pageCount: number;
  pdfVersion: string | null;
  classification: PdfClassification;
  textPresent: boolean;
  rasterPresent: boolean;
  imageHeavy: boolean;
  sampledPages: number[];
  pagesAnalyzed: number;
  textPages: number;
  rasterPages: number;
  imageHeavyPages: number;
  sampledPagePixels: Array<{ pageNumber: number; width: number; height: number }>;
  optimizationOpportunities: Array<"image-quality" | "image-resolution" | "structural-preservation" | "metadata-cleanup" | "none">;
  warnings: string[];
  processingBoundary: ProcessingBoundary;
  documentAnalysis?: PdfDocumentAnalysis;
  advancedPlan?: PdfAdvancedOptimizationPlan;
}

export interface PdfOptimizationCandidateSpec {
  id: string;
  mode: PdfQualityMode;
  strategy: PdfOptimizationStrategy;
  quality: number | null;
  resolutionScale: number | null;
  format: "jpeg" | "preserve";
  description: string;
  qualityDecision: PdfOptimizationQualityDecision;
  destructive: boolean;
  scope: "all-pages" | "raster-only-pages";
}

export interface PdfOptimizationPlan {
  operation: PdfOptimizationOperation;
  inputBytes: number;
  pageCount: number;
  classification: PdfClassification;
  targetBytes: number | null;
  targetLabel: string | null;
  mode: PdfQualityMode;
  metadataPolicy: PdfOptimizationMetadataPolicy;
  preserveTextAndVector: boolean;
  candidates: PdfOptimizationCandidateSpec[];
  processingBoundary: ProcessingBoundary;
  documentAnalysis?: PdfDocumentAnalysis;
  advancedPlan?: PdfAdvancedOptimizationPlan;
}

export interface PdfOptimizationCandidateResult {
  candidate: PdfOptimizationCandidateSpec;
  valid: boolean;
  outputBytes: number;
  pageCount: number;
  textPagesPreserved: boolean;
  previewAvailable: boolean;
  targetAchieved: boolean;
  warnings: string[];
  preservationStatus?: "preservation-safe" | "preservation-warning" | "preservation-blocked";
  featureChanges?: Array<{ feature: string; before: string; after: string; status: "preserved" | "changed" | "unknown" | "blocked" }>;
  preservationWarnings?: string[];
}

export interface PdfOptimizationResult {
  inputBytes: number;
  outputBytes: number;
  targetBytes: number | null;
  reductionBytes: number;
  reductionPercentage: number;
  pageCount: number;
  strategy: PdfOptimizationStrategy;
  qualityDecision: PdfOptimizationQualityDecision;
  targetAchieved: boolean | null;
  bestEffort: boolean;
  warnings: string[];
  processingBoundary: ProcessingBoundary;
  validationStatus: "validated" | "failed" | "cancelled";
  filename: string;
  analysis: PdfOptimizationAnalysis;
  candidateCount: number;
  message: string;
  preservationStatus?: "preservation-safe" | "preservation-warning" | "preservation-blocked";
  preservationWarnings?: string[];
  featureChanges?: Array<{ feature: string; before: string; after: string; status: "preserved" | "changed" | "unknown" | "blocked" }>;
  pageCountBefore?: number;
  pageCountAfter?: number;
  textStatus?: "preserved" | "changed" | "unknown";
  linkStatus?: "preserved" | "changed" | "unknown";
  formStatus?: "preserved" | "changed" | "unknown";
  bookmarkStatus?: "preserved" | "changed" | "unknown";
  metadataStatus?: "preserved" | "removed" | "changed" | "unknown";
}

export interface PdfOptimizationProgress {
  stage: "analyzing" | "planning" | "optimizing" | "validating" | "complete" | "cancelled";
  completed: number;
  total: number;
  detail: string;
}

export function qualityPolicy(mode: PdfQualityMode): { quality: number; resolutionScale: number; qualityDecision: PdfOptimizationQualityDecision } {
  switch (mode) {
    case "maximum": return { quality: 0.9, resolutionScale: 1, qualityDecision: "excellent" };
    case "balanced": return { quality: 0.78, resolutionScale: 0.78, qualityDecision: "good" };
    case "smaller": return { quality: 0.68, resolutionScale: 0.62, qualityDecision: "acceptable" };
    case "smallest": return { quality: 0.56, resolutionScale: 0.48, qualityDecision: "best-effort" };
  }
}

export function createPdfOptimizationPlan(analysis: Pick<PdfOptimizationAnalysis, "inputBytes" | "pageCount" | "classification">, intent: PdfOptimizationIntent, metadataPolicy: PdfOptimizationMetadataPolicy = "preserve"): { plan: PdfOptimizationPlan } | { error: string } {
  if (analysis.pageCount < 1) return { error: "The PDF has no usable pages to optimize." };
  if (analysis.pageCount > MAX_OPTIMIZATION_PAGES) return { error: `Browser-local PDF optimization is limited to ${MAX_OPTIMIZATION_PAGES} pages at a time.` };
  const preserveTextAndVector = analysis.classification === "text" || analysis.classification === "mixed" || analysis.classification === "unknown";
  const candidates = generateCandidateSpecs(analysis.classification, intent.mode, preserveTextAndVector);
  return { plan: { operation: "pdf.optimize.target_size", inputBytes: analysis.inputBytes, pageCount: analysis.pageCount, classification: analysis.classification, targetBytes: intent.targetBytes, targetLabel: intent.targetLabel, mode: intent.mode, metadataPolicy, preserveTextAndVector, candidates, processingBoundary: PDF_OPTIMIZATION_BOUNDARY } };
}

export function generateCandidateSpecs(classification: PdfClassification, mode: PdfQualityMode, preserveTextAndVector: boolean): PdfOptimizationCandidateSpec[] {
  if (classification === "text" || classification === "unknown" || (preserveTextAndVector && classification !== "mixed")) {
    return [{ id: "preserve-original", mode, strategy: "original-preserved", quality: null, resolutionScale: null, format: "preserve", description: "Preserve text and vector content; no default page rasterization.", qualityDecision: "preserved", destructive: false, scope: "all-pages" }];
  }
  const order: PdfQualityMode[] = mode === "maximum" ? ["maximum", "balanced", "smaller", "smallest"] : mode === "balanced" ? ["balanced", "smaller", "smallest"] : mode === "smaller" ? ["smaller", "smallest"] : ["smallest"];
  return order.slice(0, MAX_OPTIMIZATION_CANDIDATES).map((candidateMode) => {
    const policy = qualityPolicy(candidateMode);
    const strategy: PdfOptimizationStrategy = policy.resolutionScale < 0.9 && policy.quality < 0.8 ? "image-quality-and-resolution" : policy.resolutionScale < 0.9 ? "image-resolution" : "image-quality";
    return { id: `raster-${candidateMode}`, mode: candidateMode, strategy, quality: policy.quality, resolutionScale: policy.resolutionScale, format: "jpeg", description: `${candidateMode[0].toUpperCase()}${candidateMode.slice(1)} image optimization for raster pages.`, qualityDecision: policy.qualityDecision, destructive: true, scope: classification === "mixed" ? "raster-only-pages" : "all-pages" };
  });
}

export function reductionPercentage(inputBytes: number, outputBytes: number): number {
  if (inputBytes <= 0) return 0;
  return Math.max(0, ((inputBytes - outputBytes) / inputBytes) * 100);
}

export function selectBestPdfCandidate(candidates: readonly PdfOptimizationCandidateResult[], targetBytes: number | null, inputBytes: number): PdfOptimizationCandidateResult | null {
  const valid = candidates.filter((candidate) => candidate.valid);
  if (valid.length === 0) return null;
  const accepted = targetBytes === null ? valid.filter((candidate) => candidate.outputBytes < inputBytes) : valid.filter((candidate) => candidate.outputBytes <= targetBytes);
  const pool = accepted.length > 0 ? accepted : valid;
  return [...pool].sort((a, b) => {
    const qualityRank = (value: PdfOptimizationQualityDecision) => ({ preserved: 5, excellent: 4, good: 3, acceptable: 2, "best-effort": 1 }[value]);
    const qualityDifference = qualityRank(b.candidate.qualityDecision) - qualityRank(a.candidate.qualityDecision);
    if (qualityDifference !== 0) return qualityDifference;
    return a.outputBytes - b.outputBytes;
  })[0] ?? null;
}

export function buildPdfOptimizationResult(args: { inputBytes: number; targetBytes: number | null; pageCount: number; candidate: PdfOptimizationCandidateResult; analysis: PdfOptimizationAnalysis; filename: string; candidateCount: number; additionalWarnings?: string[] }): PdfOptimizationResult {
  const { inputBytes, targetBytes, pageCount, candidate, analysis, filename, candidateCount, additionalWarnings = [] } = args;
  const targetAchieved = targetBytes === null ? null : candidate.outputBytes <= targetBytes;
  const bestEffort = targetBytes !== null && !targetAchieved;
  const warnings = [...candidate.warnings, ...additionalWarnings, ...analysis.warnings];
  if (analysis.advancedPlan?.expectedRisks.status !== "preservation-safe") warnings.push(...(analysis.advancedPlan?.expectedRisks.reasons ?? []));
  if (bestEffort) warnings.push("The target could not be reached within the deterministic quality floor; the best available validated result is shown.");
  if (candidate.outputBytes >= inputBytes && candidate.candidate.strategy !== "original-preserved") warnings.push("The attempted optimization did not reduce the measured byte size; consider preserving the original.");
  const strategy = candidate.candidate.strategy;
  const qualityDecision = targetBytes !== null && !targetAchieved ? "best-effort" : candidate.candidate.qualityDecision;
  const message = targetBytes === null ? (strategy === "original-preserved" || strategy === "conservative-preservation" ? "No safe destructive PDF optimization was applied; text and vector content remain preserved." : "PDF optimization completed and was independently validated.") : targetAchieved ? `Target achieved: ${inputBytes.toLocaleString()} bytes → ${candidate.outputBytes.toLocaleString()} bytes.` : `Target could not be reached without severe quality loss. Best available: ${candidate.outputBytes.toLocaleString()} bytes.`;
  const featureChanges = candidate.featureChanges ?? [];
  const findFeature = (...names: string[]) => featureChanges.find((change) => names.includes(change.feature));
  const statusFromChange = (change: typeof featureChanges[number] | undefined): "preserved" | "changed" | "unknown" => change?.status === "preserved" ? "preserved" : change?.status === "unknown" ? "unknown" : change ? "changed" : "unknown";
  const textChange = findFeature("searchable text");
  const linkChange = findFeature("links");
  const formChange = findFeature("form fields", "forms");
  const bookmarkChange = findFeature("bookmarks");
  const metadataChange = findFeature("metadata");
  const metadataStatus = metadataChange?.before === "detected" && metadataChange.after !== "detected" ? "removed" : statusFromChange(metadataChange);
  return { inputBytes, outputBytes: candidate.outputBytes, targetBytes, reductionBytes: Math.max(0, inputBytes - candidate.outputBytes), reductionPercentage: reductionPercentage(inputBytes, candidate.outputBytes), pageCount, strategy, qualityDecision, targetAchieved, bestEffort, warnings, processingBoundary: PDF_OPTIMIZATION_BOUNDARY, validationStatus: "validated", filename, analysis, candidateCount, message, preservationStatus: candidate.preservationStatus ?? analysis.advancedPlan?.expectedRisks.status, preservationWarnings: candidate.preservationWarnings ?? [], featureChanges, pageCountBefore: pageCount, pageCountAfter: candidate.pageCount, textStatus: statusFromChange(textChange) === "unknown" ? (candidate.textPagesPreserved ? "preserved" : "unknown") : statusFromChange(textChange), linkStatus: statusFromChange(linkChange), formStatus: statusFromChange(formChange), bookmarkStatus: statusFromChange(bookmarkChange), metadataStatus };
}

export function createDocumentIntelligenceSnapshot(analysis: PdfDocumentAnalysis): DocumentIntelligenceSnapshot {
  return {
    identity: { fileName: analysis.fileName, fileSizeBytes: analysis.fileSizeBytes, pdfVersion: analysis.pdfVersion, processingBoundary: "browser-local" },
    classification: { value: analysis.classification, confidence: analysis.classification === "unknown" ? "unknown" : "heuristic" },
    pages: { exactPageCount: analysis.pageCount, sampledPageCount: analysis.pagesAnalyzed, roles: analysis.pages.map((page) => ({ pageNumber: page.pageNumber, role: page.role, confidence: page.roleConfidence })) },
    textSignals: { status: analysis.textPresence, sampledPages: analysis.text.sampledPages.length, boundedCharacterCount: analysis.text.boundedCharacterCount },
    layoutSignals: { textDensity: analysis.layout.textDensity, lineDensity: analysis.layout.lineDensity, blockDensity: analysis.layout.blockDensity, imageDensity: analysis.layout.imageDensity },
    mediaSignals: { rasterPageCount: analysis.images.rasterPageCount, highResolutionPageCount: analysis.images.highResolutionPageCount, imageSignalCount: analysis.images.imageSignals.length },
    featureSignals: { text: analysis.features.text, links: analysis.features.links, forms: analysis.features.forms, annotations: analysis.features.annotations, bookmarks: analysis.features.bookmarks, embeddedFiles: analysis.features.embeddedFiles, javascript: analysis.features.javascript, metadata: analysis.features.metadata },
    ocrReadiness: analysis.ocrReadiness,
    structureSignals: { groups: analysis.structure.pageGroups.map((group) => ({ startPage: group.startPage, endPage: group.endPage, role: group.role })) },
    optimizationSignals: { opportunities: analysis.optimizationOpportunities, riskLevel: analysis.preservationRisk.level, recommendation: analysis.recommendation },
  };
}

export function optimizationAnalysisFromAsset(asset: PdfAsset): PdfOptimizationAnalysis {
  const rasterPresent = asset.classification === "scanned" || asset.classification === "mixed";
  const textPresent = asset.textExtractable;
  const imageHeavy = asset.classification === "scanned";
  const opportunities: PdfOptimizationAnalysis["optimizationOpportunities"] = imageHeavy ? ["image-quality", "image-resolution"] : textPresent ? ["structural-preservation", "metadata-cleanup"] : rasterPresent ? ["image-quality"] : ["none"];
  return { inputBytes: asset.sizeBytes, pageCount: asset.pageCount, pdfVersion: asset.pdfVersion, classification: asset.classification, textPresent, rasterPresent, imageHeavy, sampledPages: [], pagesAnalyzed: 0, textPages: 0, rasterPages: 0, imageHeavyPages: 0, sampledPagePixels: [], optimizationOpportunities: opportunities, warnings: [...asset.warnings], processingBoundary: PDF_OPTIMIZATION_BOUNDARY };
}
