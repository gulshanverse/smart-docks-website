import type { SupportedImageMimeType } from "../files/types";

export interface ToolDefinition {
  id: "image.compress.target_size";
  inputCategory: "image";
  outputCategory: "image";
  supportedFormats: readonly SupportedImageMimeType[];
  parameters: readonly ["targetBytes", "preserveQuality"];
  localProcessing: true;
  batchSupport: false;
}

export const imageTargetCompressionTool: ToolDefinition = {
  id: "image.compress.target_size",
  inputCategory: "image",
  outputCategory: "image",
  supportedFormats: ["image/jpeg", "image/png", "image/webp"],
  parameters: ["targetBytes", "preserveQuality"],
  localProcessing: true,
  batchSupport: false,
};

export const toolRegistry = [imageTargetCompressionTool] as const;
