import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileImage,
  HardDrive,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import type { FileAsset, FileIntakeError, PdfAsset } from "./domain/files/types";
import type { OfficeAsset } from "./domain/office/types";
import type { PdfInspectionValidation } from "./domain/pdfs/types";
import { formatBytes } from "./lib/file-utils";
import { parseImageIntent, parsePdfIntent, type ParsedIntent } from "./domain/intents/parse-intent";
import { createImageCompressionWorkflow, createPdfInspectionWorkflow } from "./domain/workflows/types";
import { validatePdfInspection } from "./domain/pdfs/validation";
import { compressImage, type CompressionOutcome, type CompressionStage } from "./features/compression/compress-image";
import { inspectFile } from "./features/intake/inspect-file";
import { PDFJS_VERSION } from "./features/pdf/config";
import { PdfPageWorkspace } from "./features/pdf/PdfPageWorkspace";
import { PdfCoreTools } from "./features/pdf/PdfCoreTools";
import { OfficeWorkspace } from "./features/office/OfficeWorkspace";
import { UnifiedWorkspace } from "./features/unified/UnifiedWorkspace";
import { planUnifiedWorkflow } from "./domain/unified/planner";
import type { UnifiedWorkflowPlan, UnifiedWorkflowState } from "./domain/unified/types";
import { CollectionWorkspace } from "./features/collections/CollectionWorkspace";
import { WorkflowWorkspace } from "./features/workflows/WorkflowWorkspace";
import { runBoundedScheduler, type WorkflowPlan } from "./domain/workflows/orchestration";
import { ExtractionWorkspace } from "./features/extraction/ExtractionWorkspace";
import { AutomationWorkspace } from "./features/automation/AutomationWorkspace";
import "./styles/tokens.css";
import "./styles/app.css";

interface Notice {
  title: string;
  message: string;
  recovery: string;
}

type PdfInspectionStage = "validating" | "inspecting" | "rendering";
type WorkflowStage = CompressionStage | PdfInspectionStage;

const stageLabels: Record<WorkflowStage, string> = {
  preparing: "Preparing image",
  analyzing: "Analyzing image",
  optimizing: "Optimizing",
  checking: "Checking result",
  validating: "Validating PDF",
  inspecting: "Inspecting PDF",
  rendering: "Rendering preview",
};

const examples = ["make this image under 100KB", "compress to 500KB", "make it less than 1 MB"];

function intakeErrorToNotice(error: FileIntakeError): Notice {
  return { title: error.title, message: error.message, recovery: error.recovery };
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const assetUrlRef = useRef<string | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  const currentFileRef = useRef<File | null>(null);
  const originalPdfRef = useRef<{ file: File; asset: PdfAsset } | null>(null);
  const [originalPdf, setOriginalPdf] = useState<{ file: File; asset: PdfAsset } | null>(null);
  const resultUrlsRef = useRef<string[]>([]);
  const [asset, setAsset] = useState<FileAsset | null>(null);
  const [pdfValidation, setPdfValidation] = useState<PdfInspectionValidation | null>(null);
  const [goal, setGoal] = useState("");
  const [intent, setIntent] = useState<ParsedIntent | null>(null);
  const [outcome, setOutcome] = useState<CompressionOutcome | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [stage, setStage] = useState<WorkflowStage | null>(null);
  const [keepOriginalDimensions, setKeepOriginalDimensions] = useState(false);
  const [pdfNavigationRequest, setPdfNavigationRequest] = useState<{ pageNumber: number; token: number } | null>(null);
  const [unifiedPlan, setUnifiedPlan] = useState<UnifiedWorkflowPlan | null>(null);
  const [unifiedState, setUnifiedState] = useState<UnifiedWorkflowState>("idle");
  const pdfNavigationTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (assetUrlRef.current) URL.revokeObjectURL(assetUrlRef.current);
      resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function releaseResultUrls() {
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrlsRef.current = [];
  }

  function releaseUrls() {
    if (assetUrlRef.current) URL.revokeObjectURL(assetUrlRef.current);
    releaseResultUrls();
    assetUrlRef.current = null;
  }

  async function handleFile(file: File | undefined, options: { preserveOriginal?: boolean } = {}) {
    if (!file) return;
    releaseUrls();
    if (!options.preserveOriginal) { originalPdfRef.current = null; setOriginalPdf(null); }
    pdfFileRef.current = null;
    currentFileRef.current = null;
    setAsset(null);
    setPdfValidation(null);
    setOutcome(null);
    setIntent(null);
    setKeepOriginalDimensions(false);
    setNotice(null);
    setUnifiedPlan(null);
    setUnifiedState("intake");
    setReadingFile(true);
    try {
      const result = await inspectFile(file, setStage);
      if ("code" in result) {
        setNotice(intakeErrorToNotice(result));
        return;
      }
      assetUrlRef.current = result.previewUrl;
      setUnifiedState("inspecting");
      currentFileRef.current = file;
      pdfFileRef.current = result.category === "pdf" ? file : null;

      if (result.category === "pdf") {
        const workflow = createPdfInspectionWorkflow(result);
        setPdfValidation(validatePdfInspection(workflow.input));
      }
      setAsset(result);
      setUnifiedState("idle");
    } catch {
      setNotice({
        title: "We could not inspect that file.",
        message: "The browser stopped while reading the file.",
        recovery: "Try another supported image or PDF file.",
      });
    } finally {
      setReadingFile(false);
      setStage(null);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleFile(event.dataTransfer.files[0]);
  }

  function handleGoalChange(value: string) {
    setGoal(value);
    setIntent(null);
    setUnifiedPlan(null);
    setUnifiedState("idle");
    if (notice?.title === "We need a clearer goal.") setNotice(null);
  }

  async function runWorkflow(options: { allowResize?: boolean } = {}): Promise<boolean> {
    if (!asset) {
      setNotice({
        title: "Add a file first.",
        message: "There is no file ready for this workflow.",
        recovery: "Choose a supported image or PDF above.",
      });
      return false;
    }
    if (asset.category === "pdf") {
      const parsed = parsePdfIntent(goal);
      setNotice({
        title: parsed.status === "valid" ? "PDF target understood." : "PDF optimization is ready.",
        message: parsed.message,
        recovery: "Use Optimize PDF below to analyze the document, choose a quality policy, and validate a browser-local result.",
      });
      return true;
    }
    if (asset.category === "office") {
      setNotice({ title: "Office inspection is ready.", message: "Use the Office workspace below for bounded structure and text extraction. Office-to-PDF conversion is currently unavailable locally.", recovery: "Download the bounded TXT extraction or continue with a supported image/PDF conversion workflow." });
      return true;
    }
    const parsed = parseImageIntent(goal);
    setIntent(parsed);
    if (parsed.status !== "valid" || !parsed.intent) {
      setNotice({
        title: parsed.status === "unsupported" ? "That goal is not available yet." : "We need a clearer goal.",
        message: parsed.message,
        recovery: "Use an exact target such as “make this image under 100KB.”",
      });
      return false;
    }

    setNotice(null);
    releaseResultUrls();
    setOutcome(null);
    setStage("preparing");
    try {
      const workflow = createImageCompressionWorkflow(asset, parsed.intent);
      const result = await compressImage(asset, workflow.intent, setStage, { allowResize: options.allowResize ?? !keepOriginalDimensions });
      resultUrlsRef.current = [result.previewUrl, result.downloadUrl];
      setOutcome(result);
      return true;
    } catch (error) {
      setNotice({
        title: "The image could not be processed locally.",
        message: error instanceof Error ? error.message : "The browser stopped during image processing.",
        recovery: "Try a smaller image or another supported format.",
      });
      return false;
    } finally {
      setStage(null);
    }
  }

  async function executeOrchestratedWorkflow(plan: WorkflowPlan): Promise<void> {
    const result = await runBoundedScheduler(plan.steps, async (step) => {
      if (step.capability === "image.compress.target_size") {
        const succeeded = await runWorkflow();
        if (!succeeded) throw new Error("The image compression executor could not produce a validated result.");
        return;
      }
      if (step.capability === "validation" || step.type === "inspect") return;
      throw new Error(`The ${step.capability} executor is not available in this browser workflow yet.`);
    }, { failurePolicy: plan.failurePolicy });
    if (result.failed.length > 0 || result.blocked.length > 0) throw new Error("One or more workflow steps could not be executed. Original files remain unchanged.");
  }

  function reviewUnifiedPlan() {
    if (!asset) return;
    setUnifiedState("planning");
    const nextPlan = planUnifiedWorkflow(asset, goal);
    setUnifiedPlan(nextPlan);
    setUnifiedState("review");
  }

  async function confirmUnifiedPlan() {
    if (!unifiedPlan) return;
    setUnifiedState("running");
    const success = await runWorkflow();
    setUnifiedState(success ? "completed" : "recoverable-error");
  }

  function cancelUnifiedPlan() {
    setUnifiedPlan(null);
    setUnifiedState("cancelled");
  }

  function reprocessWithResize(allowResize: boolean) {
    setKeepOriginalDimensions(!allowResize);
    void runWorkflow({ allowResize });
  }

  function continueWithPdfResult(file: File, resultAsset: PdfAsset) {
    if (pdfFileRef.current && asset?.category === "pdf" && !originalPdfRef.current) {
      const snapshot = { file: pdfFileRef.current, asset };
      originalPdfRef.current = snapshot;
      setOriginalPdf(snapshot);
    }
    void handleFile(file, { preserveOriginal: true });
  }

  function returnToOriginalPdf() {
    const snapshot = originalPdfRef.current;
    if (!snapshot) return;
    originalPdfRef.current = null;
    setOriginalPdf(null);
    void handleFile(snapshot.file);
  }

  function navigateToPdfPage(pageNumber: number) {
    pdfNavigationTokenRef.current += 1;
    setPdfNavigationRequest({ pageNumber, token: pdfNavigationTokenRef.current });
  }

  function reset() {
    releaseUrls();
    originalPdfRef.current = null;
    setOriginalPdf(null);
    pdfFileRef.current = null;
    currentFileRef.current = null;
    setAsset(null);
    setPdfValidation(null);
    setGoal("");
    setIntent(null);
    setOutcome(null);
    setNotice(null);
    setUnifiedPlan(null);
    setUnifiedState("idle");
    setStage(null);
    setKeepOriginalDimensions(false);
    setPdfNavigationRequest(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const isBusy = readingFile || Boolean(stage);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label="SmartDocs home">
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
            <span className="brand-name">SmartDocs</span>
          </a>
          <nav className="site-nav" aria-label="Primary navigation">
            <a className="nav-link active" href="#workspace">Workspace</a>
            <a className="nav-link" href="#how-it-works">How it works</a>
            <a className="nav-link" href="#roadmap">Roadmap</a>
          </nav>
          <div className="privacy-chip"><LockKeyhole size={14} /> Processed locally</div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="container hero-grid">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> Verified document intelligence</p>
              <h1>One file.<br /><span>One clear goal.</span></h1>
              <p className="hero-lede">SmartDocs turns a human request into a verified result. Start with an image, PDF, or supported Office collection, describe one explicit goal, and use measured browser-local tools. Source files stay local; only an explicit, bounded AI context can cross the optional gateway.</p>
              <div className="hero-proof"><span><Check size={14} /> Source bytes stay local</span><span><Check size={14} /> Bounded inspection</span><span><Check size={14} /> Evidence-linked answers</span></div>
            </div>
            <div className="hero-side-note"><span>01</span><p>Give the work a goal, not a tool name.</p><ArrowRight size={22} /></div>
          </div>
        </section>

        <section id="workspace" className="workspace-section" aria-labelledby="workspace-title">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">The workspace</p>
                <h2 id="workspace-title">What do you want to do<br /><span>with your file?</span></h2>
              </div>
              <p className="section-intro">Describe one exact goal for a file or a controlled collection. SmartDocs parses intent locally, evaluates compatible capabilities, and offers measured PDF/image tools, safe document actions, bounded Office inspection, and evidence-linked intelligence without silently uploading originals.</p>
            </div>

            <div className="workflow-layout">
              <div className="workflow-card intake-card">
                <div className="card-label"><span className="label-icon"><Upload size={15} /></span> 01 · Add a file</div>
                <input ref={inputRef} className="file-picker-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.docx,.docm,.doc,.pptx,.pptm,.ppt,.xlsx,.xlsm,.xls" aria-label="Choose a JPEG, PNG, WebP image, or PDF" onChange={(event) => void handleFile(event.target.files?.[0])} />
                {!asset ? (
                  <div className="dropzone" role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} data-testid="dropzone">
                    <span className="dropzone-icon"><FileImage size={25} /></span>
                    <strong>{readingFile ? "Inspecting file…" : "Drop an image, PDF, or Office file here"}</strong>
                    <span>or choose JPEG, PNG, WebP, PDF, DOCX, PPTX, or XLSX</span>
                    <small>Images: 25 MB · PDFs/Office: 50 MB</small>
                  </div>
                ) : (
                  asset.category === "image" ? <div className="asset-preview" data-testid="asset-preview">
                    <img src={asset.previewUrl} alt={`Preview of ${asset.name}`} />
                    <div className="asset-info">
                      <div><strong>{asset.name}</strong><button className="icon-button" type="button" onClick={reset} aria-label="Remove image"><X size={16} /></button></div>
                      <span>{formatBytes(asset.sizeBytes)} · {asset.width} × {asset.height} · {asset.mimeType.replace("image/", "").toUpperCase()}</span>
                      <span className="local-badge"><LockKeyhole size={13} /> Stays in your browser</span>
                    </div>
                  </div> : asset.category === "office" ? <OfficeAssetCard asset={asset} onReset={reset} /> : pdfFileRef.current ? <PdfAssetCard asset={asset} file={pdfFileRef.current} validation={pdfValidation} onReset={reset} /> : null
                )}
              </div>

              <div className="workflow-card goal-card legacy-goal-card">
                <div className="card-label"><span className="label-icon violet"><WandSparkles size={15} /></span> 02 · Describe the goal</div>
                <label htmlFor="goal-input" className="goal-label">What should happen to this file?</label>
                <textarea id="goal-input" value={goal} onChange={(event) => handleGoalChange(event.target.value)} placeholder={asset?.category === "pdf" ? "e.g. compress this PDF under 2MB" : asset?.category === "office" ? "e.g. extract all text from this Word file" : "e.g. make this image under 100KB"} rows={3} data-testid="goal-input" />
                {asset?.category === "pdf" ? <div className="pdf-goal-note" role="status"><strong>PDF page operations are available.</strong><span>Use an exact target such as “compress this PDF under 2MB,” or choose a quality mode in Optimize PDF below. Text/vector content is preserved by default.</span></div> : asset?.category === "office" ? <div className="pdf-goal-note office-goal-note" role="status"><strong>Office intelligence is ready.</strong><span>SmartDocs can inspect bounded structure and extract text locally. Office-to-PDF conversion is explicitly unavailable until a faithful browser renderer is independently verified.</span></div> : <>
                  <div className="example-row" aria-label="Goal examples">
                    {examples.map((example) => <button key={example} type="button" onClick={() => handleGoalChange(example)}>{example}</button>)}
                  </div>
                  {intent?.status === "valid" && intent.intent ? <div className="intent-confirmation"><Check size={15} /> Target understood: ≤ {intent.intent.targetLabel}</div> : null}
                  <button className="primary-button" type="button" onClick={() => void runWorkflow()} disabled={isBusy} data-testid="run-workflow">{stage ? <><span className="spinner" /> {stageLabels[stage]}…</> : <><Sparkles size={17} /> Optimize locally <ArrowRight size={17} /></>}</button>
                </>}
                <p className="microcopy"><LockKeyhole size={13} /> {asset?.category === "pdf" ? "PDF inspection is processed locally in your browser." : asset?.category === "office" ? "Office package inspection is processed locally in your browser." : "Your image never leaves this browser."}</p>
              </div>
            </div>

            <WorkflowWorkspace asset={asset} documents={[]} onGoalChange={handleGoalChange} onExecute={executeOrchestratedWorkflow} />
            <ExtractionWorkspace asset={asset} onNavigateToPage={navigateToPdfPage} />
            <AutomationWorkspace asset={asset} onExecute={executeOrchestratedWorkflow} />
            {asset ? <UnifiedWorkspace asset={asset} goal={goal} state={unifiedState} plan={unifiedPlan} busy={isBusy} onGoalChange={handleGoalChange} onReview={reviewUnifiedPlan} onConfirm={() => void confirmUnifiedPlan()} onCancel={cancelUnifiedPlan} onResetPlan={() => { setUnifiedPlan(null); setUnifiedState("idle"); }} /> : null}
            <CollectionWorkspace onContinuePdf={continueWithPdfResult} />
            {asset?.category === "pdf" && pdfFileRef.current ? <PdfPageWorkspace file={pdfFileRef.current} asset={asset} requestedPageNumber={pdfNavigationRequest?.pageNumber} navigationRequestToken={pdfNavigationRequest?.token} /> : null}
            {asset?.category === "office" ? <OfficeWorkspace asset={asset} /> : null}
            <PdfCoreTools currentFile={pdfFileRef.current} currentAsset={asset?.category === "pdf" ? asset : null} currentInputFile={currentFileRef.current} currentInputAsset={asset} onContinueResult={continueWithPdfResult} onNavigateToPage={navigateToPdfPage} />
            {originalPdf ? <div className="pdf-recovery-bar" role="status"><span><strong>Original PDF remains recoverable.</strong> Continue editing the current result or return to the untouched source.</span><button type="button" className="secondary-button" onClick={returnToOriginalPdf}><RotateCcw size={15} /> Return to original PDF</button></div> : null}

            {notice ? <div className="notice" role="alert"><div className="notice-icon"><X size={17} /></div><div><strong>{notice.title}</strong><p>{notice.message}</p><span>{notice.recovery}</span></div></div> : null}
            {stage ? <div className="processing-strip" role="status" aria-live="polite"><span className="spinner" /><div><strong>{stageLabels[stage]}</strong><span>Working locally in your browser. No progress percentage is invented.</span></div><ChevronDown size={18} /></div> : null}

            {outcome && asset?.category === "image" ? <ResultPanel asset={asset} outcome={outcome} onReset={reset} onReprocess={reprocessWithResize} keepOriginalDimensions={keepOriginalDimensions} /> : null}
          </div>
        </section>

        <section id="how-it-works" className="how-section" aria-labelledby="how-title">
          <div className="container">
            <div className="section-heading compact"><div><p className="eyebrow">How it works</p><h2 id="how-title">Simple on the outside.<br /><span>Measured underneath.</span></h2></div></div>
            <div className="steps-grid">
              <article><span>01</span><h3>Understand the request</h3><p>The deterministic parser handles common PDF target-size phrases and converts KB/MB into exact decimal bytes.</p></article>
              <article><span>02</span><h3>Try the lightest path</h3><p>The browser analyzes bounded document signals, preserves text/vector documents, and tests bounded image-quality candidates only where the preservation policy permits.</p></article>
              <article><span>03</span><h3>Check before delivery</h3><p>The output is decoded again, its bytes and dimensions are verified, and only then is a download offered.</p></article>
            </div>
          </div>
        </section>

        <section id="roadmap" className="roadmap-section" aria-labelledby="roadmap-title">
          <div className="container roadmap-grid"><div><p className="eyebrow">A measured roadmap</p><h2 id="roadmap-title">Build the foundation<br /><span>before the universe.</span></h2></div>      <div className="roadmap-list"><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Smart image optimizer</strong><p>Compression, resize recovery, and verified local results.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>PDF core platform</strong><p>Local page operations, merge, split, conversion, blank-page review, and validated results.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Smart PDF optimization</strong><p>Target-size compression for scanned/image-heavy PDFs with quality modes, validation, progress, and recovery.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Browser-local OCR + document understanding</strong><p>Bundled English OCR, searchable-PDF authoring, local text search, deterministic structure signals, and preservation validation.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Evidence-backed AI document intelligence</strong><p>Bounded local context, deterministic retrieval, classification, summaries, extraction, Q&amp;A, structure views, explicit consent, and validated source-page navigation.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Safe document actions</strong><p>Reviewed action plans, local text-match redaction, annotations, crop and resize, metadata controls, validation, cancellation, recovery, and bounded undo/redo.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Universal conversion engine</strong><p>Intent-first PDF/image conversion, ordered collections, page selection, quality and resolution controls, validated outputs, target-size measurement, previews, progress, cancellation, and chaining.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Office document intelligence</strong><p>Browser-local DOCX/PPTX/XLSX intake, bounded OOXML inspection, Word structure, slide summaries, sheet/cell previews, TXT export, warnings, and honest conversion boundaries.</p></div><span className="roadmap-state">Done</span></div><div className="roadmap-item current"><span className="roadmap-marker" /><div><strong>Controlled document collections</strong><p>Multi-file intake, explicit order and selection, compatibility-aware plans, validated PDF merge, ordered image-to-PDF, bounded cross-document search, individual outputs, and memory-only session history.</p></div><span className="roadmap-state">Now</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Beyond the Phase 11 boundary</strong><p>Unbounded batch queues, full collection optimization/OCR/AI execution, faithful Office rendering and round-trips, Office-to-PDF conversion, ZIP packaging, cloud conversion, autonomous actions, sharing, and account features remain intentionally out of scope.</p></div><span className="roadmap-state">Planned</span></div></div></div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-inner"><a className="brand footer-brand" href="#top" aria-label="Back to SmartDocs home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span className="brand-name">SmartDocs</span></a><p>One file + one goal → one verified result.</p><span className="footer-phase">Phase 11 · Controlled collections</span></div></footer>
    </div>
  );
}

function OfficeAssetCard({ asset, onReset }: { asset: OfficeAsset; onReset: () => void }) {
  const typeLabel = asset.documentType === "word" ? "Word document" : asset.documentType === "presentation" ? "PowerPoint presentation" : asset.documentType === "spreadsheet" ? "Excel workbook" : "Office document";
  return <div className="pdf-asset-card office-asset-card"><div className="pdf-preview-frame office-file-mark"><strong>.{asset.format.toUpperCase()}</strong><span>Office</span></div><div className="pdf-asset-info"><div><strong>{asset.name}</strong><button className="icon-button" type="button" onClick={onReset} aria-label="Remove Office file"><X size={16} /></button></div><span>{formatBytes(asset.sizeBytes)} · {typeLabel}</span><span>{asset.analysis.complexity} complexity · {asset.analysis.preservationRisk} preservation risk</span><span className="local-badge"><LockKeyhole size={13} /> Stays in your browser</span></div></div>;
}

function PdfAssetCard({ asset, file, validation, onReset }: { asset: PdfAsset; file: File; validation: PdfInspectionValidation | null; onReset: () => void }) {
  return <div className="pdf-asset-card" data-testid="pdf-preview-card">
    <div className="pdf-preview-frame">{asset.previewUrl ? <img src={asset.previewUrl} alt={`First-page preview of ${asset.name}`} /> : <span>Preview unavailable</span>}</div>
    <div className="pdf-asset-info">
      <div><strong>{asset.name}</strong><button className="icon-button" type="button" onClick={onReset} aria-label="Remove PDF"><X size={16} /></button></div>
      <span>{formatBytes(asset.sizeBytes)} · {asset.pageCount} {asset.pageCount === 1 ? "page" : "pages"}</span>
      <span>{asset.classification === "scanned" ? "Likely scanned PDF" : asset.classification === "mixed" ? "Mixed PDF" : asset.classification === "text" ? "Text PDF" : "PDF detected"}</span>
      <span>Text layer: {asset.textPresence === "detected" ? "Detected" : asset.textPresence === "limited" ? "Limited" : "Not detected"}</span>
      {asset.pageDimensions ? <span>{asset.pageDimensions.label}</span> : null}
      <details className="pdf-details"><summary>Details</summary><span>PDF version: {asset.pdfVersion ?? "Not declared"}</span><span>Inspection engine: PDF.js {PDFJS_VERSION}</span></details>
      {validation ? <span className={`pdf-validation ${validation.valid ? "valid" : "invalid"}`}><Check size={13} /> {validation.message}</span> : null}
      <span className="local-badge"><LockKeyhole size={13} /> PDF inspection is processed locally in your browser</span>
      {asset.warnings.length > 0 ? <small>{asset.warnings[0]}</small> : null}
    </div>
  </div>;
}

function ResultPanel({ asset, outcome, onReset, onReprocess, keepOriginalDimensions }: { asset: Extract<FileAsset, { category: "image" }>; outcome: CompressionOutcome; onReset: () => void; onReprocess: (allowResize: boolean) => void; keepOriginalDimensions: boolean }) {
  const { validation } = outcome;
  return <section className="result-panel" aria-labelledby="result-title" data-testid="result-panel">
    <div className="result-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> 03 · Verified result</p><h2 id="result-title">Your image is ready.</h2></div><span className={validation.targetAchieved ? "result-status achieved" : "result-status warning"}>{validation.targetAchieved ? <Check size={15} /> : <WandSparkles size={15} />}{validation.targetAchieved ? "Target achieved" : "Best quality available"}</span></div>
    {outcome.warning ? <div className="result-warning"><strong>We protected the image quality.</strong><span>{outcome.warning}</span><small>{validation.resizeApplied ? "SmartDocs used the smallest tested dimension reduction that reached the target." : "Allow resizing if you want SmartDocs to evaluate a dimension reduction."}</small></div> : null}
    {validation.resizeApplied ? <div className="smart-optimization"><strong>Smart optimization</strong><span><Check size={14} /> Reduced dimensions from {validation.originalDimensions.width} × {validation.originalDimensions.height} to {validation.finalDimensions.width} × {validation.finalDimensions.height}</span><span><Check size={14} /> Preserved acceptable visual quality</span></div> : null}
    {outcome.resizeAvailable ? <div className="advanced-control"><label><input type="checkbox" checked={keepOriginalDimensions} onChange={(event) => { const keep = event.target.checked; onReprocess(!keep); }} /> Keep original dimensions</label>{keepOriginalDimensions ? <button type="button" onClick={() => onReprocess(true)}>Allow resizing</button> : null}</div> : null}
    <div className="comparison-grid"><div className="preview-frame"><div className="preview-label">Original <span>{formatBytes(asset.sizeBytes)}</span></div><img src={asset.previewUrl} alt={`Original preview of ${asset.name}`} /></div><div className="preview-frame optimized"><div className="preview-label">Optimized <span>{formatBytes(validation.outputBytes)}</span></div><img src={outcome.previewUrl} alt={`Optimized preview of ${outcome.filename}`} /></div></div>
    <dl className="metrics-grid"><div><dt>Original</dt><dd>{formatBytes(validation.originalBytes)}</dd></div><div><dt>Optimized</dt><dd>{formatBytes(validation.outputBytes)}</dd></div><div><dt>Reduction</dt><dd>{validation.reductionPercent.toFixed(1)}%</dd></div><div><dt>Final dimensions</dt><dd>{validation.finalDimensions.width} × {validation.finalDimensions.height}</dd></div><div><dt>Target</dt><dd>≤ {outcome.targetLabel}</dd></div></dl>
    <p className="dimension-summary">Original dimensions: <strong>{validation.originalDimensions.width} × {validation.originalDimensions.height}</strong> <ArrowRight size={14} /> Final dimensions: <strong>{validation.finalDimensions.width} × {validation.finalDimensions.height}</strong></p>
    <div className="result-actions"><a className="primary-button download-button" href={outcome.downloadUrl} download={outcome.filename}><Download size={17} /> Download optimized image</a><button className="secondary-button" type="button" onClick={onReset}><RotateCcw size={16} /> Start another</button></div>
    <p className="validation-line"><HardDrive size={14} /> {validation.valid ? "Output decoded successfully" : "Output validation needs attention"} · {validation.mimeType.replace("image/", "").toUpperCase()} · Local processing complete</p>
  </section>;
}

export default App;
