import { Check, ChevronRight, CircleAlert, FileText, LockKeyhole, Play, RotateCcw, Sparkles, X } from "lucide-react";
import type { FileAsset } from "../../domain/files/types";
import { availableCapabilities } from "../../domain/unified/planner";
import type { UnifiedWorkflowPlan, UnifiedWorkflowState } from "../../domain/unified/types";
import { formatBytes } from "../../lib/file-utils";

interface UnifiedWorkspaceProps {
  asset: FileAsset;
  goal: string;
  state: UnifiedWorkflowState;
  plan: UnifiedWorkflowPlan | null;
  busy?: boolean;
  onGoalChange: (goal: string) => void;
  onReview: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onResetPlan: () => void;
}

const formatLabel: Record<FileAsset["category"], string> = { image: "Image", pdf: "PDF", office: "Office document" };

const suggestionCatalog: Array<{ capability: string; label: string; prompt: string }> = [
  { capability: "pdf.optimize.target_size", label: "Compress", prompt: "Compress this PDF under 1 MB" },
  { capability: "pdf.convert.pages_to_png", label: "Convert pages", prompt: "Convert pages 2–5 to PNG" },
  { capability: "pdf.ocr.inspect", label: "Make searchable", prompt: "Make this scan searchable" },
  { capability: "pdf.text.search", label: "Search", prompt: "Find all mentions of a phrase" },
  { capability: "pdf.document.classify", label: "Extract text", prompt: "Extract the text from this document" },
  { capability: "image.compress.target_size", label: "Compress", prompt: "Make this image under 100KB" },
  { capability: "image.convert.to_pdf", label: "Convert to PDF", prompt: "Create a PDF from this image" },
  { capability: "image.convert.jpeg_to_png", label: "Convert format", prompt: "Convert this image to PNG" },
  { capability: "office.extract.text", label: "Extract text", prompt: "Extract all text from this Office document" },
  { capability: "office.inspect.word", label: "Inspect document", prompt: "Inspect this document" },
  { capability: "office.inspect.presentation", label: "Inspect document", prompt: "Inspect this presentation" },
  { capability: "office.inspect.spreadsheet", label: "Inspect document", prompt: "Inspect this workbook" },
];

function humanStepLabel(capability: string): string {
  if (capability.includes("inspect")) return "Inspect the document";
  if (capability.includes("target-size")) return "Reach the requested file size";
  if (capability.includes("optimize") || capability.includes("compress")) return "Optimize the document";
  if (capability.includes("ocr")) return "Make the document searchable";
  if (capability.includes("search")) return "Search the document";
  if (capability.includes("extract")) return "Extract the requested information";
  if (capability.includes("convert")) return "Convert the document";
  if (capability.includes("organize") || capability.includes("merge") || capability.includes("split")) return "Organize the document";
  if (capability.includes("image.validate")) return "Verify the image result";
  if (capability.includes("validate")) return "Verify the result";
  if (capability.includes("ai")) return "Review the document with optional AI assistance";
  return "Process the document";
}

function assetDescription(asset: FileAsset): string {
  if (asset.category === "pdf") return `${asset.pageCount} ${asset.pageCount === 1 ? "page" : "pages"} · ${formatBytes(asset.sizeBytes)}`;
  if (asset.category === "image") return `${asset.width} × ${asset.height} · ${formatBytes(asset.sizeBytes)}`;
  return `${asset.format.toUpperCase()} · ${formatBytes(asset.sizeBytes)}`;
}

export function UnifiedWorkspace({ asset, goal, state, plan, busy = false, onGoalChange, onReview, onConfirm, onCancel, onResetPlan }: UnifiedWorkspaceProps) {
  const capabilities = availableCapabilities(asset);
  const suggestions = suggestionCatalog.filter((suggestion) => capabilities.includes(suggestion.capability)).slice(0, 6);
  const isReview = state === "review" || state === "awaiting-confirmation";
  const isRunning = state === "running" || state === "cancelling" || busy;
  const isCompleted = state === "completed";
  return <section className="unified-workspace" aria-labelledby="unified-workspace-title">
    <div className="unified-workspace-heading">
      <div><p className="eyebrow"><span className="eyebrow-line" /> Your document</p><h2 id="unified-workspace-title">What should SmartDocs do?</h2><p>Describe the result you want in plain language. SmartDocs will show the safest supported path before anything runs.</p></div>
      <span className="local-badge"><LockKeyhole size={13} /> Processed locally</span>
    </div>

    <div className="document-summary-card">
      <div className="document-summary-icon"><FileText size={20} /></div>
      <div className="document-summary-copy"><strong>{asset.name}</strong><span>{formatLabel[asset.category]} · {assetDescription(asset)}</span></div>
      <div className="document-summary-status"><Check size={15} /> Ready</div>
    </div>

    <div className="command-bar-wrap">
      <label htmlFor="unified-goal-input">Your goal</label>
      <div className={`command-bar ${goal.trim() ? "has-value" : ""}`}>
        <Sparkles size={18} aria-hidden="true" />
        <textarea id="unified-goal-input" value={goal} onChange={(event) => onGoalChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!isRunning && goal.trim()) onReview(); } if (event.key === "Escape") event.currentTarget.blur(); }} placeholder={asset.category === "pdf" ? "Compress this PDF under 1 MB" : asset.category === "office" ? "Extract invoice data from this document" : "Make this image under 100KB"} rows={1} aria-describedby="goal-help" />
        <button className="command-submit" type="button" onClick={onReview} disabled={isRunning || !goal.trim()} aria-label="Review plan"><ChevronRight size={19} /></button>
      </div>
      <p id="goal-help" className="command-help">Press Enter to review a plan. SmartDocs will not change the original document.</p>
    </div>

    {suggestions.length > 0 ? <div className="suggestion-row" aria-label="Suggested tasks"><span>Suggested</span>{suggestions.map((suggestion) => <button key={`${suggestion.capability}-${suggestion.label}`} type="button" onClick={() => onGoalChange(suggestion.prompt)}>{suggestion.label}</button>)}</div> : null}

    {isReview && plan ? <div className="unified-plan-card" data-testid="unified-plan-card"><div className="unified-plan-heading"><div><p className="eyebrow">Review before execution</p><h3>Your plan</h3><p className="plan-summary">{plan.intent.goal || "Complete the requested document task"}</p></div><span className={`unified-risk risk-${plan.risk}`}>{plan.risk === "low" ? "Low risk" : plan.risk === "medium" ? "Review recommended" : "Needs confirmation"}</span></div><ol className="unified-step-list">{plan.steps.map((workflowStep, index) => <li key={`${workflowStep.id}-${index}`}><span className="step-number">{index + 1}</span><div><strong>{humanStepLabel(workflowStep.capability)}</strong><small>{workflowStep.requiresConfirmation ? "You will review this step before it runs." : "SmartDocs will verify the result before download."}</small></div></li>)}</ol><div className="unified-plan-meta"><span><LockKeyhole size={14} /> <strong>Browser-local</strong></span><span><FileText size={14} /> <strong>Original preserved</strong></span><span><Check size={14} /> <strong>Verified before download</strong></span></div>{plan.warnings.map((warning) => <p className="unified-warning" key={warning}><CircleAlert size={15} /> {warning}</p>)}<details className="technical-details"><summary>View technical details</summary><div><span>Expected output: {plan.expectedOutput}</span><span>Validation: {plan.validationPlan.join(" · ")}</span><span>Workflow steps: {plan.steps.map((step) => step.capability).join(" · ")}</span></div></details><div className="unified-confirm-row"><button className="secondary-button" type="button" onClick={onCancel}><X size={15} /> Cancel</button><button className="primary-button" type="button" onClick={onConfirm}><Play size={15} /> {plan.requiresConfirmation || state === "awaiting-confirmation" ? "Confirm and run" : "Run this plan"}</button></div></div> : null}

    {isCompleted ? <div className="unified-state success" role="status"><Check size={16} /> Your document is ready. The verified result is shown below.</div> : null}
    {state === "cancelled" ? <div className="unified-state" role="status"><X size={16} /> Task cancelled. Your original document remains unchanged.</div> : null}
    {state === "recoverable-error" ? <div className="unified-state error" role="alert"><CircleAlert size={16} /> SmartDocs could not complete that task safely. Your original document remains unchanged.</div> : null}
    {plan && !isReview && !isCompleted && state !== "cancelled" ? <button className="secondary-button reset-plan-button" type="button" onClick={onResetPlan} disabled={isRunning}><RotateCcw size={15} /> Start a different task</button> : null}
  </section>;
}
