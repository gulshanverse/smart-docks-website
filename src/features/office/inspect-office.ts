import type { FileAsset, FileIntakeError } from "../../domain/files/types";
import { DEFAULT_OFFICE_LIMITS, type OfficeAsset, type OfficeDocumentAnalysis, type OfficeDocumentType, type OfficeFeatureSignals, type OfficeFormat, type OfficeMetadata, type OfficeSheetPreview, type OfficeSlideSummary, type OfficeTextBlock, type OfficeWarning } from "../../domain/office/types";
import { openOfficePackage, type OfficePackage } from "./office-package";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation" as const;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const;
const XML_NS = "http://schemas.openxmlformats.org";

function ext(name: string): string {
  const value = name.toLowerCase().split(".").pop() ?? "";
  return value;
}

function formatFor(file: File): OfficeFormat {
  const value = ext(file.name);
  return ["docx", "pptx", "xlsx", "docm", "pptm", "xlsm", "doc", "ppt", "xls"].includes(value) ? value as OfficeFormat : "unknown";
}

function documentType(format: OfficeFormat): OfficeDocumentType {
  if (format === "docx" || format === "docm" || format === "doc") return "word";
  if (format === "pptx" || format === "pptm" || format === "ppt") return "presentation";
  if (format === "xlsx" || format === "xlsm" || format === "xls") return "spreadsheet";
  return "unknown";
}

function textOf(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function directChildren(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", localName));
}

function safeText(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function metadataFrom(xml: string | null): OfficeMetadata {
  if (!xml) return { title: null, subject: null, creator: null, lastModifiedBy: null, created: null, modified: null };
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return {
    title: textOf(doc.getElementsByTagNameNS("*", "title")[0] ?? null) || null,
    subject: textOf(doc.getElementsByTagNameNS("*", "subject")[0] ?? null) || null,
    creator: textOf(doc.getElementsByTagNameNS("*", "creator")[0] ?? null) || null,
    lastModifiedBy: textOf(doc.getElementsByTagNameNS("*", "lastModifiedBy")[0] ?? null) || null,
    created: textOf(doc.getElementsByTagNameNS("*", "created")[0] ?? null) || null,
    modified: textOf(doc.getElementsByTagNameNS("*", "modified")[0] ?? null) || null,
  };
}

function parseXml(xml: string, label: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error(`The ${label} XML part is malformed.`);
  return doc;
}

function packageWarnings(pkg: OfficePackage, format: OfficeFormat): OfficeWarning[] {
  const warnings: OfficeWarning[] = [];
  const names = pkg.entries.map((entry) => entry.name);
  if (format === "docm" || format === "pptm" || format === "xlsm" || names.some((name) => name.toLowerCase().endsWith("vbaProject.bin".toLowerCase()))) {
    warnings.push({ code: "macro-detected", severity: "warning", message: "Macro content was detected. SmartDocs never executes VBA or Office scripts, and conversion capabilities are restricted." });
  }
  if (names.some((name) => name.startsWith("externalLinks/") || name.includes("externalLink"))) {
    warnings.push({ code: "external-links", severity: "warning", message: "External workbook relationships were detected. SmartDocs does not fetch or resolve external content." });
  }
  if (names.some((name) => name.includes("embeddings/") || name.includes("oleObject"))) {
    warnings.push({ code: "embedded-objects", severity: "warning", message: "Embedded objects were detected. SmartDocs inspects only supported XML structure and does not execute embedded content." });
  }
  if (names.some((name) => name.endsWith("comments.xml") || name.includes("comments"))) {
    warnings.push({ code: "comments", severity: "info", message: "Comments are present and may not be represented in every bounded preview." });
  }
  return warnings;
}

function makeCapabilities(type: OfficeDocumentType, format: OfficeFormat, warnings: OfficeWarning[]) {
  const macro = warnings.some((warning) => warning.code === "macro-detected");
  const capabilities = [
    { id: "office.inspect", label: "Bounded package inspection", state: "available" as const, reason: "OOXML markers and selected XML parts were validated locally." },
    { id: "office.extract.text", label: "Bounded text extraction", state: "available" as const, reason: "Text is extracted from selected XML parts into bounded memory." },
    { id: `office.preview.${type}`, label: type === "word" ? "Interpreted Word structure preview" : type === "presentation" ? "Structural slide preview" : "Bounded sheet/cell preview", state: "available" as const, reason: "The preview is format-aware but not a claim of Microsoft Office rendering fidelity." },
    { id: "office.convert.pdf", label: "Office to PDF", state: "unavailable" as const, reason: "No independently verified browser-local faithful Office renderer is bundled." },
  ];
  if (macro) capabilities[3] = { ...capabilities[3], state: "unavailable" as const, reason: "Macro-enabled Office documents cannot be converted locally because macros are never executed." };
  return capabilities;
}

function relationshipTarget(base: string, target: string): string {
  const parts = `${base}/${target}`.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") result.pop(); else result.push(part);
  }
  return result.join("/");
}

function parseDocx(pkg: OfficePackage, limits: typeof DEFAULT_OFFICE_LIMITS): { features: OfficeFeatureSignals; blocks: OfficeTextBlock[]; extractedText: string } {
  const xml = pkg.readText("word/document.xml");
  if (!xml) throw new Error("The DOCX package is missing word/document.xml.");
  const doc = parseXml(xml, "DOCX document");
  const paragraphs = directChildren(doc, "p");
  const blocks: OfficeTextBlock[] = [];
  let headingCount = 0;
  const texts: string[] = [];
  paragraphs.slice(0, 600).forEach((paragraph, index) => {
    const value = safeText(directChildren(paragraph, "t").map((node) => textOf(node)).join(""), 2_000);
    if (!value) return;
    const style = directChildren(paragraph, "pStyle")[0]?.getAttributeNS(XML_NS + "/wordprocessingml", "val") ?? directChildren(paragraph, "pStyle")[0]?.getAttribute("w:val") ?? "";
    const heading = /^Heading\s*\d/i.test(style);
    if (heading) headingCount += 1;
    texts.push(value);
    blocks.push({ id: `paragraph-${index + 1}`, text: value, kind: heading ? "heading" : "paragraph", location: `paragraph ${index + 1}` });
  });
  const text = safeText(texts.join("\n"), limits.maxTextCharacters);
  return {
    features: { paragraphCount: paragraphs.length, headingCount, tableCount: directChildren(doc, "tbl").length, imageCount: directChildren(doc, "blip").length, hyperlinkCount: directChildren(doc, "hyperlink").length, sectionCount: directChildren(doc, "sectPr").length },
    blocks,
    extractedText: text,
  };
}

async function parsePptx(pkg: OfficePackage, limits: typeof DEFAULT_OFFICE_LIMITS): Promise<{ features: OfficeFeatureSignals; blocks: OfficeTextBlock[]; slides: OfficeSlideSummary[]; extractedText: string }> {
  const presentationXml = pkg.readText("ppt/presentation.xml");
  const relsXml = pkg.readText("ppt/_rels/presentation.xml.rels");
  if (!presentationXml || !relsXml) throw new Error("The PPTX package is missing presentation XML relationships.");
  const presentation = parseXml(presentationXml, "PPTX presentation");
  const rels = parseXml(relsXml, "PPTX presentation relationships");
  const targets = new Map<string, string>();
  Array.from(rels.getElementsByTagNameNS("*", "Relationship")).forEach((rel) => { const id = rel.getAttribute("Id"); const target = rel.getAttribute("Target"); if (id && target && target.startsWith("slides/")) targets.set(id, relationshipTarget("ppt", target)); });
  const ids = directChildren(presentation, "sldId");
  const slides: OfficeSlideSummary[] = [];
  const blocks: OfficeTextBlock[] = [];
  const texts: string[] = [];
  for (let index = 0; index < Math.min(ids.length, limits.maxSlides); index += 1) {
    const relId = ids[index].getAttribute("r:id") ?? ids[index].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const target = relId ? targets.get(relId) : null;
    const slideXml = target ? pkg.readText(target) : null;
    if (!slideXml) continue;
    const slide = parseXml(slideXml, `PPTX slide ${index + 1}`);
    const slideTexts = directChildren(slide, "t").map((node) => textOf(node)).filter(Boolean);
    const slideText = safeText(slideTexts.join(" "), 8_000);
    const title = slideTexts[0] ?? null;
    slideTexts.forEach((value, textIndex) => { blocks.push({ id: `slide-${index + 1}-text-${textIndex + 1}`, text: safeText(value, 2_000), kind: textIndex === 0 ? "slide-title" : "slide-text", location: `slide ${index + 1}` }); });
    texts.push(slideText);
    slides.push({ slideNumber: index + 1, title, text: slideText, shapeCount: directChildren(slide, "sp").length, imageCount: directChildren(slide, "pic").length, chartCount: directChildren(slide, "graphicFrame").filter((node) => node.innerHTML.includes("chart")).length });
  }
  return { features: { slideCount: ids.length, titleSignals: slides.map((slide) => slide.title).filter((value): value is string => Boolean(value)), textBoxCount: slides.reduce((sum, slide) => sum + slide.shapeCount, 0), shapeCount: slides.reduce((sum, slide) => sum + slide.shapeCount, 0), imageCount: slides.reduce((sum, slide) => sum + slide.imageCount, 0), chartCount: slides.reduce((sum, slide) => sum + slide.chartCount, 0), notesPresent: pkg.entries.some((entry) => entry.name.startsWith("ppt/notesSlides/")), themePresent: pkg.has("ppt/theme/theme1.xml"), masterPresent: pkg.entries.some((entry) => entry.name.startsWith("ppt/slideMasters/")) }, blocks, slides, extractedText: safeText(texts.join("\n"), limits.maxTextCharacters) };
}

function parseCellAddress(address: string): { column: number; row: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(address);
  if (!match) return { column: 0, row: 0 };
  let column = 0;
  for (const char of match[1].toUpperCase()) column = column * 26 + char.charCodeAt(0) - 64;
  return { column, row: Number(match[2]) };
}

async function parseXlsx(pkg: OfficePackage, limits: typeof DEFAULT_OFFICE_LIMITS): Promise<{ features: OfficeFeatureSignals; blocks: OfficeTextBlock[]; sheets: OfficeSheetPreview[]; extractedText: string }> {
  const workbookXml = pkg.readText("xl/workbook.xml");
  const relsXml = pkg.readText("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) throw new Error("The XLSX package is missing workbook XML relationships.");
  const workbook = parseXml(workbookXml, "XLSX workbook");
  const rels = parseXml(relsXml, "XLSX workbook relationships");
  const targets = new Map<string, string>();
  Array.from(rels.getElementsByTagNameNS("*", "Relationship")).forEach((rel) => { const id = rel.getAttribute("Id"); const target = rel.getAttribute("Target"); if (id && target) targets.set(id, relationshipTarget("xl", target)); });
  const sharedXml = pkg.readText("xl/sharedStrings.xml");
  const shared = sharedXml ? directChildren(parseXml(sharedXml, "XLSX shared strings"), "si").map((node) => directChildren(node, "t").map((part) => textOf(part)).join("")) : [];
  const sheets: OfficeSheetPreview[] = [];
  const blocks: OfficeTextBlock[] = [];
  const texts: string[] = [];
  let formulaCount = 0;
  let mergedCellCount = 0;
  const sheetNodes = directChildren(workbook, "sheet");
  for (const [sheetIndex, sheetNode] of sheetNodes.entries()) {
    const name = sheetNode.getAttribute("name") ?? `Sheet ${sheetIndex + 1}`;
    const state = (sheetNode.getAttribute("state") as OfficeSheetPreview["state"] | null) ?? "visible";
    const relId = sheetNode.getAttribute("r:id") ?? sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const target = relId ? targets.get(relId) : null;
    const sheetXml = target ? pkg.readText(target) : null;
    if (!sheetXml) continue;
    const sheet = parseXml(sheetXml, `XLSX sheet ${name}`);
    const rows = directChildren(sheet, "row");
    const previewRows: OfficeSheetPreview["rows"] = [];
    for (const row of rows.slice(0, limits.maxRowsPerSheet)) {
      for (const cell of directChildren(row, "c").slice(0, 64)) {
        const address = cell.getAttribute("r") ?? "";
        const type = cell.getAttribute("t");
        const formula = textOf(directChildren(cell, "f")[0] ?? null) || null;
        const raw = textOf(directChildren(cell, "v")[0] ?? null);
        const value = type === "s" ? (shared[Number(raw)] ?? "") : type === "inlineStr" ? textOf(directChildren(cell, "t")[0] ?? null) : raw;
        if (formula) formulaCount += 1;
        if (!value && !formula) continue;
        previewRows.push({ address, value: safeText(value, 1_000), formula });
        blocks.push({ id: `sheet-${sheetIndex + 1}-${address}`, text: safeText(formula ? `${value} (${formula})` : value, 1_000), kind: "cell", location: `${name}!${address}` });
        texts.push(`${name}!${address}: ${formula ? `${value} [${formula}]` : value}`);
      }
    }
    const dimension = directChildren(sheet, "dimension")[0]?.getAttribute("ref") ?? null;
    mergedCellCount += directChildren(sheet, "mergeCell").length;
    sheets.push({ name, state, range: dimension, rows: previewRows, truncated: rows.length > limits.maxRowsPerSheet });
  }
  return { features: { sheetCount: sheetNodes.length, visibleSheetCount: sheetNodes.filter((node) => (node.getAttribute("state") ?? "visible") === "visible").length, hiddenSheetCount: sheetNodes.filter((node) => node.getAttribute("state") === "hidden" || node.getAttribute("state") === "veryHidden").length, usedRanges: Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet.range ?? ""])), formulaCount, mergedCellCount, workbookHyperlinkCount: directChildren(workbook, "hyperlink").length }, blocks, sheets, extractedText: safeText(texts.join("\n"), limits.maxTextCharacters) };
}

function failure(file: File, code: FileIntakeError["code"], title: string, message: string, recovery: string): FileIntakeError { return { code, title, message, recovery }; }

export async function inspectOfficeFile(file: File): Promise<FileAsset | FileIntakeError> {
  const format = formatFor(file);
  if (["doc", "ppt", "xls"].includes(format)) return failure(file, "unsupported-office", "Legacy Office format is not supported.", `.${format} is a legacy binary Office format without a safe browser-local inspector in SmartDocs.`, "Save the document as .docx, .pptx, or .xlsx and try again.");
  if (!["docx", "pptx", "xlsx", "docm", "pptm", "xlsm"].includes(format)) return failure(file, "unsupported-office", "That Office format is not supported.", "SmartDocs currently supports OOXML DOCX, PPTX, and XLSX inspection only.", "Choose a DOCX, PPTX, or XLSX file.");
  if (file.size > DEFAULT_OFFICE_LIMITS.maxInputBytes) return failure(file, "office-package-limit", "Office file is too large.", "The browser-local Office inspection limit is 50 MiB.", "Choose a smaller document or reduce embedded media before retrying.");
  try {
    const pkg = await openOfficePackage(file, DEFAULT_OFFICE_LIMITS);
    const names = new Set(pkg.entries.map((entry) => entry.name));
    const markers = format === "docx" || format === "docm" ? names.has("word/document.xml") : format === "pptx" || format === "pptm" ? names.has("ppt/presentation.xml") : names.has("xl/workbook.xml");
    if (!names.has("[Content_Types].xml") || !markers) throw new Error("The package markers do not match a supported OOXML document.");
    const warnings = packageWarnings(pkg, format);
    const type = documentType(format);
    const metadata = metadataFrom(pkg.readText("docProps/core.xml"));
    let features: OfficeFeatureSignals; let blocks: OfficeTextBlock[]; let extractedText: string; let slides: OfficeSlideSummary[] = []; let sheets: OfficeSheetPreview[] = [];
    if (type === "word") ({ features, blocks, extractedText } = parseDocx(pkg, DEFAULT_OFFICE_LIMITS));
    else if (type === "presentation") ({ features, blocks, extractedText, slides } = await parsePptx(pkg, DEFAULT_OFFICE_LIMITS));
    else ({ features, blocks, extractedText, sheets } = await parseXlsx(pkg, DEFAULT_OFFICE_LIMITS));
    const complexity = file.size > 10 * 1024 * 1024 || (features.slideCount ?? 0) > 20 || (features.sheetCount ?? 0) > 10 || (features.paragraphCount ?? 0) > 500 ? "high" : "moderate";
    const analysis: OfficeDocumentAnalysis = { documentType: type, format, version: "OOXML", fileSize: file.size, complexity, metadata, features, warnings, capabilities: makeCapabilities(type, format, warnings), preservationRisk: warnings.some((warning) => warning.severity === "warning") ? "high" : "moderate", processingBoundary: "browser-local", validationStatus: warnings.some((warning) => warning.code === "macro-detected") ? "warning" : "validated", sampledStructure: blocks.slice(0, 120), slides, sheets, extractedText };
    const mimeType = format.startsWith("doc") ? DOCX_MIME : format.startsWith("ppt") ? PPTX_MIME : XLSX_MIME;
    return { id: crypto.randomUUID(), name: file.name, sizeBytes: file.size, extension: ext(file.name), processingBoundary: "browser-local", category: "office", mimeType, format, documentType: type, analysis, capabilities: analysis.capabilities, warnings, validationStatus: analysis.validationStatus, previewUrl: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The browser could not safely inspect this Office package.";
    return failure(file, message.includes("limit") || message.includes("bounded") ? "office-package-limit" : "invalid-office", "Office inspection stopped safely.", message, "No document content was uploaded or executed. Try a smaller, unencrypted OOXML file.");
  }
}
