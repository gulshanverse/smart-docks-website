import type { FileAsset } from "../files/types";
import { COLLECTION_LIMITS, type CollectionDocument, type CollectionOperation, type CollectionState } from "./types";

export interface CompatibilityResult { supported: boolean; message: string; warnings: readonly string[]; }

export function fingerprintFile(file: File): string {
  return `${file.name.toLowerCase()}|${file.size}|${file.lastModified}|${file.type}`;
}

export function findDuplicate(document: CollectionDocument, documents: readonly CollectionDocument[]): string | null {
  const duplicate = documents.find((candidate) => candidate.documentId !== document.documentId && candidate.fingerprint === document.fingerprint);
  return duplicate?.documentId ?? null;
}

function allCategory(documents: readonly CollectionDocument[], category: FileAsset["category"]): boolean { return documents.every((document) => document.asset.category === category); }
function allOffice(documents: readonly CollectionDocument[]): boolean { return allCategory(documents, "office"); }
function allPdf(documents: readonly CollectionDocument[]): boolean { return allCategory(documents, "pdf"); }
function allSearchableType(documents: readonly CollectionDocument[]): boolean { return documents.every((document) => document.asset.category === "pdf" || document.asset.category === "office"); }

export function evaluateCollectionCompatibility(documents: readonly CollectionDocument[], operation: CollectionOperation): CompatibilityResult {
  if (documents.length === 0) return { supported: false, message: "Add at least one document before planning a collection workflow.", warnings: [] };
  if (documents.length > COLLECTION_LIMITS.maxDocuments) return { supported: false, message: `Collections are limited to ${COLLECTION_LIMITS.maxDocuments} documents.`, warnings: [] };
  if (operation === "merge-pdfs") {
    if (documents.length < 2 || !allPdf(documents)) return { supported: false, message: "These files cannot be processed together for this operation. PDF merge requires at least two PDF documents.", warnings: ["Do not silently remove incompatible files."] };
    return { supported: true, message: "All selected documents are compatible PDF merge inputs.", warnings: [] };
  }
  if (operation === "image-collection-to-pdf") {
    if (!allCategory(documents, "image")) return { supported: false, message: "These files cannot be processed together for this operation. Ordered image-to-PDF requires images only.", warnings: [] };
    return { supported: true, message: "The selected images will keep their explicit order in one PDF.", warnings: [] };
  }
  if (operation === "optimize-pdfs") {
    if (!allPdf(documents)) return { supported: false, message: "These files cannot be processed together for this operation. Collection optimization requires PDF documents only.", warnings: [] };
    const pages = documents.reduce((sum, document) => sum + (document.asset.category === "pdf" ? document.asset.pageCount : 0), 0);
    if (pages > COLLECTION_LIMITS.maxPdfPages) return { supported: false, message: `The selected PDFs contain ${pages} pages; the collection limit is ${COLLECTION_LIMITS.maxPdfPages}.`, warnings: [] };
    return { supported: true, message: "Each PDF will be optimized sequentially and validated independently.", warnings: ["One failed document will not invalidate already validated outputs."] };
  }
  if (operation === "multi-document-search") {
    if (!allSearchableType(documents)) return { supported: false, message: "These files cannot be processed together for this operation. Search accepts PDF, DOCX, PPTX, and XLSX sources.", warnings: [] };
    return { supported: true, message: `Search will cover at most ${COLLECTION_LIMITS.maxSearchCharacters.toLocaleString()} characters and ${COLLECTION_LIMITS.maxMatches} matches.`, warnings: ["Results will identify the source document and page, slide, sheet, or cell where available."] };
  }
  if (["multi-document-summarize", "multi-document-extract", "multi-document-ask", "multi-document-structure"].includes(operation)) {
    if (!allSearchableType(documents)) return { supported: false, message: "These files cannot be processed together for this operation. Bounded document intelligence accepts PDF and Office sources.", warnings: [] };
    return { supported: true, message: "Only bounded text and structure context may be prepared for the selected documents.", warnings: ["AI interpretation requires explicit consent and retains source provenance."] };
  }
  return { supported: true, message: "The selected documents can be inspected together.", warnings: [] };
}

const transitions: Record<CollectionState, readonly CollectionState[]> = {
  idle: ["collecting"], collecting: ["collecting", "inspecting", "planning", "idle"], inspecting: ["planning", "failed", "recoverable-error", "cancelled"], planning: ["review", "failed", "recoverable-error"], review: ["awaiting-confirmation", "queued", "planning", "collecting", "idle"], "awaiting-confirmation": ["queued", "review", "idle"], queued: ["running", "cancelled", "idle"], running: ["validating", "partial-success", "failed", "cancelled", "recoverable-error"], validating: ["completed", "partial-success", "failed", "recoverable-error"], completed: ["collecting", "idle", "review"], "partial-success": ["review", "running", "collecting", "idle"], failed: ["review", "recoverable-error", "idle"], cancelled: ["collecting", "review", "idle"], "recoverable-error": ["review", "running", "idle"],
};

export function canTransitionCollection(from: CollectionState, to: CollectionState): boolean { return from === to || transitions[from].includes(to); }
export function transitionCollectionState(from: CollectionState, to: CollectionState): CollectionState { if (!canTransitionCollection(from, to)) throw new Error(`Invalid collection transition: ${from} → ${to}`); return to; }
