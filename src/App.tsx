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
import type { FileAsset, FileIntakeError } from "./domain/files/types";
import { formatBytes } from "./lib/file-utils";
import { parseImageIntent, type ParsedIntent } from "./domain/intents/parse-intent";
import { createImageCompressionWorkflow } from "./domain/workflows/types";
import { compressImage, type CompressionOutcome, type CompressionStage } from "./features/compression/compress-image";
import { inspectImageFile } from "./features/intake/read-image";
import "./styles/tokens.css";
import "./styles/app.css";

interface Notice {
  title: string;
  message: string;
  recovery: string;
}

const stageLabels: Record<CompressionStage, string> = {
  preparing: "Preparing image",
  analyzing: "Analyzing image",
  optimizing: "Optimizing",
  checking: "Checking result",
};

const examples = ["make this image under 100KB", "compress to 500KB", "make it less than 1 MB"];

function intakeErrorToNotice(error: FileIntakeError): Notice {
  return { title: error.title, message: error.message, recovery: error.recovery };
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const assetUrlRef = useRef<string | null>(null);
  const resultUrlsRef = useRef<string[]>([]);
  const [asset, setAsset] = useState<FileAsset | null>(null);
  const [goal, setGoal] = useState("");
  const [intent, setIntent] = useState<ParsedIntent | null>(null);
  const [outcome, setOutcome] = useState<CompressionOutcome | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [stage, setStage] = useState<CompressionStage | null>(null);

  useEffect(() => {
    return () => {
      if (assetUrlRef.current) URL.revokeObjectURL(assetUrlRef.current);
      resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function releaseUrls() {
    if (assetUrlRef.current) URL.revokeObjectURL(assetUrlRef.current);
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    assetUrlRef.current = null;
    resultUrlsRef.current = [];
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    releaseUrls();
    setAsset(null);
    setOutcome(null);
    setIntent(null);
    setNotice(null);
    setReadingFile(true);
    try {
      const result = await inspectImageFile(file);
      if ("code" in result) {
        setNotice(intakeErrorToNotice(result));
        return;
      }
      assetUrlRef.current = result.previewUrl;
      setAsset(result);
    } catch {
      setNotice({
        title: "We could not inspect that file.",
        message: "The browser stopped while reading the image.",
        recovery: "Try another JPEG, PNG, or WebP file.",
      });
    } finally {
      setReadingFile(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handleFile(event.dataTransfer.files[0]);
  }

  function handleGoalChange(value: string) {
    setGoal(value);
    setIntent(null);
    if (notice?.title === "We need a clearer goal.") setNotice(null);
  }

  async function runWorkflow() {
    if (!asset) {
      setNotice({
        title: "Add an image first.",
        message: "There is no file ready for this workflow.",
        recovery: "Choose a JPEG, PNG, or WebP image above.",
      });
      return;
    }
    const parsed = parseImageIntent(goal);
    setIntent(parsed);
    if (parsed.status !== "valid" || !parsed.intent) {
      setNotice({
        title: parsed.status === "unsupported" ? "That goal is not available yet." : "We need a clearer goal.",
        message: parsed.message,
        recovery: "Use an exact target such as “make this image under 100KB.”",
      });
      return;
    }

    setNotice(null);
    setOutcome(null);
    setStage("preparing");
    try {
      const workflow = createImageCompressionWorkflow(asset, parsed.intent);
      const result = await compressImage(workflow.input, workflow.intent, setStage);
      resultUrlsRef.current = [result.previewUrl, result.downloadUrl];
      setOutcome(result);
    } catch (error) {
      setNotice({
        title: "The image could not be processed locally.",
        message: error instanceof Error ? error.message : "The browser stopped during image processing.",
        recovery: "Try a smaller image or another supported format.",
      });
    } finally {
      setStage(null);
    }
  }

  function reset() {
    releaseUrls();
    setAsset(null);
    setGoal("");
    setIntent(null);
    setOutcome(null);
    setNotice(null);
    setStage(null);
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
              <p className="eyebrow"><span className="eyebrow-line" /> First real workflow</p>
              <h1>One file.<br /><span>One clear goal.</span></h1>
              <p className="hero-lede">SmartDocs turns a human request into a verified result. Start with a real image, describe the size you need, and keep the whole workflow in your browser.</p>
              <div className="hero-proof"><span><Check size={14} /> No server upload</span><span><Check size={14} /> Actual byte check</span><span><Check size={14} /> Downloadable result</span></div>
            </div>
            <div className="hero-side-note"><span>01</span><p>Give the work a goal, not a tool name.</p><ArrowRight size={22} /></div>
          </div>
        </section>

        <section id="workspace" className="workspace-section" aria-labelledby="workspace-title">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">The workspace</p>
                <h2 id="workspace-title">What do you want to do<br /><span>with your image?</span></h2>
              </div>
              <p className="section-intro">Describe an exact target. SmartDocs will interpret it, find the best local path, and check the output before you download.</p>
            </div>

            <div className="workflow-layout">
              <div className="workflow-card intake-card">
                <div className="card-label"><span className="label-icon"><Upload size={15} /></span> 01 · Add an image</div>
                <input ref={inputRef} className="file-picker-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a JPEG, PNG, or WebP image" onChange={(event) => void handleFile(event.target.files?.[0])} />
                {!asset ? (
                  <div className="dropzone" role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} data-testid="dropzone">
                    <span className="dropzone-icon"><FileImage size={25} /></span>
                    <strong>{readingFile ? "Reading image…" : "Drop an image here"}</strong>
                    <span>or choose a JPEG, PNG, or WebP file</span>
                    <small>Maximum input size: 25 MB</small>
                  </div>
                ) : (
                  <div className="asset-preview" data-testid="asset-preview">
                    <img src={asset.previewUrl} alt={`Preview of ${asset.name}`} />
                    <div className="asset-info">
                      <div><strong>{asset.name}</strong><button className="icon-button" type="button" onClick={reset} aria-label="Remove image"><X size={16} /></button></div>
                      <span>{formatBytes(asset.sizeBytes)} · {asset.width} × {asset.height} · {asset.mimeType.replace("image/", "").toUpperCase()}</span>
                      <span className="local-badge"><LockKeyhole size={13} /> Stays in your browser</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="workflow-card goal-card">
                <div className="card-label"><span className="label-icon violet"><WandSparkles size={15} /></span> 02 · Describe the goal</div>
                <label htmlFor="goal-input" className="goal-label">What should happen to this image?</label>
                <textarea id="goal-input" value={goal} onChange={(event) => handleGoalChange(event.target.value)} placeholder="e.g. make this image under 100KB" rows={3} data-testid="goal-input" />
                <div className="example-row" aria-label="Goal examples">
                  {examples.map((example) => <button key={example} type="button" onClick={() => handleGoalChange(example)}>{example}</button>)}
                </div>
                {intent?.status === "valid" && intent.intent ? <div className="intent-confirmation"><Check size={15} /> Target understood: ≤ {intent.intent.targetLabel}</div> : null}
                <button className="primary-button" type="button" onClick={() => void runWorkflow()} disabled={isBusy} data-testid="run-workflow">{stage ? <><span className="spinner" /> {stageLabels[stage]}…</> : <><Sparkles size={17} /> Optimize locally <ArrowRight size={17} /></>}</button>
                <p className="microcopy"><LockKeyhole size={13} /> Your image never leaves this browser.</p>
              </div>
            </div>

            {notice ? <div className="notice" role="alert"><div className="notice-icon"><X size={17} /></div><div><strong>{notice.title}</strong><p>{notice.message}</p><span>{notice.recovery}</span></div></div> : null}
            {stage ? <div className="processing-strip" role="status" aria-live="polite"><span className="spinner" /><div><strong>{stageLabels[stage]}</strong><span>Working with the image in your browser. No progress percentage is invented.</span></div><ChevronDown size={18} /></div> : null}

            {outcome && asset ? <ResultPanel asset={asset} outcome={outcome} onReset={reset} /> : null}
          </div>
        </section>

        <section id="how-it-works" className="how-section" aria-labelledby="how-title">
          <div className="container">
            <div className="section-heading compact"><div><p className="eyebrow">How it works</p><h2 id="how-title">Simple on the outside.<br /><span>Measured underneath.</span></h2></div></div>
            <div className="steps-grid">
              <article><span>01</span><h3>Understand the request</h3><p>The first parser handles common target-size phrases and converts KB/MB into exact decimal bytes.</p></article>
              <article><span>02</span><h3>Try real candidates</h3><p>The browser decodes the image, measures actual encodings, and searches for the highest quality that fits.</p></article>
              <article><span>03</span><h3>Check before delivery</h3><p>The output is decoded again, its bytes and dimensions are verified, and only then is a download offered.</p></article>
            </div>
          </div>
        </section>

        <section id="roadmap" className="roadmap-section" aria-labelledby="roadmap-title">
          <div className="container roadmap-grid"><div><p className="eyebrow">A measured roadmap</p><h2 id="roadmap-title">Build the foundation<br /><span>before the universe.</span></h2></div><div className="roadmap-list"><div className="roadmap-item current"><span className="roadmap-marker" /><div><strong>Image target-size workflow</strong><p>Implemented locally in this phase.</p></div><span className="roadmap-state">Now</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>Document workflows</strong><p>PDF, OCR, conversion, and isolated processing.</p></div><span className="roadmap-state">Planned</span></div><div className="roadmap-item"><span className="roadmap-marker" /><div><strong>AI-assisted understanding</strong><p>Schema-constrained planning when it adds real value.</p></div><span className="roadmap-state">Later</span></div></div></div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-inner"><a className="brand footer-brand" href="#top" aria-label="Back to SmartDocs home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span className="brand-name">SmartDocs</span></a><p>One file + one goal → one verified result.</p><span className="footer-phase">Phase 1 · Image workflow</span></div></footer>
    </div>
  );
}

function ResultPanel({ asset, outcome, onReset }: { asset: FileAsset; outcome: CompressionOutcome; onReset: () => void }) {
  const { validation } = outcome;
  return <section className="result-panel" aria-labelledby="result-title" data-testid="result-panel">
    <div className="result-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> 03 · Verified result</p><h2 id="result-title">Your image is ready.</h2></div><span className={validation.targetAchieved ? "result-status achieved" : "result-status warning"}>{validation.targetAchieved ? <Check size={15} /> : <WandSparkles size={15} />}{validation.targetAchieved ? "Target achieved" : "Best quality available"}</span></div>
    {outcome.warning ? <div className="result-warning"><strong>We protected the image quality.</strong><span>{outcome.warning}</span><small>To reach a smaller target, the next real option would be resizing first.</small></div> : null}
    <div className="comparison-grid"><div className="preview-frame"><div className="preview-label">Original <span>{formatBytes(asset.sizeBytes)}</span></div><img src={asset.previewUrl} alt={`Original preview of ${asset.name}`} /></div><div className="preview-frame optimized"><div className="preview-label">Optimized <span>{formatBytes(validation.outputBytes)}</span></div><img src={outcome.previewUrl} alt={`Optimized preview of ${outcome.filename}`} /></div></div>
    <dl className="metrics-grid"><div><dt>Original</dt><dd>{formatBytes(validation.originalBytes)}</dd></div><div><dt>Optimized</dt><dd>{formatBytes(validation.outputBytes)}</dd></div><div><dt>Reduction</dt><dd>{validation.reductionPercent.toFixed(1)}%</dd></div><div><dt>Dimensions</dt><dd>{validation.width} × {validation.height}</dd></div><div><dt>Target</dt><dd>≤ {outcome.targetLabel}</dd></div></dl>
    <div className="result-actions"><a className="primary-button download-button" href={outcome.downloadUrl} download={outcome.filename}><Download size={17} /> Download optimized image</a><button className="secondary-button" type="button" onClick={onReset}><RotateCcw size={16} /> Start another</button></div>
    <p className="validation-line"><HardDrive size={14} /> {validation.valid ? "Output decoded successfully" : "Output validation needs attention"} · {validation.mimeType.replace("image/", "").toUpperCase()} · Local processing complete</p>
  </section>;
}

export default App;
