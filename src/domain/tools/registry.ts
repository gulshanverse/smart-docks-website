import type { SupportedImageMimeType, SupportedPdfMimeType } from "../files/types";

export type ToolId = "image.compress.target_size" | "pdf.inspect" | "pdf.inspect.page" | "pdf.render.preview" | "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages" | "pdf.merge" | "pdf.split" | "pdf.render.images" | "image.create.pdf" | "pdf.detect.blank_pages" | "pdf.remove.blank_pages" | "pdf.analyze.optimization" | "pdf.optimize.target_size";
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

export const pdfPreviewTool: ToolDefinition = {
  id: "pdf.render.preview",
  inputCategory: "pdf",
  outputCategory: "preview",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumber", "renderScale"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const toolRegistry = [imageTargetCompressionTool, pdfInspectTool, pdfPageInspectTool, pdfPreviewTool, pdfDeletePagesTool, pdfExtractPagesTool, pdfReorderPagesTool, pdfRotatePagesTool, pdfMergeTool, pdfSplitTool, pdfRenderImagesTool, imageCreatePdfTool, pdfDetectBlankPagesTool, pdfRemoveBlankPagesTool, pdfAnalyzeOptimizationTool, pdfOptimizeTargetSizeTool] as const;
