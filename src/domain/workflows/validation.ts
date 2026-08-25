export type OptimizationStrategy = "original-preserved" | "compression-only" | "resize-and-compress";
export type QualityDecision = "preserved" | "good" | "acceptable" | "best-effort";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ValidationResult {
  valid: boolean;
  targetAchieved: boolean;
  targetBytes: number;
  outputBytes: number;
  originalBytes: number;
  reductionPercent: number;
  mimeType: string;
  width: number;
  height: number;
  originalDimensions: ImageDimensions;
  finalDimensions: ImageDimensions;
  optimizationStrategy: OptimizationStrategy;
  qualityDecision: QualityDecision;
  resizeApplied: boolean;
  message: string;
}
