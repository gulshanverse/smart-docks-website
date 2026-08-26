import { extensionForConversionFormat, type ConversionFormat } from "./types";

export function sanitizeConversionStem(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? name;
  return leaf.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";
}

export function conversionFilename(sourceName: string, format: ConversionFormat, suffix?: string): string {
  const stem = sanitizeConversionStem(sourceName);
  const extension = extensionForConversionFormat(format);
  return `${stem}${suffix ? `-${suffix}` : ""}.${extension}`;
}

export function pageConversionFilename(sourceName: string, pageNumber: number, totalPages: number, format: Exclude<ConversionFormat, "pdf">): string {
  const width = Math.max(3, String(totalPages).length);
  return conversionFilename(sourceName, format, `page-${String(pageNumber).padStart(width, "0")}`);
}

export function uniqueFilename(filename: string, used: ReadonlySet<string>): string {
  if (!used.has(filename)) return filename;
  const match = /^(.*?)(\.[^.]+)$/.exec(filename);
  if (!match) return `${filename}-2`;
  let index = 2;
  let candidate = `${match[1]}-${index}${match[2]}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${match[1]}-${index}${match[2]}`;
  }
  return candidate;
}
