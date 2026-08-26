from pathlib import Path
from fpdf import FPDF

OUT = Path(__file__).parent

FIXTURES = {
    "phase7-redaction-fixture.pdf": [
        [
            "Synthetic Redaction Review",
            "Name: Example Person",
            "Email: redaction@example.test",
            "Phone: 000-000-0000",
            "Review note: these values are fictional test data.",
        ],
        [
            "Synthetic Second Page",
            "The second page remains unchanged by a page-one-only redaction.",
            "No real personal data is included in this fixture.",
        ],
    ],
}

for filename, pages in FIXTURES.items():
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    for lines in pages:
        pdf.add_page()
        pdf.set_font("Helvetica", size=12)
        for line in lines:
            pdf.cell(0, 9, line)
            pdf.ln(9)
    pdf.output(str(OUT / filename))

print(f"generated {len(FIXTURES)} Phase 7 synthetic fixtures")
