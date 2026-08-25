import { describe, expect, it } from "vitest";
import { formatBytes, reductionPercent } from "../lib/file-utils";
import { parseByteTarget, parseImageIntent } from "../domain/intents/parse-intent";
import { selectCandidate } from "../features/compression/select-candidate";
import { qualityDecision, scaledDimensions } from "../features/compression/compress-image";
import { MAX_PDF_INPUT_BYTES } from "../domain/files/types";
import { classifyPdf } from "../domain/pdfs/types";
import { validatePdfInspection } from "../domain/pdfs/validation";
import { createPdfInspectionWorkflow } from "../domain/workflows/types";
import { hasPdfSignature, isPdfWithinLocalInspectionLimit, normalizePageDimensions, readPdfVersion } from "../domain/pdfs/helpers";
import { createPdfPageAsset, inferPdfPageTypeHint, normalizePdfPageGeometry, normalizePdfPageText, samplePdfPageNumbers } from "../domain/pdfs/pages";
import { createPdfPageInspectionWorkflow } from "../domain/workflows/types";

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
