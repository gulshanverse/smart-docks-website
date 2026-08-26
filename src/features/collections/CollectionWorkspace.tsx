import { Check, ChevronDown, ChevronUp, CircleAlert, FileStack, LockKeyhole, Play, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FileAsset, PdfAsset } from "../../domain/files/types";
import { COLLECTION_LIMITS, type CollectionDocument, type CollectionHistoryItem, type CollectionResult, type CollectionSearchResult, type CollectionState } from "../../domain/collections/types";
import { evaluateCollectionCompatibility, fingerprintFile } from "../../domain/collections/compatibility";
import { collectionCapabilities, planCollectionWorkflow } from "../../domain/collections/planner";
import { inspectFile } from "../intake/inspect-file";
import { createImageToPdfPlan, createMergePlan } from "../../domain/pdfs/core";
import { searchCollectionDocuments } from "./search-collection";
import { inspectFile as reopenFile } from "../intake/inspect-file";

interface CollectionWorkspaceProps { onContinuePdf?: (file: File, asset: PdfAsset) => void; }
interface CollectionOutput { fileName: string; downloadUrl: string; status: "validated" | "failed" | "cancelled"; documentName: string; validation: string; }

function makeDocument(file: File, asset: FileAsset, order: number): CollectionDocument { return { documentId: asset.id, file, originalFile: file, asset, order, selected: true, duplicateOf: null, fingerprint: fingerprintFile(file) }; }
function formatAsset(asset: FileAsset): string { return asset.category === "pdf" ? `PDF · ${asset.pageCount} pages` : asset.category === "image" ? `${asset.extension.toUpperCase()} · ${asset.width} × ${asset.height}` : `${asset.format.toUpperCase()} · ${asset.analysis.documentType}`; }

export function CollectionWorkspace({ onContinuePdf }: CollectionWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [documents, setDocuments] = useState<CollectionDocument[]>([]);
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<ReturnType<typeof planCollectionWorkflow> | null>(null);
  const [state, setState] = useState<CollectionState>("idle");
  const [outputs, setOutputs] = useState<CollectionOutput[]>([]);
  const [searchResult, setSearchResult] = useState<CollectionSearchResult | null>(null);
  const [history, setHistory] = useState<CollectionHistoryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);
  const collectionIdRef = useRef(`collection-${Date.now()}`);

  useEffect(() => () => { urlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  function clearOutputs() { urlsRef.current.forEach((url) => URL.revokeObjectURL(url)); urlsRef.current = []; setOutputs([]); setSearchResult(null); }
  function clearCollection() { clearOutputs(); documents.forEach((document) => { if (document.asset.previewUrl) URL.revokeObjectURL(document.asset.previewUrl); }); setDocuments([]); setGoal(""); setPlan(null); setNotice(null); setState("idle"); }
  function move(index: number, direction: -1 | 1) { setDocuments((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next.map((document, order) => ({ ...document, order })); }); setPlan(null); }
  function toggle(documentId: string) { setDocuments((current) => current.map((document) => document.documentId === documentId ? { ...document, selected: !document.selected } : document)); setPlan(null); }
  function remove(documentId: string) { setDocuments((current) => current.filter((document) => document.documentId !== documentId).map((document, order) => ({ ...document, order }))); setPlan(null); }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = [...files];
    if (documents.length + incoming.length > COLLECTION_LIMITS.maxDocuments) { setNotice(`Collections are limited to ${COLLECTION_LIMITS.maxDocuments} documents.`); return; }
    setBusy(true); setState("inspecting"); setNotice(null);
    try {
      const next: CollectionDocument[] = [...documents];
      for (const file of incoming) {
        const inspected = await inspectFile(file, () => undefined);
        if ("code" in inspected) throw new Error(`${file.name}: ${inspected.message}`);
        const duplicate = next.find((document) => document.fingerprint === fingerprintFile(file));
        next.push({ ...makeDocument(file, inspected, next.length), duplicateOf: duplicate?.documentId ?? null });
      }
      setDocuments(next);
      setState("collecting");
    } catch (error) { setNotice(error instanceof Error ? error.message : "One or more documents could not be inspected."); setState("recoverable-error"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  function review() {
    if (documents.length === 0) return setNotice("Add documents before planning a collection workflow.");
    if (!goal.trim()) return setNotice("Describe one explicit goal for the selected documents.");
    setNotice(null); setState("planning");
    const nextPlan = planCollectionWorkflow(collectionIdRef.current, documents, goal);
    setPlan(nextPlan); setState(nextPlan.compatible ? (nextPlan.requiresConfirmation ? "awaiting-confirmation" : "review") : "recoverable-error");
  }

  async function validatePdfOutput(file: File, expectedPageCount: number, documentName: string): Promise<CollectionOutput> {
    const inspected = await reopenFile(file, () => undefined);
    if ("code" in inspected || inspected.category !== "pdf" || inspected.pageCount !== expectedPageCount) return { fileName: file.name, downloadUrl: "", status: "failed", documentName, validation: "Generated PDF could not be reopened with the expected page count." };
    const downloadUrl = URL.createObjectURL(file); urlsRef.current.push(downloadUrl);
    return { fileName: file.name, downloadUrl, status: "validated", documentName, validation: `PDF.js reopened the output with ${inspected.pageCount} pages.` };
  }

  async function execute() {
    if (!plan || !plan.compatible) return;
    setBusy(true); cancelRef.current = false; setState("queued"); clearOutputs();
    const nextOutputs: CollectionOutput[] = [];
    try {
      setState("running");
      const selected = documents.filter((document) => plan.intent.documentIds.includes(document.documentId));
      if (plan.intent.operation === "merge-pdfs") {
        const pdfs = selected.filter((document): document is CollectionDocument & { asset: PdfAsset } => document.asset.category === "pdf");
        const mergePlan = createMergePlan(pdfs.map((document) => document.file.name), pdfs.map((document) => document.asset.pageCount), true);
        if ("error" in mergePlan) throw new Error(mergePlan.error);
        const { mergePdfs } = await import("../pdf/core-operations");
        const output = await mergePdfs(pdfs.map((document) => document.file), pdfs.map((document) => document.asset), mergePlan.plan);
        const resultFile = new File([new Uint8Array(output.bytes)], output.filename, { type: "application/pdf" });
        nextOutputs.push(await validatePdfOutput(resultFile, pdfs.reduce((sum, document) => sum + document.asset.pageCount, 0), "Merged collection"));
      } else if (plan.intent.operation === "image-collection-to-pdf") {
        const images = selected.filter((document) => document.asset.category === "image");
        const imagePlan = createImageToPdfPlan(images.map((document) => document.file.name), false);
        if ("error" in imagePlan) throw new Error(imagePlan.error);
        const { imagesToPdf } = await import("../pdf/core-operations");
        const output = await imagesToPdf(images.map((document) => document.file), imagePlan.plan);
        const resultFile = new File([new Uint8Array(output.bytes)], output.filename, { type: "application/pdf" });
        nextOutputs.push(await validatePdfOutput(resultFile, images.length, "Ordered image collection"));
      } else if (plan.intent.operation === "inspect") {
        selected.forEach((document) => nextOutputs.push({ fileName: "", downloadUrl: "", status: "validated", documentName: document.asset.name, validation: "Source inspection is already validated." }));
      } else if (plan.intent.operation === "multi-document-search") {
        const query = goal.replace(/.*(?:search|find|look for)\s+/i, "").trim() || goal;
        setSearchResult(await searchCollectionDocuments(selected, query));
      } else {
        throw new Error("This collection goal is planned but must be continued through its existing specialized workspace; no unvalidated batch output is offered here.");
      }
      if (cancelRef.current) { setState("cancelled"); return; }
      setOutputs(nextOutputs); setState(nextOutputs.some((output) => output.status === "failed") ? "partial-success" : "completed");
      const successful = nextOutputs.filter((output) => output.status === "validated").length;
      const collectionResult: CollectionResult = { contractVersion: "phase11-collection-result-v1", collectionId: plan.collectionId, workflowId: plan.workflowId, sourceDocumentIds: plan.intent.documentIds, outputDocumentIds: nextOutputs.filter((output) => output.status === "validated").map((output) => output.fileName), perDocumentResults: nextOutputs.map((output, index) => ({ documentId: selected[index]?.documentId ?? `result-${index}`, documentName: output.documentName, status: output.status === "validated" ? "validated" : output.status, outputFileName: output.fileName || null, downloadUrl: output.downloadUrl || null, outputBytes: null, validationMessage: output.validation, warnings: [], provenance: [{ documentId: selected[index]?.documentId ?? `result-${index}`, documentName: output.documentName, format: selected[index]?.asset.extension ?? "unknown", location: null, excerpt: null, sourceType: "detected", confidence: "high" }] })), overallStatus: successful === nextOutputs.length ? "validated" : "partial-success", validationSummary: `${successful} validated output${successful === 1 ? "" : "s"}.`, warnings: plan.warnings, processingBoundary: plan.processingBoundary, provenance: [], historyReference: `${plan.collectionId}:${Date.now()}` };
      setHistory((current) => [{ historyId: collectionResult.historyReference, workflowId: collectionResult.workflowId, collectionId: collectionResult.collectionId, operation: plan.intent.operation, sourceDocumentIds: collectionResult.sourceDocumentIds, sourceNames: selected.map((document) => document.asset.name), resultStatus: collectionResult.overallStatus, timestamp: Date.now(), outputFileNames: nextOutputs.map((output) => output.fileName).filter(Boolean), warnings: collectionResult.warnings, resultAvailable: true }, ...current].slice(0, COLLECTION_LIMITS.maxHistoryItems));
    } catch (error) { setOutputs(nextOutputs); setNotice(error instanceof Error ? error.message : "The collection workflow failed locally."); setState(nextOutputs.length > 0 ? "partial-success" : "failed"); }
    finally { setBusy(false); }
  }

  const compatibility = plan ? evaluateCollectionCompatibility(documents.filter((document) => plan.intent.documentIds.includes(document.documentId)), plan.intent.operation) : null;
  const capabilities = collectionCapabilities(documents.filter((document) => document.selected));
  return <section className="collection-workspace" aria-labelledby="collection-workspace-title">
    <div className="collection-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Phase 11 · Collections</p><h3 id="collection-workspace-title">Several files. One controlled workflow.</h3><p>Add a bounded collection, keep its order visible, choose an explicit goal, and review compatibility before any batch work starts.</p></div><span className="local-badge"><LockKeyhole size={13} /> Memory-only session</span></div>
    <div className="collection-toolbar"><input ref={inputRef} className="file-picker-input" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.docx,.docm,.pptx,.pptm,.xlsx,.xlsm" aria-label="Add documents to collection" onChange={(event) => void addFiles(event.target.files)} /><span>{documents.length} / {COLLECTION_LIMITS.maxDocuments} documents</span><button className="secondary-button" type="button" onClick={() => inputRef.current?.click()} disabled={busy}><FileStack size={15} /> Add documents</button><button className="secondary-button" type="button" onClick={clearCollection} disabled={busy || documents.length === 0}><Trash2 size={15} /> Clear</button></div>
    {documents.length === 0 ? <div className="collection-empty"><FileStack size={22} /><strong>Start a controlled collection</strong><span>Use PDFs for merge, images for ordered PDF creation, or compatible PDF/Office sources for bounded inspection and search planning.</span></div> : <div className="collection-list">{documents.map((document, index) => <article className={`collection-item${document.selected ? " selected" : ""}`} key={document.documentId}><input type="checkbox" checked={document.selected} onChange={() => toggle(document.documentId)} aria-label={`Select ${document.asset.name}`} /><div className="collection-item-main"><strong>{index + 1}. {document.asset.name}</strong><span>{formatAsset(document.asset)} · {Math.round(document.asset.sizeBytes / 1000)} KB</span><small>{document.duplicateOf ? "Appears twice with another selected source; both remain unless removed." : `${document.asset.category === "office" ? document.asset.analysis.complexity : document.asset.category === "pdf" ? document.asset.classification : "Validated image"}`}</small></div><div className="collection-item-actions"><button type="button" className="icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${document.asset.name} earlier`}><ChevronUp size={15} /></button><button type="button" className="icon-button" onClick={() => move(index, 1)} disabled={index === documents.length - 1} aria-label={`Move ${document.asset.name} later`}><ChevronDown size={15} /></button><button type="button" className="icon-button" onClick={() => remove(document.documentId)} aria-label={`Remove ${document.asset.name}`}><X size={15} /></button></div></article>)}</div>}
    {documents.length > 0 ? <><div className="collection-capability-row"><strong>Compatible collection capabilities</strong>{capabilities.map((capability) => <span className="capability-pill" key={capability}>{capability.replaceAll("-", " ")}</span>)}{capabilities.length === 0 ? <span className="capability-pill unavailable">No shared operation</span> : null}</div><label className="collection-goal-label" htmlFor="collection-goal">What do you want to do with these files?</label><textarea id="collection-goal" value={goal} onChange={(event) => { setGoal(event.target.value); setPlan(null); setState("collecting"); }} placeholder="e.g. merge these PDFs, convert these images into one PDF, or find invoice numbers in all these documents" rows={2} /><div className="collection-actions"><button className="primary-button" type="button" onClick={review} disabled={busy || !goal.trim()}><Check size={15} /> Review collection plan</button>{plan && plan.compatible && plan.executable ? <button className="primary-button" type="button" onClick={() => void execute()} disabled={busy || plan.requiresConfirmation}><Play size={15} /> Run workflow</button> : null}{busy ? <button className="secondary-button" type="button" onClick={() => { cancelRef.current = true; setState("cancelled"); }}><X size={15} /> Cancel queued work</button> : null}</div></> : null}
    {compatibility && !compatibility.supported ? <div className="collection-notice" role="alert"><CircleAlert size={16} /> {compatibility.message}</div> : null}
    {plan ? <div className="collection-plan" data-testid="collection-plan"><div className="collection-plan-heading"><div><p className="eyebrow">Review before execution</p><h4>{plan.intent.operation.replaceAll("-", " ")}</h4><span>{plan.intent.documentIds.length} selected documents · {plan.steps.length} bounded steps</span></div><span className={`unified-risk risk-${plan.risk}`}>{plan.risk} risk</span></div><ol className="unified-step-list">{plan.steps.slice(0, 24).map((workflowStep, index) => <li key={workflowStep.stepId}><span className="step-number">{index + 1}</span><div><strong>{workflowStep.capability}</strong><span>{workflowStep.inputDocumentIds.length} input{workflowStep.inputDocumentIds.length === 1 ? "" : "s"} · {workflowStep.dependencies.length ? `after ${workflowStep.dependencies.join(", ")}` : "ready"}</span><small>{workflowStep.requiresConfirmation ? "Explicit confirmation or consent required" : workflowStep.validationPlan[0]}</small></div></li>)}</ol><div className="unified-plan-meta"><span><LockKeyhole size={14} /> {plan.processingBoundary === "browser-local-to-ai-gateway" ? "Browser-local + explicit AI gateway" : "Browser-local"}</span><span><FileStack size={14} /> Originals unchanged</span><span>{plan.expectedOutputCount} expected output{plan.expectedOutputCount === 1 ? "" : "s"}</span></div>{plan.warnings.map((warning) => <p className="unified-warning" key={warning}><CircleAlert size={15} /> {warning}</p>)}</div> : null}
    {notice ? <div className="collection-notice" role="alert"><CircleAlert size={16} /> {notice}</div> : null}
    {searchResult ? <div className="collection-results" data-testid="collection-search-results"><div className="collection-plan-heading"><div><p className="eyebrow">Bounded collection search</p><h4>{searchResult.message}</h4></div><span className="result-status">{searchResult.searchedDocumentCount} / {searchResult.totalDocumentCount} documents</span></div>{searchResult.matches.map((match) => <div className="collection-result-row" key={`${match.documentId}-${match.location}-${match.excerpt}`}><div><strong>{match.documentName} · {match.location ?? "Location unavailable"}</strong><span>{match.excerpt}</span><small>{match.format.toUpperCase()} · {match.sourceType} · {match.confidence ?? "confidence unavailable"}</small></div></div>)}</div> : null}
    {outputs.length > 0 ? <div className="collection-results"><div className="collection-plan-heading"><div><p className="eyebrow">Validated collection result</p><h4>{state === "partial-success" ? "Partial success" : "Outputs ready"}</h4></div><span className="result-status"><Check size={13} /> {outputs.filter((output) => output.status === "validated").length} validated</span></div>{outputs.map((output) => <div className="collection-result-row" key={`${output.documentName}-${output.fileName}`}><div><strong>{output.documentName}</strong><span>{output.validation}</span></div>{output.status === "validated" && output.downloadUrl ? <a className="secondary-button" href={output.downloadUrl} download={output.fileName}>Download</a> : <span className="capability-pill unavailable">{output.status}</span>}</div>)}</div> : null}
    {history.length > 0 ? <div className="collection-history"><div className="collection-plan-heading"><div><p className="eyebrow">Recent activity</p><h4>Session history</h4></div><button className="secondary-button" type="button" onClick={() => setHistory([])}><RotateCcw size={14} /> Clear history</button></div>{history.map((item) => <div className="history-row" key={item.historyId}><span><Check size={14} /> {item.operation.replaceAll("-", " ")}</span><small>{item.sourceNames.length} documents · {item.resultStatus} · {new Date(item.timestamp).toLocaleTimeString()}</small></div>)}</div> : null}
  </section>;
}
