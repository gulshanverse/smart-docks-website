import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, FileText, Image as ImageIcon, RotateCcw } from "lucide-react";
import type { PdfAsset } from "../../domain/files/types";
import { pageHintLabel, type PdfPageAsset } from "../../domain/pdfs/pages";
import { createPdfPageInspectionWorkflow } from "../../domain/workflows/types";
import type { PdfPageSession } from "./page-intelligence";

interface PdfPageWorkspaceProps {
  file: File;
  asset: PdfAsset;
}

type PageMap = Record<number, PdfPageAsset>;

function formatPageType(page: PdfPageAsset): string {
  return pageHintLabel(page);
}

function markSelected(pages: PageMap, selectedPageNumber: number | null): PageMap {
  return Object.fromEntries(Object.entries(pages).filter(([, page]) => page).map(([key, page]) => [Number(key), { ...page, selected: page.pageNumber === selectedPageNumber }])) as PageMap;
}

export function PdfPageWorkspace({ file, asset }: PdfPageWorkspaceProps) {
  const [session, setSession] = useState<PdfPageSession | null>(null);
  const [pages, setPages] = useState<PageMap>({});
  const [selectedPageNumber, setSelectedPageNumber] = useState<number | null>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "error">("loading");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let nextSession: PdfPageSession | null = null;
    setSession(null);
    setPages({});
    setSelectedPageNumber(1);
    setSessionState("loading");
    setPageMessage(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);

    void import("./page-intelligence").then(({ openPdfPageSession }) => openPdfPageSession(file)).then((opened) => {
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
  }, [file]);

  useEffect(() => {
    if (!session || selectedPageNumber === null) return;
    let active = true;
    const pageNumber = selectedPageNumber;
    const workflow = createPdfPageInspectionWorkflow(asset, pageNumber);
    setPageMessage(null);
    setPages((current) => markSelected(current, pageNumber));
    setPages((current) => {
      const page = current[pageNumber];
      return page ? { ...current, [pageNumber]: { ...page, selected: true, previewState: "loading" } } : current;
    });
    if (previewUrlRef.current) {
      session.revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }

    void (async () => {
      try {
        const page = await session.inspectPage(workflow.pageNumber);
        if (!active) return;
        setPages((current) => ({ ...markSelected(current, pageNumber), [pageNumber]: { ...page, selected: true, previewState: "loading" } }));
        const url = await session.renderPage(workflow.pageNumber, { kind: "preview" });
        if (!active) {
          session.revokeObjectUrl(url);
          return;
        }
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPages((current) => ({ ...markSelected(current, pageNumber), [pageNumber]: { ...page, selected: true, previewState: "ready", previewUrl: url } }));
      } catch (error) {
        if (!active) return;
        setPages((current) => ({ ...markSelected(current, pageNumber), [pageNumber]: { ...(current[pageNumber] ?? { pageNumber, widthPoints: 0, heightPoints: 0, orientation: "portrait", paperSizeHint: "other", hasText: false, textCharacterCount: 0, hasRasterContent: false, typeHint: "unknown", previewState: "error", previewUrl: null, thumbnailState: "idle", thumbnailUrl: null, selected: true, warnings: [] }), selected: true, previewState: "error", previewUrl: null, warnings: ["Preview unavailable"] } }));
        setPageMessage(error instanceof Error && error.message === "page-unavailable" ? "That page is unavailable." : "Preview unavailable for this page. You can continue to another page.");
      }
    })();

    return () => {
      active = false;
    };
  }, [asset, selectedPageNumber, session]);

  const handlePageData = useCallback((pageNumber: number, page: PdfPageAsset) => {
    setPages((current) => ({ ...current, [pageNumber]: { ...page, selected: selectedPageNumber === pageNumber } }));
  }, [selectedPageNumber]);

  function selectPage(pageNumber: number) {
    if (pageNumber < 1 || pageNumber > asset.pageCount) return;
    setSelectedPageNumber(pageNumber);
  }

  function clearSelection() {
    if (previewUrlRef.current && session) session.revokeObjectUrl(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setSelectedPageNumber(null);
    setPages((current) => markSelected(current, null));
    setPageMessage("Page selection cleared. Choose a page to inspect it.");
  }

  function handlePageKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectPage(Math.min(asset.pageCount, (selectedPageNumber ?? 1) + 1));
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectPage(Math.max(1, (selectedPageNumber ?? 2) - 1));
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectPage(1);
    }
    if (event.key === "End") {
      event.preventDefault();
      selectPage(asset.pageCount);
    }
  }

  const selectedPage = selectedPageNumber ? pages[selectedPageNumber] : null;
  const canNavigate = sessionState === "ready" && asset.pageCount > 0;

  return <section className="pdf-page-workspace" aria-labelledby="pdf-pages-title">
    <div className="pdf-workspace-heading">
      <div>
        <p className="eyebrow"><span className="eyebrow-line" /> Page intelligence</p>
        <h3 id="pdf-pages-title">Inspect the document <span>page by page.</span></h3>
        <p>Page signals and previews are generated locally only when needed. Page selection is informational in this phase.</p>
      </div>
      <div className="pdf-page-count"><strong>{asset.pageCount}</strong><span>{asset.pageCount === 1 ? "page" : "pages"}</span></div>
    </div>

    <div className="pdf-page-controls" onKeyDown={handlePageKeyDown} tabIndex={0} aria-label="Page navigation. Use arrow keys to move between pages.">
      <button className="secondary-button page-nav-button" type="button" onClick={() => selectPage(Math.max(1, (selectedPageNumber ?? 2) - 1))} disabled={!canNavigate || selectedPageNumber === null || selectedPageNumber <= 1} aria-label="Previous page"><ChevronLeft size={16} /> Previous</button>
      <label className="page-jump">Page <input type="number" min={1} max={asset.pageCount} value={selectedPageNumber ?? ""} onChange={(event) => selectPage(Number(event.target.value))} aria-label={`Page number from 1 to ${asset.pageCount}`} /> of {asset.pageCount}</label>
      <button className="secondary-button page-nav-button" type="button" onClick={() => selectPage(Math.min(asset.pageCount, (selectedPageNumber ?? 0) + 1))} disabled={!canNavigate || selectedPageNumber === null || selectedPageNumber >= asset.pageCount} aria-label="Next page">Next <ChevronRight size={16} /></button>
      <button className="clear-selection" type="button" onClick={clearSelection} disabled={selectedPageNumber === null}><RotateCcw size={14} /> Clear selection</button>
    </div>

    <div className="pdf-page-layout">
      <div className="pdf-selected-page" aria-live="polite">
        <div className="pdf-selected-page-label"><span><Eye size={14} /> Selected page</span>{selectedPageNumber ? <strong>Page {selectedPageNumber} of {asset.pageCount} selected</strong> : <strong>No page selected</strong>}</div>
        <div className={`pdf-page-preview ${selectedPage?.previewState === "error" ? "has-error" : ""}`}>
          {previewUrl ? <img src={previewUrl} alt={`Preview of page ${selectedPageNumber} of ${asset.pageCount}`} /> : selectedPage?.previewState === "loading" || sessionState === "loading" ? <span className="page-loading"><span className="spinner" /> Loading page preview…</span> : <span>{selectedPage?.previewState === "error" ? "Preview unavailable" : "Select a page to preview it."}</span>}
        </div>
        {pageMessage ? <p className="pdf-page-message" role="status">{pageMessage}</p> : null}
        {selectedPage ? <PageMetadata page={selectedPage} /> : null}
      </div>

      <div className="pdf-thumbnail-panel">
        <div className="pdf-thumbnail-heading"><span><FileText size={14} /> Pages</span><small>Thumbnails load when visible</small></div>
        <div className="pdf-thumbnail-strip" role="list" aria-label={`${asset.pageCount} PDF pages`}>
          {Array.from({ length: asset.pageCount }, (_, index) => index + 1).map((pageNumber) => <LazyPageThumbnail key={pageNumber} pageNumber={pageNumber} page={pages[pageNumber]} session={session} selected={selectedPageNumber === pageNumber} onSelect={() => selectPage(pageNumber)} onPageData={handlePageData} />)}
        </div>
      </div>
    </div>
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
    <div className="page-type-hint"><dt>Page hint</dt><dd><Check size={13} /> {formatPageType(page)}</dd></div>
  </dl>;
}

function LazyPageThumbnail({ pageNumber, page, session, selected, onSelect, onPageData }: { pageNumber: number; page?: PdfPageAsset; session: PdfPageSession | null; selected: boolean; onSelect: () => void; onPageData: (pageNumber: number, page: PdfPageAsset) => void }) {
  const [visible, setVisible] = useState(false);
  const [thumbnail, setThumbnail] = useState<PdfPageAsset | null>(page ?? null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || visible) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
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
    if (!visible || !session || thumbnail?.thumbnailUrl) return;
    let active = true;
    setThumbnail({ ...(thumbnail ?? { pageNumber, widthPoints: 0, heightPoints: 0, orientation: "portrait", paperSizeHint: "other", hasText: false, textCharacterCount: 0, hasRasterContent: false, typeHint: "unknown", previewState: "idle", previewUrl: null, thumbnailState: "loading", thumbnailUrl: null, selected, warnings: [] }), thumbnailState: "loading", selected });
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
        const failed = { ...(thumbnail ?? { pageNumber, widthPoints: 0, heightPoints: 0, orientation: "portrait" as const, paperSizeHint: "other" as const, hasText: false, textCharacterCount: 0, hasRasterContent: false, typeHint: "unknown" as const, previewState: "idle" as const, previewUrl: null, thumbnailState: "error" as const, thumbnailUrl: null, selected, warnings: [] }), thumbnailState: "error" as const, selected, warnings: ["Thumbnail unavailable"] };
        setThumbnail(failed);
        onPageData(pageNumber, failed);
      }
    })();
    return () => {
      active = false;
    };
  }, [onPageData, pageNumber, selected, session, visible]);

  return <div ref={containerRef} className={`pdf-thumbnail ${selected ? "selected" : ""}`} role="listitem">
    <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Select page ${pageNumber}`} className="pdf-thumbnail-button">
      <span className="pdf-thumbnail-image">{thumbnail?.thumbnailUrl ? <img src={thumbnail.thumbnailUrl} alt={`Thumbnail of page ${pageNumber}`} /> : thumbnail?.thumbnailState === "error" ? <span>Preview unavailable</span> : <span>{visible ? "Loading…" : "Scroll to load"}</span>}</span>
      <span className="pdf-thumbnail-number">{pageNumber}</span>
    </button>
  </div>;
}
