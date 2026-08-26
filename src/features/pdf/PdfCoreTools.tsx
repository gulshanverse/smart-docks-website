import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Download, FileImage, FilePlus2, Layers3, ScanText, Trash2, X } from "lucide-react";
const PdfOptimizationPanel = lazy(() => import("./PdfOptimizationPanel").then((module) => ({ default: module.PdfOptimizationPanel })));
const PdfOcrPanel = lazy(() => import("../ocr/PdfOcrPanel").then((module) => ({ default: module.PdfOcrPanel })));
import type { PdfAsset } from "../../domain/files/types";
import { createBlankDetectionPlan, createBlankRemovalPlan, createImageToPdfPlan, createMergePlan, createPdfImagePlan, createSplitPlan, type BlankPageSignals, type PdfImageFormat, type PdfImageResolution, type PdfMetadataSnapshot } from "../../domain/pdfs/core";
import { validateCorePdfOutput, type CorePdfValidation } from "../../domain/pdfs/core-validation";
import { createDeletePlan } from "../../domain/pdfs/operations";
import { inspectFile } from "../intake/inspect-file";
import { createPdfCoreWorkflow } from "../../domain/workflows/types";
import { mutatePdf } from "./mutate-pdf";
import type { PdfImageOutput } from "./render-pdf-images";
import type { CorePdfOutput } from "./core-operations";

interface PdfCoreToolsProps { currentFile: File | null; currentAsset: PdfAsset | null; onContinueResult?: (file: File, asset: PdfAsset) => void; }
interface ValidatedPdfResult { output: CorePdfOutput; file: File; asset: PdfAsset; validation: CorePdfValidation; downloadUrl: string; }
interface MergeInput { file: File; asset: PdfAsset; }

export function PdfCoreTools({ currentFile, currentAsset, onContinueResult }: PdfCoreToolsProps) {
  const [active, setActive] = useState<"merge" | "split" | "images" | "create" | "blank" | "optimization" | "ocr">(currentAsset ? "optimization" : "merge");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mergeInputs, setMergeInputs] = useState<MergeInput[]>([]);
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [splitRanges, setSplitRanges] = useState("1-3, 4-7, 8-12");
  const [imagePageRanges, setImagePageRanges] = useState("1");
  const [imageFormat, setImageFormat] = useState<PdfImageFormat>("jpg");
  const [imageResolution, setImageResolution] = useState<PdfImageResolution>("standard");
  const [imageOutputs, setImageOutputs] = useState<PdfImageOutput[]>([]);
  const [imageInputs, setImageInputs] = useState<File[]>([]);
  const [blankSignals, setBlankSignals] = useState<BlankPageSignals[]>([]);
  const [blankCoverage, setBlankCoverage] = useState<"complete" | "sampled" | null>(null);
  const [blankSelection, setBlankSelection] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<ValidatedPdfResult[]>([]);
  const resultUrls = useRef<string[]>([]);
  const imageUrls = useRef<string[]>([]);
  const previousAssetRef = useRef<PdfAsset | null>(currentAsset);

  useEffect(() => () => { resultUrls.current.forEach((url) => URL.revokeObjectURL(url)); imageUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (currentAsset && previousAssetRef.current !== currentAsset) setActive("optimization");
    previousAssetRef.current = currentAsset;
  }, [currentAsset]);

  function resetNotice() { setNotice(null); }
  function releaseResults() { resultUrls.current.forEach((url) => URL.revokeObjectURL(url)); resultUrls.current = []; setResults([]); }
  function releaseImages() { imageUrls.current.forEach((url) => URL.revokeObjectURL(url)); imageUrls.current = []; setImageOutputs([]); }
  function toArrayBuffer(bytes: Uint8Array): ArrayBuffer { const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return copy.buffer; }
  function makeFile(output: CorePdfOutput): File { return new File([toArrayBuffer(output.bytes)], output.filename, { type: "application/pdf" }); }

  async function validateOutput(output: CorePdfOutput): Promise<ValidatedPdfResult> {
    const file = makeFile(output);
    const inspected = await inspectFile(file, () => undefined);
    if ("code" in inspected || inspected.category !== "pdf") throw new Error(`${output.filename}: PDF.js could not reopen the generated output.`);
    const validation = validateCorePdfOutput({ operation: output.operation, expectedPageCount: output.expectedPageCount, actualPageCount: inspected.pageCount, previewAvailable: Boolean(inspected.previewUrl), inputBytes: output.inputBytes, outputBytes: output.outputBytes, processingBoundary: inspected.processingBoundary, warnings: output.warnings });
    if (!validation.valid) { if (inspected.previewUrl) URL.revokeObjectURL(inspected.previewUrl); throw new Error(`${output.filename}: ${validation.message}`); }
    const downloadUrl = URL.createObjectURL(new Blob([toArrayBuffer(output.bytes)], { type: "application/pdf" }));
    resultUrls.current.push(downloadUrl);
    if (inspected.previewUrl) resultUrls.current.push(inspected.previewUrl);
    return { output, file, asset: inspected, validation, downloadUrl };
  }

  async function handleMergeFiles(files: FileList | null) {
    if (!files) return;
    resetNotice(); setMergeInputs([]); setBusy(true);
    const next: MergeInput[] = [];
    try {
      for (const file of [...files]) {
        const inspected = await inspectFile(file, () => undefined);
        if ("code" in inspected || inspected.category !== "pdf") throw new Error(`${file.name}: ${"code" in inspected ? inspected.message : "Choose a PDF file."}`);
        next.push({ file, asset: inspected });
      }
      if (next.length < 2) throw new Error("Select at least two valid PDFs to merge.");
      setMergeInputs(next);
    } catch (error) { setNotice(error instanceof Error ? error.message : "One or more PDFs could not be inspected."); }
    finally { setBusy(false); }
  }

  function moveMerge(index: number, direction: -1 | 1) { setMergeInputs((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }

  async function runMerge() {
    resetNotice(); setBusy(true); releaseResults();
    try {
      const planResult = createMergePlan(mergeInputs.map((item) => item.file.name), mergeInputs.map((item) => item.asset.pageCount), preserveMetadata);
      if ("error" in planResult) throw new Error(planResult.error);
      createPdfCoreWorkflow("merge", planResult.plan);
      const { mergePdfs, readPdfMetadata } = await import("./core-operations");
      const metadata: PdfMetadataSnapshot | undefined = preserveMetadata ? await readPdfMetadata(mergeInputs[0].file) : undefined;
      const output = await mergePdfs(mergeInputs.map((item) => item.file), mergeInputs.map((item) => item.asset), planResult.plan, metadata);
      setResults([await validateOutput(output)]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Merge failed locally."); }
    finally { setBusy(false); }
  }

  async function runSplit() {
    if (!currentFile || !currentAsset) return setNotice("Add a PDF before splitting it.");
    resetNotice(); setBusy(true); releaseResults();
    try {
      const planResult = createSplitPlan(splitRanges, currentAsset.pageCount);
      if ("error" in planResult) throw new Error(planResult.error);
      createPdfCoreWorkflow("split", planResult.plan);
      const { splitPdf } = await import("./core-operations");
      const outputs = await splitPdf(currentFile, currentAsset, planResult.plan);
      const validated: ValidatedPdfResult[] = [];
      for (const output of outputs) validated.push(await validateOutput(output));
      setResults(validated);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Split failed locally."); }
    finally { setBusy(false); }
  }

  async function runPdfToImage() {
    if (!currentFile || !currentAsset) return setNotice("Add a PDF before converting pages to images.");
    resetNotice(); setBusy(true); releaseImages();
    try {
      const parsed = createSplitPlan(imagePageRanges, currentAsset.pageCount);
      if ("error" in parsed) throw new Error(parsed.error);
      const pages = parsed.plan.ranges.flatMap((range) => Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index));
      const plan = createPdfImagePlan(pages, currentAsset.pageCount, imageFormat, imageResolution);
      if ("error" in plan) throw new Error(plan.error);
      createPdfCoreWorkflow("render_images", plan.plan);
      const { renderPdfImages } = await import("./render-pdf-images");
      const outputs = await renderPdfImages(currentFile, plan.plan);
      imageUrls.current = outputs.map((output) => URL.createObjectURL(output.blob));
      setImageOutputs(outputs);
    } catch (error) { setNotice(error instanceof Error ? error.message : "PDF-to-image conversion failed locally."); }
    finally { setBusy(false); }
  }

  async function handleImages(files: FileList | null) {
    if (!files) return;
    resetNotice(); setBusy(true);
    try {
      const valid: File[] = [];
      for (const file of [...files]) {
        const inspected = await inspectFile(file, () => undefined);
        if ("code" in inspected || inspected.category !== "image") throw new Error(`${file.name}: ${"code" in inspected ? inspected.message : "Choose a supported image."}`);
        valid.push(file);
      }
      setImageInputs(valid);
    } catch (error) { setNotice(error instanceof Error ? error.message : "One or more images could not be inspected."); }
    finally { setBusy(false); }
  }

  async function runImagesToPdf() {
    resetNotice(); setBusy(true); releaseResults();
    try {
      const planResult = createImageToPdfPlan(imageInputs.map((file) => file.name), false);
      if ("error" in planResult) throw new Error(planResult.error);
      createPdfCoreWorkflow("create_pdf", planResult.plan);
      const { imagesToPdf } = await import("./core-operations");
      const output = await imagesToPdf(imageInputs, planResult.plan);
      setResults([await validateOutput(output)]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Image-to-PDF creation failed locally."); }
    finally { setBusy(false); }
  }

  async function runBlankDetection() {
    if (!currentFile || !currentAsset) return setNotice("Add a PDF before checking blank pages.");
    resetNotice(); setBusy(true); setBlankSignals([]); setBlankCoverage(null); setBlankSelection(new Set());
    try {
      const detectionPlan = createBlankDetectionPlan(currentAsset.pageCount);
      if ("error" in detectionPlan) throw new Error(detectionPlan.error);
      createPdfCoreWorkflow("detect_blank_pages", detectionPlan.plan);
      const { detectBlankPages } = await import("./render-pdf-images");
      const detected = await detectBlankPages(currentFile, detectionPlan.plan.pageNumbers);
      setBlankCoverage(detectionPlan.plan.coverage);
      setBlankSignals(detected);
      setBlankSelection(new Set(detected.filter((page) => page.classification === "likely-blank").map((page) => page.pageNumber)));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Blank-page detection could not complete locally."); }
    finally { setBusy(false); }
  }

  async function removeBlankPages() {
    if (!currentFile || !currentAsset || blankSelection.size === 0) return setNotice("Review and select at least one page before removing blank pages.");
    resetNotice(); setBusy(true); releaseResults();
    try {
      const removalPlan = createBlankRemovalPlan(currentAsset.pageCount, [...blankSelection]);
      if ("error" in removalPlan) throw new Error(removalPlan.error);
      createPdfCoreWorkflow("remove_blank_pages", removalPlan.plan);
      const mutationPlan = createDeletePlan(currentAsset.pageCount, removalPlan.plan.confirmedPageNumbers);
      if ("error" in mutationPlan) throw new Error(mutationPlan.error.message);
      const mutation = await mutatePdf(currentFile, currentAsset, mutationPlan.plan);
      const output: CorePdfOutput = { bytes: mutation.bytes, filename: mutation.filename.replace("deleted-pages", "without-blank-pages"), inputBytes: mutation.inputBytes, outputBytes: mutation.outputBytes, expectedPageCount: removalPlan.plan.expectedOutputPageCount, operation: "remove_blank_pages", warnings: ["Blank-page removal used a bounded heuristic and required explicit review."] };
      setResults([await validateOutput(output)]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Blank-page removal failed locally."); }
    finally { setBusy(false); }
  }

  return <section className="pdf-core-tools" aria-labelledby="pdf-core-title">
    <div className="pdf-core-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> PDF core + optimization</p><h3 id="pdf-core-title">Do more with your document.</h3><p>Optimize, merge, split, convert, and clean PDFs locally. Every generated PDF is reopened with PDF.js before download.</p></div><span className="local-badge"><Check size={13} /> Browser-local</span></div>
    <div className="pdf-core-tabs" role="tablist" aria-label="PDF core operations">
      <CoreTab id="optimization" active={active === "optimization"} onClick={() => { setActive("optimization"); resetNotice(); }}>Optimize PDF</CoreTab>
      <CoreTab id="ocr" active={active === "ocr"} onClick={() => { setActive("ocr"); resetNotice(); }} disabled={!currentAsset}>OCR + search</CoreTab>
      <CoreTab id="merge" active={active === "merge"} onClick={() => { setActive("merge"); resetNotice(); }}>Merge PDFs</CoreTab>
      <CoreTab id="split" active={active === "split"} onClick={() => { setActive("split"); resetNotice(); }} disabled={!currentAsset}>Split PDF</CoreTab>
      <CoreTab id="images" active={active === "images"} onClick={() => { setActive("images"); resetNotice(); }} disabled={!currentAsset}>PDF → images</CoreTab>
      <CoreTab id="create" active={active === "create"} onClick={() => { setActive("create"); resetNotice(); }}>Images → PDF</CoreTab>
      <CoreTab id="blank" active={active === "blank"} onClick={() => { setActive("blank"); resetNotice(); }} disabled={!currentAsset}>Blank pages</CoreTab>
    </div>
    {notice ? <div className="core-notice" role="alert"><X size={16} /><span>{notice}</span></div> : null}
    {active === "optimization" ? <Suspense fallback={<div className="core-panel"><span className="spinner" /> Loading PDF optimization tools…</div>}><PdfOptimizationPanel file={currentFile} asset={currentAsset} onContinueResult={onContinueResult} /></Suspense> : null}
    {active === "ocr" ? <Suspense fallback={<div className="core-panel"><span className="spinner" /> Loading local OCR tools…</div>}><PdfOcrPanel file={currentFile} asset={currentAsset} onContinueResult={onContinueResult} /></Suspense> : null}
    {active === "merge" ? <MergePanel inputs={mergeInputs} busy={busy} preserveMetadata={preserveMetadata} onPreserve={setPreserveMetadata} onFiles={handleMergeFiles} onMove={moveMerge} onRemove={(index) => setMergeInputs((current) => current.filter((_, itemIndex) => itemIndex !== index))} onRun={() => void runMerge()} /> : null}
    {active === "split" && currentAsset ? <SplitPanel currentAsset={currentAsset} ranges={splitRanges} setRanges={setSplitRanges} busy={busy} onRun={() => void runSplit()} /> : null}
    {active === "images" && currentAsset ? <PdfToImagePanel ranges={imagePageRanges} setRanges={setImagePageRanges} format={imageFormat} setFormat={setImageFormat} resolution={imageResolution} setResolution={setImageResolution} busy={busy} onRun={() => void runPdfToImage()} outputs={imageOutputs} urls={imageUrls.current} /> : null}
    {active === "create" ? <ImagesToPdfPanel inputs={imageInputs} busy={busy} onFiles={handleImages} onRun={() => void runImagesToPdf()} /> : null}
    {active === "blank" && currentAsset ? <BlankPanel signals={blankSignals} coverage={blankCoverage} selected={blankSelection} setSelected={setBlankSelection} busy={busy} onDetect={() => void runBlankDetection()} onRemove={() => void removeBlankPages()} /> : null}
    {results.length > 0 ? <div className="core-results" aria-live="polite">{results.map((result) => <CoreResult key={result.file.name} result={result} onContinue={onContinueResult ? () => onContinueResult(result.file, result.asset) : undefined} />)}</div> : null}
  </section>;
}

function CoreTab({ id, active, onClick, disabled, children }: { id: string; active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) { return <button id={`tab-${id}`} className={`core-tab ${active ? "active" : ""}`} type="button" role="tab" aria-selected={active} onClick={onClick} disabled={disabled}>{children}</button>; }
function MergePanel({ inputs, busy, preserveMetadata, onPreserve, onFiles, onMove, onRemove, onRun }: { inputs: MergeInput[]; busy: boolean; preserveMetadata: boolean; onPreserve: (value: boolean) => void; onFiles: (files: FileList | null) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (index: number) => void; onRun: () => void }) { return <div className="core-panel"><p>Select two or more PDFs. Their order here becomes the order in the merged document.</p><label className="core-file-button"><FilePlus2 size={15} /> Choose PDFs<input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => onFiles(event.target.files)} /></label>{inputs.length > 0 ? <ol className="merge-list">{inputs.map((item, index) => <li key={`${item.file.name}-${index}`}><span><strong>{index + 1}. {item.file.name}</strong><small>{item.asset.pageCount} pages · {formatBytes(item.file.size)}</small></span><div><button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${item.file.name} up`}><ChevronUp size={15} /></button><button type="button" onClick={() => onMove(index, 1)} disabled={index === inputs.length - 1} aria-label={`Move ${item.file.name} down`}><ChevronDown size={15} /></button><button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${item.file.name}`}><Trash2 size={15} /></button></div></li>)}</ol> : <p className="core-empty">No PDFs selected yet.</p>}<label className="core-check"><input type="checkbox" checked={preserveMetadata} onChange={(event) => onPreserve(event.target.checked)} /> Preserve basic metadata when available</label><button type="button" className="primary-button" onClick={onRun} disabled={busy || inputs.length < 2}><Layers3 size={16} /> {busy ? "Merging locally…" : "Merge PDFs"}</button></div>; }
function SplitPanel({ currentAsset, ranges, setRanges, busy, onRun }: { currentAsset: PdfAsset; ranges: string; setRanges: (value: string) => void; busy: boolean; onRun: () => void }) { return <div className="core-panel"><p>Enter non-overlapping or overlapping ranges exactly. Values are validated before mutation; page numbers are never silently clamped.</p><label className="core-field">Page ranges<input value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder={`1-3, 4-7, 8-${currentAsset.pageCount}`} aria-label="PDF page ranges" /></label><small className="core-hint">Example: 1-3, 4-7, 8-{currentAsset.pageCount}</small><button type="button" className="primary-button" onClick={onRun} disabled={busy}>{busy ? "Splitting locally…" : "Split PDF"}</button></div>; }
function PdfToImagePanel({ ranges, setRanges, format, setFormat, resolution, setResolution, busy, onRun, outputs, urls }: { ranges: string; setRanges: (value: string) => void; format: PdfImageFormat; setFormat: (value: PdfImageFormat) => void; resolution: PdfImageResolution; setResolution: (value: PdfImageResolution) => void; busy: boolean; onRun: () => void; outputs: PdfImageOutput[]; urls: string[] }) { return <div className="core-panel"><p>Render actual PDF pages sequentially. For multiple pages, each image is offered individually rather than inventing a ZIP.</p><label className="core-field">Pages<input value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="1 or 1-3" aria-label="Pages to convert to images" /></label><div className="core-inline-fields"><label className="core-field">Format<select value={format} onChange={(event) => setFormat(event.target.value as PdfImageFormat)}><option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP where supported</option></select></label><label className="core-field">Resolution<select value={resolution} onChange={(event) => setResolution(event.target.value as PdfImageResolution)}><option value="standard">Standard</option><option value="high">High</option></select></label></div><button type="button" className="primary-button" onClick={onRun} disabled={busy}>{busy ? "Rendering locally…" : "Convert pages to images"}</button>{outputs.length > 0 ? <div className="image-output-list">{outputs.map((output, index) => <a key={output.filename} className="secondary-button" href={urls[index]} download={output.filename}><Download size={14} /> Page {output.pageNumber} · {output.filename}</a>)}</div> : null}</div>; }
function ImagesToPdfPanel({ inputs, busy, onFiles, onRun }: { inputs: File[]; busy: boolean; onFiles: (files: FileList | null) => void; onRun: () => void }) { return <div className="core-panel"><p>Create an A4 PDF from supported JPEG or PNG images. Images are centered and fit without stretching; originals remain untouched.</p><small className="core-hint">WebP-to-PDF is not offered because this authoring path cannot safely embed WebP.</small><label className="core-file-button"><FileImage size={15} /> Choose images<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple onChange={(event) => onFiles(event.target.files)} /></label>{inputs.length > 0 ? <div className="selected-file-list">{inputs.map((file) => <span key={file.name}>{file.name} · {formatBytes(file.size)}</span>)}</div> : <p className="core-empty">No images selected yet.</p>}<button type="button" className="primary-button" onClick={onRun} disabled={busy || inputs.length === 0}>{busy ? "Creating locally…" : "Create PDF from images"}</button></div>; }
function BlankPanel({ signals, coverage, selected, setSelected, busy, onDetect, onRemove }: { signals: BlankPageSignals[]; coverage: "complete" | "sampled" | null; selected: Set<number>; setSelected: (value: Set<number>) => void; busy: boolean; onDetect: () => void; onRemove: () => void }) { const likely = useMemo(() => signals.filter((page) => page.classification === "likely-blank" || page.classification === "possibly-blank"), [signals]); return <div className="core-panel"><p>Blank-page detection is a bounded visual heuristic, not semantic AI. Review every candidate, especially in scanned PDFs.</p><button type="button" className="secondary-button" onClick={onDetect} disabled={busy}><ScanText size={15} /> {busy ? "Checking locally…" : "Review blank-page candidates"}</button>{signals.length > 0 ? <><p className="blank-summary">{likely.length} pages look likely or possibly blank. {coverage === "sampled" ? "This large PDF was sampled at a maximum of 50 pages; review additional pages manually before removal." : "All pages were reviewed within the bounded limit."}</p>
<div className="blank-list">{signals.map((page) => <label key={page.pageNumber} className={`blank-row ${page.classification}`}><input type="checkbox" checked={selected.has(page.pageNumber)} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(page.pageNumber); else next.delete(page.pageNumber); setSelected(next); }} /><span>Page {page.pageNumber}</span><small>{page.classification.replace("-", " ")} · {page.textCharacterCount} text chars</small></label>)}</div><button type="button" className="primary-button destructive-core" onClick={onRemove} disabled={busy || selected.size === 0}><Trash2 size={15} /> Remove reviewed pages</button></> : null}</div>; }
function CoreResult({ result, onContinue }: { result: ValidatedPdfResult; onContinue?: () => void }) { return <article className="core-result"><div className="core-result-preview">{result.asset.previewUrl ? <img src={result.asset.previewUrl} alt={`First-page preview of ${result.file.name}`} /> : null}</div><div><p className="eyebrow"><span className="eyebrow-line" /> Validated result</p><h4>{result.file.name}</h4><p>{result.validation.actualPageCount} pages · {formatBytes(result.output.outputBytes)}</p><span className="local-badge"><Check size={13} /> {result.validation.message}</span>{result.validation.warnings.map((warning) => <small key={warning}>{warning}</small>)}<div className="core-result-actions"><a className="primary-button" href={result.downloadUrl} download={result.file.name}><Download size={16} /> Download PDF</a>{onContinue ? <button type="button" className="secondary-button" onClick={onContinue}>Continue editing this PDF</button> : null}</div></div></article>; }
function formatBytes(bytes: number): string { if (bytes < 1000) return `${bytes} B`; if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`; return `${(bytes / 1_000_000).toFixed(2)} MB`; }
