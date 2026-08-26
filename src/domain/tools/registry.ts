import type { SupportedImageMimeType, SupportedPdfMimeType } from "../files/types";

export type ToolId = "image.compress.target_size" | "pdf.inspect" | "pdf.inspect.page" | "pdf.render.preview" | "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages" | "pdf.merge" | "pdf.split" | "pdf.render.images" | "image.create.pdf" | "pdf.detect.blank_pages" | "pdf.remove.blank_pages" | "pdf.analyze.optimization" | "pdf.optimize.target_size" | "pdf.analyze.advanced" | "pdf.inspect.images" | "pdf.inspect.fonts" | "pdf.inspect.features" | "pdf.extract.bounded_text" | "pdf.analyze.layout" | "pdf.analyze.ocr_readiness" | "pdf.plan.optimization" | "pdf.generate.candidates" | "pdf.validate.preservation" | "pdf.compare" | "intelligence.snapshot" | "pdf.ocr.inspect" | "pdf.ocr.plan" | "pdf.ocr.recognize" | "pdf.ocr.create_searchable" | "pdf.ocr.validate" | "pdf.text.extract" | "pdf.text.search" | "pdf.structure.analyze" | "pdf.document.classify";
export type ToolInputCategory = "image" | "pdf";

export interface ToolDefinition {
  id: ToolId;
  inputCategory: ToolInputCategory;
  outputCategory: "image" | "pdf" | "preview";
  supportedFormats: readonly (SupportedImageMimeType | SupportedPdfMimeType)[];
  parameters: readonly string[];
  processingBoundary: "browser-local";
  batchSupport: false;
}

export const imageTargetCompressionTool: ToolDefinition = {
  id: "image.compress.target_size",
  inputCategory: "image",
  outputCategory: "image",
  supportedFormats: ["image/jpeg", "image/png", "image/webp"],
  parameters: ["targetBytes", "preserveQuality"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfInspectTool: ToolDefinition = {
  id: "pdf.inspect",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["samplePages", "textSampleLimit"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfPageInspectTool: ToolDefinition = {
  id: "pdf.inspect.page",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumber", "textSampleLimit"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfDeletePagesTool: ToolDefinition = {
  id: "pdf.delete.pages",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["selectedPageNumbers"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfExtractPagesTool: ToolDefinition = {
  id: "pdf.extract.pages",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["selectedPageNumbers"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfReorderPagesTool: ToolDefinition = {
  id: "pdf.reorder.pages",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["pageOrder"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfRotatePagesTool: ToolDefinition = {
  id: "pdf.rotate.pages",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["selectedPageNumbers", "rotationDegrees"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfMergeTool: ToolDefinition = {
  id: "pdf.merge",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["orderedInputFiles", "preserveMetadata"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfSplitTool: ToolDefinition = {
  id: "pdf.split",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["pageRanges"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfRenderImagesTool: ToolDefinition = {
  id: "pdf.render.images",
  inputCategory: "pdf",
  outputCategory: "image",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumbers", "format", "resolution"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const imageCreatePdfTool: ToolDefinition = {
  id: "image.create.pdf",
  inputCategory: "image",
  outputCategory: "pdf",
  supportedFormats: ["image/jpeg", "image/png"],
  parameters: ["orderedInputFiles", "pagePolicy"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfDetectBlankPagesTool: ToolDefinition = {
  id: "pdf.detect.blank_pages",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumbers"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfRemoveBlankPagesTool: ToolDefinition = {
  id: "pdf.remove.blank_pages",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["confirmedPageNumbers"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfAnalyzeOptimizationTool: ToolDefinition = {
  id: "pdf.analyze.optimization",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["pageCount", "classification", "imageHeavyPages", "optimizationOpportunities"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfOptimizeTargetSizeTool: ToolDefinition = {
  id: "pdf.optimize.target_size",
  inputCategory: "pdf",
  outputCategory: "pdf",
  supportedFormats: ["application/pdf"],
  parameters: ["targetBytes", "qualityMode", "metadataPolicy", "qualityFloor"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const pdfAdvancedAnalyzeTool: ToolDefinition = { id: "pdf.analyze.advanced", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["samplePages", "featureSignals", "preservationRisk", "intelligenceSnapshot"], processingBoundary: "browser-local", batchSupport: false };
export const pdfImageInspectTool: ToolDefinition = { id: "pdf.inspect.images", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["samplePages", "rasterSignals", "highResolutionPageCount"], processingBoundary: "browser-local", batchSupport: false };
export const pdfFontInspectTool: ToolDefinition = { id: "pdf.inspect.fonts", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["fontCount", "embeddedSignal", "subsetSignal"], processingBoundary: "browser-local", batchSupport: false };
export const pdfFeatureInspectTool: ToolDefinition = { id: "pdf.inspect.features", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["annotations", "links", "forms", "bookmarks", "embeddedFiles", "javascript", "metadata"], processingBoundary: "browser-local", batchSupport: false };
export const pdfBoundedTextTool: ToolDefinition = { id: "pdf.extract.bounded_text", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["samplePages", "characterLimit", "blockLimit"], processingBoundary: "browser-local", batchSupport: false };
export const pdfLayoutAnalyzeTool: ToolDefinition = { id: "pdf.analyze.layout", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["textDensity", "lineDensity", "blockDensity", "imageDensity"], processingBoundary: "browser-local", batchSupport: false };
export const pdfOcrReadinessTool: ToolDefinition = { id: "pdf.analyze.ocr_readiness", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageSignals", "ocrReadiness"], processingBoundary: "browser-local", batchSupport: false };
export const pdfAdvancedPlanTool: ToolDefinition = { id: "pdf.plan.optimization", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["eligibleOperations", "blockedOperations", "preservationRequirements", "expectedRisks", "validationRequirements"], processingBoundary: "browser-local", batchSupport: false };
export const pdfCandidateTool: ToolDefinition = { id: "pdf.generate.candidates", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["qualityMode", "boundedCandidateCount", "eligiblePages"], processingBoundary: "browser-local", batchSupport: false };
export const pdfPreservationValidationTool: ToolDefinition = { id: "pdf.validate.preservation", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageCount", "text", "links", "forms", "bookmarks", "metadata", "representativePages"], processingBoundary: "browser-local", batchSupport: false };
export const pdfCompareTool: ToolDefinition = { id: "pdf.compare", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["before", "after", "featureChanges"], processingBoundary: "browser-local", batchSupport: false };
export const intelligenceSnapshotTool: ToolDefinition = { id: "intelligence.snapshot", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["boundedSerializableAnalysis"], processingBoundary: "browser-local", batchSupport: false };
export const pdfOcrInspectTool: ToolDefinition = { id: "pdf.ocr.inspect", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["ocrReadiness", "pageStatuses", "language"], processingBoundary: "browser-local", batchSupport: false };
export const pdfOcrPlanTool: ToolDefinition = { id: "pdf.ocr.plan", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["language", "plannedPages", "skippedPages", "maxPagesPerRun"], processingBoundary: "browser-local", batchSupport: false };
export const pdfOcrRecognizeTool: ToolDefinition = { id: "pdf.ocr.recognize", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["language", "pageResults", "progress", "cancellation"], processingBoundary: "browser-local", batchSupport: false };
export const pdfOcrSearchableTool: ToolDefinition = { id: "pdf.ocr.create_searchable", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["language", "transparentTextLayer", "visualAppearance"], processingBoundary: "browser-local", batchSupport: false };
export const pdfOcrValidateTool: ToolDefinition = { id: "pdf.ocr.validate", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageCount", "dimensions", "textPresence", "characterCount", "representativeRenders"], processingBoundary: "browser-local", batchSupport: false };
export const pdfTextExtractTool: ToolDefinition = { id: "pdf.text.extract", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["boundedText", "pageResults"], processingBoundary: "browser-local", batchSupport: false };
export const pdfTextSearchTool: ToolDefinition = { id: "pdf.text.search", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["query", "boundedMatches", "pageNavigation"], processingBoundary: "browser-local", batchSupport: false };
export const pdfStructureAnalyzeTool: ToolDefinition = { id: "pdf.structure.analyze", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["documentType", "sections", "tableLikeRegions", "signatureLikeRegions"], processingBoundary: "browser-local", batchSupport: false };
export const pdfDocumentClassifyTool: ToolDefinition = { id: "pdf.document.classify", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["likelyType", "confidence"], processingBoundary: "browser-local", batchSupport: false };

export const pdfPreviewTool: ToolDefinition = {
  id: "pdf.render.preview",
  inputCategory: "pdf",
  outputCategory: "preview",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumber", "renderScale"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const toolRegistry = [imageTargetCompressionTool, pdfInspectTool, pdfPageInspectTool, pdfPreviewTool, pdfDeletePagesTool, pdfExtractPagesTool, pdfReorderPagesTool, pdfRotatePagesTool, pdfMergeTool, pdfSplitTool, pdfRenderImagesTool, imageCreatePdfTool, pdfDetectBlankPagesTool, pdfRemoveBlankPagesTool, pdfAnalyzeOptimizationTool, pdfOptimizeTargetSizeTool, pdfAdvancedAnalyzeTool, pdfImageInspectTool, pdfFontInspectTool, pdfFeatureInspectTool, pdfBoundedTextTool, pdfLayoutAnalyzeTool, pdfOcrReadinessTool, pdfAdvancedPlanTool, pdfCandidateTool, pdfPreservationValidationTool, pdfCompareTool, intelligenceSnapshotTool, pdfOcrInspectTool, pdfOcrPlanTool, pdfOcrRecognizeTool, pdfOcrSearchableTool, pdfOcrValidateTool, pdfTextExtractTool, pdfTextSearchTool, pdfStructureAnalyzeTool, pdfDocumentClassifyTool] as const;
