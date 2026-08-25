import type { PdfAsset } from "../files/types";
import type { PdfInspectionValidation } from "./types";

export function validatePdfInspection(asset: PdfAsset): PdfInspectionValidation {
  const previewAvailable = Boolean(asset.previewUrl);
  const valid = asset.pageCount > 0 && asset.classification !== "invalid" && !asset.passwordProtected;
  const message = !valid
    ? "The PDF inspection did not produce a usable document result."
    : previewAvailable
      ? "PDF loaded, classified, and first-page preview rendered locally."
      : "PDF loaded and classified, but a first-page preview was not available.";

  return {
    valid,
    type: "pdf",
    pageCount: asset.pageCount,
    previewAvailable,
    classification: asset.classification,
    protected: asset.passwordProtected || asset.encrypted,
    processingBoundary: asset.processingBoundary,
    message,
  };
}
