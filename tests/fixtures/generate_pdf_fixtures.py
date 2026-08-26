from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)
FIXED_DATE = datetime(1969, 12, 31, 19, 0, tzinfo=timezone.utc)


def page_pdf(path: Path, pages: list[str], image_pages: set[int] | None = None, blank_pages: set[int] | None = None, landscape: bool = False, image_path: Path | None = None) -> None:
    pdf = FPDF(orientation="L" if landscape else "P")
    pdf.set_title(path.stem)
    pdf.set_author("SmartDocs fixture generator")
    pdf.creation_date = FIXED_DATE
    image_pages = image_pages or set()
    blank_pages = blank_pages or set()
    for index, text in enumerate(pages):
        pdf.add_page()
        if index in blank_pages:
            continue
        if index in image_pages:
            pdf.image(str(image_path or (ROOT / "scan-page.png")), x=15, y=28, w=180)
            continue
        pdf.set_font("Helvetica", size=16)
        pdf.cell(0, 10, text)
        pdf.ln(12)
        pdf.set_font("Helvetica", size=11)
        pdf.multi_cell(0, 6, "This is a reproducible SmartDocs fixture used for local PDF inspection tests.")
    pdf.output(str(path))


def feature_pdf(path: Path) -> None:
    pdf = FPDF()
    pdf.set_title("SmartDocs feature preservation fixture")
    pdf.set_author("SmartDocs fixture generator")
    pdf.creation_date = FIXED_DATE
    pdf.add_page()
    try:
        pdf.bookmark("Feature preservation fixture", level=0, y=20)
    except AttributeError:
        pass
    pdf.set_font("Helvetica", size=16)
    pdf.cell(0, 10, "Feature preservation fixture")
    pdf.ln(16)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 8, "This link annotation must remain visible to preservation validation.", link="https://example.com/smartdocs-feature-fixture")
    pdf.add_page()
    try:
        pdf.bookmark("Second feature page", level=0, y=20)
    except AttributeError:
        pass
    pdf.set_font("Helvetica", size=16)
    pdf.cell(0, 10, "Second feature page")
    pdf.output(str(path))


def fixture_image(path: Path, color: tuple[int, int, int], label: str, fmt: str) -> None:
    image = Image.new("RGB", (640, 420), color)
    draw = ImageDraw.Draw(image)
    draw.rectangle((18, 18, 622, 402), outline=(25, 35, 75), width=8)
    draw.text((70, 190), label, fill=(25, 35, 75))
    image.save(path, format=fmt, quality=90 if fmt == "JPEG" else None)


scan = Image.new("RGB", (900, 1200), "white")
draw = ImageDraw.Draw(scan)
draw.rectangle((30, 30, 870, 1170), outline=(25, 35, 75), width=8)
for y in range(80, 1120, 42):
    draw.line((90, y, 810, y), fill=(90, 100, 130), width=4)
draw.text((90, 560), "Scanned document fixture", fill=(25, 35, 75))
scan.save(ROOT / "scan-page.png")

heavy_scan = Image.new("RGB", (1800, 2400), "white")
heavy_pixels = heavy_scan.load()
for y in range(2400):
    for x in range(1800):
        base = (x * 17 + y * 31 + (x * y) % 97) % 256
        heavy_pixels[x, y] = (base, (base + 23) % 256, (base + 47) % 256)
heavy_draw = ImageDraw.Draw(heavy_scan)
heavy_draw.rectangle((70, 70, 1730, 2330), outline=(245, 245, 245), width=14)
heavy_draw.text((180, 1120), "Large scanned optimization fixture", fill=(250, 250, 250))
heavy_scan.save(ROOT / "heavy-scan-page.jpg", format="JPEG", quality=96, optimize=False, progressive=False)

page_pdf(ROOT / "text-fixture.pdf", ["SmartDocs text PDF fixture", "Second text page"])
page_pdf(ROOT / "scanned-fixture.pdf", ["", ""], image_pages={0, 1})
page_pdf(ROOT / "large-scanned-fixture.pdf", ["", "", ""], image_pages={0, 1, 2}, image_path=ROOT / "heavy-scan-page.jpg")
page_pdf(ROOT / "image-heavy-fixture.pdf", ["", ""], image_pages={0, 1}, image_path=ROOT / "heavy-scan-page.jpg")
page_pdf(ROOT / "mixed-fixture.pdf", ["SmartDocs mixed PDF fixture", ""], image_pages={1})
page_pdf(ROOT / "multipage-fixture.pdf", [f"Navigation fixture page {index}" for index in range(1, 13)])
page_pdf(ROOT / "sampling-fixture.pdf", [f"Sampling fixture page {index}" for index in range(1, 101)])
page_pdf(ROOT / "blank-pages-fixture.pdf", ["Content page 1", "", "Content page 3", "", ""], blank_pages={1, 3, 4})
page_pdf(ROOT / "landscape-fixture.pdf", ["Landscape orientation fixture"], landscape=True)
page_pdf(ROOT / "merge-a.pdf", ["Merge input A page 1", "Merge input A page 2"])
page_pdf(ROOT / "merge-b.pdf", ["Merge input B page 1"])
page_pdf(ROOT / "merge-c.pdf", ["Merge input C page 1", "Merge input C page 2", "Merge input C page 3"])
feature_pdf(ROOT / "feature-preservation-fixture.pdf")
fixture_image(ROOT / "image-a.png", (225, 235, 250), "Image A", "PNG")
fixture_image(ROOT / "image-b.jpg", (245, 230, 220), "Image B", "JPEG")
fixture_image(ROOT / "image-c.png", (225, 245, 225), "Image C", "PNG")
(ROOT / "invalid-fixture.pdf").write_bytes(b"this is not a PDF")
page_pdf(ROOT / "oversized-fixture.pdf", [f"Oversized fixture page {index}" for index in range(80)])

(ROOT / "fixtures.md").write_text(
    """# PDF fixtures

Generated by `python3 tests/fixtures/generate_pdf_fixtures.py`.

- `text-fixture.pdf`: two text pages.
- `scanned-fixture.pdf`: two image-only pages.
- `large-scanned-fixture.pdf`: three deterministic high-resolution image-only pages for optimization and quality-floor tests.
- `image-heavy-fixture.pdf`: two deterministic high-resolution image-only pages for measurable compression tests.
- `mixed-fixture.pdf`: one text page and one image-only page.
- `multipage-fixture.pdf`: twelve text pages for navigation and thumbnails.
- `sampling-fixture.pdf`: one hundred text pages for bounded sampling behavior.
- `blank-pages-fixture.pdf`: five pages with three deterministic blank candidates.
- `landscape-fixture.pdf`: one landscape page for orientation behavior.
- `merge-a.pdf`, `merge-b.pdf`, `merge-c.pdf`: deterministic merge inputs totaling six pages.
- `feature-preservation-fixture.pdf`: two-page PDF with metadata, hyperlink annotation, and outline signals.
- `image-a.png`, `image-b.jpg`, `image-c.png`: deterministic image-to-PDF inputs.
- `heavy-scan-page.jpg`: deterministic high-resolution scan source used by the optimization fixtures.
- `invalid-fixture.pdf`: deterministic non-PDF bytes.
- `oversized-fixture.pdf`: reproducible multi-page input for size-limit handling.
""",
    encoding="utf-8",
)
