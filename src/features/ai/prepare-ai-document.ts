import type { PdfAsset } from "../../domain/files/types";
import { createDocumentIntelligenceSnapshot } from "../../domain/pdfs/optimization";
import { createOcrPlan } from "../../domain/ocr/planning";
import { deriveDocumentStructure } from "../../domain/ocr/understanding";
import type { AiDocumentContext, AiOperationProgress } from "../../domain/ai/types";
import { buildAiDocumentContext } from "../../domain/ai/context";
import { analyzePdfDocument, DocumentAnalysisCancelledError } from "../pdf/analyze-pdf-document";
import { extractPdfText } from "../ocr/extract-pdf-text";
import { recognizePdf, OcrCancelledError } from "../ocr/recognize-pdf";

export interface PreparedAiDocument {
  context: AiDocumentContext;
  analysis: Awaited<ReturnType<typeof analyzePdfDocument>>;
  plan: ReturnType<typeof createOcrPlan>;
  ocr: Awaited<ReturnType<typeof extractPdfText>>;
  structure: ReturnType<typeof deriveDocumentStructure>;
}

export function refreshAiDocumentContext(prepared: PreparedAiDocument, query: string | null, onProgress?: (progress: AiOperationProgress) => void): PreparedAiDocument {
  const context = buildAiDocumentContext({ documentId: prepared.context.documentId, fileName: prepared.context.fileName, sourceAnalysis: prepared.analysis, snapshot: prepared.context.documentSnapshot, ocr: prepared.ocr, structure: prepared.structure, query });
  onProgress?.({ state: "retrieving", detail: context.truncated ? "Selected the most relevant bounded document sections locally." : "Reused local analysis and prepared bounded document context.", relevantPages: context.relevantPageNumbers, contextChars: context.totalContextChars, estimatedInputTokens: context.estimatedInputTokens });
  return { ...prepared, context };
}

export async function prepareAiDocument(file: File, asset: PdfAsset, query: string | null, onProgress?: (progress: AiOperationProgress) => void, signal?: AbortSignal): Promise<PreparedAiDocument> {
  onProgress?.({ state: "preparing", detail: "Inspecting document signals locally before AI context is prepared.", relevantPages: [], contextChars: 0, estimatedInputTokens: null });
  const analysis = await analyzePdfDocument(file, asset, (progress) => onProgress?.({ state: "preparing", detail: progress.detail, relevantPages: [], contextChars: 0, estimatedInputTokens: null }), signal);
  const snapshot = createDocumentIntelligenceSnapshot(analysis);
  const plan = createOcrPlan(analysis, "eng");
  let ocr;
  if (plan.plannedPages.length > 0) {
    const recognized = await recognizePdf(file, analysis, "eng", (progress) => onProgress?.({ state: "preparing", detail: progress.detail, relevantPages: plan.plannedPages, contextChars: 0, estimatedInputTokens: null }), signal);
    ocr = recognized.result;
  } else {
    ocr = await extractPdfText(file, analysis, (progress) => onProgress?.({ state: "preparing", detail: progress.message, relevantPages: [progress.pageNumber], contextChars: 0, estimatedInputTokens: null }), signal);
  }
  const structure = deriveDocumentStructure(analysis, ocr);
  const context = buildAiDocumentContext({ documentId: asset.id, fileName: file.name, sourceAnalysis: analysis, snapshot, ocr, structure, query });
  onProgress?.({ state: "retrieving", detail: context.truncated ? "Selected the most relevant bounded document sections locally." : "Prepared bounded document context locally.", relevantPages: context.relevantPageNumbers, contextChars: context.totalContextChars, estimatedInputTokens: context.estimatedInputTokens });
  return { context, analysis, plan, ocr, structure };
}

export function isAiCancellation(error: unknown): boolean { return error instanceof OcrCancelledError || error instanceof DocumentAnalysisCancelledError || error instanceof DOMException && error.name === "AbortError"; }
