import type { AiContextBlock, AiDocumentContext, AiSourceReference } from "./types";
import { MAX_AI_BLOCKS, MAX_AI_RELEVANCE_PAGES, MAX_AI_TOTAL_CONTEXT_CHARS } from "./types";

export interface AiRetrievedBlock {
  block: AiContextBlock;
  score: number;
  reasons: string[];
}

export interface AiRetrievalResult {
  query: string;
  blocks: AiRetrievedBlock[];
  pageNumbers: number[];
  truncated: boolean;
  warnings: string[];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [])].filter((token) => token.length > 1).slice(0, 64);
}

function scoreBlock(block: AiContextBlock, tokens: string[], phrase: string, pageText: string): AiRetrievedBlock {
  const haystack = block.text.toLocaleLowerCase();
  const reasons: string[] = [];
  let score = 0;
  if (phrase && haystack.includes(phrase)) {
    score += 12;
    reasons.push("exact phrase");
  }
  const overlap = tokens.filter((token) => haystack.includes(token)).length;
  if (overlap > 0) {
    score += overlap * 3;
    reasons.push(`${overlap} keyword${overlap === 1 ? "" : "s"}`);
  }
  if (pageText.toLocaleLowerCase().includes(phrase) && !haystack.includes(phrase)) {
    score += 1;
    reasons.push("page match");
  }
  if (block.sourceType === "ocr") score += 0.25;
  return { block, score, reasons };
}

export function retrieveRelevantBlocks(context: AiDocumentContext, query: string | null, maxBlocks = MAX_AI_BLOCKS): AiRetrievalResult {
  const normalized = (query ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  const tokens = tokenize(normalized);
  const phrase = normalized.toLocaleLowerCase();
  const warnings: string[] = [];
  const all: AiRetrievedBlock[] = [];
  for (const page of context.pages) {
    for (const block of page.blocks) {
      const scored = normalized ? scoreBlock(block, tokens, phrase, page.text) : { block, score: 1, reasons: ["bounded page selection"] };
      if (scored.score > 0) all.push(scored);
    }
  }
  const sorted = [...all].sort((a, b) => b.score - a.score || a.block.pageNumber - b.block.pageNumber || a.block.blockId.localeCompare(b.block.blockId));
  const picked: AiRetrievedBlock[] = [];
  let chars = 0;
  for (const candidate of sorted) {
    if (picked.length >= Math.min(maxBlocks, MAX_AI_BLOCKS)) break;
    if (chars + candidate.block.text.length > MAX_AI_TOTAL_CONTEXT_CHARS) continue;
    picked.push(candidate);
    chars += candidate.block.text.length;
  }
  const pageNumbers = [...new Set(picked.map((item) => item.block.pageNumber))].sort((a, b) => a - b).slice(0, MAX_AI_RELEVANCE_PAGES);
  const limitedBlocks = picked.filter((item) => pageNumbers.includes(item.block.pageNumber));
  const truncated = all.length > limitedBlocks.length || context.pages.length > pageNumbers.length;
  if (truncated) warnings.push("Only the most relevant bounded document sections were selected for AI.");
  if (normalized && limitedBlocks.length === 0) warnings.push("No matching document sections were found locally for this query.");
  return { query: normalized, blocks: limitedBlocks, pageNumbers, truncated, warnings };
}

export function referencesForRetrievedBlocks(blocks: readonly AiRetrievedBlock[]): AiSourceReference[] {
  return blocks.map(({ block }) => ({ pageNumber: block.pageNumber, blockId: block.blockId, offsetStart: block.offsetStart, offsetEnd: block.offsetEnd, boundingBox: block.boundingBox, sourceType: block.sourceType, confidence: block.confidence, excerpt: block.text.slice(0, 320) }));
}
