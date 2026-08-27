import { useState } from "react";
import { Check, CircleAlert, FileStack, LockKeyhole, Play, RotateCcw, ShieldCheck, WandSparkles, X, ChevronRight, Activity } from "lucide-react";
import type { FileAsset } from "../../domain/files/types";
import { planWorkflowForAsset, type WorkflowPlan, type WorkflowExecutionState, type WorkflowHistoryEntry, type WorkflowStepState } from "../../domain/workflows/orchestration";
import { formatBytes } from "../../lib/file-utils";

interface WorkflowWorkspaceProps {
  asset: FileAsset | null;
  documents: readonly { id: string; name: string; sizeBytes: number; mimeType: string; category: string }[];
  onGoalChange: (goal: string) => void;
  onExecute?: (plan: WorkflowPlan) => Promise<void>;
}

export function WorkflowWorkspace({ asset, documents, onGoalChange, onExecute }: WorkflowWorkspaceProps) {
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<WorkflowPlan | null>(null);
  const [state, setState] = useState<WorkflowExecutionState>("draft");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);

  function handleGoalChange(value: string) {
    setGoal(value);
    onGoalChange(value);
    setPlan(null);
    setState("draft");
  }

  function review() {
    if (!asset && documents.length === 0) return;
    if (!goal.trim()) return;
    setBusy(true);
    try {
      const nextPlan = asset ? planWorkflowForAsset(asset, goal) : null;
      if (nextPlan) {
        setPlan(nextPlan);
        setState(nextPlan.valid ? (nextPlan.requiresConfirmation ? "review_required" : "review") : "failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!plan || !plan.valid) return;
    setState("running");
    setBusy(true);
    try {
      if (onExecute) await onExecute(plan);
      setState("completed");
      const entry: WorkflowHistoryEntry = {
        executionId: `exec-${Date.now()}`,
        workflowId: plan.workflowId,
        goal: plan.goal,
        timestamp: Date.now(),
        documentCount: asset ? 1 : documents.length,
        stepSummary: plan.steps.reduce((acc, step) => ({ ...acc, [step.state]: (acc[step.state] || 0) + 1 }), { pending: 0, ready: 0, running: 0, validating: 0, completed: 0, skipped: 0, cancelled: 0, failed: 0, blocked: 0, retrying: 0 } as Record<WorkflowStepState, number>),
        finalState: "completed",
        artifactMetadata: [],
        warnings: plan.warnings,
      };
      setHistory((current) => [entry, ...current].slice(0, 20));
    } catch {
      setState("failed");
    } finally {
      setBusy(false);
    }
  }

  const selectedStep = plan?.steps.find((s) => s.id === selectedStepId);

  return (
    <section className="workflow-workspace" aria-labelledby="workflow-workspace-title">
      <div className="collection-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> Phase 12 · Orchestration</p>
          <h3 id="workflow-workspace-title">Automate your document goal.</h3>
          <p>Describe a multi-step request. SmartDocs plans the sequence, validates dependencies, and executes locally.</p>
        </div>
        <span className="local-badge"><Activity size={13} /> Orchestration Engine</span>
      </div>

      <div className="workflow-layout">
        <div className="workflow-card goal-card">
          <div className="card-label"><span className="label-icon violet"><WandSparkles size={15} /></span> 01 · Goal</div>
          <label htmlFor="workflow-goal" className="goal-label">What do you want to do with these documents?</label>
          <textarea id="workflow-goal" value={goal} onChange={(e) => handleGoalChange(e.target.value)} placeholder="e.g. OCR these PDFs, extract invoice numbers, then compress each below 1MB" rows={3} />
          <div className="collection-actions">
            <button className="primary-button" type="button" onClick={review} disabled={busy || !goal.trim()}><Check size={15} /> Review workflow plan</button>
            {state === "review" || state === "review_required" || state === "confirmed" ? (
              <button className="primary-button" type="button" onClick={() => void run()} disabled={busy}><Play size={15} /> Run workflow</button>
            ) : null}
          </div>
        </div>

        <div className="workflow-card collection-summary-card">
          <div className="card-label"><span className="label-icon"><FileStack size={15} /></span> 02 · Collection</div>
          <div className="summary-stats">
            <div className="stat"><strong>{asset ? 1 : documents.length}</strong><span>Documents</span></div>
            <div className="stat"><strong>{asset ? asset.extension.toUpperCase() : "Mixed"}</strong><span>Format</span></div>
            <div className="stat"><strong>{formatBytes(asset ? asset.sizeBytes : documents.reduce((s, d) => s + d.sizeBytes, 0))}</strong><span>Total size</span></div>
          </div>
          {plan && plan.warnings.length > 0 && (
            <div className="workflow-warnings">
              {plan.warnings.map((w, i) => <p key={i} className="unified-warning"><CircleAlert size={14} /> {w}</p>)}
            </div>
          )}
        </div>
      </div>

      {plan && (
        <div className="workflow-plan-container">
          <div className="workflow-graph-view">
            <div className="graph-header">
              <p className="eyebrow">Workflow dependency graph</p>
              <span className={`unified-risk risk-${plan.steps.some(s => s.risk === "high") ? "high" : plan.steps.some(s => s.risk === "medium") ? "medium" : "low"}`}>{plan.steps.some(s => s.risk === "high") ? "high" : plan.steps.some(s => s.risk === "medium") ? "medium" : "low"} risk</span>
            </div>
            <div className="graph-timeline">
              {plan.steps.map((step, index) => (
                <div key={step.id} className={`graph-node ${step.state} ${selectedStepId === step.id ? "selected" : ""}`} onClick={() => setSelectedStepId(step.id)}>
                  <div className="node-marker">{index + 1}</div>
                  <div className="node-content">
                    <strong>{step.capability.replaceAll(".", " ")}</strong>
                    <span>{step.processingBoundary === "browser-local" ? "Local" : "AI Gateway"}</span>
                  </div>
                  {index < plan.steps.length - 1 && <ChevronRight className="node-connector" size={16} />}
                </div>
              ))}
            </div>
          </div>

          {selectedStep && (
            <div className="step-detail-panel">
              <div className="detail-header">
                <strong>Step {plan.steps.indexOf(selectedStep) + 1}: {selectedStep.capability}</strong>
                <button className="icon-button" onClick={() => setSelectedStepId(null)}><X size={14} /></button>
              </div>
              <div className="detail-grid">
                <div className="detail-item"><span>Type</span><strong>{selectedStep.type}</strong></div>
                <div className="detail-item"><span>Resource</span><strong>{selectedStep.resourceClass}</strong></div>
                <div className="detail-item"><span>Boundary</span><strong>{selectedStep.processingBoundary}</strong></div>
                <div className="detail-item"><span>Risk</span><strong>{selectedStep.risk}</strong></div>
              </div>
              <div className="detail-section">
                <span>Validation plan</span>
                <ul>{selectedStep.validationPlan.map((v) => <li key={v.id}><Check size={12} /> {v.description}</li>)}</ul>
              </div>
            </div>
          )}

          <div className="privacy-disclosure-panel">
            <div className="disclosure-header"><ShieldCheck size={16} /> Privacy & Processing Boundary</div>
            <div className="disclosure-grid">
              <div className="disclosure-item"><span>Browser-local steps</span><strong>{plan.steps.filter(s => s.processingBoundary === "browser-local").length}</strong></div>
              <div className="disclosure-item"><span>Server-assisted steps</span><strong>{plan.steps.filter(s => s.processingBoundary === "browser-local-to-ai-gateway").length}</strong></div>
              <div className="disclosure-item"><span>External AI used</span><strong>{plan.steps.some(s => s.processingBoundary === "browser-local-to-ai-gateway") ? "Yes" : "No"}</strong></div>
              <div className="disclosure-item"><span>Originals uploaded</span><strong>No</strong></div>
            </div>
            <p className="microcopy"><LockKeyhole size={12} /> SmartDocs orchestration preserves your original files. Only bounded structured context crosses the optional AI gateway after your explicit confirmation.</p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="workflow-history">
          <div className="history-header">
            <p className="eyebrow">Session history</p>
            <button className="secondary-button" onClick={() => setHistory([])}><RotateCcw size={14} /> Clear</button>
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.executionId} className="history-item">
                <div className="history-main">
                  <strong>{entry.goal}</strong>
                  <span>{entry.documentCount} document{entry.documentCount === 1 ? "" : "s"} · {new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <span className={`history-state ${entry.finalState}`}>{entry.finalState}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
