"""docx → markdown 转换（保留表格），供 RAG 知识库使用。
用法: python docx2md.py <input.docx> <output.md>
"""
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
}


def para_text(p: ET.Element) -> str:
    parts = []
    for node in p.iter():
        tag = node.tag.split('}')[-1]
        if tag == 't':
            parts.append(node.text or '')
        elif tag == 'tab':
            parts.append(' ')
    return ''.join(parts).strip()


def cell_text(tc: ET.Element) -> str:
    return ' '.join(para_text(p) for p in tc.findall('w:p', NS)).strip()


def convert(xml_bytes: bytes) -> str:
    root = ET.fromstring(xml_bytes)
    body = root.find('w:body', NS)
    out: list[str] = []

    for child in body:
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            text = para_text(child)
            if not text:
                continue
            style = child.find('w:pPr/w:pStyle', NS)
            style_val = style.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val') if style is not None else None
            if style_val and style_val.startswith('Heading1'):
                out.append(f"\n# {text}\n")
            elif style_val and style_val.startswith('Heading2'):
                out.append(f"\n## {text}\n")
            elif style_val and style_val.startswith('Heading3'):
                out.append(f"\n### {text}\n")
            else:
                out.append(text)
        elif tag == 'tbl':
            rows = child.findall('w:tr', NS)
            md_rows = []
            for tr in rows:
                cells = [cell_text(tc).replace('|', '\\|') for tc in tr.findall('w:tc', NS)]
                md_rows.append(cells)
            if md_rows:
                width = max(len(r) for r in md_rows)
                header = md_rows[0]
                if len(header) < width:
                    header = header + [''] * (width - len(header))
                out.append('\n| ' + ' | '.join(header) + ' |')
                out.append('|' + '---|' * width)
                for r in md_rows[1:]:
                    if len(r) < width:
                        r = r + [''] * (width - len(r))
                    out.append('| ' + ' | '.join(r) + ' |')
                out.append('')
    return '\n'.join(out)


def main():
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    with zipfile.ZipFile(src) as z:
        xml = z.read('word/document.xml')
    md = convert(xml)
    dst.write_text(md, encoding='utf-8')
    print(f"OK: {len(md)} chars -> {dst}")


if __name__ == '__main__':
    main()
