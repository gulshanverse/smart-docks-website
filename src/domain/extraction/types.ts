export const EXTRACTION_CONTRACT_VERSION = "phase13-extraction-v1" as const;

export const EXTRACTION_LIMITS = {
  maxSchemaDepth: 4,
  maxFields: 80,
  maxRecords: 100,
  maxEvidenceExcerpt: 300,
  maxEvidencePerField: 8,
  maxCollectionDocuments: 12,
  maxExportBytes: 2_000_000,
} as const;

export type ExtractionDocumentType = "invoice" | "receipt" | "contract" | "resume" | "form" | "financial-document" | "identity-document-signal" | "purchase-order" | "generic-document";
export type ExtractionFieldType = "string" | "number" | "integer" | "boolean" | "date" | "datetime" | "currency" | "percentage" | "email" | "phone" | "url" | "enum" | "array" | "object" | "table";
export type ExtractionConfidence = "high" | "medium" | "low" | "unknown";
export type ExtractionStatus = "validated" | "extracted" | "normalized" | "inferred" | "unknown" | "missing" | "conflicting" | "invalid";
export type ExtractionMethod = "native-text" | "ocr" | "deterministic" | "ai" | "normalized" | "inferred";
export type ExtractionWarningCode = "missing-required-field" | "weak-pattern" | "ambiguous-date" | "conflicting-values" | "invalid-value" | "unsupported-field" | "unverified-identity" | "bounded-context" | "ai-untrusted" | "duplicate-record";
export type ExtractionExportFormat = "json" | "csv";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface ExtractionNormalizationRule {
  readonly id: string;
  readonly description: string;
  readonly kind: "trim" | "date" | "datetime" | "number" | "currency" | "percentage" | "lowercase" | "uppercase" | "phone" | "custom";
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
}

export interface ExtractionValidationRule {
  readonly id: string;
  readonly description: string;
  readonly kind: "required" | "regex" | "range" | "enum" | "format" | "cross-field" | "evidence-required";
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly allowedValues?: readonly string[];
}

export interface ExtractionEvidence {
  readonly evidenceId: string;
  readonly documentId: string;
  readonly sourceType: "native-text" | "ocr" | "office-text" | "office-cell" | "image" | "ai" | "measured";
  readonly sourceId: string;
  readonly pageNumber: number | null;
  readonly slideNumber: number | null;
  readonly sheetName: string | null;
  readonly cellRange: string | null;
  readonly textExcerpt: string;
  readonly startOffset: number | null;
  readonly endOffset: number | null;
  readonly boundingBox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly extractionMethod: ExtractionMethod;
}

export interface ExtractionSourceReference {
  readonly documentId: string;
  readonly documentName: string;
  readonly evidenceIds: readonly string[];
}

export interface ExtractionFieldDefinition {
  readonly id: string;
  readonly label: string;
  readonly type: ExtractionFieldType;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly description: string;
  readonly allowedValues?: readonly string[];
  readonly children?: readonly ExtractionFieldDefinition[];
  readonly itemFields?: readonly ExtractionFieldDefinition[];
  readonly normalizationRules: readonly ExtractionNormalizationRule[];
  readonly validationRules: readonly ExtractionValidationRule[];
  readonly evidenceRequired: boolean;
}

export interface ExtractionSchema {
  readonly schemaId: string;
  readonly contractVersion: typeof EXTRACTION_CONTRACT_VERSION;
  readonly name: string;
  readonly documentType: ExtractionDocumentType;
  readonly description: string;
  readonly fields: readonly ExtractionFieldDefinition[];
  readonly maxDepth: number;
  readonly createdBy: "builtin" | "user";
}

export interface ExtractionFieldValue {
  readonly fieldId: string;
  readonly value: JsonValue;
  readonly normalizedValue: JsonValue | null;
  readonly rawValue: string | null;
  readonly status: ExtractionStatus;
  readonly confidence: ExtractionConfidence;
  readonly confidenceScore: number | null;
  readonly method: ExtractionMethod | null;
  readonly sourceReferences: readonly ExtractionSourceReference[];
  readonly evidence: readonly ExtractionEvidence[];
  readonly warnings: readonly ExtractionWarning[];
}

export interface ExtractionRecord {
  readonly recordId: string;
  readonly documentId: string;
  readonly documentName: string;
  readonly schemaId: string;
  readonly fields: readonly ExtractionFieldValue[];
  readonly status: ExtractionStatus;
  readonly coverage: number;
  readonly warnings: readonly ExtractionWarning[];
  readonly conflicts: readonly ExtractionConflict[];
}

export interface ExtractionWarning {
  readonly code: ExtractionWarningCode;
  readonly message: string;
  readonly fieldId: string | null;
  readonly severity: "info" | "warning" | "error";
}

export interface ExtractionConflict {
  readonly conflictId: string;
  readonly fieldId: string;
  readonly values: readonly JsonValue[];
  readonly sourceReferences: readonly ExtractionSourceReference[];
  readonly message: string;
}

export interface ExtractionValidationResult {
  readonly valid: boolean;
  readonly status: "validated" | "warning" | "conflict" | "failed";
  readonly errors: readonly string[];
  readonly warnings: readonly ExtractionWarning[];
  readonly conflicts: readonly ExtractionConflict[];
  readonly checkedFieldIds: readonly string[];
}

export interface ExtractionDocumentResult {
  readonly documentId: string;
  readonly documentName: string;
  readonly documentType: ExtractionDocumentType;
  readonly record: ExtractionRecord | null;
  readonly validation: ExtractionValidationResult;
  readonly status: "validated" | "partial" | "failed" | "cancelled" | "empty";
  readonly warnings: readonly ExtractionWarning[];
}

export interface ExtractionAggregationRule {
  readonly id: string;
  readonly fieldId: string;
  readonly operation: "sum" | "count" | "unique" | "first" | "last" | "group";
  readonly outputFieldId: string;
}

export interface ExtractionCollectionResult {
  readonly collectionId: string;
  readonly schemaId: string;
  readonly documentIds: readonly string[];
  readonly documents: readonly ExtractionDocumentResult[];
  readonly records: readonly ExtractionRecord[];
  readonly aggregates: readonly ExtractionFieldValue[];
  readonly duplicateRecordIds: readonly string[];
  readonly conflicts: readonly ExtractionConflict[];
  readonly coverage: number;
  readonly status: "validated" | "partial" | "failed" | "cancelled" | "empty" | "conflict";
  readonly warnings: readonly ExtractionWarning[];
}

export interface ExtractionExportResult {
  readonly format: ExtractionExportFormat;
  readonly fileName: string;
  readonly mimeType: "application/json" | "text/csv";
  readonly bytes: number;
  readonly content: string;
  readonly valid: boolean;
  readonly warnings: readonly ExtractionWarning[];
}

export interface ExtractionPlan {
  readonly planId: string;
  readonly contractVersion: typeof EXTRACTION_CONTRACT_VERSION;
  readonly goal: string;
  readonly schema: ExtractionSchema;
  readonly documentIds: readonly string[];
  readonly documentType: ExtractionDocumentType;
  readonly requiresOcr: boolean;
  readonly requiresTextExtraction: boolean;
  readonly requiresAi: boolean;
  readonly deterministicOpportunities: readonly string[];
  readonly normalizationRequirements: readonly string[];
  readonly validationRequirements: readonly string[];
  readonly provenanceRequirements: readonly string[];
  readonly aggregationRules: readonly ExtractionAggregationRule[];
  readonly exportFormats: readonly ExtractionExportFormat[];
  readonly processingBoundary: "browser-local" | "browser-local-to-ai-gateway";
  readonly risk: "low" | "medium" | "high";
  readonly warnings: readonly ExtractionWarning[];
  readonly workflowStepIds: readonly string[];
  readonly valid: boolean;
}
