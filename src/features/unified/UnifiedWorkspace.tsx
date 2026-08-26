import { Check, ChevronRight, CircleAlert, FileText, LockKeyhole, Play, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { FileAsset } from "../../domain/files/types";
import { availableCapabilities } from "../../domain/unified/planner";
import { workflowStateLabel } from "../../domain/unified/state";
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

const formatLabel: Record<FileAsset["category"], string> = { image: "Image", pdf: "PDF", office: "Office" };

export function UnifiedWorkspace({ asset, goal, state, plan, busy = false, onGoalChange, onReview, onConfirm, onCancel, onResetPlan }: UnifiedWorkspaceProps) {
  const capabilities = availableCapabilities(asset);
  const isReview = state === "review" || state === "awaiting-confirmation";
  const isRunning = state === "running" || state === "cancelling" || busy;
  return <section className="unified-workspace" aria-labelledby="unified-workspace-title">
    <div className="unified-workspace-heading">
      <div><p className="eyebrow"><span className="eyebrow-line" /> Unified document workspace</p><h3 id="unified-workspace-title">One document. One validated plan.</h3><p>SmartDocs keeps specialized engines underneath one explainable flow: understand the source, map the goal, review the plan, then run only the capability that is actually available.</p></div>
      <span className="local-badge"><LockKeyhole size={13} /> {plan?.processingBoundary === "browser-local-to-ai-gateway" ? "AI boundary disclosed" : "Browser-local"}</span>
    </div>
    <div className="unified-overview-grid">
      <div className="unified-overview-card"><span>Detected</span><strong>{asset.category === "office" ? asset.analysis.documentType === "word" ? "Word document" : asset.analysis.documentType === "presentation" ? "PowerPoint" : "Excel workbook" : formatLabel[asset.category]}</strong><small>{asset.category === "pdf" ? `${asset.pageCount} ${asset.pageCount === 1 ? "page" : "pages"}` : asset.category === "image" ? `${asset.width} × ${asset.height}` : `.${asset.format.toUpperCase()} · ${asset.analysis.complexity} complexity`}</small></div>
      <div className="unified-overview-card"><span>Source</span><strong>{formatBytes(asset.sizeBytes)}</strong><small>{asset.name}</small></div>
      <div className="unified-overview-card"><span>Workflow state</span><strong>{workflowStateLabel(state)}</strong><small>{plan ? `${plan.steps.length} planned steps` : "Goal required"}</small></div>
    </div>
    <div className="unified-capability-row" aria-label="Available capabilities"><span className="unified-label">Available now</span>{capabilities.slice(0, 8).map((capability) => <span className="capability-pill" key={capability}>{capability.replaceAll(".", " · ")}</span>)}{capabilities.length === 0 ? <span className="capability-pill unavailable">No mapped capability</span> : null}</div>
    <div className="unified-goal-row"><label htmlFor="unified-goal-input">What do you want to do?</label><div className="unified-goal-controls"><textarea id="unified-goal-input" value={goal} onChange={(event) => onGoalChange(event.target.value)} placeholder={asset.category === "office" ? "e.g. show me the sheets and formulas in this Excel file" : asset.category === "pdf" ? "e.g. compress this PDF under 1 MB" : "e.g. make this image under 500 KB"} rows={2} /><div className="unified-action-row"><button className="primary-button" type="button" onClick={onReview} disabled={isRunning || !goal.trim()}><ShieldCheck size={16} /> Review plan <ChevronRight size={16} /></button>{plan ? <button className="secondary-button" type="button" onClick={onResetPlan} disabled={isRunning}><RotateCcw size={15} /> Clear plan</button> : null}</div></div></div>
    {plan && isReview ? <div className="unified-plan-card" data-testid="unified-plan-card"><div className="unified-plan-heading"><div><p className="eyebrow">Review before execution</p><h4>Your plan</h4></div><span className={`unified-risk risk-${plan.risk}`}>{plan.risk} risk</span></div><ol className="unified-step-list">{plan.steps.map((workflowStep, index) => <li key={`${workflowStep.id}-${index}`}><span className="step-number">{index + 1}</span><div><strong>{workflowStep.capability}</strong><span>{workflowStep.input} <ChevronRight size={13} /> {workflowStep.output}</span><small>{workflowStep.requiresConfirmation ? "Explicit confirmation required" : workflowStep.validationRequirement}</small></div></li>)}</ol><div className="unified-plan-meta"><span><LockKeyhole size={14} /> Processing: <strong>{plan.processingBoundary === "browser-local-to-ai-gateway" ? "Browser-local + explicit AI gateway" : "Browser-local"}</strong></span><span><FileText size={14} /> Original: <strong>Remains unchanged</strong></span><span><Check size={14} /> Expected: <strong>{plan.expectedOutput}</strong></span></div>{plan.warnings.map((warning) => <p className="unified-warning" key={warning}><CircleAlert size={15} /> {warning}</p>)}<div className="unified-confirm-row"><button className="secondary-button" type="button" onClick={onCancel}><X size={15} /> Cancel</button>{plan.requiresConfirmation || state === "awaiting-confirmation" ? <button className="primary-button" type="button" onClick={onConfirm}><Play size={15} /> Confirm and run</button> : <button className="primary-button" type="button" onClick={onConfirm}><Play size={15} /> Run validated plan</button>}</div></div> : null}
    {state === "completed" ? <div className="unified-state success" role="status"><Check size={16} /> Workflow completed. The specialized workspace below owns the validated result.</div> : null}
    {state === "cancelled" ? <div className="unified-state" role="status"><X size={16} /> Workflow cancelled. The original document remains unchanged.</div> : null}
  </section>;
}
