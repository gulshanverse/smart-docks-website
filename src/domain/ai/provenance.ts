import type { AiContextBlock, AiDocumentContext, AiSourceReference } from "./types";
import { MAX_AI_SOURCE_EXCERPT_CHARS } from "./types";

function clampExcerpt(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_AI_SOURCE_EXCERPT_CHARS) || null;
}

export function contextBlockReference(block: AiContextBlock): AiSourceReference {
  return {
    pageNumber: block.pageNumber,
    blockId: block.blockId,
    offsetStart: block.offsetStart,
    offsetEnd: block.offsetEnd,
    boundingBox: block.boundingBox,
    sourceType: block.sourceType,
    confidence: block.confidence,
    excerpt: clampExcerpt(block.text),
  };
}

export function referenceIsWithinContext(reference: AiSourceReference, context: AiDocumentContext): boolean {
  if (!Number.isInteger(reference.pageNumber) || reference.pageNumber < 1 || reference.pageNumber > context.pageCount) return false;
  const page = context.pages.find((candidate) => candidate.pageNumber === reference.pageNumber);
  if (!page) return false;
  if (reference.blockId === null) return true;
  const block = page.blocks.find((candidate) => candidate.blockId === reference.blockId);
  if (!block) return false;
  if (reference.offsetStart !== null && (reference.offsetStart < block.offsetStart || reference.offsetStart > block.offsetEnd)) return false;
  if (reference.offsetEnd !== null && (reference.offsetEnd < block.offsetStart || reference.offsetEnd > block.offsetEnd || reference.offsetEnd < (reference.offsetStart ?? block.offsetStart))) return false;
  return true;
}

export function validateSourceReferences(references: readonly AiSourceReference[], context: AiDocumentContext): { valid: AiSourceReference[]; invalidCount: number } {
  const valid: AiSourceReference[] = [];
  for (const reference of references) {
    if (referenceIsWithinContext(reference, context)) valid.push({ ...reference, excerpt: clampExcerpt(reference.excerpt) });
  }
  return { valid, invalidCount: references.length - valid.length };
}

export function sourceReferencesForPage(context: AiDocumentContext, pageNumber: number): AiSourceReference[] {
  return context.pages.find((page) => page.pageNumber === pageNumber)?.sourceReferences.map((reference) => ({ ...reference, excerpt: clampExcerpt(reference.excerpt) })) ?? [];
}

export function referencesForText(context: AiDocumentContext, text: string): AiSourceReference[] {
  const needle = text.trim().toLocaleLowerCase();
  if (!needle) return [];
  const matches: AiSourceReference[] = [];
  for (const page of context.pages) {
    for (const block of page.blocks) {
      if (block.text.toLocaleLowerCase().includes(needle)) matches.push(contextBlockReference(block));
    }
  }
  return matches;
}
