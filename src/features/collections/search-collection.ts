import type { CollectionDocument, CollectionSearchMatch, CollectionSearchResult } from "../../domain/collections/types";
import type { PdfAsset } from "../../domain/files/types";

const MAX_QUERY_CHARS = 160;
const MAX_EXCERPT_CHARS = 240;
const MAX_MATCHES = 100;
const MAX_SEARCH_CHARS = 120_000;

function excerpt(text: string, index: number): string { const start = Math.max(0, index - 90); return text.slice(start, start + MAX_EXCERPT_CHARS).replace(/\s+/g, " ").trim(); }
function officeMatches(document: CollectionDocument, query: string, remaining: number): CollectionSearchMatch[] { const asset = document.asset; if (asset.category !== "office") return []; const needle = query.toLocaleLowerCase(); return asset.analysis.sampledStructure.filter((block) => block.text.toLocaleLowerCase().includes(needle)).slice(0, remaining).map((block) => ({ documentId: document.documentId, documentName: asset.name, format: asset.format, location: block.location, excerpt: excerpt(block.text, block.text.toLocaleLowerCase().indexOf(needle)), sourceType: block.kind === "cell" ? "office-cell" : "office-text", confidence: "high" })); }

export async function searchCollectionDocuments(documents: readonly CollectionDocument[], query: string, onProgress?: (message: string) => void, signal?: AbortSignal): Promise<CollectionSearchResult> {
  const normalized = query.trim().slice(0, MAX_QUERY_CHARS);
  if (!normalized) return { query: normalized, matches: [], searchedDocumentCount: 0, totalDocumentCount: documents.length, searchedCharacters: 0, truncated: false, message: "Enter a search term before searching the collection." };
  const matches: CollectionSearchMatch[] = [];
  let searchedCharacters = 0;
  let searchedDocumentCount = 0;
  let truncated = query.trim().length > MAX_QUERY_CHARS;
  for (const document of documents) {
    if (signal?.aborted) throw new DOMException("Collection search cancelled.", "AbortError");
    if (matches.length >= MAX_MATCHES || searchedCharacters >= MAX_SEARCH_CHARS) { truncated = true; break; }
    onProgress?.(`Searching ${document.asset.name} locally.`);
    if (document.asset.category === "office") {
      searchedDocumentCount += 1;
      const text = document.asset.analysis.extractedText.slice(0, MAX_SEARCH_CHARS - searchedCharacters);
      searchedCharacters += text.length;
      matches.push(...officeMatches(document, normalized, MAX_MATCHES - matches.length));
      continue;
    }
    if (document.asset.category === "pdf") {
      searchedDocumentCount += 1;
      const [{ analyzePdfDocument }, { extractPdfText }] = await Promise.all([import("../pdf/analyze-pdf-document"), import("../ocr/extract-pdf-text")]);
      const asset = document.asset as PdfAsset;
      const analysis = await analyzePdfDocument(document.file, asset, undefined, signal);
      const textResult = await extractPdfText(document.file, analysis, undefined, signal);
      for (const page of textResult.pages) {
        if (matches.length >= MAX_MATCHES) { truncated = true; break; }
        const pageText = page.text.slice(0, MAX_SEARCH_CHARS - searchedCharacters);
        searchedCharacters += pageText.length;
        const index = pageText.toLocaleLowerCase().indexOf(normalized.toLocaleLowerCase());
        if (index >= 0) matches.push({ documentId: document.documentId, documentName: document.asset.name, format: "pdf", location: `Page ${page.pageNumber}`, excerpt: excerpt(pageText, index), sourceType: "native-text", confidence: "high" });
        if (searchedCharacters >= MAX_SEARCH_CHARS) { truncated = true; break; }
      }
    }
  }
  const message = matches.length > 0 ? `${matches.length} match${matches.length === 1 ? "" : "es"} found in ${searchedDocumentCount} searched document${searchedDocumentCount === 1 ? "" : "s"}.${truncated ? " Search limits applied." : ""}` : `No match found in the searched content from ${searchedDocumentCount} document${searchedDocumentCount === 1 ? "" : "s"}.${truncated ? " Search limits applied." : ""}`;
  return { query: normalized, matches, searchedDocumentCount, totalDocumentCount: documents.length, searchedCharacters, truncated, message };
}
