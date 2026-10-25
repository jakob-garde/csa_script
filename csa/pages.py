"""Family pages and the packing totals for each pickup group."""

import re

from csa.bands import BANDS, items_in_band
from csa.picking import picking_tables
from csa.show import show


def family_pages(week):
    """One page per family, including families who have not ordered yet.

    Yields (relative path, title, intro, sections). Bands are sections of
    the same page. A band over for the season is left out, and so is a row
    where this family wrote neither an amount nor a note. A family with no
    such rows still gets those tables, with every item listed and the
    amount and note left blank.
    """
    for group in week.groups:
        used = set()
        for index, name in enumerate(group.families):
            sections = _family_sections(group, index)
            filename = _unique(_slug(name), used)
            path = f"families/{_group_dirname(group)}/{filename}.html"
            title = f"{group.heading} — {_one_line(name)}"
            yield path, title, group.note, sections


def group_pages(week):
    """One packing page per pickup group, bands as tables on that page.

    The rows are the picking list, narrowed to this group's column.
    """
    tables = picking_tables(week)
    for index, group in enumerate(week.groups):
        column = index + 2
        sections = []
        for label, rows in tables:
            sliced = [[row[0], row[column]] for row in rows]
            if sliced:
                sliced[0] = ["", "Total"]
            sections.append((label, sliced))
        path = f"groups/{_group_dirname(group)}.html"
        yield path, group.heading, group.note, sections


def _family_sections(group, index):
    ordered = []
    blank = []
    for label, start, end in BANDS:
        items = items_in_band(group.items, start, end)
        if not items:
            continue
        header = ["", "Antal", "text"]
        ordered_rows = [header]
        blank_rows = [header]
        for item in items:
            if item.name == "":
                continue
            amount = item.amounts[index] if index < len(item.amounts) else None
            note = item.notes[index] if index < len(item.notes) else None
            shown = [item.name, show(amount), show(note)]
            if item.name != start:
                blank_rows.append(shown)
            if shown[1] == "" and shown[2] == "":
                continue
            ordered_rows.append(shown)
        if len(ordered_rows) > 1:
            ordered.append((label, ordered_rows))
        if len(blank_rows) > 1:
            blank.append((label, blank_rows))
    return ordered or blank


def _group_dirname(group):
    return "group_" + _slug(group.clean_name)


def _one_line(name):
    return re.sub(r"\s+", " ", str(name).replace("\n", " ")).strip()


def _slug(text):
    text = _one_line(text).lower().replace("&", "-")
    text = re.sub(r"[^\w]+", "-", text, flags=re.UNICODE)
    return text.strip("-")


def _unique(slug, used):
    candidate = slug or "family"
    if candidate not in used:
        used.add(candidate)
        return candidate
    number = 2
    while f"{candidate}-{number}" in used:
        number += 1
    chosen = f"{candidate}-{number}"
    used.add(chosen)
    return chosen
