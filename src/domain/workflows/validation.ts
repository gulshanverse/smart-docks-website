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
  message: string;
}
