import type { AiDocumentSchema, AiDocumentSchemaRegistry, AiDocumentType } from "./types";

const VERSION = "1";

function schema(id: string, supportedDocumentTypes: AiDocumentType[], fields: AiDocumentSchema["fields"]): AiDocumentSchema {
  return { id, version: VERSION, supportedDocumentTypes, fields };
}

const genericSchema = schema("generic", ["unknown", "other", "report", "research-paper", "letter", "book", "manual", "presentation"], [
  { id: "title", label: "Title", type: "string", required: false },
  { id: "purpose", label: "Purpose", type: "string", required: false },
  { id: "important_dates", label: "Important dates", type: "date", required: false },
  { id: "important_entities", label: "Important entities", type: "entity", required: false },
  { id: "important_amounts", label: "Important amounts", type: "money", required: false },
]);

const invoiceSchema = schema("invoice", ["invoice"], [
  { id: "invoice_number", label: "Invoice number", type: "string", required: false },
  { id: "invoice_date", label: "Invoice date", type: "date", required: false },
  { id: "due_date", label: "Due date", type: "date", required: false },
  { id: "seller", label: "Seller", type: "entity", required: false },
  { id: "buyer", label: "Buyer", type: "entity", required: false },
  { id: "subtotal", label: "Subtotal", type: "money", required: false },
  { id: "tax", label: "Tax", type: "money", required: false },
  { id: "total", label: "Total", type: "money", required: false },
  { id: "currency", label: "Currency", type: "string", required: false },
  { id: "payment_terms", label: "Payment terms", type: "string", required: false },
]);

const receiptSchema = schema("receipt", ["receipt"], [
  { id: "merchant", label: "Merchant", type: "entity", required: false },
  { id: "date", label: "Date", type: "date", required: false },
  { id: "items", label: "Items", type: "string", required: false },
  { id: "subtotal", label: "Subtotal", type: "money", required: false },
  { id: "tax", label: "Tax", type: "money", required: false },
  { id: "total", label: "Total", type: "money", required: false },
  { id: "payment_method", label: "Payment method", type: "string", required: false },
]);

const contractSchema = schema("contract", ["contract", "agreement"], [
  { id: "parties", label: "Parties", type: "entity", required: false },
  { id: "effective_date", label: "Effective date", type: "date", required: false },
  { id: "expiration_date", label: "Expiration date", type: "date", required: false },
  { id: "obligations", label: "Obligations", type: "string", required: false },
  { id: "termination_terms", label: "Termination terms", type: "string", required: false },
  { id: "governing_law", label: "Governing law", type: "string", required: false },
  { id: "payment_terms", label: "Payment terms", type: "string", required: false },
]);

const resumeSchema = schema("resume", ["resume"], [
  { id: "name", label: "Name", type: "string", required: false },
  { id: "email", label: "Email", type: "string", required: false },
  { id: "phone", label: "Phone", type: "string", required: false },
  { id: "education", label: "Education", type: "string", required: false },
  { id: "skills", label: "Skills", type: "string", required: false },
  { id: "experience", label: "Experience", type: "string", required: false },
  { id: "companies", label: "Companies", type: "entity", required: false },
  { id: "dates", label: "Dates", type: "date", required: false },
]);

const schemas = [genericSchema, invoiceSchema, receiptSchema, contractSchema, resumeSchema];

export const documentSchemaRegistry: AiDocumentSchemaRegistry = {
  get(schemaId, version = VERSION) {
    return schemas.find((candidate) => candidate.id === schemaId && candidate.version === version) ?? null;
  },
  list() {
    return schemas.map((candidate) => ({ ...candidate, fields: candidate.fields.map((field) => ({ ...field })) }));
  },
};

export function schemaForDocumentType(documentType: AiDocumentType): AiDocumentSchema {
  return schemas.find((candidate) => candidate.supportedDocumentTypes.includes(documentType)) ?? genericSchema;
}
