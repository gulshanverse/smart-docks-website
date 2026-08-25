import { createFileId, getExtension } from "../../lib/file-utils";
import { MAX_INPUT_BYTES, SUPPORTED_IMAGE_TYPES, type FileAsset, type FileIntakeError, type SupportedImageMimeType } from "../../domain/files/types";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function isSupportedMime(value: string): value is SupportedImageMimeType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(value);
}

function signatureMatches(bytes: Uint8Array, mimeType: SupportedImageMimeType): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  if (mimeType === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

function imageError(code: FileIntakeError["code"], title: string, message: string, recovery: string): FileIntakeError {
  return { code, title, message, recovery };
}

export async function inspectImageFile(file: File): Promise<FileAsset | FileIntakeError> {
  if (!isSupportedMime(file.type)) {
    return imageError(
      "unsupported-format",
      "That file type is not supported yet.",
      "SmartDocs currently accepts JPEG, PNG, and WebP images.",
      "Choose a JPEG, PNG, or WebP file and try again.",
    );
  }

  if (file.size > MAX_INPUT_BYTES) {
    return imageError(
      "oversized-input",
      "This image is too large for local processing.",
      `The current browser limit is ${Math.round(MAX_INPUT_BYTES / 1_000_000)} MB.`,
      "Choose a smaller image or resize it before bringing it into SmartDocs.",
    );
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!signatureMatches(header, file.type)) {
    return imageError(
      "invalid-image",
      "The file content does not match its declared image type.",
      "SmartDocs rejected the file instead of trusting its filename or MIME label.",
      "Export the image again as a valid JPEG, PNG, or WebP and retry.",
    );
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(previewUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      URL.revokeObjectURL(previewUrl);
      return imageError(
        "invalid-image",
        "The image has no usable dimensions.",
        "The browser decoded the file but could not find a usable image frame.",
        "Choose a different image and try again.",
      );
    }

    return {
      id: createFileId(),
      name: file.name,
      mimeType: file.type,
      extension: getExtension(file.name),
      sizeBytes: file.size,
      width: image.naturalWidth,
      height: image.naturalHeight,
      category: "image",
      previewUrl,
      capabilities: { compressToTarget: true },
    };
  } catch {
    URL.revokeObjectURL(previewUrl);
    return imageError(
      "decode-failure",
      "The browser could not decode this image.",
      "The file may be corrupt or encoded in a way this browser cannot read.",
      "Open the image in another app, export it again, and retry.",
    );
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failure"));
    image.src = url;
  });
}
