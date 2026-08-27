import { ArrowRight, FileImage } from "lucide-react";
import { toolRegistry } from "../../domain/tools/registry";

interface ToolBrowserProps {
  onSelectGoal: (goal: string) => void;
}

type ToolCard = readonly [id: string, name: string, description: string, goal: string];
type ToolGroup = { id: string; label: string; description: string; items: readonly ToolCard[] };

const groups: readonly ToolGroup[] = [
  { id: "pdf", label: "PDF", description: "Organize, optimize, convert, and secure PDFs.", items: [["pdf.optimize.target_size", "Compress PDF", "Reduce file size while preserving quality.", "Compress this PDF under 1 MB"], ["pdf.merge", "Merge PDFs", "Combine files in a controlled order.", "Merge these PDFs"], ["pdf.split", "Split PDF", "Separate pages into new files.", "Split this PDF into separate files"], ["pdf.extract.pages", "Extract pages", "Create a PDF from selected pages.", "Extract pages 2–4 from this PDF"], ["pdf.ocr.create_searchable", "Make searchable", "Create a searchable PDF from a scan.", "Make this PDF searchable"], ["pdf.convert.pages_to_jpeg", "Convert PDF", "Turn selected pages into images.", "Convert this PDF to JPG"]] },
  { id: "images", label: "Images", description: "Compress images or create PDFs from them.", items: [["image.compress.target_size", "Compress image", "Reach a target size with measured output.", "Make this image under 100KB"], ["image.convert.to_pdf", "Create PDF", "Turn an image into a PDF.", "Create a PDF from this image"], ["image.convert.jpeg_to_png", "Convert image", "Convert supported image formats locally.", "Convert this image to PNG"]] },
  { id: "documents", label: "Documents", description: "Inspect Office files and extract bounded text.", items: [["office.inspect.word", "Inspect document", "Review a Word document safely.", "Inspect this document"], ["office.inspect.presentation", "Inspect presentation", "Review a PowerPoint file safely.", "Inspect this presentation"], ["office.inspect.spreadsheet", "Inspect workbook", "Review an Excel workbook safely.", "Inspect this workbook"], ["office.extract.text", "Extract text", "Export bounded text from an Office file.", "Extract all text from this Office document"]] },
  { id: "intelligence", label: "Intelligence", description: "Understand structure and meaning with bounded evidence.", items: [["pdf.document.classify", "Classify document", "Detect likely document type locally.", "Classify this document"], ["document.extract", "Extract information", "Turn bounded evidence into a reviewable record.", "Extract information from this document"], ["pdf.text.search", "Search document", "Find text and navigate to source pages.", "Find all mentions of a phrase"]] },
  { id: "workflows", label: "Workflows", description: "Continue with collections, projects, and automation.", items: [["project.open", "Projects", "Save and reopen work on this device.", "Open my projects"], ["automation.session.create", "Smart workflow", "Plan multi-step document work.", "Create a smart workflow for this document"], ["project.workflow.save", "Save workflow", "Keep a workflow available locally.", "Save this workflow to a project"]] },
];

export function ToolBrowser({ onSelectGoal }: ToolBrowserProps) {
  const registryIds = new Set<string>(toolRegistry.map((tool) => tool.id));
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter(([id]) => registryIds.has(id)) })).filter((group) => group.items.length > 0);
  const count = visibleGroups.reduce((total, group) => total + group.items.length, 0);
  return <section id="tools" className="tool-browser" aria-labelledby="tools-title">
    <div className="tool-browser-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Explore capabilities</p><h2 id="tools-title">All tools, clearly organized.</h2><p>Choose a supported capability directly, or start with the simple task flow above. Every tool here maps to an existing SmartDocs engine.</p></div><span className="tool-count">{count} supported actions</span></div>
    <nav className="tool-filter-row" aria-label="Tool categories">{visibleGroups.map((group) => <a key={group.id} href={`#tool-group-${group.id}`}>{group.label}</a>)}</nav>
    <div className="tool-groups">{visibleGroups.map((group) => <section className="tool-group" id={`tool-group-${group.id}`} key={group.id}><div className="tool-group-heading"><h3>{group.label}</h3><p>{group.description}</p></div><div className="tool-card-grid">{group.items.map(([id, name, description, goal]) => <button className="tool-card" type="button" key={id} onClick={() => { onSelectGoal(goal); document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span className="tool-card-icon"><FileImage size={17} /></span><span className="tool-card-copy"><strong>{name}</strong><small>{description}</small></span><ArrowRight size={16} /></button>)}</div></section>)}</div>
  </section>;
}
