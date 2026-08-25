import type { SupportedImageMimeType, SupportedPdfMimeType } from "../files/types";

export type ToolId = "image.compress.target_size" | "pdf.inspect" | "pdf.render.preview";
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

export const pdfPreviewTool: ToolDefinition = {
  id: "pdf.render.preview",
  inputCategory: "pdf",
  outputCategory: "preview",
  supportedFormats: ["application/pdf"],
  parameters: ["pageNumber", "renderScale"],
  processingBoundary: "browser-local",
  batchSupport: false,
};

export const toolRegistry = [imageTargetCompressionTool, pdfInspectTool, pdfPreviewTool] as const;
