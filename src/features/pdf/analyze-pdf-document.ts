import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { PdfAsset, PdfClassification } from "../../domain/files/types";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";
import { classifyPdf, type PdfInspectionSignals } from "../../domain/pdfs/types";
import { hasPdfSignature, readPdfVersion } from "../../domain/pdfs/helpers";
import { MAX_PDF_SAMPLE_PAGES, MAX_PDF_TEXT_CHARS } from "./config";
import type { PdfOptimizationProgress } from "../../domain/pdfs/optimization";
import {
  MAX_ANALYSIS_IMAGE_SIGNALS,
  MAX_ANALYSIS_PAGE_RECORDS,
  MAX_ANALYSIS_TEXT_BLOCKS,
  MAX_ANALYSIS_TEXT_SAMPLE_CHARS,
  buildDocumentInsights,
  deriveOcrReadiness,
  derivePageRole,
  derivePreservationRisk,
  emptyMetadataAnalysis,
  type PdfDocumentAnalysis,
  type PdfEmbeddedImageSignal,
  type PdfFeatureSignals,
  type PdfFieldSignal,
  type PdfFontAnalysis,
  type PdfLayoutSignals,
  type PdfMetadataAnalysis,
  type PdfPageAnalysis,
  type PdfPageRole,
  type PdfRiskLevel,
  type PdfSignalStatus,
  type PdfStructureGroup,
  type PdfTextAnalysis,
  type PdfTextBlock,
  type PdfTextPageAnalysis,
} from "../../domain/pdfs/document-analysis";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RASTER_OPERATORS = new Set<number>([
  pdfjsLib.OPS.paintImageMaskXObject,
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintInlineImageXObject,
]);

const VECTOR_OPERATOR_NAMES = ["constructPath", "stroke", "closeStroke", "fill", "eoFill", "fillStroke", "eoFillStroke", "shadingFill"] as const;
const VECTOR_OPERATORS = new Set<number>(VECTOR_OPERATOR_NAMES.map((name) => (pdfjsLib.OPS as unknown as Record<string, number | undefined>)[name]).filter((value): value is number => typeof value === "number"));
const FONT_OPERATORS = new Set<number>([pdfjsLib.OPS.setFont].filter((value): value is number => typeof value === "number"));
const MAX_ANALYSIS_BLOCKS_PER_PAGE = MAX_ANALYSIS_TEXT_BLOCKS;
const HIGH_RESOLUTION_POINTS = 1_200;

type AnyRecord = Record<string, unknown>;
type PdfTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

export class DocumentAnalysisCancelledError extends Error {
  constructor() {
    super("PDF document analysis was cancelled. The original PDF remains unchanged.");
    this.name = "DocumentAnalysisCancelledError";
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DocumentAnalysisCancelledError();
}

function emitProgress(onProgress: ((progress: PdfOptimizationProgress) => void) | undefined, progress: PdfOptimizationProgress): void {
  onProgress?.(progress);
}

function samplePageNumbers(pageCount: number): number[] {
  if (pageCount <= MAX_PDF_SAMPLE_PAGES) return Array.from({ length: pageCount }, (_, index) => index + 1);
  return [...new Set([1, 2, Math.ceil(pageCount / 2), pageCount - 1, pageCount].filter((page) => page >= 1 && page <= pageCount))];
}

function asRecord(value: unknown): AnyRecord | null {
  return typeof value === "object" && value !== null ? value as AnyRecord : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function itemText(item: unknown): string {
  const record = asRecord(item);
  return typeof record?.str === "string" ? record.str : "";
}

function itemNumber(record: AnyRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textStats(items: readonly unknown[]): { itemCount: number; characterCount: number } {
  let itemCount = 0;
  let characterCount = 0;
  for (const item of items) {
    const value = itemText(item);
    if (!value.trim()) continue;
    itemCount += 1;
    characterCount = Math.min(MAX_PDF_TEXT_CHARS, characterCount + value.length);
    if (characterCount >= MAX_PDF_TEXT_CHARS) break;
  }
  return { itemCount, characterCount };
}

function countOperators(fnArray: readonly number[], operators: Set<number>): number {
  let count = 0;
  for (const operator of fnArray) if (operators.has(operator)) count += 1;
  return count;
}

function fieldSignal(value: unknown, known: boolean): PdfFieldSignal {
  const normalized = stringValue(value);
  return normalized ? { status: "detected", value: normalized } : { status: known ? "not-detected" : "unknown", value: null };
}

function pageFeatureStatus(count: number | null, inspected: boolean): PdfSignalStatus {
  if (count === null) return "unknown";
  return count > 0 ? "detected" : inspected ? "not-detected" : "unknown";
}

function getMetadataField(info: AnyRecord, metadata: unknown, ...names: string[]): unknown {
  for (const name of names) {
    const infoValue = info[name];
    if (infoValue !== undefined && infoValue !== null && String(infoValue).trim()) return infoValue;
    const getter = asRecord(metadata)?.get;
    if (typeof getter === "function") {
      try {
        const metadataValue = getter.call(metadata, name);
        if (metadataValue !== undefined && metadataValue !== null && String(metadataValue).trim()) return metadataValue;
      } catch {
        // Metadata is advisory; an unreadable field remains unknown.
      }
    }
  }
  return null;
}

function metadataFromPdf(metadataResult: { info: Object; metadata: unknown } | null): PdfMetadataAnalysis {
  if (!metadataResult) return emptyMetadataAnalysis();
  const info = asRecord(metadataResult.info) ?? {};
  const metadata = metadataResult.metadata;
  const known = true;
  const fields: Record<keyof Pick<PdfMetadataAnalysis, "title" | "author" | "subject" | "keywords" | "creator" | "producer" | "creationDate" | "modificationDate">, PdfFieldSignal> = {
    title: fieldSignal(getMetadataField(info, metadata, "Title", "dc:title"), known),
    author: fieldSignal(getMetadataField(info, metadata, "Author", "dc:creator"), known),
    subject: fieldSignal(getMetadataField(info, metadata, "Subject", "dc:description"), known),
    keywords: fieldSignal(getMetadataField(info, metadata, "Keywords", "pdf:Keywords"), known),
    creator: fieldSignal(getMetadataField(info, metadata, "Creator", "xmp:CreatorTool"), known),
    producer: fieldSignal(getMetadataField(info, metadata, "Producer", "pdf:Producer"), known),
    creationDate: fieldSignal(getMetadataField(info, metadata, "CreationDate", "xmp:CreateDate"), known),
    modificationDate: fieldSignal(getMetadataField(info, metadata, "ModDate", "xmp:ModifyDate"), known),
  };
  const presentFieldCount = Object.values(fields).filter((field) => field.status === "detected").length;
  return { status: presentFieldCount > 0 ? "detected" : "not-detected", ...fields, presentFieldCount };
}

function blocksFromTextContent(textContent: PdfTextContent, pageNumber: number): { stats: { itemCount: number; characterCount: number }; sample: string; blocks: PdfTextBlock[]; lineCount: number } {
  const blocks: PdfTextBlock[] = [];
  const sampleParts: string[] = [];
  const lineKeys = new Set<string>();
  let itemCount = 0;
  let characterCount = 0;
  for (const rawItem of textContent.items) {
    const record = asRecord(rawItem);
    const value = itemText(rawItem).replace(/\s+/g, " ").trim();
    if (!value) continue;
    itemCount += 1;
    characterCount = Math.min(MAX_PDF_TEXT_CHARS, characterCount + value.length);
    if (sampleParts.join(" ").length < MAX_ANALYSIS_TEXT_SAMPLE_CHARS) sampleParts.push(value.slice(0, Math.max(0, MAX_ANALYSIS_TEXT_SAMPLE_CHARS - sampleParts.join(" ").length)));
    const transform = Array.isArray(record?.transform) ? record.transform.filter((value): value is number => typeof value === "number") : [];
    const x = transform.length > 4 ? transform[4] : 0;
    const y = transform.length > 5 ? transform[5] : 0;
    const width = Math.max(0, itemNumber(record, "width") ?? 0);
    const height = Math.max(0, itemNumber(record, "height") ?? Math.abs(transform[3] ?? 0));
    if (blocks.length < MAX_ANALYSIS_BLOCKS_PER_PAGE) blocks.push({ text: value.slice(0, 160), x, y, width, height, pageNumber });
    lineKeys.add(`${Math.round(y / 3)}`);
    if (characterCount >= MAX_PDF_TEXT_CHARS) break;
  }
  return { stats: { itemCount, characterCount }, sample: sampleParts.join(" ").slice(0, MAX_ANALYSIS_TEXT_SAMPLE_CHARS), blocks, lineCount: lineKeys.size };
}

function annotationSummary(annotations: readonly unknown[]): { annotationCount: number; linkCount: number; formFieldCount: number } {
  let linkCount = 0;
  let formFieldCount = 0;
  for (const annotation of annotations) {
    const record = asRecord(annotation);
    const subtype = typeof record?.subtype === "string" ? record.subtype : "";
    if (subtype === "Link" || typeof record?.url === "string" || record?.dest !== undefined) linkCount += 1;
    if (subtype === "Widget" || typeof record?.fieldName === "string" || typeof record?.fieldType === "string") formFieldCount += 1;
  }
  return { annotationCount: annotations.length, linkCount, formFieldCount };
}

function pageRoleGroups(pages: readonly PdfPageAnalysis[], exactPageCount: number): PdfStructureGroup[] {
  const groups: PdfStructureGroup[] = [];
  for (const page of pages) {
    const previous = groups[groups.length - 1];
    if (previous && previous.role === page.role && previous.endPage + 1 === page.pageNumber) previous.endPage = page.pageNumber;
    else groups.push({ startPage: page.pageNumber, endPage: page.pageNumber, role: page.role, confidence: page.roleConfidence });
  }
  return groups.length ? groups : [{ startPage: 1, endPage: exactPageCount, role: "unknown", confidence: "uncertain" }];
}

function recommendationFor(classification: PdfClassification, riskLevel: PdfRiskLevel, imageCount: number, textPageCount: number, formStatus: PdfSignalStatus): string {
  if (formStatus === "detected") return "This PDF contains interactive fields. A conservative preservation-first path is recommended; destructive rasterization is blocked.";
  if (classification === "scanned" && imageCount > 0) return "This PDF is mostly scanned pages. Balanced image optimization is the safest starting point for size reduction.";
  if (classification === "mixed") return "This PDF combines searchable text and raster content. A hybrid optimization can target eligible images while preserving text pages.";
  if (textPageCount > 0 || classification === "text") return "This PDF contains searchable text. Preserve its structure; optimization may have limited size impact.";
  if (riskLevel === "unknown") return "Some document features could not be inspected authoritatively. Preserve the original and review any candidate carefully.";
  return "No high-confidence destructive optimization opportunity was found in the bounded analysis.";
}

async function openPdf(data: Uint8Array): Promise<{ pdf: PDFDocumentProxy; task: ReturnType<typeof pdfjsLib.getDocument> }> {
  const task = pdfjsLib.getDocument({ data, useWorkerFetch: true });
  let passwordRequired = false;
  task.onPassword = () => {
    passwordRequired = true;
    void task.destroy();
  };
  try {
    const pdf = await task.promise;
    if (passwordRequired) throw new Error("password-required");
    return { pdf, task };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (passwordRequired) throw new Error("This PDF is password protected and cannot be analyzed here.");
    throw error;
  }
}

export async function validatePdfRepresentativeRenders(file: File, signal?: AbortSignal): Promise<number[]> {
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local render-validation limit.");
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfCancelled(signal);
  const { pdf, task } = await openPdf(data);
  try {
    const sampledPages = samplePageNumbers(pdf.numPages);
    const representativePages = [...new Set([sampledPages[0], sampledPages[Math.floor(sampledPages.length / 2)], sampledPages.at(-1)].filter((page): page is number => typeof page === "number"))];
    for (const pageNumber of representativePages) {
      throwIfCancelled(signal);
      const page = await pdf.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error(`Representative page ${pageNumber} could not create a 2D canvas context.`);
        const renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        page.cleanup();
      }
    }
    return representativePages;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

export async function analyzePdfDocument(file: File, asset?: PdfAsset, onProgress?: (progress: PdfOptimizationProgress) => void, signal?: AbortSignal): Promise<PdfDocumentAnalysis> {
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local analysis limit.");
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!hasPdfSignature(header)) throw new Error("This file is not a valid PDF.");
  throwIfCancelled(signal);
  const data = new Uint8Array(await file.arrayBuffer());
  const { pdf, task } = await openPdf(data);
  try {
    const pageCount = pdf.numPages;
    if (pageCount < 1) throw new Error("The PDF has no usable pages.");
    const sampledPages = samplePageNumbers(pageCount);
    const pages: PdfPageAnalysis[] = [];
    const textPages: PdfTextPageAnalysis[] = [];
    const imageSignals: PdfEmbeddedImageSignal[] = [];
    let textItemCount = 0;
    let boundedCharacterCount = 0;
    let rasterPageCount = 0;
    let vectorSignalCount = 0;
    let highResolutionPageCount = 0;
    let fontSignalCount = 0;
    let annotationCount: number | null = 0;
    let linkCount: number | null = 0;
    let formFieldCount: number | null = 0;
    let annotationInspectionSucceeded = true;
    let textInspectionSucceeded = true;
    let rasterInspectionSucceeded = true;
    let vectorInspectionSucceeded = true;
    let lineCount = 0;
    let blockCount = 0;
    const pageDimensions: PdfDocumentAnalysis["pageDimensions"] = [];

    for (let index = 0; index < sampledPages.length; index += 1) {
      throwIfCancelled(signal);
      const pageNumber = sampledPages[index];
      emitProgress(onProgress, { stage: "analyzing", completed: index, total: sampledPages.length, detail: `Analyzing document features on page ${pageNumber} of ${pageCount}` });
      const page = await pdf.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent({ disableNormalization: false });
        const text = blocksFromTextContent(textContent, pageNumber);
        const operators = await page.getOperatorList();
        const rasterSignals = countOperators(operators.fnArray, RASTER_OPERATORS);
        const vectorSignals = countOperators(operators.fnArray, VECTOR_OPERATORS);
        const fontSignals = countOperators(operators.fnArray, FONT_OPERATORS);
        const highResolution = rasterSignals > 0 && Math.max(viewport.width, viewport.height) >= HIGH_RESOLUTION_POINTS;
        const annotationValues = await page.getAnnotations({ intent: "display" }).catch(() => null);
        const annotation = annotationValues ? annotationSummary(annotationValues) : null;
        if (!annotation) annotationInspectionSucceeded = false;
        if (text.stats.itemCount > 0) textPages.push({ pageNumber, status: "detected", characterCount: text.stats.characterCount, itemCount: text.stats.itemCount, sample: text.sample, blocks: text.blocks });
        else textPages.push({ pageNumber, status: "not-detected", characterCount: 0, itemCount: 0, sample: "", blocks: [] });
        textItemCount += text.stats.itemCount;
        boundedCharacterCount = Math.min(MAX_PDF_TEXT_CHARS, boundedCharacterCount + text.stats.characterCount);
        lineCount += text.lineCount;
        blockCount += text.blocks.length;
        if (rasterSignals > 0) rasterPageCount += 1;
        vectorSignalCount += vectorSignals;
        fontSignalCount += fontSignals;
        if (highResolution) highResolutionPageCount += 1;
        if (annotation) {
          annotationCount = (annotationCount ?? 0) + annotation.annotationCount;
          linkCount = (linkCount ?? 0) + annotation.linkCount;
          formFieldCount = (formFieldCount ?? 0) + annotation.formFieldCount;
        }
        if (!Array.isArray(operators.fnArray)) rasterInspectionSucceeded = false;
        if (!Array.isArray(operators.fnArray)) vectorInspectionSucceeded = false;
        const pageAnalysisBase = { pageNumber, characterCount: text.stats.characterCount, rasterSignals, annotationCount: annotation?.annotationCount ?? null, linkCount: annotation?.linkCount ?? null, formFieldCount: annotation?.formFieldCount ?? null, imageHeavy: rasterSignals > 0 && (text.stats.characterCount < 160 || highResolution) };
        const role = derivePageRole(pageAnalysisBase, pageCount);
        const orientation = viewport.width > viewport.height ? "landscape" : viewport.width < viewport.height ? "portrait" : "square";
        pages.push({ ...pageAnalysisBase, widthPoints: Math.round(viewport.width), heightPoints: Math.round(viewport.height), rotation: page.rotate, orientation, textPresence: text.stats.itemCount > 0 ? "detected" : "not-detected", vectorSignals, role: role.role, roleConfidence: role.confidence, ocrReadiness: deriveOcrReadiness(text.stats.itemCount > 0 ? "detected" : "not-detected", rasterSignals, text.stats.characterCount) });
        pageDimensions.push({ pageNumber, widthPoints: Math.round(viewport.width), heightPoints: Math.round(viewport.height), rotation: page.rotate });
        if (rasterSignals > 0 && imageSignals.length < MAX_ANALYSIS_IMAGE_SIGNALS) imageSignals.push({ pageNumber, rasterOperatorCount: rasterSignals, width: null, height: null, bitsPerComponent: null, colorSpace: null, compression: "pdf-image-operator", estimatedBytes: null });
      } catch (error) {
        if (error instanceof DocumentAnalysisCancelledError) throw error;
        textInspectionSucceeded = false;
        rasterInspectionSucceeded = false;
        vectorInspectionSucceeded = false;
      } finally {
        page.cleanup();
      }
    }

    throwIfCancelled(signal);
    const metadataResult = await pdf.getMetadata().catch(() => null);
    const metadata = metadataFromPdf(metadataResult);
    const outline = await pdf.getOutline().catch(() => null);
    const attachments = await pdf.getAttachments().catch(() => null);
    const jsActions = await pdf.getJSActions().catch(() => null);
    const pageLabels = await pdf.getPageLabels().catch(() => null);
    const encryptionDetected = Boolean((pdf as unknown as { isEncrypted?: boolean }).isEncrypted);
    const formsStatus = formFieldCount === null ? "unknown" : formFieldCount > 0 ? "detected" : annotationInspectionSucceeded ? "not-detected" : "unknown";
    const linksStatus = pageFeatureStatus(linkCount, annotationInspectionSucceeded);
    const annotationStatus = pageFeatureStatus(annotationCount, annotationInspectionSucceeded);
    const featureSignals: PdfFeatureSignals = {
      text: textItemCount > 0 ? "detected" : textInspectionSucceeded ? "not-detected" : "unknown",
      rasterImages: rasterPageCount > 0 ? "detected" : rasterInspectionSucceeded ? "not-detected" : "unknown",
      vectorDrawing: vectorSignalCount > 0 ? "detected" : vectorInspectionSucceeded ? "not-detected" : "unknown",
      annotations: annotationStatus,
      links: linksStatus,
      forms: formsStatus,
      bookmarks: outline === null ? "unknown" : outline.length > 0 ? "detected" : "not-detected",
      embeddedFiles: attachments === null ? "unknown" : attachments.size > 0 ? "detected" : "not-detected",
      javascript: jsActions === null ? "not-detected" : "detected",
      encryption: encryptionDetected ? "detected" : "not-detected",
      pageLabels: pageLabels === null ? "not-detected" : "detected",
      rotation: pages.some((page) => page.rotation !== 0) ? "detected" : "not-detected",
      metadata: metadata.status,
      annotationCount,
      linkCount,
      formFieldCount,
      bookmarkCount: outline === null ? null : outline.length,
      embeddedFileCount: attachments === null ? null : attachments.size,
      pageLabelCount: pageLabels === null ? null : pageLabels.length,
    };
    const signals: PdfInspectionSignals = { pageCount, pagesSampled: sampledPages.length, pagesWithText: pages.filter((page) => page.textPresence === "detected").length, textItemCount, boundedCharacterCount, firstPageHasRasterImage: pages.some((page) => page.pageNumber === 1 && page.rasterSignals > 0), rasterPages: rasterPageCount, protected: encryptionDetected };
    const classification = asset?.classification ?? classifyPdf(signals);
    const textPresence: PdfSignalStatus = textItemCount > 0 ? "detected" : textInspectionSucceeded ? "not-detected" : "unknown";
    const textAnalysis: PdfTextAnalysis = { status: textPresence, sampledPages: sampledPages.slice(), pagesWithText: pages.filter((page) => page.textPresence === "detected").length, boundedCharacterCount, textPages, note: sampledPages.length < pageCount ? `Text extraction is bounded to ${sampledPages.length} representative pages.` : "Text extraction is bounded per page and does not retain full document text." };
    const imageAnalysis = { status: rasterPageCount > 0 ? "detected" : rasterInspectionSucceeded ? "not-detected" : "unknown", sampledPages: sampledPages.slice(), rasterPageCount, highResolutionPageCount, imageSignals, estimatedImageBytes: null, note: "PDF.js exposed raster operator signals, but embedded image byte size and intrinsic dimensions remain unknown in this safe inspection path." } as PdfDocumentAnalysis["images"];
    const fontAnalysis: PdfFontAnalysis = { status: fontSignalCount > 0 ? "detected" : "unknown", count: fontSignalCount > 0 ? fontSignalCount : null, embedded: "unknown", subset: "unknown", categories: [], note: fontSignalCount > 0 ? "Font usage operators were detected; embedded/subset status remains unknown and fonts are not rewritten." : "Font dictionaries are not rewritten or guessed in Phase 4; font optimization is not applied because preservation cannot be guaranteed." };
    const pageArea = pages.reduce((sum, page) => sum + page.widthPoints * page.heightPoints, 0);
    const layout: PdfLayoutSignals = { textDensity: pageArea > 0 ? boundedCharacterCount / pageArea : null, lineDensity: pageArea > 0 ? lineCount / pageArea : null, blockDensity: pageArea > 0 ? blockCount / pageArea : null, imageDensity: pageArea > 0 ? imageSignals.length / pageArea : null, whitespace: "unknown", repeatedHeaderFooter: "unknown", note: "Density signals are bounded heuristics from sampled text blocks and raster operators; whitespace and repeated headers/footers remain unknown without broader visual analysis." };
    const vectorSignals: PdfSignalStatus = vectorSignalCount > 0 ? "detected" : vectorInspectionSucceeded ? "not-detected" : "unknown";
    const preservationRisk = derivePreservationRisk({ classification, features: featureSignals, vectorSignals });
    const ocrReadiness: PdfDocumentAnalysis["ocrReadiness"] = pages.some((page) => page.ocrReadiness === "ocr-likely-useful") ? "ocr-likely-useful" : pages.some((page) => page.ocrReadiness === "ocr-uncertain") ? "ocr-uncertain" : textPresence === "detected" ? "ocr-probably-unnecessary" : "unknown";
    const optimizationOpportunities: PdfDocumentAnalysis["optimizationOpportunities"] = classification === "scanned" ? ["image-recompression", "image-resolution"] : classification === "mixed" ? ["image-recompression", "image-resolution", "safe-structural-preservation"] : textPresence === "detected" ? ["safe-structural-preservation", "metadata-cleanup"] : ["none"];
    const warnings = [...(asset?.warnings ?? [])];
    if (sampledPages.length < pageCount) warnings.push(`Advanced analysis sampled ${sampledPages.length} of ${pageCount} pages; the authoritative page count remains ${pageCount}.`);
    if (featureSignals.javascript === "detected") warnings.push("Document JavaScript/action signals were detected. SmartDocs never executes PDF JavaScript.");
    if (featureSignals.forms === "detected") warnings.push("Interactive form fields were detected; destructive rasterization is blocked by default.");
    if (featureSignals.embeddedFiles === "detected") warnings.push("Embedded files were detected and will not be modified.");
    if (featureSignals.bookmarks === "detected") warnings.push("Bookmarks/outlines were detected; structural candidates require preservation validation.");
    if (featureSignals.links === "detected") warnings.push("Links were detected; candidates must preserve them or be rejected.");
    const analysisWithoutInsights = { fileName: file.name, fileSizeBytes: file.size, pdfVersion: readPdfVersion(header), pageCount, classification, textPresence, textPageCount: pages.filter((page) => page.textPresence === "detected").length, rasterPageCount, vectorSignals, pageDimensions, pages: pages.slice(0, MAX_ANALYSIS_PAGE_RECORDS), features: featureSignals, metadata, images: imageAnalysis, fonts: fontAnalysis, text: textAnalysis, layout, structure: { pageGroups: pageRoleGroups(pages, pageCount), sampledPageCount: pages.length, exactPageCount: pageCount, note: sampledPages.length < pageCount ? "Page roles and groups are representative heuristics from sampled pages." : "Page roles and groups are deterministic heuristics from bounded page signals." }, ocrReadiness, preservationRisk, optimizationOpportunities, recommendation: recommendationFor(classification, preservationRisk.level, rasterPageCount, textAnalysis.pagesWithText, featureSignals.forms), insights: [], warnings, sampledPages, pagesAnalyzed: pages.length, processingBoundary: "browser-local" as const };
    const insights = buildDocumentInsights(analysisWithoutInsights);
    emitProgress(onProgress, { stage: "complete", completed: sampledPages.length, total: sampledPages.length, detail: "Advanced PDF analysis complete" });
    return { ...analysisWithoutInsights, insights };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
