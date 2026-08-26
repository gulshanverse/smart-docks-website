import { normalizeDocumentType, normalizedFact } from "../../domain/ai/normalization";
import { contextBlockReference, referencesForText } from "../../domain/ai/provenance";
import type { AiAnswerResult, AiClassificationResult, AiDocumentProvider, AiDocumentRequest, AiDocumentResponse, AiExtractionResult, AiFailureResponse, AiModelConfig, AiOperationResult, AiSourceReference, AiStructureResult, AiSummaryResult } from "../../domain/ai/types";
import { MAX_AI_RESPONSE_CHARS } from "../../domain/ai/types";

const mockModel: AiModelConfig = { providerId: "deterministic-mock", modelId: "mock-phase6-v1", maxOutputTokens: 1_800, temperature: 0, structuredOutput: true, streaming: false };

function sources(request: AiDocumentRequest): AiSourceReference[] { return request.context.pages.flatMap((page) => page.blocks.slice(0, 4).map(contextBlockReference)).slice(0, 12); }
function response(request: AiDocumentRequest, result: AiOperationResult, started: number): AiDocumentResponse { return { version: "phase6-result-v1", requestId: request.requestId, operation: request.operation, state: "completed", model: mockModel, result, usage: { inputTokens: request.context.estimatedInputTokens, outputTokens: null, estimated: true }, processingTimeMs: Math.max(0, Math.round(performance.now() - started)), processingBoundary: "deterministic-mock" }; }
function failure(request: AiDocumentRequest, code: AiFailureResponse["error"]["code"], message: string): AiFailureResponse { return { version: "phase6-result-v1", requestId: request.requestId, operation: request.operation, state: "failed", error: { code, message, retryable: false }, processingBoundary: "deterministic-mock" }; }
function text(request: AiDocumentRequest): string { return request.context.pages.map((page) => page.text).join(" ").slice(0, MAX_AI_RESPONSE_CHARS); }
function findFact(request: AiDocumentRequest, patterns: RegExp[]): { value: string; source: AiSourceReference[] } | null {
  for (const pattern of patterns) {
    const match = text(request).match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      return { value, source: referencesForText(request.context, value).slice(0, 3).length > 0 ? referencesForText(request.context, value).slice(0, 3) : sources(request).slice(0, 1) };
    }
  }
  return null;
}
function classify(request: AiDocumentRequest): AiClassificationResult {
  const body = text(request).toLocaleLowerCase();
  const documentType = body.includes("invoice") ? "invoice" : body.includes("receipt") ? "receipt" : body.includes("agreement") || body.includes("contract") ? "contract" : normalizeDocumentType(request.context.structure.documentType.value);
  const evidence = sources(request).slice(0, 3);
  return { documentType, confidence: evidence.length > 0 && documentType !== "unknown" ? "medium" : "unknown", reason: documentType === "unknown" ? "The bounded context did not contain enough reliable classification evidence." : `The bounded context contains terms associated with a ${documentType} document.`, evidence };
}
function summary(request: AiDocumentRequest): AiSummaryResult {
  const body = text(request); const refs = sources(request).slice(0, 3); const sentence = body.split(/(?<=[.!?])\s+/)[0]?.slice(0, 600) || "Not found in document.";
  const dates = findFact(request, [/(?:due|effective|issue|expiry|appointment|filing|signature)\s+date\s*[:\-]?\s*([^.;\n]+)/i, /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/]);
  const amounts = findFact(request, [/(?:total|amount|subtotal|tax)\s*[:\-]?\s*([^.;\n]+)/i, /([₹$€£]\s?[\d,]+(?:\.\d{2})?)/]);
  return { shortSummary: sentence, detailedSummary: body ? `The bounded document context begins: ${sentence}` : "Not found in document.", keyPoints: body ? [{ text: sentence, source: refs }] : [], purpose: { value: body ? "The purpose could not be determined with certainty from the bounded context." : null, source: refs }, importantDates: dates ? [normalizedFact("important_date", dates.value, "medium", dates.source)] : [], importantEntities: [], importantAmounts: amounts ? [normalizedFact("important_amount", amounts.value, "medium", amounts.source)] : [], warnings: ["AI-generated summary from the deterministic mock provider; verify important information against the source document."] };
}
function answer(request: AiDocumentRequest): AiAnswerResult {
  const query = (request.query ?? "").toLocaleLowerCase();
  if (!query.trim()) return { answer: "I couldn't find that in the document because no question was supplied.", confidence: "unknown", sourceStatus: "not-found", sources: [], conflicts: [], warnings: [] };
  const due = query.includes("due") ? findFact(request, [/(?:due|payment)\s+(?:date|by)\s*[:\-]?\s*([^.;\n]+)/i]) : null;
  const issuer = query.includes("who") || query.includes("issuer") ? findFact(request, [/(?:issued by|seller|merchant|from)\s*[:\-]?\s*([^.;\n]+)/i]) : null;
  const found = due ?? issuer ?? findFact(request, [new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i")]);
  if (!found) return { answer: "I couldn't find that in the document.", confidence: "unknown", sourceStatus: "not-found", sources: [], conflicts: [], warnings: [] };
  return { answer: found.value, confidence: "medium", sourceStatus: "supported", sources: found.source, conflicts: [], warnings: ["AI-generated answer from the deterministic mock provider; verify against the source document."] };
}
function extraction(request: AiDocumentRequest): AiExtractionResult {
  const schemaId = request.schemaId; const fields = request.context.structure.sections.slice(0, 0).map(() => normalizedFact("unused", null, "unknown", []));
  const invoice = schemaId === "invoice" ? ["invoice_number", "invoice_date", "due_date", "seller", "buyer", "subtotal", "tax", "total", "currency", "payment_terms"] : ["title", "purpose", "important_dates", "important_entities", "important_amounts"];
  const extracted = invoice.map((field) => {
    const found = findFact(request, [new RegExp(`${field.replace(/_/g, "[ _-]")}\\s*[:\\-]?\\s*([^.;\\n]+)`, "i")]);
    return normalizedFact(field, found?.value ?? null, found ? "medium" : "unknown", found?.source ?? [], found ? "verified" : "not-found");
  });
  return { schemaId, schemaVersion: request.schemaVersion, documentType: classify(request).documentType, fields: [...fields, ...extracted], entities: [], tables: [], warnings: ["Missing fields are explicitly marked not-found; no values were inferred."] };
}
function structure(request: AiDocumentRequest): AiStructureResult {
  const sections = request.context.structure.sections.slice(0, 20).map((section) => ({ title: section.title, pageNumber: section.pageNumber, confidence: "medium" as const, source: request.context.pages.find((page) => page.pageNumber === section.pageNumber)?.sourceReferences.slice(0, 2) ?? [] }));
  return { title: { value: request.context.structure.title.value, confidence: "unknown", source: [] }, sections, tables: [], forms: [], warnings: ["Structure enrichment is provided by the deterministic mock provider; table and form reconstruction is not claimed."] };
}

export class DeterministicMockAiProvider implements AiDocumentProvider {
  readonly id = "deterministic-mock";
  readonly model = mockModel;
  private run(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse> {
    const started = performance.now();
    if (signal?.aborted) return Promise.resolve(failure(request, "cancelled", "AI request cancelled. Partial output was discarded."));
    let result: AiOperationResult;
    if (request.operation === "classify") result = { operation: "classify", value: classify(request) };
    else if (request.operation === "summarize") result = { operation: "summarize", value: summary(request) };
    else if (request.operation === "extract") result = { operation: "extract", value: extraction(request) };
    else if (request.operation === "ask") result = { operation: "ask", value: answer(request) };
    else result = { operation: "structure", value: structure(request) };
    return Promise.resolve(response(request, result, started));
  }
  analyzeDocument(request: AiDocumentRequest, signal?: AbortSignal) { return this.run(request, signal); }
  summarizeDocument(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "summarize" }, signal); }
  extractFields(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "extract" }, signal); }
  answerQuestion(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "ask" }, signal); }
  classifyDocument(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "classify" }, signal); }
  extractStructuredData(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "extract" }, signal); }
}
