import type { ConversionBackground, ConversionFitMode, ConversionFormat, ConversionIntent, ConversionOrientation, ConversionPageSize, ConversionQuality, ConversionResolution } from "../conversions/types";
import { MAX_CONVERSION_MARGIN_POINTS } from "../conversions/types";

export type IntentStatus = "valid" | "ambiguous" | "unsupported";

export interface ParsedConversionIntent {
  status: IntentStatus;
  intent?: ConversionIntent;
  message: string;
}

export interface ImageCompressionIntent {
  operation: "image.compress.target_size";
  targetBytes: number;
  targetLabel: string;
  preserveQuality: boolean;
  sourceType: "image";
}

export interface PdfOptimizationIntent {
  operation: "pdf.optimize.target_size";
  targetBytes: number | null;
  targetLabel: string | null;
  sourceType: "pdf";
}

export interface ParsedPdfIntent {
  status: IntentStatus;
  intent?: PdfOptimizationIntent;
  message: string;
}

export interface ParsedIntent {
  status: IntentStatus;
  intent?: ImageCompressionIntent;
  message: string;
}

const TARGET_PATTERN = /(?:under|below|less\s+than|less|smaller\s+than|compress\s+to|to|≤|<=)\s*(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib)\b/i;
const BARE_TARGET_PATTERN = /\b(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib)\b/i;

/** SmartDocs uses decimal units: 1 KB = 1,000 bytes and 1 MB = 1,000,000 bytes. */
export function parseByteTarget(value: string, unit: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const normalizedUnit = unit.toLowerCase();
  const multiplier = normalizedUnit === "mb" || normalizedUnit === "mib" ? 1_000_000 : 1_000;
  const bytes = Math.round(amount * multiplier);
  return bytes > 0 ? bytes : null;
}

export function parsePdfIntent(goal: string): ParsedPdfIntent {
  const normalized = goal.trim().replace(/\s+/g, " ");
  const targetMatch = normalized.match(TARGET_PATTERN) ?? normalized.match(BARE_TARGET_PATTERN);
  if (targetMatch) {
    const targetBytes = parseByteTarget(targetMatch[1], targetMatch[2]);
    if (targetBytes) {
      const targetLabel = `${targetMatch[1]} ${targetMatch[2].toUpperCase()}`;
      return {
        status: "valid",
        intent: { operation: "pdf.optimize.target_size", targetBytes, targetLabel, sourceType: "pdf" },
        message: `We’ll aim for ≤ ${targetLabel} while preserving as much PDF quality and structure as possible.`,
      };
    }
  }
  if (!normalized || /compress|smaller|reduce|shrink|tiny|optimi[sz]e/i.test(normalized)) {
    return { status: "ambiguous", message: "Choose a quality mode or provide a target such as “compress this PDF under 5MB.”" };
  }
  return { status: "unsupported", message: "This workflow handles PDF optimization and target sizes in KB or MB." };
}

export function parseImageIntent(goal: string): ParsedIntent {
  const normalized = goal.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return {
      status: "ambiguous",
      message: "Describe a target such as “make this image under 100KB.”",
    };
  }

  const targetMatch = normalized.match(TARGET_PATTERN) ?? normalized.match(BARE_TARGET_PATTERN);
  if (targetMatch) {
    const targetBytes = parseByteTarget(targetMatch[1], targetMatch[2]);
    if (targetBytes) {
      return {
        status: "valid",
        intent: {
          operation: "image.compress.target_size",
          targetBytes,
          targetLabel: `${targetMatch[1]} ${targetMatch[2].toUpperCase()}`,
          preserveQuality: true,
          sourceType: "image",
        },
        message: `We’ll aim for ≤ ${targetMatch[1]} ${targetMatch[2].toUpperCase()} while preserving as much quality as possible.`,
      };
    }
  }

  if (/compress|smaller|reduce|shrink|size/i.test(normalized)) {
    return {
      status: "ambiguous",
      message: "Please provide a target size such as 50KB, 100KB, or 1MB.",
    };
  }

  return {
    status: "unsupported",
    message: "This first workflow handles image target-size compression. Try “make this image under 100KB.”",
  };
}

const CONVERSION_FORMAT_PATTERNS: readonly [ConversionFormat, RegExp][] = [
  ["jpeg", /\b(?:jpe?g|jpg)\b/i],
  ["png", /\bpng\b/i],
  ["webp", /\bwebp\b/i],
  ["pdf", /\bpdf\b/i],
];

function conversionTargetFormat(goal: string): ConversionFormat | null {
  for (const [format, pattern] of CONVERSION_FORMAT_PATTERNS) if (pattern.test(goal)) return format;
  return null;
}

function conversionQuality(goal: string): ConversionQuality | null {
  if (/smallest\s+practical|smallest/i.test(goal)) return "smallest-practical";
  if (/\bsmall|lightweight|light\b/i.test(goal)) return "small";
  if (/\bbalanced|practical/i.test(goal)) return "balanced";
  if (/\bhigh(?:est)?\s+quality|high-quality|high quality/i.test(goal)) return "high";
  if (/maximum\s+quality|max(?:imum)?\s+quality|best quality/i.test(goal)) return "maximum";
  return null;
}

function conversionResolution(goal: string): ConversionResolution | null {
  const match = /\b(150|200|300)\s*dpi\b/i.exec(goal);
  if (match) return `${match[1]}dpi` as ConversionResolution;
  if (/\bscreen\b/i.test(goal)) return "screen";
  return null;
}

function conversionPageSize(goal: string): ConversionPageSize | null {
  if (/\ba4\b/i.test(goal)) return "A4";
  if (/\ba5\b/i.test(goal)) return "A5";
  if (/\bletter\b/i.test(goal)) return "Letter";
  if (/\blegal\b/i.test(goal)) return "Legal";
  if (/original\s+(?:image\s+)?size/i.test(goal)) return "original";
  return null;
}

function conversionOrientation(goal: string): ConversionOrientation | null {
  if (/\bportrait\b/i.test(goal)) return "portrait";
  if (/\blandscape\b/i.test(goal)) return "landscape";
  if (/\bauto(?:matic)?\s+orientation\b/i.test(goal)) return "auto";
  return null;
}

function conversionFit(goal: string): ConversionFitMode | null {
  if (/fit\s*[- ]?width/i.test(goal)) return "fit-width";
  if (/fit\s*[- ]?height/i.test(goal)) return "fit-height";
  if (/\bcover\b/i.test(goal)) return "cover";
  if (/\bcontain|fit(?:ted)?\b/i.test(goal)) return "contain";
  return null;
}

function conversionBackground(goal: string): ConversionBackground | null {
  if (/\bblack\s+background|background\s*[:=]?\s*black/i.test(goal)) return "black";
  if (/\btransparent\b/i.test(goal)) return "transparent";
  if (/\bwhite\s+background|background\s*[:=]?\s*white/i.test(goal)) return "white";
  return null;
}

function conversionPageSelection(goal: string): ConversionIntent["pageSelection"] {
  if (/\bcurrent\s+page\b/i.test(goal)) return { kind: "current", value: null };
  if (/\bselected\s+pages?\b/i.test(goal)) return { kind: "selected", value: null };
  const match = /\bpages?\s+([0-9]+(?:\s*[-–]\s*[0-9]+)?(?:\s*,\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?)*)/i.exec(goal);
  if (match) return { kind: "range", value: match[1].replaceAll("–", "-") };
  return { kind: "all", value: null };
}

function conversionTarget(goal: string): ConversionIntent["targetSize"] {
  const match = goal.match(TARGET_PATTERN) ?? goal.match(BARE_TARGET_PATTERN);
  if (!match) return null;
  const bytes = parseByteTarget(match[1], match[2]);
  if (!bytes) return null;
  const perFile = /per\s+(?:page|file|image)|each/i.test(goal);
  return { scope: perFile ? "per-file" : "total", bytes, label: `${match[1]} ${match[2].toUpperCase()}` };
}

export function parseConversionIntent(goal: string): ParsedConversionIntent {
  const normalized = goal.trim().replace(/\s+/g, " ");
  const targetFormat = conversionTargetFormat(normalized);
  const mentionsConversion = /\bconvert(?:ed|ing)?\b|\bmake\s+(?:a|one)\s+pdf\b|\bturn\s+.+\s+into\b|\bimages?\s*(?:to|into)\s*pdf\b/i.test(normalized);
  if (!normalized || !mentionsConversion) return { status: "unsupported", message: "Describe a conversion such as “convert this PDF to JPG” or “make one PDF from these images.”" };
  if (!targetFormat) return { status: "ambiguous", message: "What format should the output use? Choose JPG, PNG, WebP, or PDF." };

  const marginMatch = /\b(?:margin|margins)\s*(?:of|=|:)\s*(\d+(?:\.\d+)?)\s*(?:pt|points?)?\b/i.exec(normalized);
  const marginPoints = marginMatch ? Math.min(MAX_CONVERSION_MARGIN_POINTS, Number(marginMatch[1])) : null;
  const intent: ConversionIntent = {
    targetFormat,
    targetSize: conversionTarget(normalized),
    pageSelection: conversionPageSelection(normalized),
    quality: conversionQuality(normalized),
    resolution: conversionResolution(normalized),
    pageSize: conversionPageSize(normalized),
    orientation: conversionOrientation(normalized),
    fitMode: conversionFit(normalized),
    marginPoints,
    background: conversionBackground(normalized),
  };
  const warnings = targetFormat === "jpeg" && intent.background === "transparent" ? " JPEG does not support transparency; choose a white or black background." : "";
  return { status: "valid", intent, message: `Conversion target understood: ${targetFormat.toUpperCase()}.${warnings}` };
}
