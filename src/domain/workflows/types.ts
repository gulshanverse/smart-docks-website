import type { FileAsset } from "../files/types";
import type { ImageCompressionIntent } from "../intents/parse-intent";

export type WorkflowStepId = "image.compress.target_size" | "validation";

export interface ImageCompressionWorkflow {
  input: FileAsset;
  intent: ImageCompressionIntent;
  steps: readonly [
    { id: "image.compress.target_size"; targetBytes: number; preserveQuality: boolean },
    { id: "validation" },
  ];
}

export function createImageCompressionWorkflow(input: FileAsset, intent: ImageCompressionIntent): ImageCompressionWorkflow {
  return {
    input,
    intent,
    steps: [
      {
        id: "image.compress.target_size",
        targetBytes: intent.targetBytes,
        preserveQuality: intent.preserveQuality,
      },
      { id: "validation" },
    ],
  };
}
