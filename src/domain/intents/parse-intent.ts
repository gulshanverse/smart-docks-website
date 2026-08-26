export type IntentStatus = "valid" | "ambiguous" | "unsupported";

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
