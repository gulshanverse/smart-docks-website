import type { PdfDocumentAnalysis, PdfPageAnalysis } from "../pdfs/document-analysis";
import {
  MAX_OCR_PAGES_PER_RUN,
  type OcrLanguage,
  type OcrPagePlan,
  type OcrPlan,
} from "./types";

const SUPPORTED_LANGUAGES = new Set<OcrLanguage>(["eng"]);

function pageSignal(page: PdfPageAnalysis | undefined, analysis: PdfDocumentAnalysis): OcrPagePlan["status"] {
  if (page?.role === "blank") return "skipped";
  if (page && page.characterCount > 0) return "not-needed";
  if (page && (page.rasterSignals > 0 || page.imageHeavy || page.role === "scan" || page.role === "image-heavy" || page.role === "mixed" || page.role === "form")) return "recommended";
  if (analysis.classification === "scanned") return "recommended";
  if (analysis.classification === "mixed" && analysis.ocrReadiness === "ocr-likely-useful") return "recommended";
  if (analysis.textPresence === "detected") return "not-needed";
  return "unknown";
}

function reasonFor(status: OcrPagePlan["status"], page: PdfPageAnalysis | undefined, bounded: boolean): string {
  if (bounded) return "Skipped from this bounded OCR run because the document exceeds the local page limit.";
  if (status === "not-needed") return "Searchable text was detected on this page.";
  if (status === "skipped") return "Blank page or no useful visual content was detected.";
  if (status === "recommended") return page?.role === "form" ? "A scanned or form-like page may benefit from OCR while preserving interactive forms." : "Image-only or image-heavy content is likely to benefit from OCR.";
  return "The bounded analysis could not classify this page authoritatively.";
}

export function createOcrPlan(analysis: PdfDocumentAnalysis, language: OcrLanguage = "eng"): OcrPlan {
  const supported = SUPPORTED_LANGUAGES.has(language);
  const pagePlans: OcrPagePlan[] = [];
  const plannedPages: number[] = [];
  const skippedPages: number[] = [];
  const blockedPages: number[] = [];
  const warnings: string[] = [];
  const sampledPages = new Set(analysis.pages.map((page) => page.pageNumber));

  if (!supported) warnings.push(`The selected OCR language (${language}) is not bundled in this browser build.`);
  for (let pageNumber = 1; pageNumber <= analysis.pageCount; pageNumber += 1) {
    const page = analysis.pages.find((candidate) => candidate.pageNumber === pageNumber);
    const initialStatus = pageSignal(page, analysis);
    const overLimit = initialStatus === "recommended" && plannedPages.length >= MAX_OCR_PAGES_PER_RUN;
    const status = overLimit || !supported && initialStatus === "recommended" ? "skipped" : initialStatus;
    pagePlans.push({ pageNumber, status, reason: reasonFor(status, page, overLimit), sourceRole: page?.role ?? null });
    if (status === "recommended") plannedPages.push(pageNumber);
    if (status === "skipped") skippedPages.push(pageNumber);
    if (!supported && initialStatus === "recommended") blockedPages.push(pageNumber);
  }

  if (analysis.pageCount > MAX_OCR_PAGES_PER_RUN && plannedPages.length >= MAX_OCR_PAGES_PER_RUN) warnings.push(`OCR is bounded to ${MAX_OCR_PAGES_PER_RUN} pages per run; the complete document is not eligible for searchable-PDF authoring until every page is recognized.`);
  if (analysis.pageCount > sampledPages.size) warnings.push(`Page-level OCR planning uses bounded signals; ${analysis.pageCount - sampledPages.size} page${analysis.pageCount - sampledPages.size === 1 ? "" : "s"} were not represented in the Phase 4 sample.`);
  const hasRecommended = plannedPages.length > 0;
  const hasUnknown = pagePlans.some((page) => page.status === "unknown");
  const recommendation = !supported ? "unsupported" : !hasRecommended ? "not-needed" : analysis.pageCount > MAX_OCR_PAGES_PER_RUN ? "review-limit" : analysis.ocrReadiness === "ocr-likely-useful" ? "ocr-first" : hasUnknown ? "review-limit" : "ocr-then-optimize";

  return {
    documentId: analysis.fileName,
    pageCount: analysis.pageCount,
    language,
    supported,
    pages: pagePlans,
    plannedPages,
    skippedPages,
    blockedPages,
    maxPagesPerRun: MAX_OCR_PAGES_PER_RUN,
    recommendation,
    warnings,
    processingBoundary: "browser-local",
  };
}

export function isOcrSearchablePdfEligible(plan: OcrPlan, result: { failedPages: number[]; processedPages: number[]; skippedPages: number[]; pageCount: number; textPresence: string }): boolean {
  return plan.supported
    && plan.recommendation !== "unsupported"
    && plan.recommendation !== "review-limit"
    && result.failedPages.length === 0
    && result.processedPages.length + result.skippedPages.length === result.pageCount
    && result.textPresence !== "unknown";
}
