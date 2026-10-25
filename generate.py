"""Generate this week's pages from an order-list export."""

import sys
from datetime import datetime
from pathlib import Path

from csa.html import render_html, render_index
from csa.pages import family_pages, group_pages
from csa.picking import picking_document
from csa.read import read_week


def main(argv):
    source = Path(argv[1] if len(argv) > 1 else "DEV_CSA_lista.xlsx")
    out = Path(argv[2] if len(argv) > 2 else "out")
    week = read_week(source)
    out.mkdir(parents=True, exist_ok=True)

    title, sections = picking_document(week)
    _write(out / "picking.html", render_html(title, sections))

    families_by_dir = {}
    for path, page_title, intro, page_sections in family_pages(week):
        _write(out / path, render_html(page_title, page_sections, intro))
        directory = path.split("/")[1]
        label = page_title.split(" — ", 1)[-1]
        families_by_dir.setdefault(directory, []).append((label, path))

    index_groups = []
    for path, page_title, intro, page_sections in group_pages(week):
        _write(out / path, render_html(page_title, page_sections, intro))
        directory = path.split("/")[1].replace(".html", "")
        index_groups.append((page_title, path, families_by_dir.get(directory, [])))
    generated = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    _write(out / "index.html", render_index("This week", index_groups, generated))
    print(out / "index.html")


def _write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv)
