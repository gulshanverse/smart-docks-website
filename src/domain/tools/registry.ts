import type { SupportedImageMimeType, SupportedPdfMimeType } from "../files/types";
import type { OfficeMimeType } from "../office/types";

export type ToolId = "image.compress.target_size" | "image.convert.jpeg_to_png" | "image.convert.jpeg_to_webp" | "image.convert.png_to_jpeg" | "image.convert.png_to_webp" | "image.convert.webp_to_jpeg" | "image.convert.webp_to_png" | "pdf.convert.pages_to_jpeg" | "pdf.convert.pages_to_png" | "pdf.convert.pages_to_webp" | "image.convert.to_pdf" | "pdf.inspect" | "pdf.inspect.page" | "pdf.render.preview" | "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages" | "pdf.merge" | "pdf.split" | "pdf.render.images" | "image.create.pdf" | "pdf.detect.blank_pages" | "pdf.remove.blank_pages" | "pdf.analyze.optimization" | "pdf.optimize.target_size" | "pdf.analyze.advanced" | "pdf.inspect.images" | "pdf.inspect.fonts" | "pdf.inspect.features" | "pdf.extract.bounded_text" | "pdf.analyze.layout" | "pdf.analyze.ocr_readiness" | "pdf.plan.optimization" | "pdf.generate.candidates" | "pdf.validate.preservation" | "pdf.compare" | "intelligence.snapshot" | "pdf.ocr.inspect" | "pdf.ocr.plan" | "pdf.ocr.recognize" | "pdf.ocr.create_searchable" | "pdf.ocr.validate" | "pdf.text.extract" | "pdf.text.search" | "pdf.structure.analyze" | "pdf.document.classify" | "ai.document.classify" | "ai.document.summarize" | "ai.document.extract" | "ai.document.ask" | "ai.document.structure" | "pdf.redact.region" | "pdf.highlight.region" | "pdf.annotate.text" | "pdf.annotate.shape" | "pdf.annotate.note" | "pdf.crop" | "pdf.resize" | "pdf.metadata.update" | "pdf.metadata.remove-basic" | "office.inspect.word" | "office.inspect.presentation" | "office.inspect.spreadsheet" | "office.extract.text" | "office.extract.cells" | "office.preview.word" | "office.preview.presentation" | "office.preview.spreadsheet" | "office.validate" | "document.extract" | "document.extract.invoice" | "document.extract.receipt" | "document.extract.contract" | "document.extract.resume" | "document.extract.table" | "document.extract.collection" | "document.validate.extraction" | "document.export.json" | "document.export.csv" | "automation.session.create" | "automation.session.checkpoint" | "automation.session.resume" | "automation.session.pause" | "automation.session.cancel" | "automation.step.retry" | "automation.review.request" | "automation.review.resolve" | "automation.quality.validate" | "automation.reconcile.documents" | "automation.evidence.resolve" | "automation.report.generate" | "project.create" | "project.open" | "project.update" | "project.archive" | "project.delete" | "project.restore" | "project.document.add" | "project.document.remove" | "project.document.version" | "project.document.export" | "project.workflow.save" | "project.workflow.resume" | "project.workflow.retry" | "project.history.list" | "project.export" | "project.import" | "project.storage.inspect" | "project.cleanup";
export type ToolInputCategory = "image" | "pdf" | "office" | "document";

export interface ToolDefinition {
  id: ToolId;
  inputCategory: ToolInputCategory;
  outputCategory: "image" | "pdf" | "preview" | "text" | "structured-data";
  supportedFormats: readonly (SupportedImageMimeType | SupportedPdfMimeType | OfficeMimeType)[];
  parameters: readonly string[];
  processingBoundary: "browser-local" | "server-assisted";
  batchSupport: boolean;
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
export const aiDocumentClassifyTool: ToolDefinition = { id: "ai.document.classify", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["boundedContext", "consent", "provenance"], processingBoundary: "server-assisted", batchSupport: false };
export const aiDocumentSummarizeTool: ToolDefinition = { id: "ai.document.summarize", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["boundedContext", "consent", "provenance"], processingBoundary: "server-assisted", batchSupport: false };
export const aiDocumentExtractTool: ToolDefinition = { id: "ai.document.extract", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["schemaId", "boundedContext", "consent", "provenance"], processingBoundary: "server-assisted", batchSupport: false };
export const aiDocumentAskTool: ToolDefinition = { id: "ai.document.ask", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["query", "boundedContext", "consent", "provenance"], processingBoundary: "server-assisted", batchSupport: false };
export const aiDocumentStructureTool: ToolDefinition = { id: "ai.document.structure", inputCategory: "pdf", outputCategory: "preview", supportedFormats: ["application/pdf"], parameters: ["boundedContext", "consent", "provenance"], processingBoundary: "server-assisted", batchSupport: false };

export const pdfRedactRegionTool: ToolDefinition = { id: "pdf.redact.region", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageIdentity", "rect", "optionalTargetText", "review", "validation"], processingBoundary: "browser-local", batchSupport: false };
export const pdfHighlightRegionTool: ToolDefinition = { id: "pdf.highlight.region", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageIdentity", "rect", "opacity"], processingBoundary: "browser-local", batchSupport: false };
export const pdfAnnotateTextTool: ToolDefinition = { id: "pdf.annotate.text", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageIdentity", "rect", "text", "fontSize"], processingBoundary: "browser-local", batchSupport: false };
export const pdfAnnotateShapeTool: ToolDefinition = { id: "pdf.annotate.shape", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageIdentity", "rect", "shape", "color"], processingBoundary: "browser-local", batchSupport: false };
export const pdfAnnotateNoteTool: ToolDefinition = { id: "pdf.annotate.note", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageIdentity", "rect", "text", "fontSize"], processingBoundary: "browser-local", batchSupport: false };
export const pdfCropTool: ToolDefinition = { id: "pdf.crop", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageIdentity", "rect", "preview", "geometryValidation"], processingBoundary: "browser-local", batchSupport: false };
export const pdfResizeTool: ToolDefinition = { id: "pdf.resize", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["pageSize", "preserveAspectRatio"], processingBoundary: "browser-local", batchSupport: false };
export const pdfMetadataUpdateTool: ToolDefinition = { id: "pdf.metadata.update", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["basicFields", "metadataPolicy"], processingBoundary: "browser-local", batchSupport: false };
export const pdfMetadataRemoveTool: ToolDefinition = { id: "pdf.metadata.remove-basic", inputCategory: "pdf", outputCategory: "pdf", supportedFormats: ["application/pdf"], parameters: ["basicFields", "unknownStreamsWarning"], processingBoundary: "browser-local", batchSupport: false };

const conversionImageFormats = ["image/jpeg", "image/png", "image/webp"] as const;
export const imageJpegToPngTool: ToolDefinition = { id: "image.convert.jpeg_to_png", inputCategory: "image", outputCategory: "image", supportedFormats: conversionImageFormats, parameters: ["outputFormat", "quality", "targetSize", "background"], processingBoundary: "browser-local", batchSupport: true };
export const imageJpegToWebpTool: ToolDefinition = { id: "image.convert.jpeg_to_webp", inputCategory: "image", outputCategory: "image", supportedFormats: conversionImageFormats, parameters: ["outputFormat", "quality", "targetSize"], processingBoundary: "browser-local", batchSupport: true };
export const imagePngToJpegTool: ToolDefinition = { id: "image.convert.png_to_jpeg", inputCategory: "image", outputCategory: "image", supportedFormats: conversionImageFormats, parameters: ["outputFormat", "quality", "targetSize", "background"], processingBoundary: "browser-local", batchSupport: true };
export const imagePngToWebpTool: ToolDefinition = { id: "image.convert.png_to_webp", inputCategory: "image", outputCategory: "image", supportedFormats: conversionImageFormats, parameters: ["outputFormat", "quality", "targetSize"], processingBoundary: "browser-local", batchSupport: true };
export const imageWebpToJpegTool: ToolDefinition = { id: "image.convert.webp_to_jpeg", inputCategory: "image", outputCategory: "image", supportedFormats: conversionImageFormats, parameters: ["outputFormat", "quality", "targetSize", "background"], processingBoundary: "browser-local", batchSupport: true };
export const imageWebpToPngTool: ToolDefinition = { id: "image.convert.webp_to_png", inputCategory: "image", outputCategory: "image", supportedFormats: conversionImageFormats, parameters: ["outputFormat", "quality", "targetSize"], processingBoundary: "browser-local", batchSupport: true };
export const pdfPagesToJpegTool: ToolDefinition = { id: "pdf.convert.pages_to_jpeg", inputCategory: "pdf", outputCategory: "image", supportedFormats: ["application/pdf"], parameters: ["outputFormat", "resolution", "pageSelection", "quality", "targetSize"], processingBoundary: "browser-local", batchSupport: true };
export const pdfPagesToPngTool: ToolDefinition = { id: "pdf.convert.pages_to_png", inputCategory: "pdf", outputCategory: "image", supportedFormats: ["application/pdf"], parameters: ["outputFormat", "resolution", "pageSelection"], processingBoundary: "browser-local", batchSupport: true };
export const pdfPagesToWebpTool: ToolDefinition = { id: "pdf.convert.pages_to_webp", inputCategory: "pdf", outputCategory: "image", supportedFormats: ["application/pdf"], parameters: ["outputFormat", "resolution", "pageSelection", "quality", "targetSize"], processingBoundary: "browser-local", batchSupport: true };
export const imageToPdfConversionTool: ToolDefinition = { id: "image.convert.to_pdf", inputCategory: "image", outputCategory: "pdf", supportedFormats: conversionImageFormats, parameters: ["orderedInputFiles", "pageSize", "orientation", "fit", "margin", "background"], processingBoundary: "browser-local", batchSupport: true };

export const pdfPreviewTool: ToolDefinition = {
  id: "pdf.render.preview",
  inputCategory: "pdf",
  outputCategory: "preview",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumber", "renderScale"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const officeInspectWordTool: ToolDefinition = { id: "office.inspect.word", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], parameters: ["metadata", "paragraphs", "headings", "tables", "images", "hyperlinks", "sections", "warnings"], processingBoundary: "browser-local", batchSupport: false };
export const officeInspectPresentationTool: ToolDefinition = { id: "office.inspect.presentation", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], parameters: ["slideCount", "slideText", "shapes", "images", "charts", "notes", "themes", "warnings"], processingBoundary: "browser-local", batchSupport: false };
export const officeInspectSpreadsheetTool: ToolDefinition = { id: "office.inspect.spreadsheet", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], parameters: ["sheetCount", "hiddenSheets", "usedRanges", "formulas", "mergedCells", "boundedCells", "warnings"], processingBoundary: "browser-local", batchSupport: false };
export const officeExtractTextTool: ToolDefinition = { id: "office.extract.text", inputCategory: "office", outputCategory: "text", supportedFormats: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], parameters: ["boundedText", "sourceLocations"], processingBoundary: "browser-local", batchSupport: false };
export const officeExtractCellsTool: ToolDefinition = { id: "office.extract.cells", inputCategory: "office", outputCategory: "text", supportedFormats: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], parameters: ["selectedSheet", "boundedRange", "values", "formulas"], processingBoundary: "browser-local", batchSupport: false };
export const officePreviewWordTool: ToolDefinition = { id: "office.preview.word", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], parameters: ["sampledStructure", "interpretedPreview", "fidelityWarning"], processingBoundary: "browser-local", batchSupport: false };
export const officePreviewPresentationTool: ToolDefinition = { id: "office.preview.presentation", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], parameters: ["slideSummaries", "structuralPreview", "fidelityWarning"], processingBoundary: "browser-local", batchSupport: false };
export const officePreviewSpreadsheetTool: ToolDefinition = { id: "office.preview.spreadsheet", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], parameters: ["sheetPreview", "boundedRows", "boundedColumns", "fidelityWarning"], processingBoundary: "browser-local", batchSupport: false };
export const officeValidateTool: ToolDefinition = { id: "office.validate", inputCategory: "office", outputCategory: "preview", supportedFormats: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], parameters: ["zipStructure", "ooxmlMarkers", "parsedParts", "boundedLimits", "warnings"], processingBoundary: "browser-local", batchSupport: false };

const extractionFormats: readonly (SupportedImageMimeType | SupportedPdfMimeType | OfficeMimeType)[] = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const extractionTool = (id: ToolId, parameters: readonly string[], outputCategory: ToolDefinition["outputCategory"] = "structured-data"): ToolDefinition => ({ id, inputCategory: "document", outputCategory, supportedFormats: extractionFormats, parameters, processingBoundary: "browser-local", batchSupport: id === "document.extract.collection" });
export const documentExtractTool = extractionTool("document.extract", ["schemaId", "goal", "boundedSources"]);
export const documentExtractInvoiceTool = extractionTool("document.extract.invoice", ["schemaId", "invoiceFields", "evidence"]);
export const documentExtractReceiptTool = extractionTool("document.extract.receipt", ["schemaId", "receiptFields", "evidence"]);
export const documentExtractContractTool = extractionTool("document.extract.contract", ["schemaId", "contractFields", "evidence"]);
export const documentExtractResumeTool = extractionTool("document.extract.resume", ["schemaId", "resumeFields", "evidence"]);
export const documentExtractTableTool = extractionTool("document.extract.table", ["schemaId", "boundedRows", "evidence"]);
export const documentExtractCollectionTool = extractionTool("document.extract.collection", ["schemaId", "documentIds", "aggregationRules"]);
export const documentValidateExtractionTool = extractionTool("document.validate.extraction", ["schemaId", "records", "provenance", "warnings"], "structured-data");
export const documentExportJsonTool = extractionTool("document.export.json", ["records", "validation"], "text");
export const documentExportCsvTool = extractionTool("document.export.csv", ["records", "validation"], "text");
const automationTool = (id: ToolId, parameters: readonly string[], outputCategory: ToolDefinition["outputCategory"] = "structured-data"): ToolDefinition => ({ id, inputCategory: "document", outputCategory, supportedFormats: extractionFormats, parameters, processingBoundary: id.includes("review") || id.includes("session") ? "browser-local" : "browser-local", batchSupport: id === "automation.reconcile.documents" });
export const automationSessionCreateTool = automationTool("automation.session.create", ["workflowId", "boundedMetadata"]);
export const automationSessionCheckpointTool = automationTool("automation.session.checkpoint", ["sessionId", "stepStates", "artifactMetadata"]);
export const automationSessionResumeTool = automationTool("automation.session.resume", ["sessionId", "checkpointId"]);
export const automationSessionPauseTool = automationTool("automation.session.pause", ["sessionId", "checkpointId"]);
export const automationSessionCancelTool = automationTool("automation.session.cancel", ["sessionId", "reason"]);
export const automationStepRetryTool = automationTool("automation.step.retry", ["sessionId", "stepId", "attempt", "retryPolicy"]);
export const automationReviewRequestTool = automationTool("automation.review.request", ["sessionId", "reason", "evidence", "decision"]);
export const automationReviewResolveTool = automationTool("automation.review.resolve", ["sessionId", "checkpointId", "decision"]);
export const automationQualityValidateTool = automationTool("automation.quality.validate", ["sessionId", "qualityGates"]);
export const automationReconcileTool = automationTool("automation.reconcile.documents", ["documentIds", "fieldNames", "tolerance"]);
export const automationEvidenceTool = automationTool("automation.evidence.resolve", ["evidenceId", "documentId", "fieldId"], "preview");
export const automationReportTool = automationTool("automation.report.generate", ["sessionId", "qualityGates", "manifest"], "text");
const projectTool = (id: ToolId, parameters: readonly string[], outputCategory: ToolDefinition["outputCategory"] = "structured-data"): ToolDefinition => ({ id, inputCategory: "document", outputCategory, supportedFormats: extractionFormats, parameters, processingBoundary: "browser-local", batchSupport: false });
export const projectCreateTool = projectTool("project.create", ["name", "description", "localOnly"]);
export const projectOpenTool = projectTool("project.open", ["projectId"]);
export const projectUpdateTool = projectTool("project.update", ["projectId", "name", "description", "settings"]);
export const projectArchiveTool = projectTool("project.archive", ["projectId"]);
export const projectDeleteTool = projectTool("project.delete", ["projectId", "confirmation"]);
export const projectRestoreTool = projectTool("project.restore", ["projectId"]);
export const projectDocumentAddTool = projectTool("project.document.add", ["projectId", "explicitConsent", "signature", "bytes"]);
export const projectDocumentRemoveTool = projectTool("project.document.remove", ["projectId", "documentId", "confirmation"]);
export const projectDocumentVersionTool = projectTool("project.document.version", ["projectId", "documentId", "validatedArtifact"]);
export const projectDocumentExportTool = projectTool("project.document.export", ["projectId", "documentId"], "text");
export const projectWorkflowSaveTool = projectTool("project.workflow.save", ["projectId", "workflowMetadata"]);
export const projectWorkflowResumeTool = projectTool("project.workflow.resume", ["projectId", "checkpointId"]);
export const projectWorkflowRetryTool = projectTool("project.workflow.retry", ["projectId", "workflowId", "failedStepIds"]);
export const projectHistoryListTool = projectTool("project.history.list", ["projectId"], "text");
export const projectExportTool = projectTool("project.export", ["projectId", "kind"], "text");
export const projectImportTool = projectTool("project.import", ["validatedPackage", "metadataOnly"], "structured-data");
export const projectStorageInspectTool = projectTool("project.storage.inspect", ["projectId"], "structured-data");
export const projectCleanupTool = projectTool("project.cleanup", ["projectId", "retentionPolicy"]);
export const toolRegistry = [automationSessionCreateTool, automationSessionCheckpointTool, automationSessionResumeTool, automationSessionPauseTool, automationSessionCancelTool, automationStepRetryTool, automationReviewRequestTool, automationReviewResolveTool, automationQualityValidateTool, automationReconcileTool, automationEvidenceTool, automationReportTool, projectCreateTool, projectOpenTool, projectUpdateTool, projectArchiveTool, projectDeleteTool, projectRestoreTool, projectDocumentAddTool, projectDocumentRemoveTool, projectDocumentVersionTool, projectDocumentExportTool, projectWorkflowSaveTool, projectWorkflowResumeTool, projectWorkflowRetryTool, projectHistoryListTool, projectExportTool, projectImportTool, projectStorageInspectTool, projectCleanupTool, documentExtractTool, documentExtractInvoiceTool, documentExtractReceiptTool, documentExtractContractTool, documentExtractResumeTool, documentExtractTableTool, documentExtractCollectionTool, documentValidateExtractionTool, documentExportJsonTool, documentExportCsvTool, officeInspectWordTool, officeInspectPresentationTool, officeInspectSpreadsheetTool, officeExtractTextTool, officeExtractCellsTool, officePreviewWordTool, officePreviewPresentationTool, officePreviewSpreadsheetTool, officeValidateTool, imageTargetCompressionTool, imageJpegToPngTool, imageJpegToWebpTool, imagePngToJpegTool, imagePngToWebpTool, imageWebpToJpegTool, imageWebpToPngTool, pdfPagesToJpegTool, pdfPagesToPngTool, pdfPagesToWebpTool, imageToPdfConversionTool, pdfInspectTool, pdfPageInspectTool, pdfPreviewTool, pdfDeletePagesTool, pdfExtractPagesTool, pdfReorderPagesTool, pdfRotatePagesTool, pdfMergeTool, pdfSplitTool, pdfRenderImagesTool, imageCreatePdfTool, pdfDetectBlankPagesTool, pdfRemoveBlankPagesTool, pdfAnalyzeOptimizationTool, pdfOptimizeTargetSizeTool, pdfAdvancedAnalyzeTool, pdfImageInspectTool, pdfFontInspectTool, pdfFeatureInspectTool, pdfBoundedTextTool, pdfLayoutAnalyzeTool, pdfOcrReadinessTool, pdfAdvancedPlanTool, pdfCandidateTool, pdfPreservationValidationTool, pdfCompareTool, intelligenceSnapshotTool, pdfOcrInspectTool, pdfOcrPlanTool, pdfOcrRecognizeTool, pdfOcrSearchableTool, pdfOcrValidateTool, pdfTextExtractTool, pdfTextSearchTool, pdfStructureAnalyzeTool, pdfDocumentClassifyTool, aiDocumentClassifyTool, aiDocumentSummarizeTool, aiDocumentExtractTool, aiDocumentAskTool, aiDocumentStructureTool, pdfRedactRegionTool, pdfHighlightRegionTool, pdfAnnotateTextTool, pdfAnnotateShapeTool, pdfAnnotateNoteTool, pdfCropTool, pdfResizeTool, pdfMetadataUpdateTool, pdfMetadataRemoveTool] as const;
