import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { PdfAsset } from "../../domain/files/types";
import type { DocumentAction, DocumentActionPlan, PdfRect } from "../../domain/actions/types";
import { MAX_TEXT_LENGTH } from "../../domain/actions/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ActionExecutionProgress { completed: number; total: number; message: string; }
export interface ActionExecutionResult {
  bytes: Uint8Array;
  filename: string;
  inputBytes: number;
  outputBytes: number;
  expectedPageCount: number;
  warnings: string[];
  redactedPageNumbers: number[];
  validatedTargetTexts: string[];
}

function assertSource(file: File, asset: PdfAsset): void {
  if (asset.passwordProtected || asset.encrypted) throw new Error("This PDF is password protected and cannot be edited here.");
  if (asset.pageCount < 1 || file.size > 50 * 1024 * 1024) throw new Error("This PDF is outside the bounded browser-local editing limit.");
}

function color(value: string | undefined, fallback: [number, number, number]) {
  const match = value?.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return rgb(...fallback);
  const hex = match[1];
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

function rectFor(action: DocumentAction, target: DocumentAction["targets"][number]): PdfRect | null {
  return target.rect ?? action.parameters.rect ?? null;
}

function assertRectWithinPage(rect: PdfRect, width: number, height: number): void {
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > width || rect.y + rect.height > height) throw new Error("A region falls outside the selected PDF page and was rejected.");
}

function pageSizePoints(size: DocumentAction["parameters"]["pageSize"]): { width: number; height: number } | null {
  if (size === "A4") return { width: 595.28, height: 841.89 };
  if (size === "A5") return { width: 419.53, height: 595.28 };
  if (size === "Letter") return { width: 612, height: 792 };
  if (size === "Legal") return { width: 612, height: 1008 };
  return null;
}

function textFor(action: DocumentAction, target: DocumentAction["targets"][number]): string {
  return (target.text ?? action.parameters.text ?? "").slice(0, MAX_TEXT_LENGTH);
}

function pagesFor(plan: DocumentActionPlan, pageCount: number): number[] {
  let order = Array.from({ length: pageCount }, (_, index) => index + 1);
  const extract = plan.actions.find((action) => action.actionType === "extract-pages");
  if (extract) {
    const selected = new Set(extract.targets.map((target) => target.page.sourcePageNumber));
    order = order.filter((page) => selected.has(page));
  }
  const deleted = new Set(plan.actions.filter((action) => action.actionType === "delete-pages").flatMap((action) => action.targets.map((target) => target.page.sourcePageNumber)));
  order = order.filter((page) => !deleted.has(page));
  const reorder = plan.actions.find((action) => action.actionType === "reorder-pages");
  if (reorder) {
    const requested = reorder.targets.map((target) => target.page.sourcePageNumber).filter((page) => order.includes(page));
    order = [...requested, ...order.filter((page) => !requested.includes(page))];
  }
  return order;
}

function actionsForPage(plan: DocumentActionPlan, pageNumber: number): DocumentAction[] {
  return plan.actions.filter((action) => action.targets.some((target) => target.page.sourcePageNumber === pageNumber));
}

function redactionActions(plan: DocumentActionPlan, pageNumber: number): DocumentAction[] {
  return actionsForPage(plan, pageNumber).filter((action) => action.actionType === "redact-region");
}

async function renderPageWithOverlays(sourceBytes: Uint8Array, pageNumber: number, actions: DocumentAction[], signal: AbortSignal | undefined): Promise<{ png: Uint8Array; width: number; height: number }> {
  if (signal?.aborted) throw new DOMException("Action cancelled", "AbortError");
  const loadingTask = pdfjsLib.getDocument({ data: sourceBytes, useWorkerFetch: true });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2, rotation: 0 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) { page.cleanup(); await loadingTask.destroy(); throw new Error("The browser could not create a redaction canvas."); }
  try {
    await page.render({ canvas: null, canvasContext: context, viewport }).promise;
    for (const action of actions) {
      for (const target of action.targets.filter((item) => item.page.sourcePageNumber === pageNumber)) {
        const rect = rectFor(action, target);
        if (!rect) continue;
        assertRectWithinPage(rect, viewport.width / 2, viewport.height / 2);
        const x = rect.x * 2;
        const y = (viewport.height / 2) - (rect.y + rect.height) * 2;
        const width = rect.width * 2;
        const height = rect.height * 2;
        if (action.actionType === "redact-region") {
          context.fillStyle = "#090909";
          context.fillRect(x, y, width, height);
        } else if (action.actionType === "highlight-region") {
          context.fillStyle = "rgba(250, 204, 21, 0.42)";
          context.fillRect(x, y, width, height);
        } else if (action.actionType === "annotate-shape") {
          context.strokeStyle = action.parameters.color ?? "#4338ca";
          context.lineWidth = 3;
          context.strokeRect(x, y, width, height);
        }
      }
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The edited page could not be encoded.")), "image/png"));
    return { png: new Uint8Array(await blob.arrayBuffer()), width: viewport.width / 2, height: viewport.height / 2 };
  } finally {
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
    page.cleanup();
    await loadingTask.destroy();
  }
}

function applyPageActions(page: any, actions: DocumentAction[], pageNumber: number, font: any): void {
  for (const action of actions) {
    for (const target of action.targets.filter((item) => item.page.sourcePageNumber === pageNumber)) {
      const rect = rectFor(action, target);
      if (rect && ["add-text", "annotate-note", "highlight-region", "annotate-shape", "crop-pages"].includes(action.actionType)) assertRectWithinPage(rect, page.getWidth(), page.getHeight());
      if (action.actionType === "add-text") {
        const text = textFor(action, target);
        if (!text.trim() || !rect) continue;
        page.drawText(text, { x: rect.x, y: rect.y, size: action.parameters.fontSize ?? 14, font, color: color(action.parameters.color, [0.05, 0.05, 0.05]), maxWidth: rect.width });
      } else if (action.actionType === "annotate-note") {
        if (!rect) continue;
        page.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: rgb(1, 0.96, 0.65), borderColor: rgb(0.7, 0.55, 0.1), borderWidth: 1, opacity: 0.92 });
        page.drawText(textFor(action, target), { x: rect.x + 5, y: rect.y + rect.height - 18, size: action.parameters.fontSize ?? 10, font, color: rgb(0.15, 0.12, 0.02), maxWidth: Math.max(20, rect.width - 10) });
      } else if (action.actionType === "highlight-region") {
        if (!rect) continue;
        page.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: rgb(1, 0.82, 0.1), opacity: action.parameters.opacity ?? 0.35, borderWidth: 0 });
      } else if (action.actionType === "annotate-shape") {
        if (!rect) continue;
        const stroke = color(action.parameters.color, [0.25, 0.2, 0.75]);
        if (action.parameters.shape === "line") page.drawLine({ start: { x: rect.x, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y + rect.height }, thickness: 2, color: stroke });
        else if (action.parameters.shape === "arrow") {
          page.drawLine({ start: { x: rect.x, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y + rect.height }, thickness: 2, color: stroke });
          page.drawLine({ start: { x: rect.x + rect.width, y: rect.y + rect.height }, end: { x: rect.x + rect.width - 10, y: rect.y + rect.height - 4 }, thickness: 2, color: stroke });
        } else page.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, borderColor: stroke, borderWidth: 2 });
      } else if (action.actionType === "crop-pages") {
        if (!rect) continue;
        page.setCropBox(rect.x, rect.y, rect.width, rect.height);
      }
    }
  }
}

function applyMetadata(output: PDFDocument, plan: DocumentActionPlan): void {
  const update = plan.actions.find((action) => action.actionType === "update-metadata");
  const remove = plan.actions.find((action) => action.actionType === "remove-basic-metadata");
  if (remove) {
    output.setTitle(""); output.setAuthor(""); output.setSubject(""); output.setCreator(""); output.setProducer(""); output.setCreationDate(new Date(0));
  }
  if (update?.parameters.metadata) {
    const metadata = update.parameters.metadata;
    if (metadata.title !== undefined) output.setTitle(metadata.title);
    if (metadata.author !== undefined) output.setAuthor(metadata.author);
    if (metadata.subject !== undefined) output.setSubject(metadata.subject);
    if (metadata.creator !== undefined) output.setCreator(metadata.creator);
    if (metadata.producer !== undefined) output.setProducer(metadata.producer);
  }
}

export async function executeDocumentActions(file: File, asset: PdfAsset, plan: DocumentActionPlan, signal?: AbortSignal, onProgress?: (progress: ActionExecutionProgress) => void): Promise<ActionExecutionResult> {
  assertSource(file, asset);
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const source = await PDFDocument.load(inputBytes, { updateMetadata: false });
  if (source.getPageCount() !== plan.sourcePageCount) throw new Error("The PDF changed before editing. Please inspect it again.");
  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const order = pagesFor(plan, source.getPageCount());
  const warnings = ["The original PDF remains unchanged. This output was authored as a new browser-local PDF and reopened for validation."];
  const redactedPageNumbers: number[] = [];
  const validatedTargetTexts: string[] = [];
  for (let index = 0; index < order.length; index += 1) {
    if (signal?.aborted) throw new DOMException("Action cancelled", "AbortError");
    const sourcePageNumber = order[index];
    const actions = actionsForPage(plan, sourcePageNumber);
    const redactions = redactionActions(plan, sourcePageNumber);
    if (redactions.length) {
      const rendered = await renderPageWithOverlays(inputBytes, sourcePageNumber, actions, signal);
      const image = await output.embedPng(rendered.png);
      const page = output.addPage([rendered.width, rendered.height]);
      page.drawImage(image, { x: 0, y: 0, width: rendered.width, height: rendered.height });
      redactedPageNumbers.push(sourcePageNumber);
      for (const action of redactions) for (const target of action.targets) if (target.text?.trim()) validatedTargetTexts.push(target.text.trim());
      warnings.push(`Page ${sourcePageNumber} was rasterized because genuine visual redaction removes the supported searchable text layer beneath the marked region.`);
    } else {
      const [page] = await output.copyPages(source, [sourcePageNumber - 1]);
      const resize = actions.find((action) => action.actionType === "resize-pages");
      const targetSize = pageSizePoints(resize?.parameters.pageSize);
      if (targetSize) {
        page.setSize(targetSize.width, targetSize.height);
        warnings.push(`Page ${sourcePageNumber} was resized to ${resize?.parameters.pageSize} without stretching the copied content.`);
      }
      applyPageActions(page, actions, sourcePageNumber, font);
      const rotate = actions.find((action) => action.actionType === "rotate-pages");
      if (rotate) page.setRotation(degrees((source.getPages()[sourcePageNumber - 1].getRotation().angle + Number(rotate.parameters.rotationDegrees ?? 90)) % 360));
      output.addPage(page);
    }
    onProgress?.({ completed: index + 1, total: order.length, message: `Authored page ${index + 1} of ${order.length}.` });
  }
  applyMetadata(output, plan);
  const bytes = await output.save({ useObjectStreams: false });
  if (!bytes.byteLength) throw new Error("The generated PDF was empty and was discarded.");
  if (plan.actions.some((action) => action.actionType === "remove-basic-metadata")) warnings.push("Basic metadata fields were cleared where supported; nonstandard metadata streams remain unknown.");
  if (redactedPageNumbers.length) warnings.push("Redaction validation must confirm target text is absent from PDF.js extraction; independently verify highly sensitive or forensic documents.");
  const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
  const primary = plan.actions[0]?.actionType ?? "edited";
  const suffix = primary === "redact-region" ? "redacted" : primary === "highlight-region" ? "highlighted" : primary === "add-text" ? "annotated" : primary === "crop-pages" ? "cropped" : primary === "resize-pages" ? "resized" : primary === "remove-basic-metadata" ? "metadata-removed" : "edited";
  return { bytes, filename: `${stem}-${suffix}.pdf`, inputBytes: file.size, outputBytes: bytes.byteLength, expectedPageCount: order.length, warnings, redactedPageNumbers, validatedTargetTexts };
}
