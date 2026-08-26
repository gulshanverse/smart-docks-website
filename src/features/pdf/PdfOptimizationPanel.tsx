import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileDown, PauseCircle, Play, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { PdfAsset } from "../../domain/files/types";
import { parsePdfIntent, type PdfOptimizationIntent } from "../../domain/intents/parse-intent";
import { buildPdfOptimizationResult, createDocumentIntelligenceSnapshot, createPdfOptimizationPlan, qualityPolicy, selectBestPdfCandidate, type PdfOptimizationAnalysis, type PdfOptimizationCandidateResult, type PdfOptimizationMetadataPolicy, type PdfOptimizationPlan, type PdfOptimizationProgress, type PdfOptimizationQualityDecision, type PdfOptimizationResult, type PdfOptimizationStrategy, type PdfQualityMode } from "../../domain/pdfs/optimization";
import { buildAdvancedOptimizationPlan, type DocumentIntelligenceSnapshot, type PdfAdvancedOptimizationPlan, type PdfDocumentAnalysis } from "../../domain/pdfs/document-analysis";
import { safeCoreFilename } from "../../domain/pdfs/core";
import { createPdfAdvancedAnalysisWorkflow, createPdfOptimizationWorkflow } from "../../domain/workflows/types";
import { comparePdfDocumentFeatures, type PdfPreservationValidation } from "../../domain/pdfs/preservation";
import { inspectFile } from "../intake/inspect-file";
import { analyzePdfForOptimization, OptimizationCancelledError, optimizePdfCandidates, type PdfOptimizationCandidateOutput } from "./optimize-pdf";
import { analyzePdfDocument, DocumentAnalysisCancelledError, validatePdfRepresentativeRenders } from "./analyze-pdf-document";

interface PdfOptimizationPanelProps {
  file: File | null;
  asset: PdfAsset | null;
  onContinueResult?: (file: File, asset: PdfAsset) => void;
}

interface DisplayResult {
  result: PdfOptimizationResult;
  file: File;
  asset: PdfAsset;
  previewUrl: string;
  downloadUrl: string;
}

const qualityModes: Array<{ value: PdfQualityMode; label: string; description: string }> = [
  { value: "maximum", label: "Maximum quality", description: "Use only the lightest tested change." },
  { value: "balanced", label: "Balanced", description: "A practical quality and size trade-off." },
  { value: "smaller", label: "Smaller file", description: "Accept more image reduction when useful." },
  { value: "smallest", label: "Smallest practical", description: "Use the documented quality floor; never destroy the document." },
];

function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function qualityLabel(value: PdfOptimizationQualityDecision): string {
  return value === "best-effort" ? "Best effort" : value[0].toUpperCase() + value.slice(1);
}

function strategyLabel(value: PdfOptimizationStrategy): string {
  return value === "original-preserved" ? "Original preserved" : value === "conservative-preservation" ? "Text/vector preserved" : value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toFile(output: PdfOptimizationCandidateOutput): File {
  const copy = new Uint8Array(output.bytes.byteLength);
  copy.set(output.bytes);
  return new File([copy.buffer], output.filename, { type: "application/pdf" });
}

function progressPercent(progress: PdfOptimizationProgress | null): number | null {
  if (!progress || progress.total <= 0) return null;
  return Math.min(100, Math.round((progress.completed / progress.total) * 100));
}

export function PdfOptimizationPanel({ file, asset, onContinueResult }: PdfOptimizationPanelProps) {
  const [mode, setMode] = useState<PdfQualityMode>("balanced");
  const [metadataPolicy, setMetadataPolicy] = useState<PdfOptimizationMetadataPolicy>("preserve");
  const [goal, setGoal] = useState("");
  const [analysis, setAnalysis] = useState<PdfOptimizationAnalysis | null>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<PdfDocumentAnalysis | null>(null);
  const [intelligenceSnapshot, setIntelligenceSnapshot] = useState<DocumentIntelligenceSnapshot | null>(null);
  const [advancedPlan, setAdvancedPlan] = useState<PdfAdvancedOptimizationPlan | null>(null);
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [progress, setProgress] = useState<PdfOptimizationProgress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultUrlsRef = useRef<string[]>([]);
  const sourceKey = `${asset?.id ?? "none"}:${file?.name ?? "none"}:${file?.size ?? 0}`;

  useEffect(() => () => {
    abortRef.current?.abort();
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    setAnalysis(null);
    setDocumentAnalysis(null);
    setIntelligenceSnapshot(null);
    setAdvancedPlan(null);
    setResult(null);
    setProgress(null);
    setNotice(null);
  }, [sourceKey]);

  const selectedMode = qualityModes.find((item) => item.value === mode) ?? qualityModes[1];
  const targetHint = useMemo(() => parsePdfIntent(goal), [goal]);
  const percent = progressPercent(progress);

  function releaseResult() {
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrlsRef.current = [];
    setResult(null);
  }

  function updateProgress(next: PdfOptimizationProgress) {
    setProgress(next);
  }

  function cancel() {
    abortRef.current?.abort();
    setProgress({ stage: "cancelled", completed: 0, total: 0, detail: "Optimization cancelled. The original PDF remains unchanged." });
    setBusy(false);
  }

  async function validateCandidate(output: PdfOptimizationCandidateOutput, plan: PdfOptimizationPlan, currentAnalysis: PdfOptimizationAnalysis, sourceDocumentAnalysis: PdfDocumentAnalysis | null, signal: AbortSignal): Promise<{ candidate: PdfOptimizationCandidateResult; file: File; asset: PdfAsset; previewUrl: string }> {
    if (signal.aborted) throw new OptimizationCancelledError();
    const candidateFile = toFile(output);
    let previewUrl: string | undefined;
    try {
      const inspected = await inspectFile(candidateFile, () => undefined);
      if ("code" in inspected || inspected.category !== "pdf") throw new Error(`${output.filename}: PDF.js could not reopen this optimization candidate.`);
      previewUrl = inspected.previewUrl ?? undefined;
      const candidateDocumentAnalysis = sourceDocumentAnalysis ? await analyzePdfDocument(candidateFile, inspected, undefined, signal) : null;
      const representativePages = await validatePdfRepresentativeRenders(candidateFile, signal);
      const preservation: PdfPreservationValidation | null = sourceDocumentAnalysis && candidateDocumentAnalysis ? comparePdfDocumentFeatures(sourceDocumentAnalysis, candidateDocumentAnalysis) : null;
      const textPagesPreserved = !currentAnalysis.textPresent || inspected.textExtractable;
      const preservationWarnings = preservation ? [...preservation.warnings, ...preservation.criticalFailures] : [];
      const candidate: PdfOptimizationCandidateResult = {
        candidate: output.candidate,
        valid: inspected.pageCount === plan.pageCount && Boolean(previewUrl) && textPagesPreserved && output.bytes.byteLength > 0 && (preservation?.valid ?? true),
        outputBytes: output.outputBytes,
        pageCount: inspected.pageCount,
        textPagesPreserved,
        previewAvailable: Boolean(previewUrl),
        targetAchieved: plan.targetBytes === null ? false : output.outputBytes <= plan.targetBytes,
        warnings: [...output.warnings, ...(textPagesPreserved ? [] : ["Text was not detectable after this candidate and it was rejected."]), ...preservationWarnings, `Representative pages rendered: ${representativePages.join(", ")}.`],
        preservationStatus: preservation?.status ?? "preservation-safe",
        preservationWarnings,
        featureChanges: preservation?.changes.map((change) => ({ feature: change.feature, before: change.before, after: change.after, status: change.status })) ?? [],
      };
      if (!candidate.valid || !previewUrl) throw new Error(`${output.filename}: Candidate validation failed; the download is not offered.`);
      return { candidate, file: candidateFile, asset: inspected, previewUrl };
    } catch (error) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      throw error;
    }
  }

  async function runOptimization() {
    if (!file || !asset) {
      setNotice("Add a PDF before optimizing it.");
      return;
    }
    const parsed = parsePdfIntent(goal);
    const intent: PdfOptimizationIntent = parsed.status === "valid" && parsed.intent ? { ...parsed.intent } : { operation: "pdf.optimize.target_size", targetBytes: null, targetLabel: null, sourceType: "pdf" };
    if (parsed.status === "unsupported") {
      setNotice(parsed.message);
      return;
    }
    releaseResult();
    setNotice(null);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setProgress({ stage: "analyzing", completed: 0, total: 1, detail: "Analyzing PDF" });
      const currentAnalysis = await analyzePdfForOptimization(file, asset, updateProgress, controller.signal);
      setAnalysis(currentAnalysis);
      setProgress({ stage: "analyzing", completed: 0, total: 1, detail: "Inspecting document features and preservation signals" });
      const currentDocumentAnalysis = await analyzePdfDocument(file, asset, updateProgress, controller.signal);
      const currentSnapshot = createDocumentIntelligenceSnapshot(currentDocumentAnalysis);
      setDocumentAnalysis(currentDocumentAnalysis);
      setIntelligenceSnapshot(currentSnapshot);
      createPdfAdvancedAnalysisWorkflow(asset, currentDocumentAnalysis, currentSnapshot);
      setProgress({ stage: "planning", completed: 0, total: 1, detail: "Choosing a deterministic optimization plan" });
      const planResult = createPdfOptimizationPlan(currentAnalysis, { ...intent, mode }, metadataPolicy);
      if ("error" in planResult) throw new Error(planResult.error);
      const plan = planResult.plan;
      const advanced = buildAdvancedOptimizationPlan(currentDocumentAnalysis, { ...intent, mode }, plan);
      plan.documentAnalysis = currentDocumentAnalysis;
      plan.advancedPlan = advanced;
      if (advanced.blockedOperations.length > 0) {
        plan.candidates = plan.candidates.filter((candidate) => !candidate.destructive);
        if (plan.candidates.length === 0) plan.candidates = [{ id: "preserve-original", mode, strategy: "conservative-preservation", quality: null, resolutionScale: null, format: "preserve", description: "Preserve the original because a destructive path could not guarantee document-feature preservation.", qualityDecision: "preserved", destructive: false, scope: "all-pages" }];
      }
      setAdvancedPlan(advanced);
      createPdfOptimizationWorkflow(asset, { ...intent, mode }, plan, advanced);

      if (intent.targetBytes !== null && file.size <= intent.targetBytes) {
        const originalOutput: PdfOptimizationCandidateOutput = {
          candidate: { id: "preserve-original", mode, strategy: "original-preserved", quality: null, resolutionScale: null, format: "preserve", description: "Original already satisfies the requested target.", qualityDecision: "preserved", destructive: false, scope: "all-pages" },
          bytes: new Uint8Array(await file.arrayBuffer()),
          filename: safeCoreFilename(file.name, "optimized", "pdf"),
          inputBytes: file.size,
          outputBytes: file.size,
          expectedPageCount: asset.pageCount,
          warnings: ["Your PDF is already under the requested size; the original bytes were preserved."]
        };
        setProgress({ stage: "validating", completed: 0, total: 1, detail: "Validating preserved original" });
        const validated = await validateCandidate(originalOutput, plan, currentAnalysis, currentDocumentAnalysis, controller.signal);
        const optimized = buildPdfOptimizationResult({ inputBytes: file.size, targetBytes: intent.targetBytes, pageCount: asset.pageCount, candidate: validated.candidate, analysis: currentAnalysis, filename: originalOutput.filename, candidateCount: 1 });
        const downloadUrl = URL.createObjectURL(validated.file);
        resultUrlsRef.current.push(downloadUrl, validated.previewUrl);
        setResult({ result: optimized, file: validated.file, asset: validated.asset, previewUrl: validated.previewUrl, downloadUrl });
        setProgress({ stage: "complete", completed: 1, total: 1, detail: "Optimization complete" });
        return;
      }

      const outputs = await optimizePdfCandidates(file, plan, updateProgress, controller.signal);
      const validatedCandidates: Array<{ candidate: PdfOptimizationCandidateResult; file: File; asset: PdfAsset; previewUrl: string }> = [];
      const rejectedCandidateWarnings: string[] = [];
      setProgress({ stage: "validating", completed: 0, total: outputs.length, detail: "Validating optimization candidates" });
      for (let index = 0; index < outputs.length; index += 1) {
        if (controller.signal.aborted) throw new OptimizationCancelledError();
        try {
          const validated = await validateCandidate(outputs[index], plan, currentAnalysis, currentDocumentAnalysis, controller.signal);
          validatedCandidates.push(validated);
          setProgress({ stage: "validating", completed: index + 1, total: outputs.length, detail: `Validated candidate ${index + 1} of ${outputs.length}` });
        } catch (error) {
          if (controller.signal.aborted) throw new OptimizationCancelledError();
          rejectedCandidateWarnings.push(error instanceof Error ? error.message : `Candidate ${index + 1} was rejected during validation.`);
          setProgress({ stage: "validating", completed: index + 1, total: outputs.length, detail: `Rejected candidate ${index + 1}; checking the next safe path` });
        }
      }
      if (validatedCandidates.length === 0) {
        const fallbackCandidate = plan.candidates.find((candidate) => !candidate.destructive) ?? { id: "preserve-original", mode, strategy: "conservative-preservation" as const, quality: null, resolutionScale: null, format: "preserve" as const, description: "Preserve the original because generated candidates did not pass feature-preservation validation.", qualityDecision: "preserved" as const, destructive: false, scope: "all-pages" as const };
        const fallbackOutput: PdfOptimizationCandidateOutput = { candidate: fallbackCandidate, bytes: new Uint8Array(await file.arrayBuffer()), filename: safeCoreFilename(file.name, "optimized", "pdf"), inputBytes: file.size, outputBytes: file.size, expectedPageCount: asset.pageCount, warnings: ["All destructive candidates were rejected; the original PDF was retained."] };
        try {
          validatedCandidates.push(await validateCandidate(fallbackOutput, plan, currentAnalysis, currentDocumentAnalysis, controller.signal));
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "No independently validated optimization candidate was available.");
        }
      }
      const selected = selectBestPdfCandidate(validatedCandidates.map((entry) => entry.candidate), plan.targetBytes, file.size);
      if (!selected) throw new Error("No independently validated optimization candidate was available.");
      const selectedEntry = validatedCandidates.find((entry) => entry.candidate.candidate.id === selected.candidate.id);
      if (!selectedEntry) throw new Error("The validated optimization candidate could not be selected.");
      for (const entry of validatedCandidates) {
        if (entry !== selectedEntry) URL.revokeObjectURL(entry.previewUrl);
      }
      const optimized = buildPdfOptimizationResult({ inputBytes: file.size, targetBytes: plan.targetBytes, pageCount: plan.pageCount, candidate: selected, analysis: currentAnalysis, filename: selectedEntry.file.name, candidateCount: validatedCandidates.length, additionalWarnings: rejectedCandidateWarnings });
      const downloadUrl = URL.createObjectURL(selectedEntry.file);
      resultUrlsRef.current.push(downloadUrl, selectedEntry.previewUrl);
      setResult({ result: optimized, file: selectedEntry.file, asset: selectedEntry.asset, previewUrl: selectedEntry.previewUrl, downloadUrl });
      setProgress({ stage: "complete", completed: outputs.length, total: outputs.length, detail: optimized.targetAchieved === false ? "Target could not be reached; best validated result selected" : "Optimization complete" });
    } catch (error) {
      if (error instanceof OptimizationCancelledError || error instanceof DocumentAnalysisCancelledError || controller.signal.aborted) {
        setProgress({ stage: "cancelled", completed: 0, total: 0, detail: "Optimization cancelled. The original PDF remains unchanged." });
        setNotice("Optimization cancelled safely. No partial candidate was kept.");
      } else {
        setNotice(error instanceof Error ? error.message : "PDF optimization failed locally.");
        setProgress(null);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  if (!file || !asset) return <div className="core-panel optimization-panel"><p>Add a validated PDF to analyze its size, document type, and safe optimization opportunities.</p></div>;

  return <div className="core-panel optimization-panel">
    <div className="optimization-intro"><p>Analyze this PDF first, then choose a quality policy. SmartDocs measures bounded text, layout, image, font, and document-feature signals before selecting a preservation-first path. Text and vector PDFs are preserved by default; raster optimization is used only for scanned or image-heavy content.</p><span className="core-hint">No AI scores or OCR results are invented. Every candidate is measured and reopened with PDF.js.</span></div>
    <div className="optimization-controls">
      <label className="core-field">Goal <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. compress this PDF under 2MB" aria-label="PDF optimization goal" /></label>
      <div className="optimization-mode-group" role="group" aria-label="PDF quality mode"><span className="core-field-label">Quality policy</span>{qualityModes.map((item) => <label key={item.value} className={`quality-option ${mode === item.value ? "selected" : ""}`}><input type="radio" name="pdf-quality-mode" value={item.value} checked={mode === item.value} onChange={() => setMode(item.value)} /> <span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}</div>
      <label className="core-check"><input type="checkbox" checked={metadataPolicy === "preserve"} onChange={(event) => setMetadataPolicy(event.target.checked ? "preserve" : "remove-non-essential")} /> Preserve basic metadata when available</label>
      {goal.trim() ? <p className={`optimization-intent ${targetHint.status === "valid" ? "valid" : "ambiguous"}`}>{targetHint.message}</p> : null}
    </div>
    {analysis ? <AnalysisSummary analysis={analysis} documentAnalysis={documentAnalysis} snapshot={intelligenceSnapshot} plan={advancedPlan} /> : null}
    {progress && busy ? <div className="optimization-progress" role="status" aria-live="polite"><div className="processing-strip"><span className="spinner" /><div><strong>{progress.detail}</strong><span>{progress.total > 0 && percent !== null ? `${percent}% · ` : ""}Working locally in your browser.</span></div></div><button type="button" className="secondary-button" onClick={cancel}><X size={15} /> Cancel</button></div> : null}
    {progress?.stage === "cancelled" && !busy ? <div className="core-notice" role="status"><PauseCircle size={16} /> {progress.detail}</div> : null}
    {notice ? <div className="core-notice" role="alert"><X size={16} /> {notice}</div> : null}
    <div className="optimization-actions"><button type="button" className="primary-button" onClick={() => void runOptimization()} disabled={busy}><Play size={16} /> {busy ? "Optimizing locally…" : analysis ? "Optimize this PDF" : "Analyze and optimize PDF"}</button>{analysis && !busy ? <button type="button" className="secondary-button" onClick={() => { setAnalysis(null); setProgress(null); setNotice(null); }}><RotateCcw size={15} /> Re-analyze</button> : null}</div>
    {result ? <OptimizationResultCard display={result} originalAsset={asset} onContinue={onContinueResult ? () => onContinueResult(result.file, result.asset) : undefined} /> : null}
  </div>;
}

function AnalysisSummary({ analysis, documentAnalysis, snapshot, plan }: { analysis: PdfOptimizationAnalysis; documentAnalysis: PdfDocumentAnalysis | null; snapshot: DocumentIntelligenceSnapshot | null; plan: PdfAdvancedOptimizationPlan | null }) {
  const policy = qualityPolicy("balanced");
  if (!documentAnalysis) return <section className="optimization-analysis" aria-live="polite"><div className="optimization-analysis-heading"><ShieldCheck size={17} /><strong>PDF analysis complete</strong></div><dl className="optimization-analysis-grid"><div><dt>Size</dt><dd>{formatBytes(analysis.inputBytes)}</dd></div><div><dt>Pages</dt><dd>{analysis.pageCount}</dd></div><div><dt>Type</dt><dd>{analysis.classification}</dd></div><div><dt>Raster pages</dt><dd>{analysis.rasterPages}{analysis.sampledPages.length < analysis.pageCount ? ` / ${analysis.sampledPages.length} sampled` : ""}</dd></div><div><dt>Text pages</dt><dd>{analysis.textPages}</dd></div></dl><p className="optimization-opportunity">Likely optimization: <strong>{analysis.optimizationOpportunities.filter((item) => item !== "none").join(" + ") || "preserve the original"}</strong>. Balanced policy uses a deterministic quality floor of {Math.round(policy.quality * 100)}% encoder quality and {Math.round(policy.resolutionScale * 100)}% render scale for raster candidates.</p>{analysis.warnings.map((warning) => <small key={warning}>{warning}</small>)}</section>;
  const feature = documentAnalysis.features;
  const formatSignal = (value: string | number | null) => value === null ? "Unknown" : typeof value === "string" ? value.replaceAll("-", " ") : value;
  return <section className="optimization-analysis advanced-analysis" aria-live="polite"><div className="optimization-analysis-heading"><ShieldCheck size={17} /><strong>PDF analyzed</strong><span className={`risk-pill ${documentAnalysis.preservationRisk.status}`}>{documentAnalysis.preservationRisk.level} preservation risk</span></div><dl className="optimization-analysis-grid"><div><dt>Size</dt><dd>{formatBytes(analysis.inputBytes)}</dd></div><div><dt>Pages</dt><dd>{analysis.pageCount}</dd></div><div><dt>Type</dt><dd>{analysis.classification}</dd></div><div><dt>Raster pages</dt><dd>{analysis.rasterPages}{analysis.sampledPages.length < analysis.pageCount ? ` / ${analysis.sampledPages.length} sampled` : ""}</dd></div><div><dt>Text pages</dt><dd>{documentAnalysis.textPageCount}</dd></div><div><dt>OCR readiness</dt><dd>{documentAnalysis.ocrReadiness.replaceAll("-", " ")}</dd></div></dl><p className="optimization-recommendation"><strong>Recommendation:</strong> {documentAnalysis.recommendation}</p><div className="insight-list">{documentAnalysis.insights.map((insight) => <span key={insight}>{insight}</span>)}</div><details className="advanced-details"><summary>Advanced document signals</summary><dl className="signal-grid"><div><dt>Searchable text</dt><dd>{formatSignal(feature.text)}</dd></div><div><dt>Vector signals</dt><dd>{formatSignal(documentAnalysis.vectorSignals)}</dd></div><div><dt>Annotations</dt><dd>{formatSignal(feature.annotationCount)}</dd></div><div><dt>Links</dt><dd>{formatSignal(feature.linkCount)}</dd></div><div><dt>Forms</dt><dd>{formatSignal(feature.formFieldCount)}</dd></div><div><dt>Bookmarks</dt><dd>{formatSignal(feature.bookmarkCount)}</dd></div><div><dt>Embedded files</dt><dd>{formatSignal(feature.embeddedFileCount)}</dd></div><div><dt>JavaScript</dt><dd>{formatSignal(feature.javascript)}</dd></div><div><dt>Metadata fields</dt><dd>{documentAnalysis.metadata.presentFieldCount}</dd></div><div><dt>High-resolution pages</dt><dd>{documentAnalysis.images.highResolutionPageCount}</dd></div></dl><p className="advanced-note">These are bounded deterministic signals, not AI scores. Unmeasured feature properties remain unknown and are not modified.</p></details><details className="advanced-details"><summary>Likely page structure</summary><div className="structure-list">{documentAnalysis.structure.pageGroups.map((group) => <span key={`${group.startPage}-${group.endPage}-${group.role}`}>Pages {group.startPage}{group.startPage === group.endPage ? "" : `–${group.endPage}`}: likely {group.role}</span>)}</div></details>{plan ? <p className="advanced-note">Strategy: <strong>{plan.strategy.replaceAll("-", " ")}</strong>. {plan.blockedOperations.length ? `Blocked by preservation policy: ${plan.blockedOperations.join(", ")}.` : "No destructive operation was blocked in the bounded plan."} Snapshot pages: {snapshot?.pages.sampledPageCount ?? 0} sampled.</p> : null}{documentAnalysis.warnings.map((warning) => <small key={warning}>{warning}</small>)}</section>;
}

function OptimizationResultCard({ display, originalAsset, onContinue }: { display: DisplayResult; originalAsset: PdfAsset; onContinue?: () => void }) {
  const { result } = display;
  const targetText = result.targetBytes === null ? "No hard target" : `≤ ${formatBytes(result.targetBytes)}`;
  return <article className="optimization-result" aria-labelledby="optimization-result-title"><div className="optimization-result-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Verified optimization result</p><h4 id="optimization-result-title">{result.targetAchieved === true ? "Target achieved." : result.bestEffort ? "Best available result." : "PDF is ready."}</h4></div><span className={`result-status ${result.targetAchieved === false ? "warning" : "achieved"}`}>{result.targetAchieved === false ? "Best effort" : result.targetAchieved === true ? "Target achieved" : "Validated"}</span></div><div className="optimization-comparison"><div className="preview-frame"><div className="preview-label">Original <span>{formatBytes(result.inputBytes)}</span></div><img src={originalAsset.previewUrl ?? undefined} alt={`Original first-page preview of ${originalAsset.name}`} /></div><div className="preview-frame optimized"><div className="preview-label">Optimized <span>{formatBytes(result.outputBytes)}</span></div><img src={display.previewUrl} alt={`Optimized first-page preview of ${display.file.name}`} /></div></div><dl className="metrics-grid optimization-metrics"><div><dt>Original</dt><dd>{formatBytes(result.inputBytes)}</dd></div><div><dt>Result</dt><dd>{formatBytes(result.outputBytes)}</dd></div><div><dt>Reduction</dt><dd>{result.reductionPercentage.toFixed(1)}%</dd></div><div><dt>Pages</dt><dd>{result.pageCount}</dd></div><div><dt>Target</dt><dd>{targetText}</dd></div></dl><div className="optimization-result-details"><p>{result.message}</p><span>Strategy: <strong>{strategyLabel(result.strategy)}</strong></span><span>Quality policy: <strong>{qualityLabel(result.qualityDecision)}</strong></span><span>Validated candidate count: <strong>{result.candidateCount}</strong></span></div><div className="preservation-report"><span className={`risk-pill ${result.preservationStatus ?? "preservation-warning"}`}>{(result.preservationStatus ?? "preservation-warning").replaceAll("preservation-", "").replaceAll("-", " ")} preservation</span>{result.textStatus ? <span>Text: <strong>{result.textStatus}</strong></span> : null}{result.linkStatus ? <span>Links: <strong>{result.linkStatus}</strong></span> : null}{result.formStatus ? <span>Forms: <strong>{result.formStatus}</strong></span> : null}{result.bookmarkStatus ? <span>Bookmarks: <strong>{result.bookmarkStatus}</strong></span> : null}{result.metadataStatus ? <span>Metadata: <strong>{result.metadataStatus}</strong></span> : null}{result.pageCountBefore !== undefined && result.pageCountAfter !== undefined ? <span>Pages: <strong>{result.pageCountBefore} → {result.pageCountAfter}</strong></span> : null}{result.featureChanges?.filter((change) => change.status !== "preserved").slice(0, 5).map((change) => <span key={`${change.feature}-${change.before}-${change.after}`}>{change.feature}: <strong>{change.before} → {change.after}</strong></span>)}</div>{result.warnings.map((warning) => <small key={warning}>{warning}</small>)}<div className="core-result-actions"><a className="primary-button" href={display.downloadUrl} download={result.filename}><FileDown size={16} /> Download validated PDF</a>{onContinue ? <button type="button" className="secondary-button" onClick={onContinue}><Download size={15} /> Continue editing this PDF</button> : null}</div><p className="validation-line"><Check size={14} /> PDF.js validation successful · original remains recoverable · browser-local processing</p></article>;
}
