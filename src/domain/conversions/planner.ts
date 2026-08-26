import { parsePageRanges } from "../pdfs/core";
import { findImageConversionCapability } from "./capabilities";
import {
  CONVERSION_BOUNDARY,
  CONVERSION_CONTRACT_VERSION,
  MAX_CONVERSION_FILES,
  MAX_CONVERSION_INPUT_BYTES,
  MAX_CONVERSION_MARGIN_POINTS,
  MAX_CONVERSION_PAGES,
  MAX_CONVERSION_PIXEL_DIMENSION,
  MAX_CONVERSION_TOTAL_PIXELS,
  type ConversionBackground,
  type ConversionIntent,
  type ConversionPageSelection,
  type ConversionPlan,
  type ConversionQuality,
  type ConversionResolution,
  type ConversionSource,
  type ConversionTargetSize,
} from "./types";

export interface ConversionPlanOptions {
  currentPage?: number;
  selectedPages?: readonly number[];
  planId?: string;
  metadataPolicy?: "preserve-basic" | "discard";
}

export interface ConversionPlanError {
  code: "invalid-source" | "unsupported-combination" | "invalid-selection" | "conflict" | "workload-limit";
  message: string;
}

function error(code: ConversionPlanError["code"], message: string): { error: ConversionPlanError } {
  return { error: { code, message } };
}

function defaultQuality(value: ConversionQuality | null, targetSize: ConversionTargetSize | null): ConversionQuality {
  if (value) return value;
  return targetSize ? "balanced" : "balanced";
}

function defaultResolution(value: ConversionResolution | null): ConversionResolution {
  return value ?? "150dpi";
}

function defaultBackground(value: ConversionBackground | null, outputFormat: ConversionPlan["outputFormat"]): ConversionBackground | null {
  if (outputFormat === "jpeg") return value ?? "white";
  return outputFormat === "pdf" ? value ?? "white" : null;
}

function stablePlanId(sources: readonly ConversionSource[], outputFormat: string): string {
  const stem = sources[0]?.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "document";
  return `conversion-${stem}-${outputFormat}`;
}

function pageSelectionFor(intent: ConversionIntent, source: ConversionSource, options: ConversionPlanOptions): { selection: ConversionPageSelection } | { error: ConversionPlanError } {
  if (source.inputFormat !== "pdf" || source.pageCount === null) return { selection: { kind: "all", pageNumbers: [], sourcePageCount: 0 } };
  const pageCount = source.pageCount;
  const requested = intent.pageSelection;
  if (requested.kind === "current") {
    const page = options.currentPage ?? 1;
    if (!Number.isInteger(page) || page < 1 || page > pageCount) return error("invalid-selection", `Current page must be between 1 and ${pageCount}.`);
    return { selection: { kind: "current", pageNumbers: [page], sourcePageCount: pageCount } };
  }
  if (requested.kind === "selected") {
    const selected = [...new Set(options.selectedPages ?? [])].sort((a, b) => a - b);
    if (selected.length === 0) return error("invalid-selection", "Select at least one PDF page before converting.");
    if (selected.some((page) => !Number.isInteger(page) || page < 1 || page > pageCount)) return error("invalid-selection", `Selected pages must be between 1 and ${pageCount}.`);
    if (selected.length > MAX_CONVERSION_PAGES) return error("workload-limit", `Conversion is limited to ${MAX_CONVERSION_PAGES} PDF pages per foreground operation.`);
    return { selection: { kind: "selected", pageNumbers: selected, sourcePageCount: pageCount } };
  }
  if (requested.kind === "range" && requested.value) {
    const parsed = parsePageRanges(requested.value, pageCount);
    if ("error" in parsed) return error("invalid-selection", parsed.error);
    const pageNumbers = parsed.ranges.flatMap((range) => Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index));
    if (pageNumbers.length > MAX_CONVERSION_PAGES) return error("workload-limit", `Conversion is limited to ${MAX_CONVERSION_PAGES} PDF pages per foreground operation.`);
    return { selection: { kind: "range", pageNumbers, sourcePageCount: pageCount } };
  }
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  if (pageNumbers.length > MAX_CONVERSION_PAGES) return error("workload-limit", `Select at most ${MAX_CONVERSION_PAGES} PDF pages for a browser-local conversion.`);
  return { selection: { kind: "all", pageNumbers, sourcePageCount: pageCount } };
}

export function createConversionPlan(sources: readonly ConversionSource[], intent: ConversionIntent, options: ConversionPlanOptions = {}): { plan: ConversionPlan } | { error: ConversionPlanError } {
  if (sources.length === 0) return error("invalid-source", "Add at least one supported image or PDF before converting.");
  if (sources.length > MAX_CONVERSION_FILES) return error("workload-limit", `Batch conversion is limited to ${MAX_CONVERSION_FILES} files.`);
  if (sources.some((source) => !source.id || !source.name || source.sizeBytes <= 0 || !Number.isFinite(source.sizeBytes))) return error("invalid-source", "Every source must have a valid identity and non-zero size.");
  const totalBytes = sources.reduce((sum, source) => sum + source.sizeBytes, 0);
  if (totalBytes > MAX_CONVERSION_INPUT_BYTES) return error("workload-limit", "This conversion exceeds the 50 MiB browser-local workload limit.");
  if (sources.some((source) => source.width !== null && source.height !== null && (source.width > MAX_CONVERSION_PIXEL_DIMENSION || source.height > MAX_CONVERSION_PIXEL_DIMENSION))) return error("workload-limit", `Images are limited to ${MAX_CONVERSION_PIXEL_DIMENSION}px per dimension for safe browser-local conversion.`);
  if (sources.some((source) => source.width !== null && source.height !== null && source.width * source.height > MAX_CONVERSION_TOTAL_PIXELS)) return error("workload-limit", "An image exceeds the safe browser-local pixel budget.");

  const hasPdf = sources.some((source) => source.inputFormat === "pdf");
  const hasImage = sources.some((source) => source.inputFormat === "image");
  const outputFormat = intent.targetFormat;
  if (!outputFormat) return error("unsupported-combination", "Choose an output format before converting.");
  if (hasPdf && hasImage) return error("unsupported-combination", "Combine either images or a PDF, not mixed source categories, in one conversion.");
  if (hasPdf && sources.length !== 1) return error("unsupported-combination", "The basic PDF conversion path accepts one PDF; use PDF merge for multiple PDFs.");
  if (hasPdf && outputFormat === "pdf") return error("unsupported-combination", "PDF to PDF is not part of the basic conversion path; use the existing PDF operations instead.");
  if (hasImage && outputFormat !== "pdf" && sources.length > 1) return error("unsupported-combination", "Multiple images can be combined into one PDF, but are not batch-converted to separate image outputs in this workspace.");
  const sourceFormat = sources[0].mimeType === "image/jpeg" ? "jpeg" : sources[0].mimeType === "image/png" ? "png" : sources[0].mimeType === "image/webp" ? "webp" : null;
  if (hasImage && outputFormat !== "pdf" && !findImageConversionCapability(sources[0].mimeType, outputFormat) && sourceFormat !== outputFormat) return error("unsupported-combination", `The selected ${sources[0].mimeType} to ${outputFormat} path is not available.`);
  if (hasImage && outputFormat === "pdf" && sources.some((source) => source.mimeType === "application/pdf")) return error("unsupported-combination", "Only supported images may be placed into an image-to-PDF collection.");
  if (hasPdf && !findImageConversionCapability("application/pdf", outputFormat) && !["jpeg", "png", "webp"].includes(outputFormat)) return error("unsupported-combination", `PDF to ${outputFormat} is not available.`);
  if (outputFormat === "jpeg" && intent.background === "transparent") return error("conflict", "JPEG cannot preserve transparency. Choose a white or black background.");
  if (intent.pageSize === "original" && intent.orientation && intent.orientation !== "auto") return error("conflict", "Original image size conflicts with an explicit PDF page orientation. Choose automatic orientation or a named page size.");

  const source = sources[0];
  const pageResult = pageSelectionFor(intent, source, options);
  if ("error" in pageResult) return pageResult;
  const selection = pageResult.selection;
  const operation = hasPdf ? "pdf-to-image" : outputFormat === "pdf" ? "image-to-pdf" : "image-to-image";
  const quality = defaultQuality(intent.quality, intent.targetSize);
  const resolution = operation === "pdf-to-image" ? defaultResolution(intent.resolution) : null;
  const pageSize = operation === "image-to-pdf" ? intent.pageSize ?? "A4" : null;
  const orientation = operation === "image-to-pdf" ? intent.orientation ?? "auto" : null;
  const fitMode = operation === "image-to-pdf" ? intent.fitMode ?? "contain" : null;
  const marginPoints = operation === "image-to-pdf" ? Math.min(MAX_CONVERSION_MARGIN_POINTS, Math.max(0, intent.marginPoints ?? 18)) : null;
  const background = defaultBackground(intent.background, outputFormat);
  const expectedOutputCount = operation === "pdf-to-image" ? selection.pageNumbers.length : operation === "image-to-pdf" ? sources.length : 1;
  const expectedPageCount = operation === "image-to-pdf" ? sources.length : null;
  const strategy = operation === "pdf-to-image" ? "pdfjs-render" : operation === "image-to-pdf" ? "pdf-page-authoring" : "direct-canvas";
  const warnings: string[] = ["Conversion runs in the browser foreground; no source file upload is used."];
  if (outputFormat === "jpeg" && (source.mimeType === "image/png" || source.mimeType === "image/webp")) warnings.push("JPEG does not support transparency; the selected background will be applied.");
  if (operation === "pdf-to-image") warnings.push("PDF pages are rasterized; editable text, links, forms, and some interactive features do not survive image conversion.");
  if (operation === "image-to-pdf") warnings.push("Images become image-only PDF pages; searchability is not added automatically. Canvas conversion may remove image metadata.");
  if (intent.targetSize) warnings.push(`The ${intent.targetSize.scope} target is a hard constraint; quality preference is secondary.`);
  const pageNumbers = selection.pageNumbers;
  const plan: ConversionPlan = {
    contractVersion: CONVERSION_CONTRACT_VERSION,
    planId: options.planId ?? stablePlanId(sources, outputFormat),
    operation,
    sourceFiles: sources.map((item, index) => ({ ...item, order: index })),
    inputFormat: hasPdf ? "pdf" : sources.length > 1 ? "image-collection" : "image",
    outputFormat,
    pageSelection: { ...selection, pageNumbers },
    ordering: sources.map((sourceItem) => sourceItem.id),
    quality,
    resolution,
    pageSize,
    orientation,
    fitMode,
    marginPoints,
    background,
    targetSize: intent.targetSize,
    metadataPolicy: options.metadataPolicy ?? "discard",
    processingBoundary: CONVERSION_BOUNDARY,
    validationPolicy: { expectedOutputFormat: outputFormat, expectedOutputCount, expectedPageCount, requireDecode: true, requireNonZeroBytes: true, requireRepresentativePreview: true, maxPixelDimension: MAX_CONVERSION_PIXEL_DIMENSION, maxTotalPixels: MAX_CONVERSION_TOTAL_PIXELS },
    warnings,
    strategy,
  };
  return { plan };
}
