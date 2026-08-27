import type { AiConfidence, AiDocumentType, AiExtractedFact } from "./types";

const monthNames: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

export function normalizeDateValue(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const raw = rawValue.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const numeric = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  const named = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!named) return null;
  const month = monthNames[named[2].toLocaleLowerCase()];
  return month ? `${named[3]}-${month}-${named[1].padStart(2, "0")}` : null;
}

export function normalizeNumberValue(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const cleaned = rawValue.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const decimal = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(/,/g, ".") : cleaned.replace(/,/g, "");
  return /^-?\d+(?:\.\d+)?$/.test(decimal) ? decimal : null;
}

export function normalizeDocumentType(value: string | null | undefined): AiDocumentType {
  const normalized = (value ?? "").toLocaleLowerCase().replace(/[_\s]+/g, "-");
  const allowed: AiDocumentType[] = ["invoice", "receipt", "bank-statement", "resume", "contract", "agreement", "report", "research-paper", "letter", "application-form", "identity-document", "tax-document", "medical-document", "book", "manual", "presentation", "other", "unknown"];
  return allowed.includes(normalized as AiDocumentType) ? normalized as AiDocumentType : "unknown";
}

export function normalizedFact(field: string, rawValue: string | null, confidence: AiConfidence, source: AiExtractedFact["source"], sourceStatus: AiExtractedFact["sourceStatus"] = rawValue ? "verified" : "not-found"): AiExtractedFact {
  const lower = field.toLocaleLowerCase();
  const normalizedValue = lower.includes("date") || lower.endsWith("_date") ? normalizeDateValue(rawValue) : lower.includes("total") || lower.includes("amount") || lower.includes("subtotal") || lower.includes("tax") || lower.includes("percentage") ? normalizeNumberValue(rawValue) : rawValue?.trim() || null;
  return { field, rawValue: rawValue?.slice(0, 900) ?? null, normalizedValue, confidence, source, sourceStatus };
}
