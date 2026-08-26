import { describe, expect, it } from "vitest";
import { formatBytes, reductionPercent } from "../lib/file-utils";
import { parseByteTarget, parseImageIntent, parsePdfIntent } from "../domain/intents/parse-intent";
import { selectCandidate } from "../features/compression/select-candidate";
import { qualityDecision, scaledDimensions } from "../features/compression/compress-image";
import { MAX_PDF_INPUT_BYTES } from "../domain/files/types";
import { classifyPdf } from "../domain/pdfs/types";
import { validatePdfInspection } from "../domain/pdfs/validation";
import { createPdfInspectionWorkflow } from "../domain/workflows/types";
import { hasPdfSignature, isPdfWithinLocalInspectionLimit, normalizePageDimensions, readPdfVersion } from "../domain/pdfs/helpers";
import { createPdfPageAsset, inferPdfPageTypeHint, normalizePdfPageGeometry, normalizePdfPageText, samplePdfPageNumbers } from "../domain/pdfs/pages";
import { createPdfPageInspectionWorkflow } from "../domain/workflows/types";
import { createDeletePlan, createExtractPlan, createReorderPlan, createRotatePlan, normalizeDocumentOrder, normalizeRotation } from "../domain/pdfs/operations";
import { validatePdfMutationResult } from "../domain/pdfs/mutation-validation";
import { classifyBlankPage, createBlankDetectionPlan, createBlankRemovalPlan, createImageToPdfPlan, createMergePlan, createPdfImagePlan, createSplitPlan, safeCoreFilename } from "../domain/pdfs/core";
import { validateCorePdfOutput } from "../domain/pdfs/core-validation";
import { createPdfAdvancedAnalysisWorkflow, createPdfCoreWorkflow, createPdfOptimizationWorkflow } from "../domain/workflows/types";
import { buildPdfOptimizationResult, createDocumentIntelligenceSnapshot, createPdfOptimizationPlan, generateCandidateSpecs, qualityPolicy, selectBestPdfCandidate, type PdfOptimizationAnalysis } from "../domain/pdfs/optimization";
import { buildAdvancedOptimizationPlan, deriveOcrReadiness, derivePageRole, derivePreservationRisk, type PdfDocumentAnalysis, type PdfFeatureSignals } from "../domain/pdfs/document-analysis";
import { comparePdfDocumentFeatures } from "../domain/pdfs/preservation";

describe("byte units", () => {
  it("uses decimal KB and MB values", () => {
    expect(parseByteTarget("100", "KB")).toBe(100_000);
    expect(parseByteTarget("1", "mb")).toBe(1_000_000);
  });

  it("formats result sizes for people", () => {
    expect(formatBytes(100_000)).toBe("97.7 KB");
    expect(formatBytes(1_000_000)).toBe("976.6 KB");
  });

  it("calculates a non-negative reduction percentage", () => {
    expect(reductionPercent(1_000_000, 250_000)).toBe(75);
    expect(reductionPercent(100, 200)).toBe(0);
  });
});

describe("deterministic image intent", () => {
  it("parses common target-size phrases", () => {
    expect(parseImageIntent("make this image under 100kb").intent?.targetBytes).toBe(100_000);
    expect(parseImageIntent("Compress to 50 KB").intent?.targetBytes).toBe(50_000);
    expect(parseImageIntent("make it less than 1 MB").intent?.targetBytes).toBe(1_000_000);
  });

  it("returns an honest ambiguous state without a target", () => {
    const result = parseImageIntent("compress this image");
    expect(result.status).toBe("ambiguous");
    expect(result.message).toContain("target size");
  });

  it("does not invent requirements for unsupported goals", () => {
    const result = parseImageIntent("make this suitable for my exam");
    expect(result.status).toBe("unsupported");
    expect(result.intent).toBeUndefined();
  });
});

describe("smart resize policy", () => {
  it("finds smaller dimensions while preserving aspect ratio", () => {
    expect(scaledDimensions({ width: 1600, height: 1000 }, 0.56)).toEqual({ width: 896, height: 560 });
  });

  it("labels preserved, good, acceptable, and best-effort quality decisions", () => {
    expect(qualityDecision(1, "image/png", true, true)).toBe("preserved");
    expect(qualityDecision(0.82, "image/jpeg", false, true)).toBe("good");
    expect(qualityDecision(0.6, "image/jpeg", false, true)).toBe("acceptable");
    expect(qualityDecision(0.45, "image/jpeg", false, false)).toBe("best-effort");
  });
});

describe("PDF inspection foundation", () => {
  it("accepts a real PDF signature and reads its version", () => {
    const header = new TextEncoder().encode("%PDF-1.7\\n%âãÏÓ");
    expect(hasPdfSignature(header)).toBe(true);
    expect(readPdfVersion(header)).toBe("1.7");
    expect(hasPdfSignature(new TextEncoder().encode("not-a-pdf"))).toBe(false);
  });

  it("classifies text, scanned, mixed, and unknown PDFs from bounded signals", () => {
    expect(classifyPdf({ pageCount: 3, pagesSampled: 3, pagesWithText: 3, textItemCount: 10, boundedCharacterCount: 200, firstPageHasRasterImage: false, rasterPages: 0, protected: false })).toBe("text");
    expect(classifyPdf({ pageCount: 3, pagesSampled: 3, pagesWithText: 0, textItemCount: 0, boundedCharacterCount: 0, firstPageHasRasterImage: true, rasterPages: 3, protected: false })).toBe("scanned");
    expect(classifyPdf({ pageCount: 3, pagesSampled: 3, pagesWithText: 2, textItemCount: 10, boundedCharacterCount: 200, firstPageHasRasterImage: false, rasterPages: 1, protected: false })).toBe("mixed");
    expect(classifyPdf({ pageCount: 1, pagesSampled: 1, pagesWithText: 0, textItemCount: 0, boundedCharacterCount: 0, firstPageHasRasterImage: false, rasterPages: 0, protected: false })).toBe("unknown");
    expect(classifyPdf({ pageCount: 1, pagesSampled: 1, pagesWithText: 1, textItemCount: 3, boundedCharacterCount: 50, firstPageHasRasterImage: false, rasterPages: 0, protected: true })).toBe("protected");
  });

  it("normalizes page dimensions into a useful paper and orientation label", () => {
    expect(normalizePageDimensions([0, 0, 595.28, 841.89]).label).toContain("A4");
    expect(normalizePageDimensions([0, 0, 792, 612]).label).toContain("Landscape");
    expect(normalizePageDimensions([0, 0, 500, 500]).label).toContain("Portrait");
  });

  it("keeps the browser PDF input limit explicit and validates local results", () => {
    expect(MAX_PDF_INPUT_BYTES).toBe(50 * 1024 * 1024);
    expect(isPdfWithinLocalInspectionLimit(MAX_PDF_INPUT_BYTES)).toBe(true);
    expect(isPdfWithinLocalInspectionLimit(MAX_PDF_INPUT_BYTES + 1)).toBe(false);
    const asset = {
      id: "pdf-test",
      name: "fixture.pdf",
      sizeBytes: 10_000,
      extension: "pdf",
      processingBoundary: "browser-local" as const,
      category: "pdf" as const,
      mimeType: "application/pdf" as const,
      pdfVersion: "1.7",
      pageCount: 2,
      encrypted: false,
      passwordProtected: false,
      textPresence: "detected" as const,
      textExtractable: true,
      classification: "mixed" as const,
      pageDimensions: { widthPoints: 595, heightPoints: 842, label: "A4 · Portrait" },
      previewUrl: "blob:preview",
      capabilities: { inspect: true as const, renderPreview: true as const },
      warnings: [],
    };
    expect(validatePdfInspection(asset)).toMatchObject({ valid: true, type: "pdf", pageCount: 2, previewAvailable: true, classification: "mixed", protected: false, processingBoundary: "browser-local" });

    const workflow = createPdfInspectionWorkflow(asset);
    expect(workflow.processingBoundary).toBe("browser-local");
    expect(workflow.steps).toEqual([
      { id: "pdf.inspect", samplePages: 8, textSampleLimit: 2_000 },
      { id: "pdf.render.preview", pageNumber: 1, renderScale: 1.25 },
      { id: "validation" },
    ]);
  });

  it("normalizes page geometry and text signals without retaining full text", () => {
    const geometry = normalizePdfPageGeometry([0, 0, 595.28, 841.89]);
    expect(geometry).toMatchObject({ orientation: "portrait", paperSizeHint: "A4", millimeterLabel: "210 × 297 mm" });
    expect(normalizePdfPageGeometry([0, 0, 500, 500]).orientation).toBe("square");
    expect(normalizePdfPageText(["", " short ", "longer text"])).toEqual({ hasText: true, textCharacterCount: 16 });
    expect(normalizePdfPageText(["x".repeat(2_500)])).toEqual({ hasText: true, textCharacterCount: 2_000 });
  });

  it("uses bounded sampling and measured page hints", () => {
    expect(samplePdfPageNumbers(2)).toEqual([1, 2]);
    expect(samplePdfPageNumbers(100)).toEqual([1, 2, 50, 99, 100]);
    expect(samplePdfPageNumbers(0)).toEqual([]);
    expect(inferPdfPageTypeHint({ hasText: true, textCharacterCount: 30, hasRasterContent: false })).toBe("text");
    expect(inferPdfPageTypeHint({ hasText: false, textCharacterCount: 0, hasRasterContent: true })).toBe("scanned");
    expect(inferPdfPageTypeHint({ hasText: true, textCharacterCount: 30, hasRasterContent: true })).toBe("mixed");
  });

  it("creates an unselected page asset and a browser-local page workflow", () => {
    const page = createPdfPageAsset(2, normalizePdfPageGeometry([0, 0, 612, 792]), { hasText: true, textCharacterCount: 50, hasRasterContent: false });
    expect(page).toMatchObject({ pageNumber: 2, orientation: "portrait", paperSizeHint: "Letter", hasText: true, previewState: "idle", thumbnailState: "idle", selected: false });
    const asset = { id: "pdf-page-test", category: "pdf" as const, name: "fixture.pdf", sizeBytes: 100, extension: "pdf", processingBoundary: "browser-local" as const, mimeType: "application/pdf" as const, pdfVersion: "1.7", pageCount: 4, encrypted: false, passwordProtected: false, textPresence: "detected" as const, textExtractable: true, classification: "mixed" as const, pageDimensions: null, previewUrl: null, capabilities: { inspect: true as const, renderPreview: true as const }, warnings: [] };
    expect(createPdfPageInspectionWorkflow(asset, 2).steps).toEqual([
      { id: "pdf.inspect.page", pageNumber: 2, textSampleLimit: 2_000 },
      { id: "pdf.render.preview", pageNumber: 2, renderScale: 1.25 },
    ]);
  });

  it("keeps parsed PDFs valid when preview rendering is unavailable", () => {
    const asset = {
      id: "pdf-no-preview",
      name: "no-preview.pdf",
      sizeBytes: 10_000,
      extension: "pdf",
      processingBoundary: "browser-local" as const,
      category: "pdf" as const,
      mimeType: "application/pdf" as const,
      pdfVersion: "1.7",
      pageCount: 1,
      encrypted: false,
      passwordProtected: false,
      textPresence: "unknown" as const,
      textExtractable: false,
      classification: "unknown" as const,
      pageDimensions: null,
      previewUrl: null,
      capabilities: { inspect: true as const, renderPreview: true as const },
      warnings: ["Preview unavailable"],
    };
    expect(validatePdfInspection(asset)).toMatchObject({ valid: true, previewAvailable: false, protected: false });
    expect(validatePdfInspection({ ...asset, passwordProtected: true, classification: "protected" as const })).toMatchObject({ valid: false, protected: true });
  });
});

describe("PDF page operations", () => {
  it("creates deterministic delete and extract plans", () => {
    const deleted = createDeletePlan(5, [4, 2, 2]);
    expect("plan" in deleted && deleted.plan).toMatchObject({ expectedOutputPageCount: 3, selectedPages: [2, 4], expectedPageOrder: [1, 3, 5] });
    const extracted = createExtractPlan(5, [4, 2, 2]);
    expect("plan" in extracted && extracted.plan).toMatchObject({ expectedOutputPageCount: 2, selectedPages: [2, 4], expectedPageOrder: [2, 4] });
  });

  it("rejects invalid selections and deleting every page", () => {
    expect(createDeletePlan(3, [1, 2, 3])).toMatchObject({ error: { code: "cannot-delete-all-pages" } });
    expect(createExtractPlan(3, [0])).toMatchObject({ error: { code: "invalid-page-selection" } });
    expect(createRotatePlan(3, [], 90)).toMatchObject({ error: { code: "no-pages-selected" } });
  });

  it("normalizes reorder plans and validates page uniqueness", () => {
    expect(normalizeDocumentOrder([4, 2, 2, 1])).toEqual([1, 2, 4]);
    expect(createReorderPlan(4, [1, 3, 2, 4])).toMatchObject({ plan: { expectedOutputPageCount: 4, expectedPageOrder: [1, 3, 2, 4] } });
    expect(createReorderPlan(4, [1, 2, 2, 4])).toMatchObject({ error: { code: "invalid-page-order" } });
  });

  it("normalizes only supported rotations and validates mutation results", () => {
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(45)).toBeNull();
    const planned = createRotatePlan(4, [2, 3], 270);
    if (!("plan" in planned)) throw new Error("expected rotate plan");
    expect(planned.plan.operation.parameters.rotationDegrees).toBe(270);
    expect(validatePdfMutationResult({ plan: planned.plan, inputBytes: 1_000, outputBytes: 1_200, pageCount: 4, previewAvailable: true, processingBoundary: "browser-local" })).toMatchObject({ valid: true, expectedPageCount: 4, processingBoundary: "browser-local", warnings: ["Page operations can make a PDF larger; no compression was applied."] });
  });
});

describe("PDF core platform plans", () => {
  it("parses validated split ranges without clamping", () => {
    expect(createSplitPlan("1-3, 5, 7-8", 8)).toMatchObject({ plan: { expectedOutputPageCounts: [3, 1, 2], ranges: [{ start: 1, end: 3 }, { start: 5, end: 5 }, { start: 7, end: 8 }] } });
    expect(createSplitPlan("0-2", 8)).toMatchObject({ error: expect.stringContaining("outside") });
  });

  it("creates merge, render, and image-to-PDF plans", () => {
    expect(createMergePlan(["a.pdf", "b.pdf"], [2, 3], true)).toMatchObject({ plan: { expectedOutputPageCount: 5, preserveMetadata: true } });
    expect(createPdfImagePlan([1, 3], 3, "png", "high")).toMatchObject({ plan: { pageNumbers: [1, 3], format: "png", resolution: "high" } });
    expect(createImageToPdfPlan(["a.png", "b.jpg"])).toMatchObject({ plan: { expectedOutputPageCount: 2, pagePolicy: "fit-centered" } });
  });

  it("bounds blank-page detection and requires reviewed removal", () => {
    expect(createBlankDetectionPlan(5)).toMatchObject({ plan: { pageNumbers: [1, 2, 3, 4, 5], coverage: "complete" } });
    const sampled = createBlankDetectionPlan(100);
    expect(sampled).toMatchObject({ plan: { coverage: "sampled" } });
    if (!("plan" in sampled)) throw new Error("expected sampled plan");
    expect(sampled.plan.pageNumbers.length).toBeLessThanOrEqual(50);
    expect(createBlankRemovalPlan(5, [4, 2, 2])).toMatchObject({ plan: { confirmedPageNumbers: [2, 4], expectedOutputPageCount: 3, reviewRequired: true } });
    expect(createBlankRemovalPlan(3, [1, 2, 3])).toMatchObject({ error: expect.stringContaining("retain") });
  });

  it("keeps blank-page classification conservative and filenames safe", () => {
    expect(classifyBlankPage({ pageNumber: 4, textCharacterCount: 0, hasRasterContent: false, nonBackgroundRatio: 0 })).toMatchObject({ classification: "likely-blank", confidence: "bounded-heuristic" });
    expect(classifyBlankPage({ pageNumber: 5, textCharacterCount: 0, hasRasterContent: true, nonBackgroundRatio: 0 })).toMatchObject({ classification: "possibly-blank" });
    expect(safeCoreFilename("../Quarter 1: report", "split-part-1", "pdf")).toBe("Quarter-1-report-split-part-1.pdf");
  });

  it("validates core results and exposes a unified workflow", () => {
    const plan = createMergePlan(["a.pdf", "b.pdf"], [1, 2]);
    if (!("plan" in plan)) throw new Error("expected merge plan");
    expect(createPdfCoreWorkflow("merge", plan.plan).steps.map((step) => step.id)).toEqual(["pdf.inspect", "pdf.merge", "validation", "pdf.render.preview"]);
    const detect = createBlankDetectionPlan(2);
    if (!("plan" in detect)) throw new Error("expected detection plan");
    expect(createPdfCoreWorkflow("detect_blank_pages", detect.plan).steps[1]).toMatchObject({ id: "pdf.detect.blank_pages", operation: "detect_blank_pages" });
    const remove = createBlankRemovalPlan(2, [2]);
    if (!("plan" in remove)) throw new Error("expected removal plan");
    expect(createPdfCoreWorkflow("remove_blank_pages", remove.plan).steps[1]).toMatchObject({ id: "pdf.remove.blank_pages", operation: "remove_blank_pages" });
    expect(validateCorePdfOutput({ operation: "merge", expectedPageCount: 3, actualPageCount: 3, previewAvailable: true, inputBytes: 100, outputBytes: 150, processingBoundary: "browser-local" })).toMatchObject({ valid: true, warnings: ["The generated PDF is larger than the input; no compression was applied."] });
  });
});

describe("PDF optimization engine", () => {
  const analysis: PdfOptimizationAnalysis = {
    inputBytes: 1_000_000,
    pageCount: 4,
    pdfVersion: "1.7",
    classification: "scanned",
    textPresent: false,
    rasterPresent: true,
    imageHeavy: true,
    sampledPages: [1, 2, 3, 4],
    pagesAnalyzed: 4,
    textPages: 0,
    rasterPages: 4,
    imageHeavyPages: 4,
    sampledPagePixels: [],
    optimizationOpportunities: ["image-quality", "image-resolution"],
    warnings: [],
    processingBoundary: "browser-local",
  };

  it("parses PDF target language using decimal KB and MB", () => {
    expect(parsePdfIntent("compress under 5MB").intent?.targetBytes).toBe(5_000_000);
    expect(parsePdfIntent("make this PDF less than 2 MB").intent?.targetBytes).toBe(2_000_000);
    expect(parsePdfIntent("reduce to 500 KB").intent?.targetBytes).toBe(500_000);
    expect(parsePdfIntent("keep it below 1.5MB").intent?.targetBytes).toBe(1_500_000);
    expect(parsePdfIntent("compress this PDF").status).toBe("ambiguous");
    expect(parsePdfIntent("make it tiny").status).toBe("ambiguous");
  });

  it("defines deterministic quality policies and a documented floor", () => {
    expect(qualityPolicy("maximum")).toMatchObject({ quality: 0.9, resolutionScale: 1 });
    expect(qualityPolicy("balanced")).toMatchObject({ quality: 0.78, resolutionScale: 0.78 });
    expect(qualityPolicy("smallest")).toMatchObject({ quality: 0.56, resolutionScale: 0.48, qualityDecision: "best-effort" });
  });

  it("generates bounded policy-aware candidates", () => {
    expect(generateCandidateSpecs("scanned", "balanced", false).length).toBeLessThanOrEqual(5);
    expect(generateCandidateSpecs("mixed", "balanced", true)[0]).toMatchObject({ scope: "raster-only-pages", destructive: true });
    expect(generateCandidateSpecs("text", "balanced", true)[0]).toMatchObject({ strategy: "original-preserved", destructive: false });
  });

  it("creates optimization plans and explicit workflow steps", () => {
    const intent = parsePdfIntent("compress under 2MB");
    if (!intent.intent) throw new Error("expected PDF intent");
    const optimizationIntent = { ...intent.intent, mode: "balanced" as const };
    const planned = createPdfOptimizationPlan(analysis, optimizationIntent, "preserve");
    if (!("plan" in planned)) throw new Error("expected optimization plan");
    expect(planned.plan.targetBytes).toBe(2_000_000);
    expect(planned.plan.processingBoundary).toBe("browser-local");
    const workflow = createPdfOptimizationWorkflow({ id: "pdf", category: "pdf", name: "fixture.pdf", sizeBytes: 1_000_000, extension: "pdf", processingBoundary: "browser-local", mimeType: "application/pdf", pdfVersion: "1.7", pageCount: 4, encrypted: false, passwordProtected: false, textPresence: "not-detected", textExtractable: false, classification: "scanned", pageDimensions: null, previewUrl: null, capabilities: { inspect: true, renderPreview: true }, warnings: [] }, optimizationIntent, planned.plan);
    expect(workflow.steps.map((step) => step.id)).toEqual(["pdf.inspect", "pdf.analyze.optimization", "pdf.optimize.target_size", "validation", "pdf.render.preview"]);
  });

  it("ranks only valid candidates by target and quality policy", () => {
    const candidates = generateCandidateSpecs("scanned", "balanced", false);
    const ranked = candidates.map((candidate, index) => ({ candidate, valid: true, outputBytes: [900_000, 650_000, 450_000][index] ?? 300_000, pageCount: 4, textPagesPreserved: true, previewAvailable: true, targetAchieved: true, warnings: [] }));
    expect(selectBestPdfCandidate(ranked, 700_000, 1_000_000)?.outputBytes).toBe(650_000);
    expect(selectBestPdfCandidate(ranked, 100_000, 1_000_000)?.outputBytes).toBe(900_000);
    expect(selectBestPdfCandidate(ranked.map((item) => ({ ...item, valid: false })), 700_000, 1_000_000)).toBeNull();
  });

  it("builds target-achieved, preserved, and best-effort result states", () => {
    const candidate = generateCandidateSpecs("scanned", "balanced", false)[0];
    const achieved = buildPdfOptimizationResult({ inputBytes: 1_000_000, targetBytes: 700_000, pageCount: 4, candidate: { candidate, valid: true, outputBytes: 650_000, pageCount: 4, textPagesPreserved: true, previewAvailable: true, targetAchieved: true, warnings: [] }, analysis, filename: "fixture-optimized.pdf", candidateCount: 3 });
    expect(achieved.targetAchieved).toBe(true);
    expect(achieved.reductionPercentage).toBe(35);
    const bestEffort = buildPdfOptimizationResult({ inputBytes: 1_000_000, targetBytes: 100_000, pageCount: 4, candidate: { candidate, valid: true, outputBytes: 650_000, pageCount: 4, textPagesPreserved: true, previewAvailable: true, targetAchieved: false, warnings: [] }, analysis, filename: "fixture-optimized.pdf", candidateCount: 3 });
    expect(bestEffort.targetAchieved).toBe(false);
    expect(bestEffort.bestEffort).toBe(true);
    expect(bestEffort.message).toContain("could not be reached");
  });
});

describe("Phase 4 PDF document intelligence", () => {
  const featureSignals: PdfFeatureSignals = { text: "detected", rasterImages: "not-detected", vectorDrawing: "detected", annotations: "not-detected", links: "not-detected", forms: "not-detected", bookmarks: "unknown", embeddedFiles: "unknown", javascript: "not-detected", encryption: "not-detected", pageLabels: "not-detected", rotation: "not-detected", metadata: "detected", annotationCount: 0, linkCount: 0, formFieldCount: 0, bookmarkCount: null, embeddedFileCount: null, pageLabelCount: null };
  const analysisFixture = (overrides: Partial<PdfDocumentAnalysis> = {}): PdfDocumentAnalysis => ({ fileName: "fixture.pdf", fileSizeBytes: 10_000, pdfVersion: "1.7", pageCount: 2, classification: "text", textPresence: "detected", textPageCount: 2, rasterPageCount: 0, vectorSignals: "detected", pageDimensions: [{ pageNumber: 1, widthPoints: 595, heightPoints: 842, rotation: 0 }, { pageNumber: 2, widthPoints: 595, heightPoints: 842, rotation: 0 }], pages: [{ pageNumber: 1, widthPoints: 595, heightPoints: 842, rotation: 0, orientation: "portrait", textPresence: "detected", characterCount: 500, rasterSignals: 0, vectorSignals: 4, annotationCount: 0, linkCount: 0, formFieldCount: 0, imageHeavy: false, role: "text-heavy", roleConfidence: "likely", ocrReadiness: "ocr-probably-unnecessary" }, { pageNumber: 2, widthPoints: 595, heightPoints: 842, rotation: 0, orientation: "portrait", textPresence: "detected", characterCount: 400, rasterSignals: 0, vectorSignals: 4, annotationCount: 0, linkCount: 0, formFieldCount: 0, imageHeavy: false, role: "text-heavy", roleConfidence: "likely", ocrReadiness: "ocr-probably-unnecessary" }], features: featureSignals, metadata: { status: "detected", title: { status: "detected", value: "Fixture" }, author: { status: "not-detected", value: null }, subject: { status: "not-detected", value: null }, keywords: { status: "not-detected", value: null }, creator: { status: "detected", value: "FPDF" }, producer: { status: "detected", value: "FPDF" }, creationDate: { status: "not-detected", value: null }, modificationDate: { status: "not-detected", value: null }, presentFieldCount: 3 }, images: { status: "not-detected", sampledPages: [1, 2], rasterPageCount: 0, highResolutionPageCount: 0, imageSignals: [], estimatedImageBytes: null, note: "bounded" }, fonts: { status: "detected", count: 2, embedded: "unknown", subset: "unknown", categories: [], note: "bounded" }, text: { status: "detected", sampledPages: [1, 2], pagesWithText: 2, boundedCharacterCount: 900, textPages: [], note: "bounded" }, layout: { textDensity: 0.001, lineDensity: 0.0001, blockDensity: 0.0001, imageDensity: 0, whitespace: "unknown", repeatedHeaderFooter: "unknown", note: "bounded" }, structure: { pageGroups: [{ startPage: 1, endPage: 2, role: "text-heavy", confidence: "likely" }], sampledPageCount: 2, exactPageCount: 2, note: "bounded" }, ocrReadiness: "ocr-probably-unnecessary", preservationRisk: { level: "medium", status: "preservation-warning", reasons: ["Text/vector content must remain searchable and is preserved by default."], blockedOperations: ["full-page-rasterization"] }, optimizationOpportunities: ["safe-structural-preservation"], recommendation: "Preserve structure", insights: ["Searchable text was detected."], warnings: [], sampledPages: [1, 2], pagesAnalyzed: 2, processingBoundary: "browser-local", ...overrides });

  it("derives conservative page roles and OCR readiness", () => {
    expect(derivePageRole({ pageNumber: 1, characterCount: 0, rasterSignals: 2, annotationCount: 0, formFieldCount: 0, imageHeavy: true }, 3)).toMatchObject({ role: "cover" });
    expect(derivePageRole({ pageNumber: 2, characterCount: 0, rasterSignals: 2, annotationCount: 0, formFieldCount: 0, imageHeavy: true }, 3)).toMatchObject({ role: "scan" });
    expect(deriveOcrReadiness("not-detected", 2, 0)).toBe("ocr-likely-useful");
    expect(deriveOcrReadiness("detected", 0, 200)).toBe("ocr-probably-unnecessary");
  });

  it("derives preservation risk and blocks destructive paths for forms", () => {
    const risk = derivePreservationRisk({ classification: "text", vectorSignals: "detected", features: { forms: "detected", links: "detected", annotations: "detected", bookmarks: "unknown", embeddedFiles: "unknown", javascript: "not-detected", encryption: "not-detected" } });
    expect(risk).toMatchObject({ level: "high", status: "preservation-warning", blockedOperations: ["full-page-rasterization"] });
    const basePlan = createPdfOptimizationPlan({ inputBytes: 10_000, pageCount: 2, classification: "text" }, { operation: "pdf.optimize.target_size", targetBytes: 5_000, targetLabel: "5 KB", mode: "balanced", sourceType: "pdf" });
    if (!("plan" in basePlan)) throw new Error("expected plan");
    const advanced = buildAdvancedOptimizationPlan(analysisFixture(), { operation: "pdf.optimize.target_size", targetBytes: 5_000, targetLabel: "5 KB", mode: "balanced", sourceType: "pdf" }, basePlan.plan);
    expect(advanced.strategy).toBe("preserve-structure");
    expect(advanced.validationRequirements).toContain("feature-preservation");
  });

  it("compares feature signals and reports critical loss", () => {
    const before = analysisFixture({ features: { ...featureSignals, links: "detected", linkCount: 2 } });
    const after = analysisFixture({ features: { ...featureSignals, links: "not-detected", linkCount: 0 } });
    const comparison = comparePdfDocumentFeatures(before, after);
    expect(comparison.valid).toBe(false);
    expect(comparison.status).toBe("preservation-blocked");
    expect(comparison.criticalFailures.join(" ")).toContain("links");
  });

  it("creates a bounded serializable intelligence snapshot", () => {
    const snapshot = createDocumentIntelligenceSnapshot(analysisFixture());
    expect(snapshot.identity.processingBoundary).toBe("browser-local");
    expect(snapshot.pages).toMatchObject({ exactPageCount: 2, sampledPageCount: 2 });
    expect(snapshot.featureSignals).toMatchObject({ text: "detected", forms: "not-detected" });
    expect(JSON.stringify(snapshot)).not.toContain("textPages");
  });

  it("maps preservation statuses and warnings into the final result", () => {
    const candidate = generateCandidateSpecs("text", "balanced", true)[0];
    const featureChanges = [
      { feature: "searchable text", before: "detected", after: "detected", status: "preserved" as const },
      { feature: "links", before: "detected", after: "detected", status: "preserved" as const },
      { feature: "form fields", before: "unknown", after: "unknown", status: "unknown" as const },
      { feature: "bookmarks", before: "unknown", after: "unknown", status: "unknown" as const },
      { feature: "metadata", before: "detected", after: "not-detected", status: "changed" as const },
    ];
    const result = buildPdfOptimizationResult({ inputBytes: 1_000, targetBytes: null, pageCount: 2, candidate: { candidate, valid: true, outputBytes: 1_000, pageCount: 2, textPagesPreserved: true, previewAvailable: true, targetAchieved: false, warnings: [], preservationStatus: "preservation-warning", preservationWarnings: ["A bounded preservation warning"], featureChanges }, analysis: { inputBytes: 1_000, pageCount: 2, pdfVersion: "1.7", classification: "text", textPresent: true, rasterPresent: false, imageHeavy: false, sampledPages: [1, 2], pagesAnalyzed: 2, textPages: 2, rasterPages: 0, imageHeavyPages: 0, sampledPagePixels: [], optimizationOpportunities: ["structural-preservation"], warnings: [], processingBoundary: "browser-local" }, filename: "fixture-optimized.pdf", candidateCount: 1 });
    expect(result.textStatus).toBe("preserved");
    expect(result.linkStatus).toBe("preserved");
    expect(result.formStatus).toBe("unknown");
    expect(result.bookmarkStatus).toBe("unknown");
    expect(result.metadataStatus).toBe("removed");
    expect(result.preservationWarnings).toEqual(["A bounded preservation warning"]);
  });

  it("maps the advanced analysis workflow to bounded inspection steps", () => {
    const snapshot = createDocumentIntelligenceSnapshot(analysisFixture());
    const workflow = createPdfAdvancedAnalysisWorkflow({} as Parameters<typeof createPdfAdvancedAnalysisWorkflow>[0], analysisFixture(), snapshot);
    expect(workflow.processingBoundary).toBe("browser-local");
    expect(workflow.steps.map((step) => step.id)).toEqual(["pdf.inspect", "pdf.analyze.advanced", "pdf.extract.bounded_text", "pdf.analyze.layout", "pdf.analyze.structure", "pdf.analyze.ocr_readiness", "intelligence.snapshot", "validation"]);
  });
});

describe("compression candidate selection", () => {
  it("selects the highest quality candidate under the target", () => {
    const result = selectCandidate([
      { bytes: 80_000, quality: 0.7, mimeType: "image/webp" },
      { bytes: 95_000, quality: 0.85, mimeType: "image/jpeg" },
      { bytes: 120_000, quality: 0.95, mimeType: "image/jpeg" },
    ], 100_000, "image/jpeg");
    expect(result.targetAchieved).toBe(true);
    expect(result.candidate.bytes).toBe(95_000);
  });

  it("returns the smallest best-effort candidate when the target is impossible", () => {
    const result = selectCandidate([
      { bytes: 84_000, quality: 0.45, mimeType: "image/webp" },
      { bytes: 110_000, quality: 0.75, mimeType: "image/jpeg" },
    ], 50_000, "image/jpeg");
    expect(result.targetAchieved).toBe(false);
    expect(result.candidate.bytes).toBe(84_000);
  });
});
