"""Which rows belong to vegetables, dairy and meat, and plants."""

import re

from csa.read import MEJERI, PLANTOR

# A row whose whole text is this means the band is over for the season.
# A product description that merely contains the words does not.
_SEASON_ENDED = re.compile(
    r"^(slut för säsong(en)?|säsong(en)?( är)? slut)\.?$",
    re.IGNORECASE,
)

BANDS = (
    ("Veggies", "before", MEJERI),
    ("Dairy & Meat", MEJERI, PLANTOR),
    ("Plants", PLANTOR, None),
)


def items_in_band(items, start, end):
    """Rows in one band, or None when the band is over for the season."""
    sliced = _slice(items, start, end)
    if any(_is_season_ended(item.name) for item in sliced):
        return None
    return sliced


def _slice(items, start, end):
    start_at = 0
    end_at = len(items)
    if start != "before":
        found = _find(items, start)
        start_at = found if found is not None else len(items)
    if end is not None:
        found = _find(items, end)
        end_at = found if found is not None else len(items)
    return items[start_at:end_at]


def _find(items, name):
    for index, item in enumerate(items):
        if item.name == name:
            return index
    return None


def _is_season_ended(name):
    collapsed = re.sub(r"\s+", " ", name.strip()).lower()
    return _SEASON_ENDED.match(collapsed) is not None
