import type { PdfAsset } from "../../domain/files/types";
import type { ImageToPdfPlan, PdfMergePlan, PdfRange, PdfSplitPlan, PdfMetadataSnapshot } from "../../domain/pdfs/core";
import { safeCoreFilename, supportedImageMime } from "../../domain/pdfs/core";
import { MAX_PDF_INPUT_BYTES } from "../../domain/files/types";

export interface CorePdfOutput {
  bytes: Uint8Array;
  filename: string;
  inputBytes: number;
  outputBytes: number;
  expectedPageCount: number;
  operation: "merge" | "split" | "create_pdf" | "remove_blank_pages";
  warnings: string[];
}

function assertPdfAsset(asset: PdfAsset, file: File): void {
  if (asset.passwordProtected || asset.encrypted) throw new Error(`${file.name}: This PDF is password protected and cannot be modified here.`);
  if (file.size > MAX_PDF_INPUT_BYTES) throw new Error(`${file.name}: This PDF is larger than the 50 MiB browser-local mutation limit.`);
  if (asset.classification === "invalid" || asset.pageCount < 1) throw new Error(`${file.name}: This PDF has no usable pages.`);
}

function applyMetadata(output: any, metadata: PdfMetadataSnapshot | undefined, preserve: boolean): string[] {
  if (!preserve || !metadata || metadata.preservation !== "available") return preserve ? ["Source metadata was not available to preserve."] : [];
  if (metadata.title) output.setTitle(metadata.title);
  if (metadata.author) output.setAuthor(metadata.author);
  if (metadata.subject) output.setSubject(metadata.subject);
  if (metadata.creator) output.setCreator(metadata.creator);
  if (metadata.producer) output.setProducer(metadata.producer);
  if (metadata.creationDate) output.setCreationDate(new Date(metadata.creationDate));
  return [];
}

export async function readPdfMetadata(file: File): Promise<PdfMetadataSnapshot> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    const document = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { updateMetadata: false });
    const date = document.getCreationDate();
    return {
      title: document.getTitle() ?? null,
      author: document.getAuthor() ?? null,
      subject: document.getSubject() ?? null,
      creator: document.getCreator() ?? null,
      producer: document.getProducer() ?? null,
      creationDate: date ? date.toISOString() : null,
      preservation: "available",
    };
  } catch {
    return { title: null, author: null, subject: null, creator: null, producer: null, creationDate: null, preservation: "not-available" };
  }
}

export async function mergePdfs(files: File[], assets: PdfAsset[], plan: PdfMergePlan, metadata?: PdfMetadataSnapshot): Promise<CorePdfOutput> {
  if (files.length < 2 || files.length !== assets.length) throw new Error("Select at least two valid PDFs to merge.");
  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create();
  let inputBytes = 0;
  const warnings: string[] = [];
  for (let index = 0; index < files.length; index += 1) {
    assertPdfAsset(assets[index], files[index]);
    inputBytes += files[index].size;
    try {
      const source = await PDFDocument.load(new Uint8Array(await files[index].arrayBuffer()), { updateMetadata: false });
      const pages = await output.copyPages(source, source.getPages().map((_, pageIndex) => pageIndex));
      pages.forEach((page) => output.addPage(page));
    } catch {
      throw new Error(`${files[index].name}: The PDF could not be safely merged.`);
    }
  }
  warnings.push(...applyMetadata(output, metadata, plan.preserveMetadata));
  const bytes = await output.save({ useObjectStreams: false });
  return { bytes, filename: "merged-document.pdf", inputBytes, outputBytes: bytes.byteLength, expectedPageCount: plan.expectedOutputPageCount, operation: "merge", warnings };
}

export async function splitPdf(file: File, asset: PdfAsset, plan: PdfSplitPlan): Promise<CorePdfOutput[]> {
  assertPdfAsset(asset, file);
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { updateMetadata: false });
  const outputs: CorePdfOutput[] = [];
  for (let index = 0; index < plan.ranges.length; index += 1) {
    const range = plan.ranges[index];
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, pageNumbers(range).map((page) => page - 1));
    pages.forEach((page) => output.addPage(page));
    const warnings = ["Basic source metadata is not copied by split; structural page content is authored into a new PDF."];
    const bytes = await output.save({ useObjectStreams: false });
    outputs.push({ bytes, filename: safeCoreFilename(file.name, `split-part-${index + 1}`, "pdf"), inputBytes: file.size, outputBytes: bytes.byteLength, expectedPageCount: range.end - range.start + 1, operation: "split", warnings });
  }
  return outputs;
}

function pageNumbers(range: PdfRange): number[] {
  return Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
}

export async function imagesToPdf(files: File[], plan: ImageToPdfPlan): Promise<CorePdfOutput> {
  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create();
  let inputBytes = 0;
  for (const file of files) {
    const mime = supportedImageMime(file.name, file.type);
    if (mime === "image/webp") throw new Error(`${file.name}: WebP to PDF is not enabled because the selected authoring path cannot safely embed WebP.`);
    if (!mime) throw new Error(`${file.name}: Choose a JPEG or PNG image for image-to-PDF.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    inputBytes += file.size;
    const image = mime === "image/jpeg" ? await output.embedJpg(bytes) : await output.embedPng(bytes);
    const bitmap = await createImageBitmap(file);
    try {
      const maxWidth = 595;
      const maxHeight = 842;
      const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      const page = output.addPage([maxWidth, maxHeight]);
      page.drawImage(image, { x: (maxWidth - width) / 2, y: (maxHeight - height) / 2, width, height });
    } finally {
      bitmap.close();
    }
  }
  output.setCreator("SmartDocs");
  output.setProducer("SmartDocs browser-local PDF authoring");
  const bytes = await output.save({ useObjectStreams: false });
  return { bytes, filename: "image-to-pdf.pdf", inputBytes, outputBytes: bytes.byteLength, expectedPageCount: plan.expectedOutputPageCount, operation: "create_pdf", warnings: ["Images were fitted and centered on A4-sized pages without stretching."] };
}
