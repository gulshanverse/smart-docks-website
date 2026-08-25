import type { FileAsset, FileIntakeError } from "../../domain/files/types";
import { hasPdfSignature } from "../pdf/inspect-pdf-signature";
import { inspectImageFile } from "./read-image";

export type FileInspectionStage = "validating" | "inspecting" | "rendering";

export async function inspectFile(file: File, onStage?: (stage: FileInspectionStage) => void): Promise<FileAsset | FileIntakeError> {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdfCandidate = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") || hasPdfSignature(header);
  if (!isPdfCandidate) return inspectImageFile(file);
  onStage?.("validating");
  onStage?.("inspecting");
  const { inspectPdfFile } = await import("../pdf/inspect-pdf");
  const result = await inspectPdfFile(file);
  if (!("code" in result)) onStage?.("rendering");
  return result;
}
