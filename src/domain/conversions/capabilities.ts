import type { ConversionFormat, ConversionInputFormat, ConversionOperation, ConversionQuality, ConversionResolution } from "./types";

export interface ConversionCapability {
  id: string;
  label: string;
  inputFormats: readonly ConversionInputFormat[];
  outputFormats: readonly ConversionFormat[];
  operation: ConversionOperation;
  processingBoundary: "browser-local";
  batchSupport: boolean;
  qualityPresets: readonly ConversionQuality[];
  resolutionPresets: readonly ConversionResolution[];
  pageSelection: boolean;
  transparencyBehavior: string;
  preservationImpact: string;
  expectedOutputType: "image" | "pdf";
  validationStrategy: string;
}

const IMAGE_QUALITY: readonly ConversionQuality[] = ["maximum", "high", "balanced", "small", "smallest-practical"];
const RENDER_RESOLUTIONS: readonly ConversionResolution[] = ["screen", "150dpi", "200dpi", "300dpi"];

export const CONVERSION_CAPABILITIES: readonly ConversionCapability[] = [
  {
    id: "image.convert.jpeg_to_png",
    label: "JPG → PNG",
    inputFormats: ["image"], outputFormats: ["png"], operation: "image-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: ["maximum"], resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "PNG output preserves the decoded canvas alpha where the browser supports it.", preservationImpact: "Re-encoded image; metadata is not promised.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, and non-zero bytes.",
  },
  {
    id: "image.convert.jpeg_to_webp",
    label: "JPG → WebP",
    inputFormats: ["image"], outputFormats: ["webp"], operation: "image-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: IMAGE_QUALITY, resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "The decoded source has no meaningful alpha guarantee for JPEG.", preservationImpact: "Re-encoded image; metadata is not promised.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, and non-zero bytes.",
  },
  {
    id: "image.convert.png_to_jpeg",
    label: "PNG → JPG",
    inputFormats: ["image"], outputFormats: ["jpeg"], operation: "image-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: IMAGE_QUALITY, resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "JPEG does not support transparency; the selected white or black background is applied explicitly.", preservationImpact: "Re-encoded image; alpha is flattened and metadata is not promised.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, and non-zero bytes.",
  },
  {
    id: "image.convert.png_to_webp",
    label: "PNG → WebP",
    inputFormats: ["image"], outputFormats: ["webp"], operation: "image-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: IMAGE_QUALITY, resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "Canvas WebP encoding may preserve alpha when supported by the browser.", preservationImpact: "Re-encoded image; metadata is not promised.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, and non-zero bytes.",
  },
  {
    id: "image.convert.webp_to_jpeg",
    label: "WebP → JPG",
    inputFormats: ["image"], outputFormats: ["jpeg"], operation: "image-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: IMAGE_QUALITY, resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "JPEG does not support transparency; the selected white or black background is applied explicitly.",
    preservationImpact: "Re-encoded image; alpha is flattened and metadata is not promised.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, and non-zero bytes.",
  },
  {
    id: "image.convert.webp_to_png",
    label: "WebP → PNG",
    inputFormats: ["image"], outputFormats: ["png"], operation: "image-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: ["maximum"], resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "PNG output preserves the decoded canvas alpha where the browser supports it.", preservationImpact: "Re-encoded image; metadata is not promised.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, and non-zero bytes.",
  },
  {
    id: "pdf.convert.pages_to_jpeg",
    label: "PDF → JPG",
    inputFormats: ["pdf"], outputFormats: ["jpeg"], operation: "pdf-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: IMAGE_QUALITY, resolutionPresets: RENDER_RESOLUTIONS, pageSelection: true,
    transparencyBehavior: "PDF page appearance is rendered onto an opaque canvas.", preservationImpact: "Rasterizes visible page appearance; editable text, links, forms, and some interactive features do not survive.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, non-zero bytes, and page selection count.",
  },
  {
    id: "pdf.convert.pages_to_png",
    label: "PDF → PNG",
    inputFormats: ["pdf"], outputFormats: ["png"], operation: "pdf-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: ["maximum"], resolutionPresets: RENDER_RESOLUTIONS, pageSelection: true,
    transparencyBehavior: "PDF page appearance is rendered onto an opaque canvas.", preservationImpact: "Rasterizes visible page appearance; editable text, links, forms, and some interactive features do not survive.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, non-zero bytes, and page selection count.",
  },
  {
    id: "pdf.convert.pages_to_webp",
    label: "PDF → WebP",
    inputFormats: ["pdf"], outputFormats: ["webp"], operation: "pdf-to-image", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: IMAGE_QUALITY, resolutionPresets: RENDER_RESOLUTIONS, pageSelection: true,
    transparencyBehavior: "PDF page appearance is rendered onto an opaque canvas before WebP encoding.", preservationImpact: "Rasterizes visible page appearance; editable text, links, forms, and some interactive features do not survive.", expectedOutputType: "image", validationStrategy: "Decode, MIME, dimensions, signature, non-zero bytes, and page selection count.",
  },
  {
    id: "image.convert.to_pdf",
    label: "Images → PDF",
    inputFormats: ["image-collection"], outputFormats: ["pdf"], operation: "image-to-pdf", processingBoundary: "browser-local", batchSupport: true,
    qualityPresets: ["maximum"], resolutionPresets: [], pageSelection: false,
    transparencyBehavior: "PDF pages use an explicit background; transparency is not treated as universally preserved.", preservationImpact: "Creates image-only PDF pages. Searchability is not added automatically.", expectedOutputType: "pdf", validationStrategy: "PDF.js reopen, expected page count, dimensions, representative render, signature, and non-zero bytes.",
  },
];

export function getConversionCapability(id: string): ConversionCapability | null {
  return CONVERSION_CAPABILITIES.find((capability) => capability.id === id) ?? null;
}

export function findImageConversionCapability(sourceMime: string, target: ConversionFormat): ConversionCapability | null {
  const source = sourceMime === "image/jpeg" ? "jpeg" : sourceMime === "image/png" ? "png" : sourceMime === "image/webp" ? "webp" : null;
  if (!source || target === "pdf") return target === "pdf" ? getConversionCapability("image.convert.to_pdf") : null;
  return getConversionCapability(`image.convert.${source}_to_${target}`) ?? null;
}
