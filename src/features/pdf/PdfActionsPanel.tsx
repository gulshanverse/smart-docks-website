import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Eye, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import type { PdfAsset } from "../../domain/files/types";
import { ACTION_IMPACTS, type ActionType, type DocumentAction, type DocumentActionPlan, type PdfRect } from "../../domain/actions/types";
import { createUserAction, planDocumentActions } from "../../domain/actions/planner";
import { createActionHistory, pushAction, redoAction, undoAction, type ActionHistory } from "../../domain/actions/history";
import { pageIdentity } from "../../domain/actions/types";
import { executeDocumentActions } from "./execute-document-actions";
import { inspectFile } from "../intake/inspect-file";
import { analyzePdfDocument } from "./analyze-pdf-document";
import { extractPdfText } from "../ocr/extract-pdf-text";
import { findPdfTextMatches, type PdfTextMatch } from "./find-pdf-text-matches";

interface PdfActionsPanelProps {
  file: File | null;
  asset: PdfAsset | null;
  onContinueResult?: (file: File, asset: PdfAsset) => void;
  onNavigateToPage?: (pageNumber: number) => void;
}

interface ActionResult {
  file: File;
  asset: PdfAsset;
  plan: DocumentActionPlan;
  downloadUrl: string;
  warnings: string[];
  validationMessage: string;
}

const actionOptions: Array<{ value: ActionType; label: string }> = [
  { value: "redact-region", label: "Redact a region" },
  { value: "highlight-region", label: "Highlight a region" },
  { value: "add-text", label: "Add text" },
  { value: "annotate-note", label: "Add a note" },
  { value: "annotate-shape", label: "Draw a shape" },
  { value: "crop-pages", label: "Crop a page" },
  { value: "resize-pages", label: "Resize pages" },
  { value: "update-metadata", label: "Update basic metadata" },
  { value: "remove-basic-metadata", label: "Remove basic metadata" },
];

function initialRect(): PdfRect { return { x: 72, y: 500, width: 240, height: 48 }; }
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer { const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return copy.buffer; }
function displayLabel(action: DocumentAction): string { return actionOptions.find((option) => option.value === action.actionType)?.label ?? action.actionType; }
function actionExplanation(action: DocumentAction): string {
  const target = action.targets[0];
  const region = target?.rect ?? action.parameters.rect;
  return `${displayLabel(action)} · page ${target?.page.sourcePageNumber ?? "?"}${region ? ` · ${Math.round(region.x)}, ${Math.round(region.y)}, ${Math.round(region.width)} × ${Math.round(region.height)} pt` : ""}`;
}

export function PdfActionsPanel({ file, asset, onContinueResult, onNavigateToPage }: PdfActionsPanelProps) {
  const [actionType, setActionType] = useState<ActionType>("redact-region");
  const [pageNumber, setPageNumber] = useState(1);
  const [rect, setRect] = useState<PdfRect>(initialRect);
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [shape, setShape] = useState<"rectangle" | "line" | "arrow">("rectangle");
  const [pageSize, setPageSize] = useState<"A4" | "A5" | "Letter" | "Legal">("A4");
  const [metadata, setMetadata] = useState({ title: "", author: "", subject: "", creator: "", producer: "" });
  const [targetText, setTargetText] = useState("");
  const [matches, setMatches] = useState<PdfTextMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState("User-selected document edit");
  const [queue, setQueue] = useState<DocumentAction[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"ready" | "running" | "completed" | "failed" | "cancelled">("ready");
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, detail: "" });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [history, setHistory] = useState<ActionHistory<ActionResult | null>>(() => createActionHistory<ActionResult | null>(null));
  const controllerRef = useRef<AbortController | null>(null);
  const resultUrlsRef = useRef<string[]>([]);

  useEffect(() => () => { controllerRef.current?.abort(); resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  const selectedOption = useMemo(() => actionOptions.find((option) => option.value === actionType), [actionType]);
  const isRedaction = actionType === "redact-region";

  function updateRect(field: keyof PdfRect, value: string) { setRect((current) => ({ ...current, [field]: Number(value) })); }

  async function findMatches() {
    if (!file || !targetText.trim()) return;
    setSearching(true); setMessage(null);
    try { setMatches(await findPdfTextMatches(file, targetText)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Text matching could not complete locally."); }
    finally { setSearching(false); }
  }

  function addToQueue() {
    if (!asset) return;
    setMessage(null);
    const target = { page: pageIdentity(asset.id, pageNumber), rect: ["update-metadata", "remove-basic-metadata"].includes(actionType) ? undefined : rect, text: isRedaction && targetText.trim() ? targetText.trim().slice(0, 300) : undefined };
    const parameters = {
      rect: target.rect,
      text: ["add-text", "annotate-note"].includes(actionType) ? text : undefined,
      fontSize: ["add-text", "annotate-note"].includes(actionType) ? fontSize : undefined,
      shape: actionType === "annotate-shape" ? shape : undefined,
      pageSize: actionType === "resize-pages" ? pageSize : undefined,
      metadata: ["update-metadata"].includes(actionType) ? Object.fromEntries(Object.entries(metadata).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.slice(0, 300)])) : undefined,
    };
    const action = createUserAction(asset.id, actionType, [target], parameters, reason.trim().slice(0, 240) || "User-selected document edit");
    const planned = planDocumentActions(asset.id, asset.pageCount, [...queue, action]);
    if ("error" in planned) { setMessage(planned.error.message); return; }
    setQueue(planned.plan.actions);
    setReviewing(true);
    setMessage(`${selectedOption?.label ?? "Action"} added to the review queue.`);
  }

  function removeFromQueue(actionId: string) { setQueue((current) => current.filter((action) => action.actionId !== actionId)); }
  function clearQueue() { setQueue([]); setReviewing(false); setConfirming(false); setMessage("Pending actions cleared. No PDF was changed."); }
  function cancelRun() { controllerRef.current?.abort(); }

  async function executePlan() {
    if (!file || !asset || queue.length === 0) return;
    const planned = planDocumentActions(asset.id, asset.pageCount, queue);
    if ("error" in planned) { setMessage(planned.error.message); setConfirming(false); return; }
    const controller = new AbortController();
    controllerRef.current = controller;
    setConfirming(false); setStatus("running"); setMessage(null); setProgress({ completed: 0, total: asset.pageCount, detail: "Starting deterministic PDF authoring…" });
    try {
      const output = await executeDocumentActions(file, asset, planned.plan, controller.signal, (next) => setProgress({ completed: next.completed, total: next.total, detail: next.message }));
      const outputFile = new File([toArrayBuffer(output.bytes)], output.filename, { type: "application/pdf" });
      const inspected = await inspectFile(outputFile, () => undefined);
      if ("code" in inspected || inspected.category !== "pdf") throw new Error("The generated PDF could not be reopened for validation.");
      if (inspected.pageCount !== output.expectedPageCount) throw new Error("The generated PDF changed page count and was discarded.");
      if (output.validatedTargetTexts.length) {
        const analysis = await analyzePdfDocument(outputFile, inspected);
        const extracted = await extractPdfText(outputFile, analysis);
        const remaining = output.validatedTargetTexts.find((target) => extracted.pages.some((page) => page.text.toLowerCase().includes(target.toLowerCase())));
        if (remaining) throw new Error(`Redaction validation failed: the selected text remained detectable (${remaining.length} characters). The candidate was discarded.`);
      }
      const downloadUrl = URL.createObjectURL(new Blob([toArrayBuffer(output.bytes)], { type: "application/pdf" }));
      resultUrlsRef.current.push(downloadUrl);
      const nextResult = { file: outputFile, asset: inspected, plan: planned.plan, downloadUrl, warnings: output.warnings, validationMessage: output.redactedPageNumbers.length ? "Validated: targeted text was not detected by the supported PDF.js extraction path." : "Validated: PDF.js reopened the new output and confirmed the expected page count." };
      setHistory((current) => pushAction(current, nextResult));
      setResult(nextResult);
      setQueue([]); setReviewing(false); setStatus("completed"); setMessage("New PDF created. The original remains unchanged.");
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      setStatus(cancelled ? "cancelled" : "failed");
      setMessage(cancelled ? "Action cancelled. Partial output was discarded; the original remains unchanged." : error instanceof Error ? error.message : "The action candidate was rejected safely.");
    } finally { controllerRef.current = null; }
  }

  if (!file || !asset) return <div className="core-panel"><p>Add a PDF to open the bounded editor.</p></div>;

  return <div className="pdf-actions-panel" aria-labelledby="pdf-actions-title">
    <div className="actions-intro"><div><p className="eyebrow"><span className="eyebrow-line" /> Phase 7 · Deterministic editor</p><h3 id="pdf-actions-title">Edit PDF safely.</h3><p>AI may suggest an action, but only reviewed user actions reach this deterministic authoring path. Every edit creates a new PDF; the original stays recoverable.</p></div><span className="local-badge"><Check size={13} /> Mutation stays local</span></div>
    <div className="action-boundary-note"><ShieldAlert size={16} /><span><strong>Bounded editor.</strong> Coordinates use PDF points with origin at the bottom-left. This is not a universal Acrobat-compatible editor.</span></div>
    <div className="action-builder">
      <div className="action-builder-heading"><h4>Actions</h4><span>{queue.length} pending</span></div>
      <label className="core-field">Action<select value={actionType} onChange={(event) => setActionType(event.target.value as ActionType)}>{actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="core-inline-fields"><label className="core-field">Page<input type="number" min={1} max={asset.pageCount} value={pageNumber} onChange={(event) => setPageNumber(Math.max(1, Math.min(asset.pageCount, Number(event.target.value))))} /></label><label className="core-field">Reason<input value={reason} maxLength={240} onChange={(event) => setReason(event.target.value)} /></label></div>
      {actionType !== "update-metadata" && actionType !== "remove-basic-metadata" && actionType !== "resize-pages" ? <div className="action-region-fields"><span className="field-label">Region in PDF points</span><div className="core-inline-fields"><label className="core-field">X<input type="number" min={0} value={rect.x} onChange={(event) => updateRect("x", event.target.value)} /></label><label className="core-field">Y<input type="number" min={0} value={rect.y} onChange={(event) => updateRect("y", event.target.value)} /></label><label className="core-field">Width<input type="number" min={1} value={rect.width} onChange={(event) => updateRect("width", event.target.value)} /></label><label className="core-field">Height<input type="number" min={1} value={rect.height} onChange={(event) => updateRect("height", event.target.value)} /></label></div></div> : null}
      {isRedaction ? <div className="core-field"><span className="field-label">Text-match redaction (optional)</span><div className="action-search-row"><input value={targetText} maxLength={300} onChange={(event) => { setTargetText(event.target.value); setMatches([]); }} placeholder="Search a term in the local PDF text" /><button type="button" className="clear-selection" onClick={() => void findMatches()} disabled={searching || !targetText.trim()}>{searching ? "Finding…" : "Find matches"}</button></div><small className="core-hint">Matches come from local PDF.js text extraction. Review each match before queueing it; visual redaction rasterizes the targeted page.</small>{matches.length > 0 ? <div className="action-match-list" aria-label="Text matches">{matches.map((match, index) => <button type="button" className="action-match" key={`${match.pageNumber}-${match.rect.x}-${match.rect.y}-${index}`} onClick={() => { const action = createUserAction(asset.id, "redact-region", [{ page: pageIdentity(asset.id, match.pageNumber), rect: match.rect, text: targetText.trim().slice(0, 300) }], { rect: match.rect }, "User reviewed local text match"); const planned = planDocumentActions(asset.id, asset.pageCount, [...queue, action]); if ("error" in planned) setMessage(planned.error.message); else { setQueue(planned.plan.actions); setReviewing(true); setMessage(`Queued the reviewed match on page ${match.pageNumber}.`); } }}><strong>Page {match.pageNumber}</strong><span>{match.text}</span><small>Queue this match</small></button>)}</div> : null}</div> : null}
      {actionType === "add-text" || actionType === "annotate-note" ? <label className="core-field">Text<textarea value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} placeholder="Enter bounded annotation text" /></label> : null}
      {actionType === "add-text" || actionType === "annotate-note" ? <label className="core-field">Font size<input type="number" min={6} max={72} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label> : null}
      {actionType === "annotate-shape" ? <label className="core-field">Shape<select value={shape} onChange={(event) => setShape(event.target.value as typeof shape)}><option value="rectangle">Rectangle</option><option value="line">Line</option><option value="arrow">Arrow</option></select></label> : null}
      {actionType === "resize-pages" ? <label className="core-field">Page size<select value={pageSize} onChange={(event) => setPageSize(event.target.value as typeof pageSize)}><option value="A4">A4</option><option value="A5">A5</option><option value="Letter">Letter</option><option value="Legal">Legal</option></select><small className="core-hint">Resize is intentionally bounded to a named page size; content is not silently stretched.</small></label> : null}
      {actionType === "update-metadata" ? <div className="metadata-fields">{Object.keys(metadata).map((field) => <label className="core-field" key={field}>{field}<input value={metadata[field as keyof typeof metadata]} maxLength={300} onChange={(event) => setMetadata((current) => ({ ...current, [field]: event.target.value }))} /></label>)}</div> : null}
      {actionType === "remove-basic-metadata" ? <p className="core-hint">Basic title, author, subject, creator, producer, and creation-date fields will be cleared where supported. Nonstandard metadata streams remain unknown.</p> : null}
      <div className="action-builder-actions"><button type="button" className="secondary-button" onClick={addToQueue}><Plus size={15} /> Add to review</button><button type="button" className="clear-selection" onClick={() => onNavigateToPage?.(pageNumber)}><Eye size={15} /> Preview page</button></div>
    </div>
    {message ? <div className={`action-message ${status === "failed" || status === "cancelled" ? "error" : ""}`} role={status === "failed" || status === "cancelled" ? "alert" : "status"}>{message}</div> : null}
    {queue.length > 0 ? <section className="action-review" aria-labelledby="action-review-title"><div className="action-review-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Review before mutation</p><h4 id="action-review-title">Changes to apply</h4></div><span className="risk-pill high">Review required</span></div><p className="action-review-warning">The original PDF will remain unchanged. High-impact redaction creates a new rasterized page and must be independently verified for highly sensitive or forensic use.</p><ol className="action-queue">{queue.map((action) => <li key={action.actionId}><div><strong>{actionExplanation(action)}</strong><small>{action.evidence.reason} · {action.preservationImpact} preservation impact · {action.risk} risk{action.evidence.source === "ai" ? " · AI suggestion" : " · user action"}</small></div><button type="button" className="clear-selection" onClick={() => removeFromQueue(action.actionId)} aria-label={`Remove ${displayLabel(action)}`}><Trash2 size={14} /></button></li>)}</ol><div className="action-review-actions"><button type="button" className="clear-selection" onClick={clearQueue}><X size={15} /> Cancel</button><button type="button" className="primary-button destructive-core" onClick={() => setConfirming(true)} disabled={status === "running"}><ShieldAlert size={15} /> Review and apply</button></div></section> : <div className="action-empty">Add one or more actions. Nothing is mutated until you review and confirm.</div>}
    {status === "running" ? <div className="action-progress" role="status"><div><strong>Creating and validating a new PDF</strong><span>{progress.detail}</span></div><progress value={progress.completed} max={Math.max(1, progress.total)} /><button type="button" className="clear-selection" onClick={cancelRun}>Cancel</button></div> : null}
    {confirming ? <div className="action-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="action-confirm-title"><div><ShieldAlert size={20} /><div><h4 id="action-confirm-title">Apply these document changes?</h4><p>{queue.length} reviewed action{queue.length === 1 ? "" : "s"} will create a new PDF. The original remains unchanged. Redaction is destructive and the candidate will be rejected if its validation fails.</p></div></div><div><button type="button" className="secondary-button" onClick={() => setConfirming(false)}>Cancel</button><button type="button" className="primary-button destructive-core" onClick={() => void executePlan()}>Confirm and apply</button></div></div> : null}
    {result ? <section className="action-result" aria-labelledby="action-result-title"><div className="result-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Validated output</p><h4 id="action-result-title">New PDF ready.</h4></div><span className="result-status achieved"><Check size={15} /> Validated</span></div><div className="action-result-details"><strong>{result.file.name}</strong><span>{result.asset.pageCount} pages · {result.file.size < 1000 ? `${result.file.size} B` : `${(result.file.size / 1000).toFixed(1)} KB`}</span><span>{result.validationMessage}</span>{result.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div><div className="result-actions"><a className="primary-button" href={result.downloadUrl} download={result.file.name}><Download size={16} /> Download PDF</a>{onContinueResult ? <button type="button" className="secondary-button" onClick={() => onContinueResult(result.file, result.asset)}>Continue editing</button> : null}<button type="button" className="clear-selection" onClick={() => { const next = undoAction(history); setHistory(next); setResult(next.present); setMessage("Undid the last action result. The original remains unchanged."); }} disabled={history.past.length === 0}>Undo</button><button type="button" className="clear-selection" onClick={() => { const next = redoAction(history); setHistory(next); setResult(next.present); setMessage("Redid the validated action result."); }} disabled={history.future.length === 0}>Redo</button></div></section> : null}
  </div>;
}
