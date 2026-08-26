import type { AiAnswerResult, AiClassificationResult, AiDocumentContext, AiDocumentResponse, AiExtractionResult, AiOperationResult, AiSourceReference, AiStructureResult, AiSummaryResult } from "./types";
import { MAX_AI_BLOCKS, MAX_AI_PAGES, MAX_AI_QUERY_CHARS, MAX_AI_RESPONSE_CHARS, MAX_AI_RESULT_ITEMS, MAX_AI_SOURCE_EXCERPT_CHARS } from "./types";
import { referenceIsWithinContext as referenceWithinContext } from "./provenance";

const confidenceValues = new Set(["high", "medium", "low", "unknown"]);
const documentTypes = new Set(["invoice", "receipt", "bank-statement", "resume", "contract", "agreement", "report", "research-paper", "letter", "application-form", "identity-document", "tax-document", "medical-document", "book", "manual", "presentation", "other", "unknown"]);

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function addStringError(errors: string[], label: string, value: unknown, max: number): void { if (typeof value !== "string") errors.push(`${label} must be a string.`); else if (value.length > max) errors.push(`${label} exceeds the ${max}-character limit.`); }
function validateReference(reference: unknown, context: AiDocumentContext, errors: string[], label: string): void {
  if (!isObject(reference)) { errors.push(`${label} is not an object.`); return; }
  if (!Number.isInteger(reference.pageNumber) || !referenceWithinContext(reference as unknown as AiSourceReference, context)) errors.push(`${label} points outside the supplied document context.`);
  if (reference.excerpt !== null && reference.excerpt !== undefined) addStringError(errors, `${label}.excerpt`, reference.excerpt, MAX_AI_SOURCE_EXCERPT_CHARS);
  if (reference.confidence !== undefined && !confidenceValues.has(String(reference.confidence))) errors.push(`${label}.confidence is invalid.`);
}
function validateReferences(references: unknown, context: AiDocumentContext, errors: string[], label: string): void {
  if (!Array.isArray(references)) { errors.push(`${label} must be an array.`); return; }
  if (references.length > MAX_AI_RESULT_ITEMS) errors.push(`${label} exceeds the item limit.`);
  references.forEach((reference, index) => validateReference(reference, context, errors, `${label}[${index}]`));
}
function validateClassification(value: AiClassificationResult, context: AiDocumentContext, errors: string[]): void {
  if (!documentTypes.has(value.documentType)) errors.push("documentType is invalid.");
  if (!confidenceValues.has(value.confidence)) errors.push("classification confidence is invalid.");
  addStringError(errors, "classification reason", value.reason, MAX_AI_RESPONSE_CHARS);
  validateReferences(value.evidence, context, errors, "classification evidence");
}
function validateSummary(value: AiSummaryResult, context: AiDocumentContext, errors: string[]): void {
  addStringError(errors, "shortSummary", value.shortSummary, 1_200);
  addStringError(errors, "detailedSummary", value.detailedSummary, MAX_AI_RESPONSE_CHARS);
  if (!Array.isArray(value.keyPoints) || value.keyPoints.length > MAX_AI_RESULT_ITEMS) errors.push("keyPoints is invalid or too large.");
  else value.keyPoints.forEach((point, index) => { if (!isObject(point)) errors.push(`keyPoints[${index}] is invalid.`); else { addStringError(errors, `keyPoints[${index}].text`, point.text, 1_200); validateReferences(point.source, context, errors, `keyPoints[${index}].source`); } });
  validateFacts(value.importantDates, context, errors, "importantDates");
  validateFacts(value.importantAmounts, context, errors, "importantAmounts");
  if (!Array.isArray(value.importantEntities) || value.importantEntities.length > MAX_AI_RESULT_ITEMS) errors.push("importantEntities is invalid or too large.");
  else value.importantEntities.forEach((entity, index) => { if (!isObject(entity)) errors.push(`importantEntities[${index}] is invalid.`); else { addStringError(errors, `importantEntities[${index}].value`, entity.value, 500); validateReferences(entity.source, context, errors, `importantEntities[${index}].source`); } });
}
function validateFacts(facts: unknown, context: AiDocumentContext, errors: string[], label: string): void {
  if (!Array.isArray(facts) || facts.length > MAX_AI_RESULT_ITEMS) { errors.push(`${label} is invalid or too large.`); return; }
  facts.forEach((fact, index) => { if (!isObject(fact)) errors.push(`${label}[${index}] is invalid.`); else { addStringError(errors, `${label}[${index}].field`, fact.field, 160); if (fact.rawValue !== null) addStringError(errors, `${label}[${index}].rawValue`, fact.rawValue, 900); validateReferences(fact.source, context, errors, `${label}[${index}].source`); } });
}
function validateExtraction(value: AiExtractionResult, context: AiDocumentContext, errors: string[]): void {
  addStringError(errors, "schemaId", value.schemaId, 80); addStringError(errors, "schemaVersion", value.schemaVersion, 40); if (!documentTypes.has(value.documentType)) errors.push("extraction documentType is invalid."); validateFacts(value.fields, context, errors, "fields");
  if (!Array.isArray(value.tables) || value.tables.length > MAX_AI_RESULT_ITEMS) errors.push("tables is invalid or too large."); else value.tables.forEach((table, index) => { if (!isObject(table) || !Number.isInteger(table.pageNumber) || table.pageNumber < 1 || table.pageNumber > context.pageCount) errors.push(`tables[${index}] has an invalid page.`); else validateReferences(table.source, context, errors, `tables[${index}].source`); });
}
function validateAnswer(value: AiAnswerResult, context: AiDocumentContext, errors: string[]): void {
  addStringError(errors, "answer", value.answer, MAX_AI_RESPONSE_CHARS); if (!confidenceValues.has(value.confidence)) errors.push("answer confidence is invalid."); validateReferences(value.sources, context, errors, "answer sources");
  if (value.sourceStatus === "supported" && value.sources.length === 0) errors.push("supported answer must include at least one source reference.");
  if (value.sourceStatus === "not-found" && !/couldn't find|not found|unable to find/i.test(value.answer)) errors.push("not-found answer must state that the information was not found.");
  if (!Array.isArray(value.conflicts) || value.conflicts.length > MAX_AI_RESULT_ITEMS) errors.push("answer conflicts are invalid or too large.");
}
function validateStructure(value: AiStructureResult, context: AiDocumentContext, errors: string[]): void {
  if (!isObject(value.title)) errors.push("structure title is invalid."); else { addStringError(errors, "structure title", value.title.value, 900); validateReferences(value.title.source, context, errors, "structure title source"); }
  if (!Array.isArray(value.sections) || value.sections.length > MAX_AI_RESULT_ITEMS) errors.push("structure sections are invalid or too large."); else value.sections.forEach((section, index) => { if (!isObject(section) || !Number.isInteger(section.pageNumber) || section.pageNumber < 1 || section.pageNumber > context.pageCount) errors.push(`structure section ${index} has an invalid page.`); else validateReferences(section.source, context, errors, `structure section ${index} source`); });
}

export function validateAiResult(result: AiOperationResult, context: AiDocumentContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!result || !isObject(result)) return { valid: false, errors: ["AI result is not an object."] };
  if (result.operation === "classify") validateClassification(result.value, context, errors);
  else if (result.operation === "summarize") validateSummary(result.value, context, errors);
  else if (result.operation === "extract") validateExtraction(result.value, context, errors);
  else if (result.operation === "ask") validateAnswer(result.value, context, errors);
  else if (result.operation === "structure") validateStructure(result.value, context, errors);
  else errors.push("AI operation is unsupported.");
  return { valid: errors.length === 0, errors };
}

export function validateAiResponse(response: unknown, context: AiDocumentContext, expectedOperation: AiDocumentResponse["operation"]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(response)) return { valid: false, errors: ["AI response is not an object."] };
  if (response.version !== "phase6-result-v1") errors.push("AI result version is unsupported.");
  if (response.state !== "completed") errors.push("AI response is not completed.");
  if (response.operation !== expectedOperation) errors.push("AI response operation does not match the request.");
  if (!isObject(response.result) || response.result.operation !== expectedOperation) errors.push("AI response result operation is invalid.");
  else errors.push(...validateAiResult(response.result as AiOperationResult, context).errors);
  return { valid: errors.length === 0, errors };
}

export function validateAiRequestLimits(query: string | null, context: AiDocumentContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (query !== null && query.length > MAX_AI_QUERY_CHARS) errors.push(`Query exceeds the ${MAX_AI_QUERY_CHARS}-character limit.`);
  if (context.pages.length > MAX_AI_PAGES) errors.push("AI context contains too many pages.");
  if (context.totalContextChars > 24_000) errors.push("AI context exceeds the total character limit.");
  if (context.pages.some((page) => page.blocks.length > MAX_AI_BLOCKS)) errors.push("AI context contains too many blocks on a page.");
  return { valid: errors.length === 0, errors };
}
