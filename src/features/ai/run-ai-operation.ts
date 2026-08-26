import { buildAiRequest } from "../../domain/ai/context";
import { validateAiRequestLimits, validateAiResponse } from "../../domain/ai/validation";
import { schemaForDocumentType } from "../../domain/ai/schemas";
import type { AiDocumentProvider, AiDocumentResponse, AiFailureResponse, AiOperation, AiOperationProgress } from "../../domain/ai/types";
import { operationForProvider } from "./gateway-provider";
import { prepareAiDocument, refreshAiDocumentContext, type PreparedAiDocument } from "./prepare-ai-document";
import { DeterministicMockAiProvider } from "./mock-provider";
import { GatewayAiDocumentProvider } from "./gateway-provider";
import type { PdfAsset } from "../../domain/files/types";

export type AiProviderKind = "mock" | "gateway";
export type AiProvider = DeterministicMockAiProvider | GatewayAiDocumentProvider;

export function createAiProvider(kind: AiProviderKind): AiProvider { return kind === "gateway" ? new GatewayAiDocumentProvider() : new DeterministicMockAiProvider(); }

function failure(request: { requestId: string; operation: AiOperation }, code: AiFailureResponse["error"]["code"], message: string, retryable = false): AiFailureResponse { return { version: "phase6-result-v1", requestId: request.requestId, operation: request.operation, state: code === "cancelled" ? "cancelled" : code === "rate-limit" ? "rate-limited" : code === "provider-unavailable" ? "unavailable" : "failed", error: { code, message, retryable }, processingBoundary: "deterministic-mock" }; }

export async function runAiOperation(args: { file: File; asset: PdfAsset; operation: AiOperation; query: string | null; providerKind: AiProviderKind; signal?: AbortSignal; onProgress?: (progress: AiOperationProgress) => void; prepared?: PreparedAiDocument }): Promise<{ prepared: PreparedAiDocument; response: AiDocumentResponse | AiFailureResponse }> {
  const prepared = args.prepared ? refreshAiDocumentContext(args.prepared, args.operation === "ask" ? args.query : null, args.onProgress) : await prepareAiDocument(args.file, args.asset, args.operation === "ask" ? args.query : null, args.onProgress, args.signal);
  const schema = schemaForDocumentType(prepared.structure.documentType.value as Parameters<typeof schemaForDocumentType>[0]);
  const request = buildAiRequest(prepared.context, args.operation, schema.id, schema.version, args.query, crypto.randomUUID());
  const limits = validateAiRequestLimits(args.query, prepared.context);
  if (!limits.valid) return { prepared, response: failure(request, "context-too-large", limits.errors.join(" "), false) };
  const provider = createAiProvider(args.providerKind);
  args.onProgress?.({ state: args.providerKind === "gateway" ? "sending" : "validating", detail: args.providerKind === "gateway" ? "Sending bounded document context to the configured AI gateway." : "Running the deterministic mock provider; no external request will be made.", relevantPages: prepared.context.relevantPageNumbers, contextChars: prepared.context.totalContextChars, estimatedInputTokens: prepared.context.estimatedInputTokens });
  let response = await operationForProvider(provider, args.operation, request, args.signal);
  if (response.state === "failed" || response.state === "unavailable" || response.state === "rate-limited") {
    if (response.error.retryable && !args.signal?.aborted) {
      args.onProgress?.({ state: "sending", detail: "Retrying one safe transient AI request.", relevantPages: prepared.context.relevantPageNumbers, contextChars: prepared.context.totalContextChars, estimatedInputTokens: prepared.context.estimatedInputTokens });
      response = await operationForProvider(provider, args.operation, request, args.signal);
    }
    return { prepared, response };
  }
  if (response.state !== "completed") return { prepared, response };
  args.onProgress?.({ state: "validating", detail: "Validating AI schema, bounds, and source references before rendering the result.", relevantPages: prepared.context.relevantPageNumbers, contextChars: prepared.context.totalContextChars, estimatedInputTokens: prepared.context.estimatedInputTokens });
  const validation = validateAiResponse(response, prepared.context, args.operation);
  if (!validation.valid) return { prepared, response: failure(request, "invalid-provenance", `The AI result was rejected before display: ${validation.errors.slice(0, 3).join(" ")}`, false) };
  args.onProgress?.({ state: "completed", detail: "AI result validated against the bounded document context.", relevantPages: prepared.context.relevantPageNumbers, contextChars: prepared.context.totalContextChars, estimatedInputTokens: prepared.context.estimatedInputTokens });
  return { prepared, response };
}
