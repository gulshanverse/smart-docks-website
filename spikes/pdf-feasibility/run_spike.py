from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from fpdf import FPDF
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "mixed-fixture.pdf"
PNG_PATH = ROOT / "image-page.png"
TEXT_PATH = ROOT / "extracted.txt"
RENDER_PATH = ROOT / "rendered-page.png"
RESULT_PATH = ROOT / "result.json"


def run(command: list[str], output: Path | None = None) -> str:
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    if output is not None:
        output.write_text(completed.stdout, encoding="utf-8")
    return completed.stdout


def create_fixture() -> None:
    image = Image.new("RGB", (640, 420), (34, 46, 92))
    draw = ImageDraw.Draw(image)
    for x in range(640):
        draw.line((x, 0, x, 420), fill=(34 + x // 8, 46 + x // 12, 92 + x // 10))
    draw.rectangle((90, 90, 550, 330), outline=(230, 235, 255), width=5)
    draw.text((130, 195), "SmartDocs PDF spike", fill=(245, 246, 242))
    image.save(PNG_PATH)

    pdf = FPDF()
    pdf.set_title("SmartDocs PDF architecture spike")
    pdf.set_author("SmartDocs")
    pdf.add_page()
    pdf.set_font("Helvetica", size=16)
    pdf.cell(0, 10, "SmartDocs PDF architecture spike")
    pdf.ln(12)
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, "This page contains extractable text. The second page is image-only so the fixture can exercise a mixed-document inspection path.")
    pdf.add_page()
    pdf.image(str(PNG_PATH), x=20, y=40, w=170)
    pdf.output(str(PDF_PATH))


def main() -> None:
    create_fixture()
    pdfinfo = run(["pdfinfo", str(PDF_PATH)])
    extracted = run(["pdftotext", str(PDF_PATH), "-"])
    TEXT_PATH.write_text(extracted, encoding="utf-8")
    run(["pdftoppm", "-f", "1", "-l", "1", "-png", "-singlefile", str(PDF_PATH), str(ROOT / "rendered-page")])

    pages_match = re.search(r"^Pages:\s+(\d+)", pdfinfo, flags=re.MULTILINE)
    version_match = re.search(r"^PDF version:\s+(.+)$", pdfinfo, flags=re.MULTILINE)
    result = {
        "file": PDF_PATH.name,
        "file_size_bytes": PDF_PATH.stat().st_size,
        "pdf_version": version_match.group(1).strip() if version_match else None,
        "page_count": int(pages_match.group(1)) if pages_match else None,
        "text_presence": bool(extracted.strip()),
        "text_extractable": "SmartDocs PDF architecture spike" in extracted,
        "classification_hint": "mixed" if "SmartDocs PDF architecture spike" in extracted and PDF_PATH.stat().st_size > 0 else "unknown",
        "rendered_first_page": RENDER_PATH.name,
        "tools": ["pdfinfo", "pdftotext", "pdftoppm"],
    }
    RESULT_PATH.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
