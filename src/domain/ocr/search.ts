import {
  MAX_DOCUMENT_SEARCH_RESULTS,
  MAX_OCR_DOCUMENT_TEXT_CHARS,
  MAX_SEARCH_QUERY_CHARS,
  type DocumentSearchResult,
  type OcrPageResult,
} from "./types";

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function bounded(value: string, limit: number): string {
  return value.slice(0, limit);
}

export function extractBoundedOcrText(pages: readonly OcrPageResult[]): string {
  let remaining = MAX_OCR_DOCUMENT_TEXT_CHARS;
  const chunks: string[] = [];
  for (const page of pages) {
    if (remaining <= 0) break;
    const text = bounded(page.text, remaining).trim();
    if (text.length === 0) continue;
    chunks.push(`[Page ${page.pageNumber}]\n${text}`);
    remaining -= text.length;
  }
  return chunks.join("\n\n").slice(0, MAX_OCR_DOCUMENT_TEXT_CHARS);
}

function excerptFor(text: string, start: number, end: number): string {
  const radius = 72;
  const excerptStart = Math.max(0, start - radius);
  const excerptEnd = Math.min(text.length, end + radius);
  return text.slice(excerptStart, excerptEnd).replace(/\s+/g, " ").trim();
}

function firstMatchingBox(page: OcrPageResult, query: string): OcrPageResult["boundingBoxes"][number] | null {
  const word = page.words.find((candidate) => normalized(candidate.text).includes(query));
  return word?.box ?? null;
}

export function searchOcrPages(pages: readonly OcrPageResult[], rawQuery: string): DocumentSearchResult {
  const query = bounded(rawQuery.trim(), MAX_SEARCH_QUERY_CHARS);
  if (query.length === 0) return { query, matches: [], truncated: false, searchedPages: [], warnings: ["Enter a search term to search recognized text locally."] };
  const normalizedQuery = normalized(query);
  const matches: DocumentSearchResult["matches"] = [];
  const searchedPages: number[] = [];
  let truncated = false;

  for (const page of pages) {
    searchedPages.push(page.pageNumber);
    const source = normalized(page.text);
    let offset = 0;
    while (offset < source.length) {
      const matchIndex = source.indexOf(normalizedQuery, offset);
      if (matchIndex < 0) break;
      if (matches.length >= MAX_DOCUMENT_SEARCH_RESULTS) {
        truncated = true;
        break;
      }
      matches.push({ pageNumber: page.pageNumber, start: matchIndex, end: matchIndex + normalizedQuery.length, excerpt: excerptFor(page.text, matchIndex, matchIndex + query.length), box: firstMatchingBox(page, normalizedQuery) });
      offset = matchIndex + Math.max(1, normalizedQuery.length);
    }
    if (truncated) break;
  }

  return { query, matches, truncated, searchedPages, warnings: truncated ? [`Search results are bounded to ${MAX_DOCUMENT_SEARCH_RESULTS}.`] : [] };
}
