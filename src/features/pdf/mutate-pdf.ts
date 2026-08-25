import type { PdfAsset } from "../../domain/files/types";
import type { PdfOperationPlan } from "../../domain/pdfs/operations";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";

export interface PdfMutationOutput {
  bytes: Uint8Array;
  filename: string;
  inputBytes: number;
  outputBytes: number;
  plan: PdfOperationPlan;
}

export function createMutationFilename(originalName: string, operation: PdfOperationPlan["operation"]["type"]): string {
  const base = originalName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
  const suffix = operation === "delete_pages" ? "deleted-pages" : operation === "extract_pages" ? "extracted-pages" : operation === "reorder_pages" ? "reordered" : "rotated";
  return `${base}-${suffix}.pdf`;
}

export async function mutatePdf(file: File, asset: PdfAsset, plan: PdfOperationPlan): Promise<PdfMutationOutput> {
  if (asset.passwordProtected || asset.encrypted) {
    throw new Error("This PDF is password protected and cannot be modified here.");
  }
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error("This PDF is larger than the 50 MiB browser-local mutation limit.");
  const { PDFDocument, degrees } = await import("pdf-lib");
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const source = await PDFDocument.load(inputBytes, { updateMetadata: false });
  const sourcePages = source.getPages();
  if (sourcePages.length !== plan.inputPageCount) throw new Error("The PDF changed while it was open. Please inspect it again.");

  const output = await PDFDocument.create();
  const pageOrder = plan.operation.type === "reorder_pages" ? plan.expectedPageOrder : plan.expectedPageOrder;
  const copiedPages = await output.copyPages(source, pageOrder.map((pageNumber) => pageNumber - 1));
  copiedPages.forEach((page, index) => {
    if (plan.operation.type === "rotate_pages" && plan.selectedPages.includes(pageOrder[index])) {
      const current = sourcePages[pageOrder[index] - 1].getRotation().angle;
      const added = plan.operation.parameters.rotationDegrees ?? 0;
      page.setRotation(degrees((current + added) % 360));
    }
    output.addPage(page);
  });

  const bytes = await output.save({ useObjectStreams: false });
  return {
    bytes,
    filename: createMutationFilename(file.name, plan.operation.type),
    inputBytes: file.size,
    outputBytes: bytes.byteLength,
    plan,
  };
}
