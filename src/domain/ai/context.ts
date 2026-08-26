import type { DocumentIntelligenceSnapshot, PdfDocumentAnalysis } from "../pdfs/document-analysis";
import type { DocumentStructureResult, OcrDocumentResult } from "../ocr/types";
import { MAX_AI_BLOCK_CHARS, MAX_AI_PAGES, MAX_AI_TOTAL_CONTEXT_CHARS, AI_CONTEXT_VERSION, type AiContextBlock, type AiContextPage, type AiDocumentContext, type AiDocumentRequest, type AiOperation } from "./types";
import { retrieveRelevantBlocks } from "./retrieval";

export interface BuildAiContextInput {
  documentId: string;
  fileName: string;
  sourceAnalysis: PdfDocumentAnalysis;
  snapshot: DocumentIntelligenceSnapshot;
  ocr: OcrDocumentResult;
  structure: DocumentStructureResult;
  query?: string | null;
}

function confidenceForPage(page: OcrDocumentResult["pages"][number]): AiContextBlock["confidence"] {
  if (page.confidence.metric === "engine-reported" && page.confidence.value !== null) return page.confidence.value >= 80 ? "high" : page.confidence.value >= 55 ? "medium" : "low";
  return page.text ? "unknown" : "unknown";
}

function pageText(input: BuildAiContextInput, pageNumber: number): string {
  return input.ocr.pages.find((page) => page.pageNumber === pageNumber)?.text.replace(/\s+/g, " ").trim().slice(0, MAX_AI_TOTAL_CONTEXT_CHARS) ?? "";
}

function blocksForPage(input: BuildAiContextInput, pageNumber: number): AiContextBlock[] {
  const ocrPage = input.ocr.pages.find((page) => page.pageNumber === pageNumber);
  if (!ocrPage || !ocrPage.text) return [];
  const sourceType: AiContextBlock["sourceType"] = ocrPage.status === "completed" && ocrPage.lines.length > 0 ? "ocr" : "pdf-text";
  const sourceBlocks = ocrPage.blocks.length > 0 ? ocrPage.blocks : [{ text: ocrPage.text, box: null }];
  let offset = 0;
  return sourceBlocks.slice(0, 160).map((block, index) => {
    const text = block.text.replace(/\s+/g, " ").trim().slice(0, MAX_AI_BLOCK_CHARS);
    const start = offset;
    offset += text.length + 1;
    return { blockId: `p${pageNumber}-b${index + 1}`, pageNumber, text, boundingBox: block.box, sourceType, confidence: confidenceForPage(ocrPage), offsetStart: start, offsetEnd: start + text.length };
  }).filter((block) => block.text.length > 0);
}

export function buildAiDocumentContext(input: BuildAiContextInput): AiDocumentContext {
  const allPageNumbers = input.ocr.pages.filter((page) => page.text).map((page) => page.pageNumber).slice(0, MAX_AI_PAGES * 4);
  const selection = retrieveRelevantBlocks({
    version: AI_CONTEXT_VERSION,
    documentId: input.documentId,
    fileName: input.fileName,
    pageCount: input.ocr.pageCount,
    documentSnapshot: input.snapshot,
    structure: input.structure,
    ocrStatus: input.ocr,
    pages: allPageNumbers.map((pageNumber) => ({ pageNumber, role: input.sourceAnalysis.pages.find((page) => page.pageNumber === pageNumber)?.role ?? null, text: pageText(input, pageNumber), blocks: blocksForPage(input, pageNumber), sourceReferences: [] })),
    relevantPageNumbers: [],
    truncated: false,
    truncationReason: null,
    totalContextChars: 0,
    estimatedInputTokens: null,
    processingBoundary: "browser-local-to-ai-gateway",
  }, input.query ?? null, 96);
  const chosenPages = selection.pageNumbers.slice(0, MAX_AI_PAGES);
  const pageMap = new Map<number, AiContextPage>();
  for (const pageNumber of chosenPages) {
    const blocks = blocksForPage(input, pageNumber).filter((block) => selection.blocks.some((candidate) => candidate.block.blockId === block.blockId && candidate.block.pageNumber === pageNumber));
    const text = blocks.map((block) => block.text).join(" ").slice(0, MAX_AI_TOTAL_CONTEXT_CHARS);
    pageMap.set(pageNumber, { pageNumber, role: input.sourceAnalysis.pages.find((page) => page.pageNumber === pageNumber)?.role ?? null, text, blocks, sourceReferences: blocks.map((block) => ({ pageNumber, blockId: block.blockId, offsetStart: block.offsetStart, offsetEnd: block.offsetEnd, boundingBox: block.boundingBox, sourceType: block.sourceType, confidence: block.confidence, excerpt: block.text.slice(0, 320) })) });
  }
  const pages = [...pageMap.values()];
  const totalContextChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  const truncated = selection.truncated || allPageNumbers.length > chosenPages.length || totalContextChars >= MAX_AI_TOTAL_CONTEXT_CHARS;
  return {
    version: AI_CONTEXT_VERSION,
    documentId: input.documentId,
    fileName: input.fileName,
    pageCount: input.ocr.pageCount,
    documentSnapshot: input.snapshot,
    structure: { documentType: input.structure.documentType, title: input.structure.title, sections: input.structure.sections.slice(0, 80), tableLikeRegions: input.structure.tableLikeRegions.slice(0, 80), signatureLikeRegions: input.structure.signatureLikeRegions.slice(0, 80), boundedTextCharacterCount: input.structure.boundedTextCharacterCount },
    ocrStatus: { textPresence: input.ocr.textPresence, processedPages: input.ocr.processedPages, skippedPages: input.ocr.skippedPages, failedPages: input.ocr.failedPages, boundedTextCharacterCount: input.ocr.boundedTextCharacterCount, language: input.ocr.language },
    pages,
    relevantPageNumbers: pages.map((page) => page.pageNumber),
    truncated,
    truncationReason: truncated ? "Context was limited to the most relevant bounded pages and blocks." : null,
    totalContextChars,
    estimatedInputTokens: Math.ceil(totalContextChars / 4),
    processingBoundary: "browser-local-to-ai-gateway",
  };
}

export function buildAiRequest(context: AiDocumentContext, operation: AiOperation, schemaId: string, schemaVersion: string, query: string | null, requestId: string): AiDocumentRequest {
  return { version: AI_CONTEXT_VERSION, operation, context, schemaId, schemaVersion, query: query?.slice(0, 600) ?? null, consent: true, requestId };
}
