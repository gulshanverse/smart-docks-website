import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Check, ChevronRight, CircleAlert, Copy, FileJson, Search, ShieldCheck, Square, WandSparkles, X } from "lucide-react";
import type { PdfAsset } from "../../domain/files/types";
import type { AiConfidence, AiDocumentResponse, AiError, AiOperation, AiOperationProgress, AiOperationState, AiSourceReference } from "../../domain/ai/types";
import { runAiOperation, type AiProviderKind } from "./run-ai-operation";
import type { PreparedAiDocument } from "./prepare-ai-document";

interface AiDocumentPanelProps { file: File | null; asset: PdfAsset | null; onNavigateToPage?: (pageNumber: number) => void; }
type AiView = "overview" | "extract" | "ask" | "structure";

const operationForView: Record<AiView, AiOperation> = { overview: "summarize", extract: "extract", ask: "ask", structure: "structure" };
const stateLabel: Record<AiOperationState, string> = { idle: "Ready", preparing: "Preparing local context", "awaiting-consent": "Waiting for consent", retrieving: "Retrieving relevant pages", sending: "Sending bounded context", streaming: "Streaming unavailable", validating: "Validating result", completed: "Completed", failed: "Failed", cancelled: "Cancelled", "rate-limited": "Rate limited", unavailable: "Provider unavailable" };

export function AiDocumentPanel({ file, asset, onNavigateToPage }: AiDocumentPanelProps) {
  const [view, setView] = useState<AiView>("overview");
  const [provider, setProvider] = useState<AiProviderKind>("mock");
  const [prepared, setPrepared] = useState<PreparedAiDocument | null>(null);
  const [response, setResponse] = useState<AiDocumentResponse | null>(null);
  const [progress, setProgress] = useState<AiOperationProgress | null>(null);
  const [state, setState] = useState<AiOperationState>("idle");
  const [notice, setNotice] = useState<{ message: string; error?: AiError } | null>(null);
  const [query, setQuery] = useState("When is the payment due?");
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<AiOperation | null>(null);
  const [consented, setConsented] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const busy = state === "preparing" || state === "retrieving" || state === "sending" || state === "validating";
  const sourceLabel = provider === "gateway" ? "AI-generated — verify against the source" : "Deterministic mock result — no external request";
  const operation = operationForView[view];

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPrepared(null); setResponse(null); setProgress(null); setState("idle"); setNotice(null); setConsentOpen(false); setPendingOperation(null); setConsented(false);
  }, [file, asset]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function execute(nextOperation: AiOperation) {
    if (!file || !asset) { setNotice({ message: "Add a PDF before requesting document understanding." }); return; }
    const controller = new AbortController(); abortRef.current?.abort(); abortRef.current = controller;
    setNotice(null); setResponse(null); setProgress({ state: "preparing", detail: "Preparing bounded document context locally.", relevantPages: [], contextChars: 0, estimatedInputTokens: null }); setState("preparing");
    try {
      const run = await runAiOperation({ file, asset, operation: nextOperation, query: nextOperation === "ask" ? query : null, providerKind: provider, signal: controller.signal, prepared: prepared ?? undefined, onProgress: (next) => { setProgress(next); setState(next.state); } });
      setPrepared(run.prepared);
      if (run.response.state === "completed") { setResponse(run.response); setState("completed"); }
      else { setState(run.response.state); setNotice({ message: run.response.error.message, error: run.response.error }); }
    } catch (error) {
      if (controller.signal.aborted) { setState("cancelled"); setNotice({ message: "AI operation cancelled. Partial output was discarded." }); }
      else { setState("failed"); setNotice({ message: error instanceof Error ? error.message : "AI preparation failed before a result could be validated." }); }
    } finally { if (abortRef.current === controller) abortRef.current = null; }
  }

  function start(nextOperation: AiOperation) {
    if (provider === "gateway" && !consented) { setPendingOperation(nextOperation); setConsentOpen(true); setState("awaiting-consent"); return; }
    void execute(nextOperation);
  }
  function cancel() { abortRef.current?.abort(); setState("cancelled"); setNotice({ message: "AI operation cancelled. Partial output was discarded." }); }
  function clear() { abortRef.current?.abort(); setPrepared(null); setResponse(null); setProgress(null); setState("idle"); setNotice(null); }
  function confirmConsent() { setConsented(true); setConsentOpen(false); if (pendingOperation) { const next = pendingOperation; setPendingOperation(null); void execute(next); } }

  const contextSummary = useMemo(() => prepared ? `${prepared.context.relevantPageNumbers.length} relevant page${prepared.context.relevantPageNumbers.length === 1 ? "" : "s"} · ${prepared.context.totalContextChars.toLocaleString()} context characters${prepared.context.truncated ? " · bounded selection" : ""}` : "Local context has not been prepared yet.", [prepared]);

  return <section className="ai-document-panel" aria-labelledby="ai-document-title">
    <div className="ai-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Understand document</p><h4 id="ai-document-title">Semantic intelligence, with evidence.</h4><p>Local PDF/OCR signals are prepared first. Only the bounded context required for this operation can cross the configured AI boundary.</p></div><span className={provider === "gateway" ? "ai-badge external" : "ai-badge local"}><ShieldCheck size={13} /> {provider === "gateway" ? "AI processing" : "Mock / local"}</span></div>
    <div className="ai-provider-controls"><label>Provider<select value={provider} onChange={(event) => { setProvider(event.target.value as AiProviderKind); setResponse(null); setNotice(null); setConsented(false); }} disabled={busy}><option value="mock">Deterministic mock · local test mode</option><option value="gateway">Configured AI gateway · external</option></select></label><span>{provider === "gateway" ? "Selected bounded content will be sent to the configured server gateway." : "No document content leaves this browser in mock mode."}</span></div>
    <div className="ai-tabs" role="tablist" aria-label="Document understanding views">{(["overview", "extract", "ask", "structure"] as AiView[]).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "overview" ? "Overview" : item === "extract" ? "Extract" : item === "ask" ? "Ask" : "Structure"}</button>)}</div>
    <div className="ai-operation-bar"><div><strong>{stateLabel[state]}</strong><span>{contextSummary}</span></div><div>{busy ? <button type="button" className="secondary-button" onClick={cancel}><Square size={14} /> Cancel</button> : <button type="button" className="primary-button" onClick={() => start(operation)} disabled={!file || !asset}><Brain size={15} /> {view === "overview" ? "Understand document" : view === "extract" ? "Extract information" : view === "ask" ? "Ask document" : "Analyze structure"}</button>}{(response || prepared) && !busy ? <button type="button" className="secondary-button" onClick={clear}><X size={14} /> Clear</button> : null}</div></div>
    {progress ? <div className="ai-progress" role="status" aria-live="polite"><div><strong>{progress.detail}</strong><span>{progress.estimatedInputTokens === null ? "Token estimate unavailable" : `~${progress.estimatedInputTokens.toLocaleString()} input tokens · ${progress.relevantPages.length} pages`}</span></div><progress max="1" value={progress.state === "completed" ? 1 : undefined} /></div> : null}
    {notice ? <div className="ai-notice" role="alert"><CircleAlert size={16} /><span>{notice.message}</span></div> : null}
    {consentOpen ? <div className="ai-consent" role="alertdialog" aria-labelledby="ai-consent-title"><div><strong id="ai-consent-title">AI processing uses an external provider.</strong><p>Only the selected bounded document context—not the original PDF bytes—will be sent to the configured AI gateway. The result remains ephemeral and will be validated before display.</p></div><div><button type="button" className="secondary-button" onClick={() => { setConsentOpen(false); setPendingOperation(null); setState("idle"); }}>Cancel</button><button type="button" className="primary-button" onClick={confirmConsent}>Continue</button></div></div> : null}
    {response ? <AiResponseView response={response} onNavigateToPage={onNavigateToPage} sourceLabel={sourceLabel} /> : <div className="ai-empty"><WandSparkles size={18} /><span>Choose an operation to prepare a bounded context and receive a validated result. Important facts will show their source page when available.</span></div>}
    {view === "ask" ? <div className="ai-question"><label htmlFor="ai-question-input">Ask this document<input id="ai-question-input" value={query} onChange={(event) => setQuery(event.target.value.slice(0, 600))} placeholder="e.g. When is the payment due?" /></label><small>Local retrieval selects relevant pages before any gateway request. The AI cannot use general knowledge unless explicitly requested.</small></div> : null}
  </section>;
}

function AiResponseView({ response, onNavigateToPage, sourceLabel }: { response: AiDocumentResponse; onNavigateToPage?: (pageNumber: number) => void; sourceLabel: string }) {
  const result = response.result;
  return <article className="ai-response" aria-live="polite"><div className="ai-response-meta"><span className="ai-generated-label"><Check size={13} /> {sourceLabel}</span><span>{response.model.modelId} · {response.processingTimeMs.toLocaleString()} ms</span></div>
    {result.operation === "classify" ? <><h5>{result.value.documentType.replaceAll("-", " ")}</h5><p>Confidence: <Confidence value={result.value.confidence} /></p><p>{result.value.reason}</p><Sources sources={result.value.evidence} onNavigateToPage={onNavigateToPage} /></> : null}
    {result.operation === "summarize" ? <><h5>Summary</h5><p>{result.value.shortSummary}</p><p>{result.value.detailedSummary}</p><h6>Key points</h6><ul>{result.value.keyPoints.map((point, index) => <li key={`${point.text}-${index}`}>{point.text} <Sources sources={point.source} onNavigateToPage={onNavigateToPage} /></li>)}</ul><h6>Important dates and amounts</h6><ul>{[...result.value.importantDates, ...result.value.importantAmounts].map((fact) => <li key={fact.field}><strong>{fact.field.replaceAll("_", " ")}</strong>: {fact.rawValue ?? "Not found in document."} <Sources sources={fact.source} onNavigateToPage={onNavigateToPage} /></li>)}</ul><Warnings warnings={result.value.warnings} /></> : null}
    {result.operation === "extract" ? <><h5>Structured extraction</h5><p>Schema: {result.value.schemaId} v{result.value.schemaVersion} · {result.value.documentType}</p><dl className="ai-fact-list">{result.value.fields.map((fact) => <div key={fact.field}><dt>{fact.field.replaceAll("_", " ")}</dt><dd>{fact.rawValue ?? "Not found in document."} <small>{fact.sourceStatus} · <Sources sources={fact.source} onNavigateToPage={onNavigateToPage} /></small></dd></div>)}</dl><Warnings warnings={result.value.warnings} /></> : null}
    {result.operation === "ask" ? <><h5>Answer</h5><p className="ai-answer">{result.value.answer}</p><p>Source status: {result.value.sourceStatus} · Confidence: <Confidence value={result.value.confidence} /></p>{result.value.conflicts.length > 0 ? <div className="ai-conflict"><strong>Conflicting evidence found.</strong>{result.value.conflicts.map((conflict) => <p key={conflict.field}>{conflict.field}: {conflict.values.map((value) => value.value).join(" vs ")}</p>)}</div> : null}<Sources sources={result.value.sources} onNavigateToPage={onNavigateToPage} /><Warnings warnings={result.value.warnings} /></> : null}
    {result.operation === "structure" ? <><h5>Document structure</h5><p>Title: {result.value.title.value ?? "Not found in document."}</p><ul>{result.value.sections.map((section) => <li key={`${section.pageNumber}-${section.title}`}>{section.title} · page {section.pageNumber} <Sources sources={section.source} onNavigateToPage={onNavigateToPage} /></li>)}</ul><Warnings warnings={result.value.warnings} /></> : null}
  </article>;
}
function Confidence({ value }: { value: AiConfidence }) { return <span className={`ai-confidence ${value}`}>{value}</span>; }
function Sources({ sources, onNavigateToPage }: { sources: AiSourceReference[]; onNavigateToPage?: (pageNumber: number) => void }) { return sources.length > 0 ? <span className="ai-sources">{sources.slice(0, 4).map((source, index) => <button type="button" key={`${source.pageNumber}-${source.blockId}-${index}`} onClick={() => onNavigateToPage?.(source.pageNumber)} disabled={!onNavigateToPage}><Search size={12} /> Page {source.pageNumber}{source.blockId ? ` · ${source.blockId}` : ""}</button>)}</span> : <small className="ai-no-source">Source unavailable</small>; }
function Warnings({ warnings }: { warnings: string[] }) { return warnings.length > 0 ? <ul className="ai-warning-list">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null; }
