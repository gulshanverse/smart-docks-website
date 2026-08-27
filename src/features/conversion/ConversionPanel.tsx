import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Download, FileImage, FileOutput, FilePlus2, LockKeyhole, RotateCcw, Trash2, X } from "lucide-react";
import type { FileAsset, ImageAsset, PdfAsset } from "../../domain/files/types";
import type { ConversionBackground, ConversionFormat, ConversionIntent, ConversionOutput, ConversionPlan, ConversionQuality, ConversionResolution } from "../../domain/conversions/types";
import { CONVERSION_CONTRACT_VERSION, type ConversionResultSet, type ConversionSource } from "../../domain/conversions/types";
import { createConversionPlan } from "../../domain/conversions/planner";
import { parseByteTarget, parseConversionIntent } from "../../domain/intents/parse-intent";
import { inspectFile } from "../intake/inspect-file";
import { convertImageFile, imageConversionTargetState } from "./convert-image";
import { convertImagesToPdf, convertPdfToImages } from "./convert-pdf";
import { validatePdfOutput } from "../../domain/conversions/validation";
import { uniqueFilename } from "../../domain/conversions/naming";
import { createConversionWorkflow } from "../../domain/workflows/types";

interface ConversionPanelProps {
  currentFile: File | null;
  currentAsset: FileAsset | null;
  onContinueResult?: (file: File, asset: PdfAsset) => void;
  onClearParentNotice?: () => void;
}

interface ImageInput {
  file: File;
  asset: ImageAsset;
  source: ConversionSource;
}

interface PdfInput {
  file: File;
  asset: PdfAsset;
  source: ConversionSource;
}

interface ProgressState { phase: string; completed: number; total: number; }

const QUICK_GOALS = ["convert this PDF to JPG", "convert pages 2-5 to PNG", "make one PDF from these images", "convert this PNG to JPG under 200KB"];

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function sourceFromImage(file: File, asset: ImageAsset, order: number): ConversionSource {
  return { id: asset.id, name: file.name, inputFormat: "image", mimeType: asset.mimeType, sizeBytes: file.size, width: asset.width, height: asset.height, pageCount: null, order };
}

function sourceFromPdf(file: File, asset: PdfAsset): ConversionSource {
  return { id: asset.id, name: file.name, inputFormat: "pdf", mimeType: "application/pdf", sizeBytes: file.size, width: asset.pageDimensions?.widthPoints ?? null, height: asset.pageDimensions?.heightPoints ?? null, pageCount: asset.pageCount, order: 0 };
}

function parseTargetSize(value: string, scopeText: string): ConversionIntent["targetSize"] {
  const match = /^(?:under|below|less\s+than|to)?\s*(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib)$/i.exec(value.trim());
  if (!match) return null;
  const bytes = parseByteTarget(match[1], match[2]);
  if (!bytes) return null;
  return { bytes, label: `${match[1]} ${match[2].toUpperCase()}`, scope: /per\s+(?:page|file|image)|each/i.test(scopeText) ? "per-file" : "total" };
}

function defaultIntent(format: ConversionFormat, pdfPages: string, targetSizeText: string, targetScopeText: string, quality: ConversionQuality, resolution: ConversionResolution, pageSize: ConversionIntent["pageSize"], orientation: ConversionIntent["orientation"], fitMode: ConversionIntent["fitMode"], marginPoints: number | null, background: ConversionBackground): ConversionIntent {
  const pages = pdfPages.trim().toLowerCase() === "all" || pdfPages.trim() === "" ? { kind: "all" as const, value: null } : { kind: "range" as const, value: pdfPages.trim() };
  return { targetFormat: format, targetSize: parseTargetSize(targetSizeText, targetScopeText), pageSelection: pages, quality, resolution, pageSize, orientation, fitMode, marginPoints, background };
}

function outputWithUniqueNames(outputs: readonly ConversionOutput[]): ConversionOutput[] {
  const used = new Set<string>();
  return outputs.map((output) => {
    const filename = uniqueFilename(output.filename, used);
    used.add(filename);
    return filename === output.filename ? output : { ...output, filename };
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function ConversionPanel({ currentFile, currentAsset, onContinueResult, onClearParentNotice }: ConversionPanelProps) {
  const [pdfInput, setPdfInput] = useState<PdfInput | null>(currentFile && currentAsset?.category === "pdf" ? { file: currentFile, asset: currentAsset, source: sourceFromPdf(currentFile, currentAsset) } : null);
  const [imageInputs, setImageInputs] = useState<ImageInput[]>(currentFile && currentAsset?.category === "image" ? [{ file: currentFile, asset: currentAsset, source: sourceFromImage(currentFile, currentAsset, 0) }] : []);
  const [goal, setGoal] = useState("");
  const [format, setFormat] = useState<ConversionFormat>(currentAsset ? "jpeg" : "pdf");
  const [pdfPages, setPdfPages] = useState("all");
  const [quality, setQuality] = useState<ConversionQuality>("balanced");
  const [resolution, setResolution] = useState<ConversionResolution>("150dpi");
  const [pageSize, setPageSize] = useState<NonNullable<ConversionIntent["pageSize"]>>("A4");
  const [orientation, setOrientation] = useState<NonNullable<ConversionIntent["orientation"]>>("auto");
  const [fitMode, setFitMode] = useState<NonNullable<ConversionIntent["fitMode"]>>("contain");
  const [marginPoints, setMarginPoints] = useState("18");
  const [background, setBackground] = useState<ConversionBackground>("white");
  const [targetSizeText, setTargetSizeText] = useState("");
  const [targetScopeText, setTargetScopeText] = useState("");
  const [plan, setPlan] = useState<ConversionPlan | null>(null);
  const [result, setResult] = useState<ConversionResultSet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const resultUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!currentFile || !currentAsset) return;
    if (currentAsset.category === "pdf") {
      setPdfInput({ file: currentFile, asset: currentAsset, source: sourceFromPdf(currentFile, currentAsset) });
      setImageInputs([]);
      setFormat("jpeg");
      setPdfPages("all");
    } else if (currentAsset.category === "image") {
      setPdfInput(null);
      setImageInputs([{ file: currentFile, asset: currentAsset, source: sourceFromImage(currentFile, currentAsset, 0) }]);
      setFormat("pdf");
    } else {
      setPdfInput(null);
      setImageInputs([]);
    }
    setPlan(null);
    setResult(null);
  }, [currentFile, currentAsset]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    abortRef.current?.abort();
  }, []);

  const usingPdf = Boolean(pdfInput);
  const sourceFiles = useMemo(() => usingPdf && pdfInput ? [pdfInput.source] : imageInputs.map((item) => item.source), [usingPdf, pdfInput, imageInputs]);

  function clearResultUrls() {
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrlsRef.current = [];
  }

  function applyParsedGoal(parsedGoal: string) {
    onClearParentNotice?.();
    const parsed = parseConversionIntent(parsedGoal);
    setGoal(parsedGoal);
    if (parsed.status !== "valid" || !parsed.intent) {
      setNotice(parsed.message);
      setPlan(null);
      return;
    }
    const next = parsed.intent;
    if (next.targetFormat) setFormat(next.targetFormat);
    if (next.pageSelection.kind === "range" && next.pageSelection.value) setPdfPages(next.pageSelection.value);
    if (next.pageSelection.kind === "all") setPdfPages("all");
    if (next.quality) setQuality(next.quality);
    if (next.resolution) setResolution(next.resolution);
    if (next.pageSize) setPageSize(next.pageSize);
    if (next.orientation) setOrientation(next.orientation);
    if (next.fitMode) setFitMode(next.fitMode);
    if (next.marginPoints !== null) setMarginPoints(String(next.marginPoints));
    if (next.background) setBackground(next.background);
    if (next.targetSize) { setTargetSizeText(next.targetSize.label); setTargetScopeText(next.targetSize.scope === "per-file" ? "per page/file" : "total"); }
    setNotice(null);
    setPlan(null);
  }

  async function handlePdfFile(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    const inspected = await inspectFile(file, () => undefined);
    if ("code" in inspected || inspected.category !== "pdf") { setNotice("Choose a valid, supported PDF. The source remains unchanged."); return; }
    setPdfInput({ file, asset: inspected, source: sourceFromPdf(file, inspected) });
    setImageInputs([]);
    setFormat("jpeg");
    setPlan(null);
    setResult(null);
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files) return;
    setNotice(null);
    setProgress({ phase: "Inspecting images", completed: 0, total: files.length });
    const inspected: ImageInput[] = [];
    try {
      for (const file of [...files]) {
        const asset = await inspectFile(file, () => undefined);
        if ("code" in asset || asset.category !== "image") throw new Error(`${file.name}: choose a supported JPEG, PNG, or WebP image.`);
        previewUrlsRef.current.push(asset.previewUrl);
        inspected.push({ file, asset, source: sourceFromImage(file, asset, inspected.length) });
        setProgress({ phase: "Inspecting images", completed: inspected.length, total: files.length });
      }
      setPdfInput(null);
      setImageInputs(inspected);
      setFormat("pdf");
      setPlan(null);
      setResult(null);
    } catch (error) {
      inspected.forEach((item) => URL.revokeObjectURL(item.asset.previewUrl));
      setNotice(error instanceof Error ? error.message : "One or more images could not be inspected.");
    } finally {
      setProgress(null);
    }
  }

  function moveImage(index: number, delta: -1 | 1) {
    setImageInputs((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, itemIndex) => ({ ...item, source: { ...item.source, order: itemIndex } }));
    });
    setPlan(null);
  }

  function removeImage(index: number) {
    const item = imageInputs[index];
    if (item) URL.revokeObjectURL(item.asset.previewUrl);
    setImageInputs((current) => current.filter((_, itemIndex) => itemIndex !== index).map((itemValue, itemIndex) => ({ ...itemValue, source: { ...itemValue.source, order: itemIndex } })));
    setPlan(null);
  }

  function makeIntent(): ConversionIntent {
    const margin = marginPoints.trim() === "" ? null : Number(marginPoints);
    return defaultIntent(format, pdfPages, targetSizeText, targetScopeText, quality, resolution, pageSize, orientation, fitMode, Number.isFinite(margin) ? margin : null, background);
  }

  function buildPlan() {
    onClearParentNotice?.();
    setNotice(null);
    const intent = makeIntent();
    const planResult = createConversionPlan(sourceFiles, intent, { metadataPolicy: "discard" });
    if ("error" in planResult) { setPlan(null); setNotice(planResult.error.message); return; }
    setPlan(planResult.plan);
    createConversionWorkflow(planResult.plan);
    setResult(null);
  }

  async function runConversion() {
    onClearParentNotice?.();
    if (!plan) { buildPlan(); return; }
    clearResultUrls();
    setNotice(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ phase: "Converting locally", completed: 0, total: plan.validationPolicy.expectedOutputCount });
    try {
      let outputs: ConversionOutput[] = [];
      let continuation: { file: File; asset: PdfAsset } | null = null;
      if (plan.operation === "pdf-to-image" && pdfInput) {
        outputs = await convertPdfToImages(pdfInput.file, plan, { signal: controller.signal, onProgress: (completed, total) => setProgress({ phase: "Rendering PDF pages", completed, total }) });
      } else if (plan.operation === "image-to-image") {
        for (let index = 0; index < imageInputs.length; index += 1) {
          outputs.push(await convertImageFile(imageInputs[index].file, plan, { signal: controller.signal, outputIndex: index, onProgress: (completed, total) => setProgress({ phase: "Encoding images", completed, total }) }));
        }
        outputs = outputWithUniqueNames(outputs);
      } else if (plan.operation === "image-to-pdf") {
        const authored = await convertImagesToPdf(imageInputs.map((item) => item.file), plan, { signal: controller.signal, onProgress: (completed, total) => setProgress({ phase: "Authoring PDF pages", completed, total }) });
        const file = new File([asArrayBuffer(authored.bytes)], authored.filename, { type: "application/pdf" });
        const inspected = await inspectFile(file, () => undefined);
        if ("code" in inspected || inspected.category !== "pdf") throw new Error("The generated PDF could not be reopened by PDF.js.");
        const validation = validatePdfOutput({ bytes: authored.bytes, actualPageCount: inspected.pageCount, expectedPageCount: authored.pageCount, previewAvailable: Boolean(inspected.previewUrl), expectedDimensions: { width: authored.width, height: authored.height }, actualDimensions: inspected.pageDimensions ? { width: inspected.pageDimensions.widthPoints, height: inspected.pageDimensions.heightPoints } : null, plan });
        if (!validation.valid) throw new Error(`${authored.filename}: ${validation.message}`);
        outputs = [{ outputId: `${plan.planId}-pdf`, filename: authored.filename, mimeType: "application/pdf", bytes: authored.bytes.byteLength, width: authored.width, height: authored.height, pageCount: authored.pageCount, blob: new Blob([asArrayBuffer(authored.bytes)], { type: "application/pdf" }), validation, warnings: authored.warnings }];
        continuation = { file, asset: inspected };
        if (inspected.previewUrl) previewUrlsRef.current.push(inspected.previewUrl);
      }
      if (outputs.length === 0) throw new Error("No validated conversion outputs were created.");
      const inputBytes = plan.sourceFiles.reduce((sum, source) => sum + source.sizeBytes, 0);
      const outputBytes = outputs.reduce((sum, output) => sum + output.bytes, 0);
      const targetAchieved = plan.operation === "image-to-image" ? imageConversionTargetState(outputs, plan) : plan.targetSize ? (plan.targetSize.scope === "per-file" ? outputs.every((output) => output.bytes <= plan.targetSize!.bytes) : outputBytes <= plan.targetSize.bytes) : null;
      const warnings = [...plan.warnings, ...(outputBytes > inputBytes ? ["Converted successfully, but the output is larger than the input."] : []), ...outputs.flatMap((output) => output.warnings)];
      const resultSet: ConversionResultSet = { contractVersion: CONVERSION_CONTRACT_VERSION, sourceFiles: plan.sourceFiles, inputFormat: plan.inputFormat, outputFormat: plan.outputFormat, inputBytes, outputBytes, outputs, pageCount: plan.operation === "image-to-pdf" ? outputs[0].pageCount : null, quality: plan.quality, resolution: plan.resolution, targetSize: plan.targetSize, targetAchieved, conversionApplied: true, compressionApplied: Boolean(plan.targetSize), resizeApplied: false, processingBoundary: "browser-local", strategy: plan.strategy, warnings: [...new Set(warnings)], message: targetAchieved === false ? "Conversion completed with a bounded best-effort target result." : "Conversion completed and every output passed validation." };
      resultUrlsRef.current = outputs.map((output) => URL.createObjectURL(output.blob));
      setResult(resultSet);
      setHistory((current) => [...current.slice(-4), `${plan.sourceFiles.map((source) => source.name).join(", ")} → ${outputs.map((output) => output.filename).join(", ")}`]);
      if (continuation && onContinueResult) (resultSet as ConversionResultSet & { continuation?: typeof continuation }).continuation = continuation;
    } catch (error) {
      if (isAbortError(error)) setNotice("Conversion cancelled. Partial candidates were discarded and the source was preserved.");
      else setNotice(error instanceof Error ? error.message : "Conversion failed locally. The source was preserved.");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  function continuePdfResult() {
    if (!result || result.outputFormat !== "pdf" || !onContinueResult) return;
    const output = result.outputs[0];
    const file = new File([output.blob], output.filename, { type: "application/pdf" });
    void inspectFile(file, () => undefined).then((inspected) => {
      if (!("code" in inspected) && inspected.category === "pdf") onContinueResult(file, inspected);
    });
  }

  const planSummary = plan ? `${plan.operation} · ${plan.outputFormat.toUpperCase()} · ${plan.validationPolicy.expectedOutputCount} output${plan.validationPolicy.expectedOutputCount === 1 ? "" : "s"}` : null;
  const showImageSettings = !usingPdf && imageInputs.length > 0 && format === "pdf";
  const showImageOutputSettings = !usingPdf && imageInputs.length > 0 && format !== "pdf";
  const sourceLabel = usingPdf && pdfInput ? `${pdfInput.asset.name} · ${pdfInput.asset.pageCount} pages` : imageInputs.length > 0 ? `${imageInputs.length} ordered image${imageInputs.length === 1 ? "" : "s"}` : "No source selected";

  return <section className="conversion-panel" aria-labelledby="conversion-panel-title">
    <div className="conversion-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Phase 8 · Local conversion</p><h3 id="conversion-panel-title">Convert without learning the tool name.</h3><p>Choose a source, set a visible target, review the plan, and create validated files in this browser. No upload, cloud converter, or hidden codec dependency is used.</p></div><span className="local-badge"><LockKeyhole size={13} /> Browser-local</span></div>
    <div className="conversion-goal-row"><label className="core-field conversion-goal-field">What do you want to convert?<input value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyParsedGoal(goal); }} placeholder="e.g. convert pages 2-5 to PNG under 500KB per page" /></label><button type="button" className="secondary-button" onClick={() => applyParsedGoal(goal)} disabled={!goal.trim()}>Understand request locally</button></div>
    <div className="conversion-quick-goals" aria-label="Conversion examples">{QUICK_GOALS.map((example) => <button key={example} type="button" onClick={() => applyParsedGoal(example)}>{example}</button>)}</div>

    <div className="conversion-source-grid">
      <div className="conversion-source-card"><div className="card-label"><span className="label-icon"><FileOutput size={15} /></span> 01 · Source</div><strong>{sourceLabel}</strong><p>{usingPdf ? "PDF page appearance can be rasterized into selected image pages." : imageInputs.length > 0 ? "The order below becomes the order in the generated PDF." : "Choose one PDF or an ordered collection of images."}</p>{usingPdf && pdfInput ? <button type="button" className="text-button" onClick={() => { setPdfInput(null); setPlan(null); setResult(null); }}>Use images instead</button> : null}<label className="core-file-button"><FilePlus2 size={15} /> Choose PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => void handlePdfFile(event.target.files?.[0])} /></label><label className="core-file-button"><FileImage size={15} /> Choose images<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={(event) => void handleImageFiles(event.target.files)} /></label></div>
      {imageInputs.length > 0 && !usingPdf ? <div className="conversion-collection-card"><div className="card-label"><span className="label-icon violet"><FileImage size={15} /></span> Ordered pages</div><ol className="conversion-collection-list">{imageInputs.map((item, index) => <li key={`${item.source.id}-${index}`}><img src={item.asset.previewUrl} alt={`Preview of ${item.file.name}`} /><span><strong>Page {index + 1} · {item.file.name}</strong><small>{item.asset.width} × {item.asset.height} · {formatBytes(item.file.size)}</small></span><button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={`Move ${item.file.name} earlier`}><ArrowUp size={14} /></button><button type="button" onClick={() => moveImage(index, 1)} disabled={index === imageInputs.length - 1} aria-label={`Move ${item.file.name} later`}><ArrowDown size={14} /></button><button type="button" onClick={() => removeImage(index)} aria-label={`Remove ${item.file.name}`}><Trash2 size={14} /></button></li>)}</ol></div> : null}
    </div>

    <div className="conversion-settings-grid">
      <label className="core-field">Output format<select value={format} onChange={(event) => { setFormat(event.target.value as ConversionFormat); setPlan(null); }}>{usingPdf ? null : <option value="pdf">PDF</option>}<option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option></select></label>
      {usingPdf ? <label className="core-field">PDF pages<select value={pdfPages} onChange={(event) => { setPdfPages(event.target.value); setPlan(null); }}><option value="all">All pages</option><option value="1">Page 1</option><option value="range">Custom range below</option></select></label> : null}
      {usingPdf ? <label className="core-field">Page selection<input value={pdfPages === "all" ? "all" : pdfPages === "range" ? "" : pdfPages} onChange={(event) => { setPdfPages(event.target.value || "all"); setPlan(null); }} placeholder="all or 2-5, 8" aria-label="PDF page range" /></label> : null}
      <label className="core-field">Quality<select value={quality} onChange={(event) => { setQuality(event.target.value as ConversionQuality); setPlan(null); }}><option value="maximum">Maximum quality</option><option value="high">High</option><option value="balanced">Balanced</option><option value="small">Smaller file</option><option value="smallest-practical">Smallest practical</option></select></label>
      {usingPdf ? <label className="core-field">Resolution<select value={resolution} onChange={(event) => { setResolution(event.target.value as ConversionResolution); setPlan(null); }}><option value="screen">Screen</option><option value="150dpi">150 DPI</option><option value="200dpi">200 DPI</option><option value="300dpi">300 DPI</option></select></label> : null}
      <label className="core-field">Target size <input value={targetSizeText} onChange={(event) => { setTargetSizeText(event.target.value); setPlan(null); }} placeholder="optional: 500 KB" /></label>
      <label className="core-field">Target scope <input value={targetScopeText} onChange={(event) => { setTargetScopeText(event.target.value); setPlan(null); }} placeholder="e.g. per page" /></label>
    </div>

    {showImageSettings ? <details className="conversion-advanced" open><summary>PDF page settings</summary><div className="conversion-settings-grid"><label className="core-field">Page size<select value={pageSize} onChange={(event) => { setPageSize(event.target.value as NonNullable<ConversionIntent["pageSize"]>); setPlan(null); }}><option value="A4">A4</option><option value="A5">A5</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="original">Original image size</option></select></label><label className="core-field">Orientation<select value={orientation} onChange={(event) => { setOrientation(event.target.value as NonNullable<ConversionIntent["orientation"]>); setPlan(null); }}><option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label className="core-field">Fit<select value={fitMode} onChange={(event) => { setFitMode(event.target.value as NonNullable<ConversionIntent["fitMode"]>); setPlan(null); }}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fit-width">Fit width</option><option value="fit-height">Fit height</option></select></label><label className="core-field">Margin (points)<input value={marginPoints} onChange={(event) => { setMarginPoints(event.target.value); setPlan(null); }} inputMode="decimal" /></label><label className="core-field">Background<select value={background} onChange={(event) => { setBackground(event.target.value as ConversionBackground); setPlan(null); }}><option value="white">White</option><option value="black">Black</option><option value="transparent">Transparent</option></select></label></div><p className="core-hint">Images become image-only PDF pages. Searchability is not added automatically; use the existing OCR tab as an explicit next step.</p></details> : null}
    {showImageOutputSettings ? <p className="conversion-warning" role="note">Image-to-image conversion uses canvas. Image metadata may be removed, and JPEG output flattens transparency onto the selected background.</p> : null}

    {notice ? <div className="conversion-notice" role="alert"><X size={16} /><span>{notice}</span></div> : null}
    {progress ? <div className="conversion-progress" role="status" aria-live="polite"><span className="spinner" /><strong>{progress.phase}…</strong><span>{progress.completed} of {progress.total}</span><button type="button" className="text-button" onClick={() => abortRef.current?.abort()}>Cancel</button></div> : null}
    {plan ? <div className="conversion-plan-card"><div><p className="eyebrow">02 · Review plan</p><h4>{planSummary}</h4><p>{plan.warnings[0]}</p></div><ul>{plan.warnings.slice(1).map((warning) => <li key={warning}>{warning}</li>)}</ul><div className="conversion-plan-metrics"><span>Input <strong>{formatBytes(plan.sourceFiles.reduce((sum, source) => sum + source.sizeBytes, 0))}</strong></span><span>Expected outputs <strong>{plan.validationPolicy.expectedOutputCount}</strong></span><span>Boundary <strong>browser-local</strong></span></div></div> : null}
    <div className="conversion-actions"><button type="button" className="secondary-button" onClick={buildPlan} disabled={Boolean(progress) || sourceFiles.length === 0}><Check size={15} /> {plan ? "Rebuild plan" : "Review conversion plan"}</button><button type="button" className="primary-button" onClick={() => void runConversion()} disabled={Boolean(progress) || !plan}><FileOutput size={16} /> {progress ? "Converting locally…" : "Convert and validate"}</button></div>

    {result ? <section className="conversion-result" aria-labelledby="conversion-result-title"><div className="conversion-result-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> 03 · Verified result</p><h4 id="conversion-result-title">{result.outputs.length} validated output{result.outputs.length === 1 ? "" : "s"}</h4></div><span className={`result-status ${result.targetAchieved === false ? "warning" : "achieved"}`}><Check size={15} /> {result.targetAchieved === false ? "Best effort" : "Validated"}</span></div><p>{result.message}</p><div className="conversion-result-list">{result.outputs.map((output, index) => <article key={output.outputId} className="conversion-output-card">{output.mimeType.startsWith("image/") ? <img src={resultUrlsRef.current[index]} alt={`Preview of ${output.filename}`} /> : <div className="conversion-pdf-badge"><FileOutput size={18} /><span>PDF</span></div>}<div><strong>{output.filename}</strong><span>{formatBytes(output.bytes)}{output.width && output.height ? ` · ${output.width} × ${output.height}` : ""}{output.pageCount ? ` · ${output.pageCount} pages` : ""}</span><small>{output.validation.message}</small></div><a className="secondary-button" href={resultUrlsRef.current[index]} download={output.filename}><Download size={14} /> Download</a></article>)}</div>{result.warnings.length > 0 ? <ul className="conversion-warning-list">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}{result.outputFormat === "pdf" && onContinueResult ? <button type="button" className="secondary-button" onClick={continuePdfResult}><RotateCcw size={14} /> Continue with this PDF in SmartDocs</button> : null}<div className="conversion-history"><strong>Ephemeral conversion chain</strong>{history.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div></section> : null}
  </section>;
}
