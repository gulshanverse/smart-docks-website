import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Eye, FileText, Image as ImageIcon, RotateCcw, Trash2, WandSparkles } from "lucide-react";
import type { PdfAsset } from "../../domain/files/types";
import { pageHintLabel, type PdfPageAsset } from "../../domain/pdfs/pages";
import { createDeletePlan, createExtractPlan, createReorderPlan, createRotatePlan, type PdfOperationType, type PdfRotationDegrees } from "../../domain/pdfs/operations";
import { validatePdfMutationResult, type PdfMutationValidation } from "../../domain/pdfs/mutation-validation";
import { createPdfMutationWorkflow, createPdfPageInspectionWorkflow } from "../../domain/workflows/types";
import { inspectFile } from "../intake/inspect-file";
import { mutatePdf, type PdfMutationOutput } from "./mutate-pdf";
import type { PdfPageSession } from "./page-intelligence";

interface PdfPageWorkspaceProps {
  file: File;
  asset: PdfAsset;
  requestedPageNumber?: number;
  navigationRequestToken?: number;
}

type PageMap = Record<number, PdfPageAsset>;
type PendingOperation = "delete_pages" | "extract_pages" | "rotate_pages" | "reorder_pages" | null;

interface MutationResultState {
  file: File;
  asset: PdfAsset;
  output: PdfMutationOutput;
  validation: PdfMutationValidation;
  downloadUrl: string;
}

function pagePlaceholder(pageNumber: number, selected: boolean): PdfPageAsset {
  return { pageNumber, widthPoints: 0, heightPoints: 0, orientation: "portrait", paperSizeHint: "other", hasText: false, textCharacterCount: 0, hasRasterContent: false, typeHint: "unknown", previewState: "idle", previewUrl: null, thumbnailState: "idle", thumbnailUrl: null, selected, warnings: [] };
}

function markSelected(pages: PageMap, selectedPageNumbers: ReadonlySet<number>): PageMap {
  return Object.fromEntries(Object.entries(pages).filter(([, page]) => page).map(([key, page]) => [Number(key), { ...page, selected: selectedPageNumbers.has(page.pageNumber) }])) as PageMap;
}

function formatOperationLabel(operation: PendingOperation): string {
  if (operation === "delete_pages") return "Delete";
  if (operation === "extract_pages") return "Extract";
  if (operation === "rotate_pages") return "Rotate";
  return "Reorder";
}

export function PdfPageWorkspace({ file, asset, requestedPageNumber, navigationRequestToken }: PdfPageWorkspaceProps) {
  const [source, setSource] = useState({ file, asset });
  const [session, setSession] = useState<PdfPageSession | null>(null);
  const [pages, setPages] = useState<PageMap>({});
  const [pageOrder, setPageOrder] = useState<number[]>(() => Array.from({ length: asset.pageCount }, (_, index) => index + 1));
  const [selectedPages, setSelectedPages] = useState<Set<number>>(() => new Set());
  const [activePageNumber, setActivePageNumber] = useState<number | null>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "error">("loading");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);
  const [rotationDegrees, setRotationDegrees] = useState<PdfRotationDegrees>(90);
  const [mutationState, setMutationState] = useState<"idle" | "running">("idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [result, setResult] = useState<MutationResultState | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const ownedUrlsRef = useRef<string[]>([]);
  const initialSourceRef = useRef({ file, asset });

  const selectedPageNumbers = useMemo(() => [...selectedPages].sort((a, b) => a - b), [selectedPages]);
  const selectedSet = selectedPages;
  const orderChanged = pageOrder.some((pageNumber, index) => pageNumber !== index + 1);

  function releaseOwnedResultUrls() {
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedUrlsRef.current = [];
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    let active = true;
    let nextSession: PdfPageSession | null = null;
    setSession(null);
    setPages({});
    setPageOrder(Array.from({ length: source.asset.pageCount }, (_, index) => index + 1));
    setSelectedPages(new Set());
    setActivePageNumber(1);
    setSessionState("loading");
    setPageMessage(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);

    void import("./page-intelligence").then(({ openPdfPageSession }) => openPdfPageSession(source.file)).then((opened) => {
      if (!active) {
        void opened.close();
        return;
      }
      nextSession = opened;
      setSession(opened);
      setSessionState("ready");
    }).catch((error) => {
      if (!active) return;
      setSessionState("error");
      setPageMessage(error instanceof Error && error.message === "password-required" ? "This PDF is password protected; page inspection is unavailable." : "Page intelligence could not open this PDF.");
    });

    return () => {
      active = false;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      if (nextSession) void nextSession.close();
    };
  }, [source.file, source.asset.pageCount]);

  useEffect(() => {
    if (navigationRequestToken === undefined || requestedPageNumber === undefined) return;
    if (requestedPageNumber >= 1 && requestedPageNumber <= source.asset.pageCount) {
      setActivePageNumber(requestedPageNumber);
      setPageMessage(`Showing source page ${requestedPageNumber} from the verified AI reference.`);
    }
  }, [navigationRequestToken, requestedPageNumber, source.asset.pageCount]);

  useEffect(() => {
    if (!session || activePageNumber === null) return;
    let active = true;
    const pageNumber = activePageNumber;
    const workflow = createPdfPageInspectionWorkflow(source.asset, pageNumber);
    const isAiNavigation = navigationRequestToken !== undefined && requestedPageNumber === pageNumber;
    setPageMessage(isAiNavigation ? `Showing source page ${pageNumber} from the verified AI reference.` : null);
    setPages((current) => markSelected(current, selectedSet));
    setPages((current) => ({ ...current, [pageNumber]: { ...(current[pageNumber] ?? pagePlaceholder(pageNumber, selectedSet.has(pageNumber))), selected: selectedSet.has(pageNumber), previewState: "loading" } }));
    if (previewUrlRef.current) {
      session.revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }

    void (async () => {
      try {
        const page = await session.inspectPage(workflow.pageNumber);
        if (!active) return;
        setPages((current) => ({ ...markSelected(current, selectedSet), [pageNumber]: { ...page, selected: selectedSet.has(pageNumber), previewState: "loading" } }));
        const url = await session.renderPage(workflow.pageNumber, { kind: "preview" });
        if (!active) {
          session.revokeObjectUrl(url);
          return;
        }
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPages((current) => ({ ...markSelected(current, selectedSet), [pageNumber]: { ...page, selected: selectedSet.has(pageNumber), previewState: "ready", previewUrl: url } }));
      } catch (error) {
        if (!active) return;
        setPages((current) => ({ ...markSelected(current, selectedSet), [pageNumber]: { ...(current[pageNumber] ?? pagePlaceholder(pageNumber, selectedSet.has(pageNumber))), selected: selectedSet.has(pageNumber), previewState: "error", previewUrl: null, warnings: ["Preview unavailable"] } }));
        setPageMessage(error instanceof Error && error.message === "page-unavailable" ? "That page is unavailable." : "Preview unavailable for this page. You can continue to another page.");
      }
    })();

    return () => {
      active = false;
    };
  }, [activePageNumber, navigationRequestToken, requestedPageNumber, selectedSet, session, source.asset]);

  const handlePageData = useCallback((pageNumber: number, page: PdfPageAsset) => {
    setPages((current) => ({ ...current, [pageNumber]: { ...page, selected: selectedPages.has(pageNumber) } }));
  }, [selectedPages]);

  function selectPage(pageNumber: number) {
    if (pageNumber < 1 || pageNumber > source.asset.pageCount) return;
    setActivePageNumber(pageNumber);
  }

  function togglePageSelection(pageNumber: number) {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      setPages((pagesNow) => markSelected(pagesNow, next));
      return next;
    });
  }

  function clearSelection() {
    setSelectedPages(new Set());
    setPages((current) => markSelected(current, new Set()));
    setPendingOperation(null);
    setPageMessage("Page selection cleared. Choose pages to operate on.");
  }

  function selectAllPages() {
    const next = new Set(pageOrder);
    setSelectedPages(next);
    setPages((current) => markSelected(current, next));
    setPageMessage(`${next.size} pages selected.`);
  }

  function moveSelection(direction: "up" | "down") {
    if (selectedPageNumbers.length === 0) return;
    const next = [...pageOrder];
    if (direction === "up") {
      for (let index = 1; index < next.length; index += 1) {
        if (selectedSet.has(next[index]) && !selectedSet.has(next[index - 1])) [next[index - 1], next[index]] = [next[index], next[index - 1]];
      }
    } else {
      for (let index = next.length - 2; index >= 0; index -= 1) {
        if (selectedSet.has(next[index]) && !selectedSet.has(next[index + 1])) [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
    }
    setPageOrder(next);
    setPageMessage(`Page order changed to ${next.join(" → ")}. Create a new PDF to apply it.`);
  }

  function handlePageKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectPage(Math.min(source.asset.pageCount, (activePageNumber ?? 1) + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectPage(Math.max(1, (activePageNumber ?? 2) - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      selectPage(1);
    } else if (event.key === "End") {
      event.preventDefault();
      selectPage(source.asset.pageCount);
    }
  }

  function openOperation(operation: PendingOperation) {
    setMutationMessage(null);
    setPendingOperation(operation);
  }

  async function executeOperation() {
    const operation = pendingOperation;
    if (!operation) return;
    const planned = operation === "delete_pages" ? createDeletePlan(source.asset.pageCount, selectedPageNumbers) : operation === "extract_pages" ? createExtractPlan(source.asset.pageCount, selectedPageNumbers) : operation === "rotate_pages" ? createRotatePlan(source.asset.pageCount, selectedPageNumbers, rotationDegrees) : createReorderPlan(source.asset.pageCount, pageOrder);
    if ("error" in planned) {
      setMutationMessage(planned.error.message);
      setPendingOperation(null);
      return;
    }
    const workflow = createPdfMutationWorkflow(source.asset, planned.plan);
    setPendingOperation(null);
    setMutationState("running");
    setMutationMessage(null);
    try {
      const output = await mutatePdf(source.file, workflow.input, workflow.plan);
      const outputBuffer = toArrayBuffer(output.bytes);
      const outputFile = new File([outputBuffer], output.filename, { type: "application/pdf" });
      const inspected = await inspectFile(outputFile, () => undefined);
      if ("code" in inspected || inspected.category !== "pdf") throw new Error("The new PDF could not be reopened for validation.");
      const validation = validatePdfMutationResult({ plan: planned.plan, inputBytes: output.inputBytes, outputBytes: output.outputBytes, pageCount: inspected.pageCount, previewAvailable: Boolean(inspected.previewUrl), processingBoundary: inspected.processingBoundary });
      if (!validation.valid) {
        if (inspected.previewUrl) URL.revokeObjectURL(inspected.previewUrl);
        throw new Error(validation.message);
      }
      releaseOwnedResultUrls();
      const downloadUrl = URL.createObjectURL(new Blob([outputBuffer], { type: "application/pdf" }));
      ownedUrlsRef.current.push(downloadUrl);
      if (inspected.previewUrl) ownedUrlsRef.current.push(inspected.previewUrl);
      setResult({ file: outputFile, asset: inspected, output, validation, downloadUrl });
      setPageMessage(`${validation.message} ${validation.pageCount} pages ready.`);
      setSelectedPages(new Set());
      setPageOrder(Array.from({ length: inspected.pageCount }, (_, index) => index + 1));
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "The PDF operation failed locally.");
    } finally {
      setMutationState("idle");
    }
  }

  function continueWithResult() {
    if (!result) return;
    const nextSource = { file: result.file, asset: result.asset };
    releaseOwnedResultUrls();
    setSource(nextSource);
    setResult(null);
    setMutationMessage(null);
    setPageMessage("Continuing with the validated PDF result. The original remains available below.");
  }

  function returnToOriginal() {
    const wasResultSource = source.file !== initialSourceRef.current.file;
    releaseOwnedResultUrls();
    if (wasResultSource) setSource(initialSourceRef.current);
    setResult(null);
    setMutationMessage(null);
    setPageMessage(wasResultSource ? "Returned to the original PDF. No original pages were changed." : "Result dismissed. The original PDF remains unchanged.");
  }

  const activePage = activePageNumber ? pages[activePageNumber] : null;
  const canNavigate = sessionState === "ready" && source.asset.pageCount > 0;
  const selectedLabel = selectedPageNumbers.length === 1 ? "1 page selected" : `${selectedPageNumbers.length} pages selected`;
  const isResultSource = source.file !== initialSourceRef.current.file;

  return <section className="pdf-page-workspace" aria-labelledby="pdf-pages-title">
    {isResultSource ? <div className="pdf-result-source-banner" role="status"><Check size={15} /> Working from a validated result. <button type="button" onClick={returnToOriginal}>Return to original</button></div> : null}
    <div className="pdf-workspace-heading">
      <div>
        <p className="eyebrow"><span className="eyebrow-line" /> Page intelligence</p>
        <h3 id="pdf-pages-title">Inspect the document <span>page by page.</span></h3>
        <p>Page signals and previews are generated locally only when needed. Select pages to create a new PDF; the original is never modified.</p>
      </div>
      <div className="pdf-page-count"><strong>{source.asset.pageCount}</strong><span>{source.asset.pageCount === 1 ? "page" : "pages"}</span></div>
    </div>

    <div className="pdf-page-controls" onKeyDown={handlePageKeyDown} tabIndex={0} aria-label="Page navigation. Use arrow keys to move between pages.">
      <button className="secondary-button page-nav-button" type="button" onClick={() => selectPage(Math.max(1, (activePageNumber ?? 2) - 1))} disabled={!canNavigate || activePageNumber === null || activePageNumber <= 1} aria-label="Previous page"><ChevronLeft size={16} /> Previous</button>
      <label className="page-jump">Page <input type="number" min={1} max={source.asset.pageCount} value={activePageNumber ?? ""} onChange={(event) => selectPage(Number(event.target.value))} aria-label={`Page number from 1 to ${source.asset.pageCount}`} /> of {source.asset.pageCount}</label>
      <button className="secondary-button page-nav-button" type="button" onClick={() => selectPage(Math.min(source.asset.pageCount, (activePageNumber ?? 0) + 1))} disabled={!canNavigate || activePageNumber === null || activePageNumber >= source.asset.pageCount}>Next <ChevronRight size={16} /></button>
      <button className="clear-selection" type="button" onClick={clearSelection} disabled={selectedPages.size === 0}><RotateCcw size={14} /> Clear selection</button>
    </div>

    <div className="pdf-selection-summary" role="status" aria-live="polite"><strong>{selectedLabel}</strong><span>Selection is informational until an operation is confirmed.</span><div><button type="button" onClick={selectAllPages}>Select all</button><button type="button" onClick={clearSelection} disabled={selectedPages.size === 0}>Clear</button></div></div>

    {selectedPages.size > 0 || orderChanged ? <div className="pdf-operation-toolbar" aria-label="PDF page operations">
      {selectedPages.size > 0 ? <>
        <span className="operation-count"><WandSparkles size={14} /> {selectedLabel}</span>
        <button type="button" className="operation-button destructive" onClick={() => openOperation("delete_pages")}><Trash2 size={15} /> Delete</button>
        <button type="button" className="operation-button" onClick={() => openOperation("extract_pages")}><FileText size={15} /> Extract</button>
        <label className="rotation-control">Rotate <select value={rotationDegrees} onChange={(event) => setRotationDegrees(Number(event.target.value) as PdfRotationDegrees)} aria-label="Rotation amount"><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option></select><button type="button" className="operation-button" onClick={() => openOperation("rotate_pages")}>Apply</button></label>
        <button type="button" className="operation-button" onClick={() => moveSelection("up")} disabled={selectedPages.size === 0}><ChevronLeft size={15} /> Move up</button>
        <button type="button" className="operation-button" onClick={() => moveSelection("down")} disabled={selectedPages.size === 0}><ChevronRight size={15} /> Move down</button>
      </> : null}
      {orderChanged ? <button type="button" className="operation-button primary-operation" onClick={() => openOperation("reorder_pages")}><Check size={15} /> Create reordered PDF</button> : null}
    </div> : null}

    {pendingOperation ? <div className="pdf-operation-confirmation" role="alertdialog" aria-labelledby="operation-confirm-title"><div><strong id="operation-confirm-title">{pendingOperation === "delete_pages" ? `Delete ${selectedLabel}?` : pendingOperation === "extract_pages" ? `Create a new PDF from ${selectedLabel}?` : pendingOperation === "rotate_pages" ? `Rotate ${selectedLabel} ${rotationDegrees}°?` : "Create a new PDF with the proposed page order?"}</strong><span>The original PDF remains unchanged. The new PDF will be reopened and validated locally before download.</span></div><div><button type="button" className="secondary-button" onClick={() => setPendingOperation(null)}>Cancel</button><button type="button" className="primary-button" onClick={() => void executeOperation()} disabled={mutationState === "running"}>{mutationState === "running" ? "Working locally…" : `Confirm ${formatOperationLabel(pendingOperation)}`}</button></div></div> : null}
    {mutationMessage ? <div className="pdf-operation-error" role="alert"><strong>PDF operation stopped.</strong><span>{mutationMessage}</span></div> : null}

    <div className="pdf-page-layout">
      <div className="pdf-selected-page" aria-live="polite">
        <div className="pdf-selected-page-label"><span><Eye size={14} /> Selected page</span>{activePageNumber ? <strong>Page {activePageNumber} of {source.asset.pageCount} selected</strong> : <strong>No page selected</strong>}</div>
        <div className={`pdf-page-preview ${activePage?.previewState === "error" ? "has-error" : ""}`}>
          {previewUrl ? <img src={previewUrl} alt={`Preview of page ${activePageNumber} of ${source.asset.pageCount}`} /> : activePage?.previewState === "loading" || sessionState === "loading" ? <span className="page-loading"><span className="spinner" /> Loading page preview…</span> : <span>{activePage?.previewState === "error" ? "Preview unavailable" : "Select a page to preview it."}</span>}
        </div>
        {pageMessage ? <p className="pdf-page-message" role="status">{pageMessage}</p> : null}
        {activePage ? <PageMetadata page={activePage} /> : null}
      </div>

      <div className="pdf-thumbnail-panel">
        <div className="pdf-thumbnail-heading"><span><FileText size={14} /> Pages</span><small>Thumbnails load when visible</small></div>
        <div className="pdf-thumbnail-strip" role="list" aria-label={`${source.asset.pageCount} PDF pages`}>
          {pageOrder.map((pageNumber) => <LazyPageThumbnail key={pageNumber} pageNumber={pageNumber} page={pages[pageNumber]} session={session} selected={selectedSet.has(pageNumber)} onSelect={() => selectPage(pageNumber)} onToggle={() => togglePageSelection(pageNumber)} onPageData={handlePageData} />)}
        </div>
      </div>
    </div>

    {result ? <PdfMutationResultPanel result={result} onContinue={continueWithResult} onReturn={returnToOriginal} /> : null}
  </section>;
}

function PageMetadata({ page }: { page: PdfPageAsset }) {
  const orientation = page.orientation[0].toUpperCase() + page.orientation.slice(1);
  const paper = page.paperSizeHint === "other" ? `${page.widthPoints} × ${page.heightPoints} pt` : page.paperSizeHint;
  return <dl className="pdf-page-metadata">
    <div><dt>Page</dt><dd>{page.pageNumber}</dd></div>
    <div><dt>Size</dt><dd>{paper}</dd></div>
    <div><dt>Orientation</dt><dd>{orientation}</dd></div>
    <div><dt>Dimensions</dt><dd>{page.widthPoints > 0 ? `${Math.round(page.widthPoints * 25.4 / 72)} × ${Math.round(page.heightPoints * 25.4 / 72)} mm` : "Unavailable"}</dd></div>
    <div><dt>Text</dt><dd><FileText size={13} /> {page.hasText ? `Detected · ${page.textCharacterCount} chars sampled` : "Not detected"}</dd></div>
    <div><dt>Images</dt><dd><ImageIcon size={13} /> {page.hasRasterContent ? "Detected" : "Not detected"}</dd></div>
    <div className="page-type-hint"><dt>Page hint</dt><dd><Check size={13} /> {pageHintLabel(page)}</dd></div>
  </dl>;
}

function LazyPageThumbnail({ pageNumber, page, session, selected, onSelect, onToggle, onPageData }: { pageNumber: number; page?: PdfPageAsset; session: PdfPageSession | null; selected: boolean; onSelect: () => void; onToggle: () => void; onPageData: (pageNumber: number, page: PdfPageAsset) => void }) {
  const [visible, setVisible] = useState(false);
  const [thumbnail, setThumbnail] = useState<PdfPageAsset | null>(page ?? null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || visible) return;
    if (!("IntersectionObserver" in window)) {
      setTimeout(() => setVisible(true), 0);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !session || thumbnail?.thumbnailUrl || thumbnail?.thumbnailState === "loading") return;
    let active = true;
    const placeholder = thumbnail ?? pagePlaceholder(pageNumber, selected);
    queueMicrotask(() => { if (active) setThumbnail({ ...placeholder, thumbnailState: "loading", selected }); });
    void (async () => {
      try {
        const metadata = await session.inspectPage(pageNumber);
        const url = await session.renderPage(pageNumber, { kind: "thumbnail" });
        if (!active) {
          session.revokeObjectUrl(url);
          return;
        }
        const ready = { ...metadata, selected, thumbnailState: "ready" as const, thumbnailUrl: url };
        setThumbnail(ready);
        onPageData(pageNumber, ready);
      } catch {
        if (!active) return;
        const failed = { ...placeholder, thumbnailState: "error" as const, selected, warnings: ["Thumbnail unavailable"] };
        setThumbnail(failed);
        onPageData(pageNumber, failed);
      }
    })();
    return () => {
      active = false;
    };
  }, [onPageData, pageNumber, page, selected, session, thumbnail, visible]);

  return <div ref={containerRef} className={`pdf-thumbnail ${selected ? "selected" : ""}`} role="listitem">
    <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Preview page ${pageNumber}`} className="pdf-thumbnail-button">
      <span className="pdf-thumbnail-image">{thumbnail?.thumbnailUrl ? <img src={thumbnail.thumbnailUrl} alt={`Thumbnail of page ${pageNumber}`} /> : thumbnail?.thumbnailState === "error" ? <span>Preview unavailable</span> : <span>{visible ? "Loading…" : "Scroll to load"}</span>}</span>
      <span className="pdf-thumbnail-number">{pageNumber}</span>
    </button>
    <label className="pdf-thumbnail-select"><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select page ${pageNumber}`} /> Select</label>
  </div>;
}

function PdfMutationResultPanel({ result, onContinue, onReturn }: { result: MutationResultState; onContinue: () => void; onReturn: () => void }) {
  return <section className="pdf-mutation-result" aria-labelledby="pdf-result-title">
    <div className="result-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> 03 · Verified PDF result</p><h3 id="pdf-result-title">Your new PDF is ready.</h3></div><span className="result-status achieved"><Check size={15} /> Validated locally</span></div>
    <div className="pdf-result-grid"><div className="pdf-result-preview"><img src={result.asset.previewUrl ?? ""} alt={`First-page preview of ${result.file.name}`} /></div><div className="pdf-result-details"><strong>{result.file.name}</strong><span>{result.validation.pageCount} pages · {formatBytesSafe(result.validation.outputBytes)}</span><span>{operationSummary(result.validation.operation)}</span><span>Original: {formatBytesSafe(result.validation.inputBytes)} · Result: {formatBytesSafe(result.validation.outputBytes)}</span><span className="local-badge"><Check size={13} /> Processed locally in your browser</span>{result.validation.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div></div>
    <div className="result-actions"><a className="primary-button download-button" href={result.downloadUrl} download={result.file.name}><Download size={17} /> Download PDF</a><button className="secondary-button" type="button" onClick={onContinue}>Continue with this result</button><button className="clear-selection" type="button" onClick={onReturn}>Return to original</button></div>
    <p className="validation-line"><HardDriveIcon /> {result.validation.message} Original PDF remains unchanged.</p>
  </section>;
}

function operationSummary(operation: PdfOperationType): string {
  return operation === "delete_pages" ? "Selected pages deleted" : operation === "extract_pages" ? "Selected pages extracted" : operation === "reorder_pages" ? "Pages reordered" : "Selected pages rotated";
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function formatBytesSafe(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function HardDriveIcon() {
  return <span aria-hidden="true"><Check size={14} /></span>;
}
