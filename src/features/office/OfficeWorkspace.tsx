import { Download, FileText, LockKeyhole, Table2, Presentation, TriangleAlert } from "lucide-react";
import type { OfficeAsset } from "../../domain/office/types";
import { formatBytes } from "../../lib/file-utils";

function downloadText(asset: OfficeAsset) {
  const blob = new Blob([asset.analysis.extractedText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${asset.name.replace(/\.[^.]+$/, "")}.txt`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function OfficeWorkspace({ asset }: { asset: OfficeAsset }) {
  const { analysis } = asset;
  const typeLabel = analysis.documentType === "word" ? "Word document" : analysis.documentType === "presentation" ? "PowerPoint presentation" : "Excel workbook";
  return <section className="office-workspace" aria-labelledby="office-workspace-title">
    <div className="office-workspace-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Office document</p><h3 id="office-workspace-title">{typeLabel} intelligence.</h3><p>SmartDocs inspected the OOXML package locally and shows bounded structure, extracted content, and honest capability limits. This is not a claim of Microsoft Office rendering fidelity.</p></div><span className="local-badge"><LockKeyhole size={13} /> Browser-local</span></div>
    <div className="office-overview-grid">
      <div className="office-overview-card"><span>Format</span><strong>.{analysis.format.toUpperCase()}</strong><small>{formatBytes(asset.sizeBytes)} · {analysis.complexity} complexity</small></div>
      <div className="office-overview-card"><span>Structure</span><strong>{analysis.documentType === "word" ? `${analysis.features.paragraphCount ?? 0} paragraphs` : analysis.documentType === "presentation" ? `${analysis.features.slideCount ?? 0} slides` : `${analysis.features.sheetCount ?? 0} sheets`}</strong><small>{analysis.features.tableCount ?? analysis.features.formulaCount ?? 0} structured signals</small></div>
      <div className="office-overview-card"><span>Boundary</span><strong>Parsed locally</strong><small>No Office binary or raw document bytes leave this browser.</small></div>
    </div>
    {analysis.warnings.length > 0 ? <div className="office-warning-panel" role="status"><TriangleAlert size={17} /><div><strong>Preservation and safety warnings</strong><ul>{analysis.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul></div></div> : null}
    <div className="office-capability-grid"><article><div className="office-section-title"><FileText size={16} /><h4>Capabilities</h4></div><ul className="office-capability-list">{analysis.capabilities.map((capability) => <li key={capability.id} className={capability.state}><span>{capability.label}</span><small>{capability.state === "unavailable" ? "Unavailable" : capability.state === "conditional" ? "Conditional" : "Available"} · {capability.reason}</small></li>)}</ul></article><article><div className="office-section-title"><Download size={16} /><h4>Bounded text</h4></div><p className="office-extraction-note">Text is extracted from selected package parts and capped before it reaches the interface or any future AI context.</p><button type="button" className="secondary-button" onClick={() => downloadText(asset)} disabled={!analysis.extractedText}><Download size={14} /> Download bounded TXT</button></article></div>
    {analysis.documentType === "word" ? <OfficeWordPreview asset={asset} /> : null}
    {analysis.documentType === "presentation" ? <OfficeSlidePreview asset={asset} /> : null}
    {analysis.documentType === "spreadsheet" ? <OfficeSheetPreview asset={asset} /> : null}
    <div className="office-boundary-note"><strong>Office → PDF</strong><span>Browser-local PDF conversion is unavailable because SmartDocs has not independently verified a faithful Office renderer. No screenshot-based or fake conversion is offered.</span></div>
  </section>;
}

function OfficeWordPreview({ asset }: { asset: OfficeAsset }) {
  return <article className="office-preview-card"><div className="office-section-title"><FileText size={16} /><h4>Interpreted document structure</h4></div><p>Headings, paragraphs, tables, images, links, and sections are sampled from the DOCX XML. Styling may differ from Microsoft Word.</p><div className="office-text-preview">{asset.analysis.sampledStructure.slice(0, 12).map((block) => <div key={block.id} className={block.kind === "heading" ? "office-heading-block" : "office-text-block"}><span>{block.location}</span><strong>{block.text}</strong></div>)}</div></article>;
}

function OfficeSlidePreview({ asset }: { asset: OfficeAsset }) {
  return <article className="office-preview-card"><div className="office-section-title"><Presentation size={16} /><h4>Structural slide preview</h4></div><p>Slide text and shape/image counts are sampled from PPTX XML. This is structural preview, not faithful PowerPoint rendering.</p><div className="office-slide-grid">{asset.analysis.slides.map((slide) => <div key={slide.slideNumber} className="office-slide-card"><span>Slide {slide.slideNumber}</span><strong>{slide.title ?? "Untitled slide"}</strong><p>{slide.text || "No bounded text detected."}</p><small>{slide.shapeCount} shapes · {slide.imageCount} images · {slide.chartCount} chart signals</small></div>)}</div></article>;
}

function OfficeSheetPreview({ asset }: { asset: OfficeAsset }) {
  return <article className="office-preview-card"><div className="office-section-title"><Table2 size={16} /><h4>Bounded workbook preview</h4></div><p>Showing at most the first 30 rows and 64 cells per row for each parsed sheet. Larger ranges are not loaded into React state automatically.</p><div className="office-sheet-grid">{asset.analysis.sheets.map((sheet) => <div key={sheet.name} className="office-sheet-card"><div><strong>{sheet.name}</strong><span>{sheet.state} · {sheet.range ?? "range unavailable"}</span></div><div className="office-cell-list">{sheet.rows.slice(0, 24).map((row) => <div key={row.address}><code>{row.address}</code><span>{row.value}</span>{row.formula ? <small>{row.formula}</small> : null}</div>)}</div>{sheet.truncated ? <small className="office-truncated">Preview capped at 30 rows.</small> : null}</div>)}</div></article>;
}
