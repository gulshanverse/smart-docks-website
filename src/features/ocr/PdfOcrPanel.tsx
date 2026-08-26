import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Search, ScanText, ShieldCheck, Square, X } from "lucide-react";
import type { PdfAsset } from "../../domain/files/types";
import { createDocumentIntelligenceSnapshot } from "../../domain/pdfs/optimization";
import { createPdfMakeSearchableWorkflow, createPdfOcrInspectionWorkflow, createPdfOcrRecognitionWorkflow, createPdfSearchWorkflow, createPdfStructureWorkflow } from "../../domain/workflows/types";
import { extractBoundedOcrText, searchOcrPages } from "../../domain/ocr/search";
import { createOcrPlan } from "../../domain/ocr/planning";
import { deriveDocumentStructure, createDocumentUnderstandingSnapshot } from "../../domain/ocr/understanding";
import type { DocumentSearchResult, DocumentStructureResult, OcrDocumentResult, OcrLanguage, OcrPlan, SearchablePdfValidation } from "../../domain/ocr/types";
import { createSearchablePdf, SearchablePdfValidationError } from "./create-searchable-pdf";
import { extractPdfText, textResultToFile } from "./extract-pdf-text";
import { recognizePdf, type OcrProgress, OcrCancelledError } from "./recognize-pdf";

interface PdfOcrPanelProps { file: File | null; asset: PdfAsset | null; onContinueResult?: (file: File, asset: PdfAsset) => void; }

export function PdfOcrPanel({ file, asset, onContinueResult }: PdfOcrPanelProps) {
  const [language, setLanguage] = useState<OcrLanguage>("eng");
  const [analysis, setAnalysis] = useState<import("../../domain/pdfs/document-analysis").PdfDocumentAnalysis | null>(null);
  const [plan, setPlan] = useState<OcrPlan | null>(null);
  const [ocr, setOcr] = useState<OcrDocumentResult | null>(null);
  const [structure, setStructure] = useState<DocumentStructureResult | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [validation, setValidation] = useState<SearchablePdfValidation | null>(null);
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<DocumentSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputUrlRef = useRef<string | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current); }, []);
  useEffect(() => { abortRef.current?.abort(); clearOutput(); setAnalysis(null); setPlan(null); setOcr(null); setStructure(null); setProgress(null); setSearchResult(null); setNotice(null); }, [file]);

  const extractedText = useMemo(() => ocr ? extractBoundedOcrText(ocr.pages) : "", [ocr]);
  const hasRecognizedText = Boolean(ocr && (ocr.processedPages.length > 0 || ocr.textPresence === "detected"));
  const actionLabel = plan?.recommendation === "not-needed" ? "Extract searchable text" : "Run OCR locally";

  function clearOutput() { if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current); outputUrlRef.current = null; setOutputUrl(null); setOutputFile(null); setValidation(null); }

  async function prepareAnalysis(controller: AbortController) {
    if (!file || !asset) throw new Error("Add a PDF before using OCR tools.");
    const { analyzePdfDocument } = await import("../pdf/analyze-pdf-document");
    const nextAnalysis = await analyzePdfDocument(file, asset, undefined, controller.signal);
    const nextPlan = createOcrPlan(nextAnalysis, language);
    createPdfOcrInspectionWorkflow(asset, nextPlan);
    setAnalysis(nextAnalysis); setPlan(nextPlan);
    return { nextAnalysis, nextPlan };
  }

  async function runLocalTextOrOcr() {
    if (!file || !asset || busy) return;
    const controller = new AbortController(); abortRef.current = controller; setBusy(true); setNotice(null); setProgress(null); setSearchResult(null); clearOutput();
    try {
      const { nextAnalysis, nextPlan } = await prepareAnalysis(controller);
      if (nextPlan.recommendation === "unsupported") throw new Error(nextPlan.warnings[0] ?? "The selected language is not bundled locally.");
      if (nextPlan.recommendation === "review-limit") throw new Error(nextPlan.warnings[0] ?? "This document exceeds the bounded OCR page limit; narrow the document before authoring a searchable PDF.");
      let result: OcrDocumentResult;
      if (nextPlan.recommendation === "not-needed") {
        result = await extractPdfText(file, nextAnalysis, (pageProgress) => setProgress({ stage: "recognizing", pageNumber: pageProgress.pageNumber, completed: pageProgress.pageNumber, total: pageProgress.pageTotal, progress: pageProgress.pageNumber / pageProgress.pageTotal, detail: pageProgress.message }), controller.signal);
      } else {
        const recognized = await recognizePdf(file, nextAnalysis, language, setProgress, controller.signal);
        result = recognized.result;
        createPdfOcrRecognitionWorkflow(asset, recognized.plan, result);
      }
      setOcr(result);
      const intelligence = createDocumentIntelligenceSnapshot(nextAnalysis);
      const nextStructure = deriveDocumentStructure(nextAnalysis, result);
      createPdfStructureWorkflow(asset, nextStructure);
      setStructure(nextStructure);
      createDocumentUnderstandingSnapshot(nextAnalysis, intelligence, result);
      if (result.failedPages.length > 0) setNotice("OCR completed with page-level failures. Text can be reviewed locally, but searchable-PDF authoring is blocked until all planned pages succeed.");
    } catch (error) {
      if (error instanceof OcrCancelledError || controller.signal.aborted) setNotice("OCR cancelled. The original PDF remains unchanged.");
      else setNotice(error instanceof Error ? error.message : "Local OCR could not complete.");
    } finally { setBusy(false); abortRef.current = null; }
  }

  async function makeSearchable() {
    if (!file || !asset || !analysis || !plan || !ocr || busy) return;
    const controller = new AbortController(); abortRef.current = controller; setBusy(true); setNotice(null); clearOutput();
    try {
      createPdfMakeSearchableWorkflow(asset, plan, ocr);
      const output = await createSearchablePdf({ source: file, analysis, plan, result: ocr, preserveVisualAppearance: true, signal: controller.signal, onProgress: (event) => setNotice(event.message) });
      const url = URL.createObjectURL(output.file); outputUrlRef.current = url; setOutputFile(output.file); setOutputUrl(url); setValidation(output.validation); setOcr((current) => current ? { ...current, searchablePdfAvailable: true } : current); setNotice("Searchable PDF was reopened, rendered, and validated locally.");
    } catch (error) {
      if (error instanceof OcrCancelledError || controller.signal.aborted) setNotice("Searchable-PDF authoring cancelled. No partial output is available.");
      else if (error instanceof SearchablePdfValidationError) setNotice(`Searchable-PDF validation blocked the result: ${error.validation.criticalFailures[0] ?? "the candidate did not pass preservation checks."}`);
      else setNotice(error instanceof Error ? error.message : "Searchable-PDF authoring failed locally.");
    } finally { setBusy(false); abortRef.current = null; }
  }

  function cancel() { abortRef.current?.abort(); }
  function search() { if (!ocr) return; const result = searchOcrPages(ocr.pages, query); createPdfSearchWorkflow(asset as PdfAsset, query, result); setSearchResult(result); }
  async function copyText() { if (!extractedText) return; await navigator.clipboard?.writeText(extractedText).catch(() => undefined); setNotice("Bounded recognized text copied locally when clipboard permission was available."); }
  function downloadText() { if (!ocr) return; const textFile = textResultToFile(ocr); const url = URL.createObjectURL(textFile); const anchor = document.createElement("a"); anchor.href = url; anchor.download = textFile.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }

  if (!file || !asset) return <div className="core-panel"><p>Add a PDF to inspect OCR readiness, recognize bounded scanned pages, extract text, and create a validated searchable copy.</p></div>;

  return <div className="core-panel ocr-panel">
    <div className="ocr-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> OCR + document understanding</p><h4>Make scanned PDFs searchable.</h4><p>OCR runs in a local worker with bundled English resources. The original PDF is never overwritten, and searchable output is offered only after reopening, rendering, and text-preservation checks.</p></div><span className="local-badge"><ShieldCheck size={13} /> No upload</span></div>
    <div className="ocr-controls"><label className="core-field">OCR language<select value={language} onChange={(event) => { setLanguage(event.target.value as OcrLanguage); setPlan(null); setAnalysis(null); setOcr(null); setStructure(null); clearOutput(); }} disabled={busy}><option value="eng">English · bundled</option><option value="hin" disabled>Hindi · planned local pack</option></select></label><div className="ocr-control-note">Bounded run: up to 24 pages, with no automatic language detection.</div></div>
    {plan ? <div className="ocr-plan"><strong>Local plan</strong><span>{plan.plannedPages.length} OCR page{plan.plannedPages.length === 1 ? "" : "s"} · {plan.skippedPages.length} skipped · recommendation: {plan.recommendation.replaceAll("-", " ")}</span>{plan.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div> : null}
    {notice ? <div className="core-notice" role="status"><X size={16} /><span>{notice}</span></div> : null}
    {progress ? <div className="ocr-progress" aria-live="polite"><div className="ocr-progress-row"><strong>{progress.detail}</strong><span>{progress.progress === null ? "Working" : `${Math.round(progress.progress * 100)}%`}</span></div><progress max="1" value={progress.progress ?? undefined} />{busy ? <button type="button" className="secondary-button" onClick={cancel}><Square size={14} /> Cancel safely</button> : null}</div> : null}
    <div className="ocr-actions"><button type="button" className="primary-button" onClick={() => void runLocalTextOrOcr()} disabled={busy}>{busy ? "Processing locally…" : <><ScanText size={16} /> {actionLabel}</>}</button>{ocr && plan && plan.plannedPages.length > 0 ? <button type="button" className="secondary-button" onClick={() => void makeSearchable()} disabled={busy || ocr.failedPages.length > 0 || ocr.processedPages.length !== plan.plannedPages.length}><Check size={15} /> Make searchable PDF</button> : null}</div>
    {ocr ? <div className="ocr-summary-grid"><div><small>Recognized pages</small><strong>{ocr.processedPages.length} / {ocr.pageCount}</strong></div><div><small>Text characters</small><strong>{ocr.boundedTextCharacterCount.toLocaleString()}</strong></div><div><small>OCR time</small><strong>{ocr.processingTimeMs.toLocaleString()} ms</strong></div><div><small>Searchable result</small><strong>{ocr.searchablePdfAvailable ? "Validated" : plan?.recommendation === "not-needed" ? "Source searchable" : "Not authored"}</strong></div></div> : null}
    {extractedText ? <section className="ocr-text-section" aria-labelledby="ocr-text-title"><div className="ocr-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Local text</p><h5 id="ocr-text-title">Review recognized text</h5></div><div className="ocr-text-actions"><button type="button" className="secondary-button" onClick={() => void copyText()}><Copy size={14} /> Copy</button><button type="button" className="secondary-button" onClick={downloadText}><Download size={14} /> .txt</button></div></div><textarea className="ocr-text-viewer" readOnly value={extractedText} aria-label="Bounded locally recognized text" /></section> : null}
    {ocr ? <section className="ocr-search-section" aria-labelledby="ocr-search-title"><div className="ocr-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Search</p><h5 id="ocr-search-title">Find text locally</h5></div></div><div className="ocr-search-form"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recognized text" aria-label="Search recognized text" onKeyDown={(event) => { if (event.key === "Enter") search(); }} /><button type="button" className="secondary-button" onClick={search}><Search size={14} /> Search</button></div>{searchResult ? <div className="ocr-search-results" aria-live="polite"><strong>{searchResult.matches.length} match{searchResult.matches.length === 1 ? "" : "es"}</strong>{searchResult.matches.map((match, index) => <button type="button" key={`${match.pageNumber}-${match.start}-${index}`} className="ocr-search-result" onClick={() => setNotice(`Local match on page ${match.pageNumber}. Page navigation remains bounded to this OCR result.`)}><span>Page {match.pageNumber}</span><small>{match.excerpt}</small></button>)}{searchResult.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div> : null}</section> : null}
    {structure ? <section className="ocr-understanding-section" aria-labelledby="ocr-understanding-title"><div className="ocr-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Deterministic understanding</p><h5 id="ocr-understanding-title">Document signals</h5></div></div><div className="ocr-understanding-grid"><div><small>Likely type</small><strong>{structure.documentType.value.replaceAll("-", " ")}</strong><span>{structure.documentType.confidence} heuristic</span></div><div><small>Possible sections</small><strong>{structure.sections.length}</strong><span>heading-like lines</span></div><div><small>Table-like regions</small><strong>{structure.tableLikeRegions.length}</strong><span>review required</span></div><div><small>Sensitive signals</small><strong>{structure.sensitiveRegions.length}</strong><span>values not retained</span></div></div><ul className="ocr-warning-list">{structure.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
    {validation && outputFile && outputUrl ? <article className="ocr-result"><div><p className="eyebrow"><span className="eyebrow-line" /> Validated result</p><h5>{outputFile.name}</h5><p>{(outputFile.size / 1_000_000).toFixed(2)} MB · {validation.representativePagesRendered.length} representative render{validation.representativePagesRendered.length === 1 ? "" : "s"} validated</p><span className="local-badge"><Check size={13} /> Searchable PDF ready</span></div><div className="core-result-actions"><a className="primary-button" href={outputUrl} download={outputFile.name}><Download size={16} /> Download searchable PDF</a>{onContinueResult ? <button type="button" className="secondary-button" onClick={() => onContinueResult(outputFile, asset)}><Check size={14} /> Continue editing</button> : null}</div><details><summary>Preservation report</summary><p>{validation.sourceCharacterCount.toLocaleString()} source characters → {validation.candidateCharacterCount.toLocaleString()} candidate characters.</p>{validation.featureChanges.map((change) => <small key={change.feature}>{change.feature}: {change.status} ({change.before} → {change.after})</small>)}</details></article> : null}
  </div>;
}
