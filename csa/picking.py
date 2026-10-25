"""Turn a Week into picking-list rows."""

from csa.bands import BANDS, items_in_band
from csa.show import show

_NOTICE_LENGTH = 80


def picking_tables(week):
    """One table per band. Each table is a list of rows of display strings.

    The first row is the header: blank, Total, then one column per group.
    """
    tables = []
    for label, start, end in BANDS:
        rows = _band_rows(week, start, end)
        if rows is None:
            continue
        header = ["", "Total"] + [group.heading for group in week.groups]
        body = [_product_row(name, per_group) for name, per_group in rows]
        tables.append((label, [header] + body))
    return tables


def picking_document(week):
    """The page as data: a title, then one section per band."""
    return "Picking list", picking_tables(week)


def _band_rows(week, start, end):
    """Products in this band, in first-seen order, with each group's total.

    Returns None when the band is marked over for the season.
    """
    collected = []
    for group in week.groups:
        items = items_in_band(group.items, start, end)
        collected.append(items or ())

    order = []
    seen = set()
    totals = []
    formulas = []
    for items in collected:
        by_name_total = {}
        by_name_formula = {}
        for item in items:
            if item.name == "":
                continue
            if item.name not in by_name_total:
                if item.name not in seen:
                    order.append(item.name)
                    seen.add(item.name)
            by_name_total[item.name] = item.total
            by_name_formula[item.name] = by_name_formula.get(item.name, False) or item.has_total_formula
        totals.append(by_name_total)
        formulas.append(by_name_formula)

    rows = []
    for name in order:
        per_group = []
        has_value = False
        has_formula = False
        for index in range(len(collected)):
            value = totals[index].get(name)
            per_group.append(value)
            if value is not None and value != "":
                has_value = True
            if formulas[index].get(name):
                has_formula = True
        if not has_value and not has_formula and len(name) > _NOTICE_LENGTH:
            continue
        rows.append((name, per_group))
    if not rows:
        return None
    return rows


def _product_row(name, per_group):
    numbers = [_number(value) for value in per_group]
    total = sum(numbers)
    shown = [show(value) for value in per_group]
    return [name, "" if total <= 0 else show(total)] + shown


def _number(value):
    if value is None or value == "":
        return 0
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0

