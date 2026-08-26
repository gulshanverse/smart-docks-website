import type { PdfDocumentAnalysis, PdfTextBlock } from "../pdfs/document-analysis";
import type { OcrDocumentResult, DocumentStructureResult, DeterministicSignalKind, OcrPageResult } from "./types";
import { MAX_SENSITIVE_REGIONS } from "./types";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d ()-]{7,}\d)/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;
const DATE_PATTERN = /\b(?:\d{1,2}[/-]){2}\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi;
const INVOICE_PATTERN = /\b(?:invoice|inv)[\s#:.-]*[A-Z0-9-]{3,}\b/gi;
const CURRENCY_PATTERN = /(?:[$€£₹]\s?\d[\d,.]*|\d[\d,.]*\s?(?:USD|EUR|GBP|INR))\b/gi;
const ID_PATTERN = /\b(?:\d[ -]?){7,}\d\b/g;

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function detectKind(value: string): DeterministicSignalKind[] {
  const kinds: DeterministicSignalKind[] = [];
  if (EMAIL_PATTERN.test(value)) kinds.push("email");
  EMAIL_PATTERN.lastIndex = 0;
  if (PHONE_PATTERN.test(value)) kinds.push("phone");
  PHONE_PATTERN.lastIndex = 0;
  if (URL_PATTERN.test(value)) kinds.push("url");
  URL_PATTERN.lastIndex = 0;
  if (DATE_PATTERN.test(value)) kinds.push("date");
  DATE_PATTERN.lastIndex = 0;
  if (INVOICE_PATTERN.test(value)) kinds.push("invoice-number");
  INVOICE_PATTERN.lastIndex = 0;
  if (CURRENCY_PATTERN.test(value)) kinds.push("currency");
  CURRENCY_PATTERN.lastIndex = 0;
  if (ID_PATTERN.test(value)) kinds.push("id-like");
  ID_PATTERN.lastIndex = 0;
  return kinds;
}

function sensitiveRegionsFromText(page: OcrPageResult): DocumentStructureResult["sensitiveRegions"] {
  const kinds = detectKind(page.text);
  return kinds.map((kind) => ({ pageNumber: page.pageNumber, kind, box: null, value: null, note: "Possible sensitive information detected by a deterministic pattern; value is not retained in the analysis signal." }));
}

function likelyDocumentType(text: string, analysis: PdfDocumentAnalysis, ocr: OcrDocumentResult): DocumentStructureResult["documentType"] {
  const value = text.toLocaleLowerCase();
  const matchers: Array<[DocumentStructureResult["documentType"]["value"], RegExp]> = [
    ["invoice", /\binvoice\b|\bbill to\b|\bamount due\b/],
    ["receipt", /\breceipt\b|\btotal paid\b|\bchange due\b/],
    ["application-form", /\bapplication\b|\bdate of birth\b|\bplease complete\b/],
    ["resume", /\bresume\b|\bexperience\b|\beducation\b|\bskills\b/],
    ["letter", /\bdear\b|\bsincerely\b|\bregards\b/],
    ["report", /\bexecutive summary\b|\bfindings\b|\brecommendations\b/],
    ["book", /\bchapter\s+\d+\b|\bcontents\b/],
    ["notes", /\bnotes\b|\bto-do\b|\baction items\b/],
  ];
  for (const [type, matcher] of matchers) if (matcher.test(value)) return { value: type, confidence: "likely" };
  if (analysis.classification === "scanned" || ocr.textPresence === "not-detected") return { value: "scanned-document", confidence: "likely" };
  return { value: "unknown", confidence: "unknown" };
}

function likelyTitle(pages: readonly OcrPageResult[]): DocumentStructureResult["title"] {
  const first = pages.find((page) => page.text.trim().length > 0)?.text ?? "";
  const line = first.split(/\r?\n/).map(normalizeText).find((candidate) => candidate.length >= 3 && candidate.length <= 120);
  return line ? { value: line, confidence: "uncertain" } : { value: null, confidence: "unknown" };
}

function structureFromBlocks(analysis: PdfDocumentAnalysis, pages: readonly OcrPageResult[]): Pick<DocumentStructureResult, "sections" | "tableLikeRegions" | "signatureLikeRegions"> {
  const sections: DocumentStructureResult["sections"] = [];
  const tables: DocumentStructureResult["tableLikeRegions"] = [];
  const signatures: DocumentStructureResult["signatureLikeRegions"] = [];
  for (const page of analysis.pages) {
    const blocks: PdfTextBlock[] = page.pageNumber === 0 ? [] : analysis.text.textPages.find((candidate) => candidate.pageNumber === page.pageNumber)?.blocks ?? [];
    const ocrPage = pages.find((candidate) => candidate.pageNumber === page.pageNumber);
    const text = ocrPage?.text ?? blocks.map((block) => block.text).join(" ");
    const lines = text.split(/\r?\n/).map(normalizeText).filter(Boolean);
    for (const line of lines.slice(0, 8)) {
      if (line.length >= 3 && line.length <= 90 && (/^[A-Z][A-Z\s:&-]{3,}$/.test(line) || /^\d+[.)]\s/.test(line))) sections.push({ title: line, pageNumber: page.pageNumber, confidence: "uncertain" });
    }
    const alignedBlocks = blocks.filter((block) => block.width > 0 && block.height > 0);
    if (alignedBlocks.length >= 4) tables.push({ pageNumber: page.pageNumber, box: null, confidence: "uncertain", reason: "Multiple bounded text regions were detected; table extraction is not implemented." });
    if (/_{3,}|signature|signed by|sign here/i.test(text)) signatures.push({ pageNumber: page.pageNumber, box: null, confidence: "uncertain", note: "possible signature region" });
  }
  return { sections: sections.slice(0, 32), tableLikeRegions: tables.slice(0, 24), signatureLikeRegions: signatures.slice(0, 24) };
}

export function deriveDocumentStructure(analysis: PdfDocumentAnalysis, ocr: OcrDocumentResult): DocumentStructureResult {
  const pages = ocr.pages;
  const boundedText = pages.map((page) => page.text).join("\n").slice(0, 24 * 6_000);
  const base = structureFromBlocks(analysis, pages);
  const sensitiveRegions = pages.flatMap(sensitiveRegionsFromText).slice(0, MAX_SENSITIVE_REGIONS);
  const warnings = [
    "Document type, headings, table-like regions, signatures, and sensitive-content signals are deterministic heuristics.",
    "Possible sensitive information is not retained as a value and no redaction is performed.",
  ];
  if (base.tableLikeRegions.length > 0) warnings.push("Table-like regions were detected; universal table extraction is not available in this milestone.");
  if (base.signatureLikeRegions.length > 0) warnings.push("Possible signature regions are visual heuristics only; no identity inference is performed.");
  return {
    documentType: likelyDocumentType(boundedText, analysis, ocr),
    title: likelyTitle(pages),
    sections: base.sections,
    tableLikeRegions: base.tableLikeRegions,
    signatureLikeRegions: base.signatureLikeRegions,
    sensitiveRegions,
    pageGroups: analysis.structure.pageGroups,
    boundedTextCharacterCount: boundedText.length,
    warnings,
  };
}

export function createDocumentUnderstandingSnapshot(analysis: PdfDocumentAnalysis, intelligence: import("../pdfs/document-analysis").DocumentIntelligenceSnapshot, ocr: OcrDocumentResult): import("./types").DocumentUnderstandingSnapshot {
  const structure = deriveDocumentStructure(analysis, ocr);
  return { sourceAnalysis: intelligence, ocr: { documentId: ocr.documentId, pageCount: ocr.pageCount, language: ocr.language, textPresence: ocr.textPresence, processedPages: ocr.processedPages, skippedPages: ocr.skippedPages, failedPages: ocr.failedPages, boundedTextCharacterCount: ocr.boundedTextCharacterCount, warnings: ocr.warnings }, structure, futureAiBoundary: "not-invoked", processingBoundary: "browser-local", generatedBy: "deterministic-rules" };
}
