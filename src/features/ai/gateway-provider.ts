import type { AiDocumentProvider, AiDocumentRequest, AiDocumentResponse, AiFailureResponse, AiModelConfig, AiOperation } from "../../domain/ai/types";

const gatewayUrl = (import.meta.env.VITE_AI_GATEWAY_URL as string | undefined) || "/api/ai/document";

const defaultModel: AiModelConfig = { providerId: "configured-gateway", modelId: "configured-server-model", maxOutputTokens: 1_800, temperature: 0.1, structuredOutput: true, streaming: false };

function failure(request: AiDocumentRequest, code: AiFailureResponse["error"]["code"], message: string, retryable = false): AiFailureResponse {
  return { version: "phase6-result-v1", requestId: request.requestId, operation: request.operation, state: code === "cancelled" ? "cancelled" : code === "rate-limit" ? "rate-limited" : code === "provider-unavailable" ? "unavailable" : "failed", error: { code, message, retryable }, processingBoundary: "ai-gateway" };
}

async function runGateway(request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse> {
  try {
    const response = await fetch(gatewayUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(request), signal });
    const payload = await response.json().catch(() => null) as unknown;
    if (response.ok && payload && typeof payload === "object" && (payload as { state?: string }).state === "completed") return payload as AiDocumentResponse;
    if (signal?.aborted) return failure(request, "cancelled", "AI request cancelled. Partial output was discarded.");
    const message = payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: { message?: unknown } }).error?.message === "string" ? String((payload as { error: { message: string } }).error.message) : response.status === 429 ? "The AI gateway rate limit was reached. Try again later." : response.status === 413 ? "The selected AI context is too large. Narrow the document selection and try again." : "The configured AI gateway did not return a completed result.";
    const code: AiFailureResponse["error"]["code"] = response.status === 429 ? "rate-limit" : response.status === 401 || response.status === 403 ? "authentication-failure" : response.status === 413 ? "context-too-large" : response.status >= 500 ? "provider-unavailable" : "unknown";
    return failure(request, code, message, code === "rate-limit" || code === "provider-unavailable");
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return failure(request, "cancelled", "AI request cancelled. Partial output was discarded.");
    return failure(request, "network-failure", "The AI gateway could not be reached. No AI result was stored.", true);
  }
}

export class GatewayAiDocumentProvider implements AiDocumentProvider {
  readonly id = "configured-gateway";
  readonly model = defaultModel;
  private run(request: AiDocumentRequest, signal?: AbortSignal) { return runGateway(request, signal); }
  analyzeDocument(request: AiDocumentRequest, signal?: AbortSignal) { return this.run(request, signal); }
  summarizeDocument(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "summarize" }, signal); }
  extractFields(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "extract" }, signal); }
  answerQuestion(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "ask" }, signal); }
  classifyDocument(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "classify" }, signal); }
  extractStructuredData(request: AiDocumentRequest, signal?: AbortSignal) { return this.run({ ...request, operation: "extract" }, signal); }
}

export function operationForProvider(provider: AiDocumentProvider, operation: AiOperation, request: AiDocumentRequest, signal?: AbortSignal): Promise<AiDocumentResponse | AiFailureResponse> {
  if (operation === "summarize") return provider.summarizeDocument(request, signal);
  if (operation === "extract") return provider.extractFields(request, signal);
  if (operation === "ask") return provider.answerQuestion(request, signal);
  if (operation === "classify") return provider.classifyDocument(request, signal);
  return provider.analyzeDocument(request, signal);
}
