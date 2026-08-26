from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).parent


def write(name: str, parts: dict[str, str]) -> None:
    with ZipFile(ROOT / name, "w", ZIP_DEFLATED) as archive:
        for path, content in parts.items():
            archive.writestr(path, content)


CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>'''
CORE = '''<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>SmartDocs Synthetic Fixture</dc:title><dc:creator>SmartDocs Tests</dc:creator></cp:coreProperties>'''

write("phase9-word.docx", {
    "[Content_Types].xml": CONTENT_TYPES,
    "docProps/core.xml": CORE,
    "word/document.xml": '''<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly Brief</w:t></w:r></w:p><w:p><w:r><w:t>SmartDocs keeps this Word inspection browser-local.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Metric</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:hyperlink r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:r><w:t>Local link</w:t></w:r></w:hyperlink><w:sectPr/></w:body></w:document>''',
})

write("phase9-presentation.pptx", {
    "[Content_Types].xml": CONTENT_TYPES,
    "docProps/core.xml": CORE,
    "ppt/presentation.xml": '''<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="1" r:id="rId1"/><p:sldId id="2" r:id="rId2"/></p:sldIdLst></p:presentation>''',
    "ppt/_rels/presentation.xml.rels": '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="slides/slide1.xml" Type="slide"/><Relationship Id="rId2" Target="slides/slide2.xml" Type="slide"/></Relationships>''',
    "ppt/slides/slide1.xml": '''<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:sp><p:txBody><a:p><a:r><a:t>Local Overview</a:t></a:r></a:p><a:p><a:r><a:t>Parsed without rendering claims.</a:t></a:r></a:p></p:txBody></p:sp><p:pic/></p:sld>''',
    "ppt/slides/slide2.xml": '''<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:sp><p:txBody><a:p><a:r><a:t>Next Steps</a:t></a:r></a:p></p:txBody></p:sp><p:graphicFrame><a:graphic><a:graphicData/></a:graphic></p:graphicFrame></p:sld>''',
})

write("phase9-workbook.xlsx", {
    "[Content_Types].xml": CONTENT_TYPES,
    "docProps/core.xml": CORE,
    "xl/workbook.xml": '''<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/><sheet name="Archive" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>''',
    "xl/_rels/workbook.xml.rels": '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/><Relationship Id="rId2" Target="worksheets/sheet2.xml" Type="worksheet"/></Relationships>''',
    "xl/sharedStrings.xml": '''<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Revenue</t></si><si><t>Units</t></si></sst>''',
    "xl/worksheets/sheet1.xml": '''<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:C3"/><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>1200</v></c><c r="B2"><v>4</v></c><c r="C2"><f>A2/B2</f><v>300</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells></worksheet>''',
    "xl/worksheets/sheet2.xml": '''<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A1"/><sheetData><row r="1"><c r="A1"><v>2024</v></c></row></sheetData></worksheet>''',
})
