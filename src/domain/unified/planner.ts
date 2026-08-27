import { parseConversionIntent, parseImageIntent, parsePdfIntent } from "../intents/parse-intent";
import { toolRegistry } from "../tools/registry";
import type { FileAsset } from "../files/types";
import type { UnifiedIntent, UnifiedOperation, UnifiedWorkflowPlan, UnifiedWorkflowStep } from "./types";

function hasTool(id: string): boolean { return toolRegistry.some((tool) => tool.id === id); }
function step(id: string, capability: string, input: string, output: string, options: Partial<UnifiedWorkflowStep> = {}): UnifiedWorkflowStep {
  return { id, capability, input, output, status: "ready", risk: "low", processingBoundary: "browser-local", requiresConfirmation: false, supportsCancellation: true, validationRequirement: "Validate the engine result before download.", ...options };
}
function unsupportedIntent(asset: FileAsset, goal: string, message: string): UnifiedWorkflowPlan {
  const intent: UnifiedIntent = { contractVersion: "phase10-intent-v1", sourceDocumentId: asset.id, goal, operation: "unsupported", target: null, constraints: [], outputFormat: null, selectedPages: null, confirmationPolicy: "none", processingBoundary: "browser-local", evidence: [{ type: "unknown", label: "Goal is not mapped to an implemented capability." }], confidence: "low" };
  return { id: `${asset.id}-unsupported`, source: asset, intent, steps: [step("unsupported", "No implemented capability", "source document", "no output", { status: "failed", risk: "unknown", supportsCancellation: false, validationRequirement: "No output is permitted." })], risk: "unknown", processingBoundary: "browser-local", requiresConfirmation: false, expectedOutput: "No output", validationPlan: ["Do not offer a download."], warnings: [message] };
}

export function planUnifiedWorkflow(asset: FileAsset, goal: string): UnifiedWorkflowPlan {
  const normalized = goal.trim().replace(/\s+/g, " ");
  if (asset.category === "image") {
    const conversion = parseConversionIntent(normalized);
    if (conversion.status === "valid" && conversion.intent && conversion.intent.targetFormat) {
      const conversionTarget = conversion.intent.targetFormat;
      const intent: UnifiedIntent = { contractVersion: "phase10-intent-v1", sourceDocumentId: asset.id, goal: normalized, operation: "pdf.convert", target: conversionTarget, constraints: [conversion.intent.quality ?? "default quality"], outputFormat: conversion.intent.targetFormat, selectedPages: conversion.intent.pageSelection.value, confirmationPolicy: "review", processingBoundary: "browser-local", evidence: [{ type: "user-selected", label: "Parsed conversion goal" }], confidence: "high" };
      return { id: `${asset.id}-conversion`, source: asset, intent, steps: [step("conversion.plan", "Image conversion", "image", conversionTarget, { requiresConfirmation: false }) , step("conversion.validate", "Output validation", "generated file", "validated file")], risk: "low", processingBoundary: "browser-local", requiresConfirmation: false, expectedOutput: `Validated ${conversionTarget.toUpperCase()} output`, validationPlan: ["Check signature", "Check dimensions", "Check decodability", "Measure bytes"], warnings: [] };
    }
    const parsed = parseImageIntent(normalized);
    if (parsed.status === "valid" && parsed.intent) {
      const intent: UnifiedIntent = { contractVersion: "phase10-intent-v1", sourceDocumentId: asset.id, goal: normalized, operation: "image.compress", target: parsed.intent.targetLabel, constraints: ["Preserve acceptable quality"], outputFormat: asset.mimeType, selectedPages: null, confirmationPolicy: "review", processingBoundary: "browser-local", evidence: [{ type: "user-selected", label: "Parsed target size" }], confidence: "high" };
      return { id: `${asset.id}-image-compress`, source: asset, intent, steps: [step("image.compress", "Target-size image optimization", "image", "optimized image"), step("image.validate", "Image validation", "optimized image", "validated image")], risk: "low", processingBoundary: "browser-local", requiresConfirmation: false, expectedOutput: "Validated optimized image", validationPlan: ["Check signature", "Check dimensions", "Check byte target", "Decode output"], warnings: [] };
    }
    return unsupportedIntent(asset, normalized, parsed.message);
  }
  if (asset.category === "office") {
    const isExtract = /extract|text|content|inside|read|sheet|formula|cell|workbook/i.test(normalized);
    const operation: UnifiedOperation = isExtract ? "office.extract_text" : /convert.*pdf|pdf.*convert/i.test(normalized) ? "unsupported" : "office.inspect";
    if (operation === "unsupported") return unsupportedIntent(asset, normalized, "Office-to-PDF conversion is not implemented; no screenshot-based conversion is offered.");
    const intent: UnifiedIntent = { contractVersion: "phase10-intent-v1", sourceDocumentId: asset.id, goal: normalized, operation, target: isExtract ? "bounded TXT" : asset.format.toUpperCase(), constraints: ["Bounded package inspection", "No Office rendering claim"], outputFormat: isExtract ? "text/plain" : null, selectedPages: null, confirmationPolicy: "review", processingBoundary: "browser-local", evidence: [{ type: "detected", label: `${asset.format.toUpperCase()} package classification` }], confidence: "high" };
    const steps = [step("office.inspect", "Office package inspection", "Office package", "validated analysis"), ...(isExtract ? [step("office.extract_text", "Bounded text extraction", "Office analysis", "TXT file")] : []), step("office.validate", "Office validation", "analysis/output", "validated result")];
    return { id: `${asset.id}-office-${operation}`, source: asset, intent, steps, risk: "low", processingBoundary: "browser-local", requiresConfirmation: false, expectedOutput: isExtract ? "Validated bounded TXT export" : "Validated Office analysis", validationPlan: ["Check package structure", "Check safe paths", "Check bounded parts", "Check format-specific signals"], warnings: [] };
  }
  const parsed = parsePdfIntent(normalized);
  const isConvert = /convert|render|png|jpe?g|webp|image/i.test(normalized);
  const isOcr = /ocr|searchable/i.test(normalized);
  const isSearch = /find|search/i.test(normalized);
  const isUnderstand = /summarize|summary|understand|extract|classif/i.test(normalized);
  const isEdit = /redact|highlight|annotate|remove.*page|delete.*page|rotate|crop|resize/i.test(normalized);
  const isOrganize = /merge|split|reorder|extract pages?/i.test(normalized);
  const operation: UnifiedOperation = parsed.status === "valid" ? "pdf.optimize" : isConvert ? "pdf.convert" : isOcr ? "pdf.ocr" : isSearch ? "pdf.search" : isUnderstand ? "pdf.understand" : isEdit ? "pdf.edit" : isOrganize ? "pdf.organize" : "unsupported";
  if (operation === "unsupported") return unsupportedIntent(asset, normalized, parsed.message);
  const intent: UnifiedIntent = { contractVersion: "phase10-intent-v1", sourceDocumentId: asset.id, goal: normalized, operation, target: parsed.intent?.targetLabel ?? null, constraints: ["Preserve original source", "Validate before download"], outputFormat: isConvert ? (normalized.match(/\b(png|jpe?g|webp)\b/i)?.[1] ?? "image") : "application/pdf", selectedPages: normalized.match(/pages?\s+([\d,\-– ]+)/i)?.[1]?.trim() ?? null, confirmationPolicy: isEdit ? "explicit" : "review", processingBoundary: operation === "pdf.understand" ? "browser-local-to-ai-gateway" : "browser-local", evidence: [{ type: "detected", label: "PDF source" }, ...(parsed.intent ? [{ type: "user-selected" as const, label: "Parsed target size" }] : [])], confidence: parsed.status === "valid" || isConvert || isOcr || isSearch || isUnderstand || isEdit || isOrganize ? "high" : "medium" };
  const planSteps: UnifiedWorkflowStep[] = [step("pdf.inspect", "PDF inspection", "PDF", "bounded analysis"), ...(isOcr ? [step("pdf.ocr", "OCR/searchable PDF", "scanned pages", "searchable PDF", { risk: "medium" })] : []), ...(isSearch ? [step("pdf.search", "Local document search", "bounded text", "source references")] : []), ...(isUnderstand ? [step("ai.review", "AI document understanding", "bounded JSON context", "reviewable interpretation", { processingBoundary: "browser-local-to-ai-gateway", requiresConfirmation: true, risk: "medium" })] : []), ...(isEdit ? [step("pdf.review", "Safe document action review", "reviewed proposal", "confirmed action", { requiresConfirmation: true, risk: "high" }), step("pdf.edit", "Deterministic PDF action", "confirmed action", "edited PDF", { requiresConfirmation: true, risk: "high" })] : []), ...(isOrganize ? [step("pdf.organize", "PDF page organization", "selected pages", "organized PDF")] : []), ...(operation === "pdf.optimize" ? [step("pdf.optimize", "Target-size PDF optimization", "bounded analysis", "optimized PDF", { risk: "medium" })] : []), ...(isConvert ? [step("pdf.convert", "PDF-to-image conversion", "selected pages", "images")] : []), step("pdf.validate", "Output validation", "generated output", "validated result")];
  return { id: `${asset.id}-${operation}`, source: asset, intent, steps: planSteps, risk: isEdit ? "high" : isUnderstand ? "medium" : "low", processingBoundary: intent.processingBoundary, requiresConfirmation: isEdit || isUnderstand, expectedOutput: isConvert ? "Validated image output" : operation === "pdf.search" || operation === "pdf.understand" ? "Reviewable document result" : "Validated PDF result", validationPlan: ["Reopen generated file where applicable", "Check expected structure", "Check preview", "Do not offer partial output"], warnings: isUnderstand ? ["AI interpretation is visually separated from measured and detected facts and never mutates the source directly."] : [] };
}

export function availableCapabilities(asset: FileAsset): readonly string[] {
  if (asset.category === "image") return ["image.compress.target_size", "image.convert.to_pdf", "image.convert.jpeg_to_png", "image.convert.jpeg_to_webp", "image.convert.png_to_jpeg", "image.convert.png_to_webp", "image.convert.webp_to_jpeg", "image.convert.webp_to_png"].filter(hasTool);
  if (asset.category === "office") return ["office.inspect.word", "office.inspect.presentation", "office.inspect.spreadsheet", "office.extract.text", "office.preview.word", "office.preview.presentation", "office.preview.spreadsheet", "office.validate"].filter((id) => hasTool(id) && ((asset.format === "docx" && !id.includes("presentation") && !id.includes("spreadsheet")) || (asset.format === "pptx" && !id.includes("word") && !id.includes("spreadsheet")) || (asset.format === "xlsx" && !id.includes("word") && !id.includes("presentation"))));
  return ["pdf.inspect", "pdf.convert.pages_to_jpeg", "pdf.convert.pages_to_png", "pdf.convert.pages_to_webp", "pdf.optimize.target_size", "pdf.ocr.inspect", "pdf.text.search", "pdf.document.classify", "pdf.redact.region", "pdf.merge", "pdf.split"].filter(hasTool);
}
