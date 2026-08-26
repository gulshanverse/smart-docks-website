import type { JsonValue, ExtractionFieldDefinition, ExtractionNormalizationRule } from "./types";

export interface NormalizedValue { readonly value: JsonValue | null; readonly status: "normalized" | "unknown" | "invalid"; readonly warning: string | null; }

function numberValue(raw: string): number | null { const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "").replace(/,/g, "."); const parsed = Number(cleaned); return Number.isFinite(parsed) ? parsed : null; }
function currencyCode(raw: string): string | null { const match = raw.match(/(?:₹|INR|Rs\.?|\$|USD|€|EUR|£|GBP)/i); if (!match) return null; const symbol = match[0].toUpperCase(); return symbol === "₹" || symbol.startsWith("RS") ? "INR" : symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : symbol; }
function dateValue(raw: string): NormalizedValue { const value = raw.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { value, status: "normalized", warning: null }; const iso = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); if (!iso) return { value: null, status: "unknown", warning: "Date format is not supported or is incomplete." }; const first = Number(iso[1]); const second = Number(iso[2]); if (first <= 12 && second <= 12 && first !== second) return { value: null, status: "unknown", warning: "Date is ambiguous between day-first and month-first formats." }; const day = first > 12 ? first : second; const month = first > 12 ? second : first; const candidate = `${iso[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const timestamp = Date.parse(`${candidate}T00:00:00Z`); return Number.isNaN(timestamp) ? { value: null, status: "invalid", warning: "Date is not calendar-valid." } : { value: candidate, status: "normalized", warning: null }; }

export function normalizeExtractionValue(raw: string, field: ExtractionFieldDefinition): NormalizedValue {
  const value = raw.trim();
  if (!value) return { value: null, status: "unknown", warning: "Value is empty." };
  const rule = field.normalizationRules[0] as ExtractionNormalizationRule | undefined;
  switch (field.type) {
    case "number": case "integer": case "currency": { const parsed = numberValue(value); if (parsed === null) return { value: null, status: "invalid", warning: "Value is not a valid number." }; if (field.type === "integer" && !Number.isInteger(parsed)) return { value: null, status: "invalid", warning: "Value must be an integer." }; return { value: parsed, status: "normalized", warning: null }; }
    case "percentage": { const parsed = numberValue(value); return parsed === null ? { value: null, status: "invalid", warning: "Value is not a valid percentage." } : { value: parsed > 1 && parsed <= 100 ? parsed / 100 : parsed, status: "normalized", warning: null }; }
    case "date": case "datetime": return dateValue(value);
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { value: value.toLowerCase(), status: "normalized", warning: null } : { value: null, status: "invalid", warning: "Value is not a valid email address." };
    case "phone": return /[\d]{7,}/.test(value.replace(/\D/g, "")) ? { value: value.replace(/[^\d+]/g, ""), status: "normalized", warning: null } : { value: null, status: "invalid", warning: "Value is not a valid phone number." };
    case "url": return /^https?:\/\//i.test(value) ? { value, status: "normalized", warning: null } : { value: null, status: "invalid", warning: "URL must use an explicit HTTP(S) scheme." };
    case "boolean": if (/^(true|yes|y)$/i.test(value)) return { value: true, status: "normalized", warning: null }; if (/^(false|no|n)$/i.test(value)) return { value: false, status: "normalized", warning: null }; return { value: null, status: "unknown", warning: "Boolean value is not explicit." };
    case "enum": return field.allowedValues?.includes(value) ? { value, status: "normalized", warning: null } : { value: null, status: "invalid", warning: "Value is not in the allowed set." };
    default: return { value, status: rule?.kind === "trim" ? "normalized" : "normalized", warning: null };
  }
}

export function detectCurrency(raw: string): string | null { return currencyCode(raw); }
