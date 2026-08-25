import { describe, expect, it } from "vitest";
import { formatBytes, reductionPercent } from "../lib/file-utils";
import { parseByteTarget, parseImageIntent } from "../domain/intents/parse-intent";
import { selectCandidate } from "../features/compression/select-candidate";
import { qualityDecision, scaledDimensions } from "../features/compression/compress-image";

describe("byte units", () => {
  it("uses decimal KB and MB values", () => {
    expect(parseByteTarget("100", "KB")).toBe(100_000);
    expect(parseByteTarget("1", "mb")).toBe(1_000_000);
  });

  it("formats result sizes for people", () => {
    expect(formatBytes(100_000)).toBe("97.7 KB");
    expect(formatBytes(1_000_000)).toBe("976.6 KB");
  });

  it("calculates a non-negative reduction percentage", () => {
    expect(reductionPercent(1_000_000, 250_000)).toBe(75);
    expect(reductionPercent(100, 200)).toBe(0);
  });
});

describe("deterministic image intent", () => {
  it("parses common target-size phrases", () => {
    expect(parseImageIntent("make this image under 100kb").intent?.targetBytes).toBe(100_000);
    expect(parseImageIntent("Compress to 50 KB").intent?.targetBytes).toBe(50_000);
    expect(parseImageIntent("make it less than 1 MB").intent?.targetBytes).toBe(1_000_000);
  });

  it("returns an honest ambiguous state without a target", () => {
    const result = parseImageIntent("compress this image");
    expect(result.status).toBe("ambiguous");
    expect(result.message).toContain("target size");
  });

  it("does not invent requirements for unsupported goals", () => {
    const result = parseImageIntent("make this suitable for my exam");
    expect(result.status).toBe("unsupported");
    expect(result.intent).toBeUndefined();
  });
});

describe("smart resize policy", () => {
  it("finds smaller dimensions while preserving aspect ratio", () => {
    expect(scaledDimensions({ width: 1600, height: 1000 }, 0.56)).toEqual({ width: 896, height: 560 });
  });

  it("labels preserved, good, acceptable, and best-effort quality decisions", () => {
    expect(qualityDecision(1, "image/png", true, true)).toBe("preserved");
    expect(qualityDecision(0.82, "image/jpeg", false, true)).toBe("good");
    expect(qualityDecision(0.6, "image/jpeg", false, true)).toBe("acceptable");
    expect(qualityDecision(0.45, "image/jpeg", false, false)).toBe("best-effort");
  });
});

describe("compression candidate selection", () => {
  it("selects the highest quality candidate under the target", () => {
    const result = selectCandidate([
      { bytes: 80_000, quality: 0.7, mimeType: "image/webp" },
      { bytes: 95_000, quality: 0.85, mimeType: "image/jpeg" },
      { bytes: 120_000, quality: 0.95, mimeType: "image/jpeg" },
    ], 100_000, "image/jpeg");
    expect(result.targetAchieved).toBe(true);
    expect(result.candidate.bytes).toBe(95_000);
  });

  it("returns the smallest best-effort candidate when the target is impossible", () => {
    const result = selectCandidate([
      { bytes: 84_000, quality: 0.45, mimeType: "image/webp" },
      { bytes: 110_000, quality: 0.75, mimeType: "image/jpeg" },
    ], 50_000, "image/jpeg");
    expect(result.targetAchieved).toBe(false);
    expect(result.candidate.bytes).toBe(84_000);
  });
});
