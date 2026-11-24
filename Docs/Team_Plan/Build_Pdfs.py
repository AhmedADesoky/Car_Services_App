"""Build_Pdfs.py - renders Docs/Team_Plan/Sources/*.md into styled PDFs with headless Microsoft Edge.

Usage (from the repo root):
    python Docs/Team_Plan/Build_Pdfs.py            # all documents
    python Docs/Team_Plan/Build_Pdfs.py Fares       # only sources whose name contains "Fares"
Needs: pip install markdown ; Microsoft Edge (installed on Windows by default).
"""
from __future__ import annotations

import html
import re
import subprocess
import sys
from pathlib import Path

import markdown

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "Sources"
OUT = HERE
BUILD = HERE / ".Build"
EDGE_CANDIDATES = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]

CSS = """
@page { size: A4; margin: 16mm 14mm 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif; color: #0B1B2E; font-size: 10.2pt; line-height: 1.5; }
.cover { background: #0B2545; color: #fff; border-radius: 14px; padding: 22px 26px; margin-bottom: 18px; }
.cover h1 { color: #fff; border: none; margin: 0 0 6px 0; font-size: 22pt; }
.cover .meta { color: #C9D6E5; font-size: 10pt; }
.cover code { background: rgba(255,255,255,0.16); color: #FFFFFF; }
.cover .badge { display: inline-block; background: #F2B544; color: #0B2545; font-weight: 800; border-radius: 99px; padding: 2px 10px; font-size: 9pt; margin-top: 8px; }
h1 { font-size: 17pt; color: #0B2545; border-bottom: 3px solid #0E8A86; padding-bottom: 4px; margin-top: 22px; page-break-after: avoid; }
h2 { font-size: 13.5pt; color: #0B2545; margin-top: 18px; border-left: 5px solid #0E8A86; padding-left: 8px; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #08534F; margin-top: 14px; page-break-after: avoid; }
h4 { font-size: 10.5pt; color: #3E5368; margin: 10px 0 4px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #0B2545; color: #fff; text-align: left; padding: 5px 6px; }
td { border-bottom: 1px solid #DCE3EA; padding: 4px 6px; vertical-align: top; }
tr:nth-child(even) td { background: #F3F6FA; }
code { font-family: Consolas, 'Cascadia Mono', monospace; font-size: 8.8pt; background: #EEF2F7; padding: 0 3px; border-radius: 3px; }
pre { background: #0F1E33; color: #E6EDF5; padding: 9px 11px; border-radius: 8px; font-size: 8.4pt; line-height: 1.4; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
pre code { background: none; color: inherit; padding: 0; }
blockquote { margin: 10px 0; padding: 8px 12px; background: #FFF6E6; border-left: 5px solid #F2B544; border-radius: 6px; }
blockquote.sec, .sec { background: #FDECEC; border-left-color: #C0392B; }
ul, ol { margin: 4px 0 8px 18px; padding: 0; }
li { margin: 2px 0; }
.done { color: #0E8A86; font-weight: 700; }
.part { color: #B4561B; font-weight: 700; }
.todo { color: #7A8796; font-weight: 700; }
.pb { page-break-before: always; }
.footer-note { margin-top: 24px; font-size: 8.5pt; color: #5A6B7D; border-top: 1px solid #DCE3EA; padding-top: 6px; }
"""

TEMPLATE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<style>{css}</style></head><body>{body}
<div class="footer-note">Car_Services_App · Vehicle Service SaaS · generated from Docs/Team_Plan/Sources/{source} — edit the Markdown and rebuild.</div>
</body></html>"""


def find_edge() -> Path:
    for candidate in EDGE_CANDIDATES:
        if candidate.exists():
            return candidate
    sys.exit("Microsoft Edge not found - install it or print the .html files from any browser.")


def render(md_file: Path, edge: Path) -> Path:
    text = md_file.read_text(encoding="utf-8")
    # Status markers: [DONE] [PARTIAL] [TODO]
    text = text.replace("[DONE]", '<span class="done">DONE</span>')
    text = text.replace("[PARTIAL]", '<span class="part">PARTIAL</span>')
    text = text.replace("[TODO]", '<span class="todo">NOT STARTED</span>')
    body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists", "attr_list", "md_in_html"])
    title_match = re.search(r"<h1[^>]*>(.*?)</h1>", body)
    title = html.unescape(re.sub("<[^>]+>", "", title_match.group(1))) if title_match else md_file.stem
    BUILD.mkdir(exist_ok=True)
    html_file = BUILD / f"{md_file.stem}.html"
    html_file.write_text(TEMPLATE.format(title=title, css=CSS, body=body, source=md_file.name), encoding="utf-8")
    pdf_file = OUT / f"{md_file.stem}.pdf"
    subprocess.run(
        [str(edge), "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--no-first-run",
         f"--user-data-dir={BUILD / 'Edge_Profile'}", f"--print-to-pdf={pdf_file}", html_file.as_uri()],
        check=True, capture_output=True, timeout=180,
    )
    return pdf_file


def main() -> None:
    edge = find_edge()
    only = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    for md_file in sorted(SOURCES.glob("*.md")):
        if only and only not in md_file.stem.lower():
            continue
        pdf = render(md_file, edge)
        print(f"{pdf.name}  ({pdf.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
