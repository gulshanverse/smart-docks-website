export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export type FileCategory = "image";

export interface FileAsset {
  id: string;
  name: string;
  mimeType: SupportedImageMimeType;
  extension: string;
  sizeBytes: number;
  width: number;
  height: number;
  category: FileCategory;
  previewUrl: string;
  capabilities: {
    compressToTarget: true;
  };
}

export type FileIntakeErrorCode =
  | "unsupported-format"
  | "oversized-input"
  | "invalid-image"
  | "decode-failure";

export interface FileIntakeError {
  code: FileIntakeErrorCode;
  title: string;
  message: string;
  recovery: string;
}
