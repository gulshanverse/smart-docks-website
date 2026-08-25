import type { SupportedImageMimeType, SupportedPdfMimeType } from "../files/types";

export type ToolId = "image.compress.target_size" | "pdf.inspect" | "pdf.inspect.page" | "pdf.render.preview" | "pdf.delete.pages" | "pdf.extract.pages" | "pdf.reorder.pages" | "pdf.rotate.pages";
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

export const pdfPreviewTool: ToolDefinition = {
  id: "pdf.render.preview",
  inputCategory: "pdf",
  outputCategory: "preview",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumber", "renderScale"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const toolRegistry = [imageTargetCompressionTool, pdfInspectTool, pdfPageInspectTool, pdfPreviewTool, pdfDeletePagesTool, pdfExtractPagesTool, pdfReorderPagesTool, pdfRotatePagesTool] as const;
