export function createFileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(index + 1).toLowerCase() : "";
}

export function formatBytes(bytes: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(maximumFractionDigits)} ${units[unitIndex]}`;
}

export function reductionPercent(originalBytes: number, outputBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.max(0, ((originalBytes - outputBytes) / originalBytes) * 100);
}
