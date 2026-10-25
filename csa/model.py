"""The order list, independent of spreadsheet columns."""

from dataclasses import dataclass


def trim_group_name(name):
    """Same cleaning as TrimGroupName in the sheet script."""
    return str(name).replace("grupp ", "").replace("Grupp ", "").replace('"', "")


@dataclass
class Item:
    """One row of a pickup-group tab, from column A downward."""

    name: str
    total: object
    has_total_formula: bool
    amounts: tuple
    notes: tuple


@dataclass
class Group:
    """One pickup-group tab."""

    name: str
    families: tuple
    items: tuple
    note: str = ""

    @property
    def clean_name(self):
        return trim_group_name(self.name)

    @property
    def heading(self):
        return "Group " + self.clean_name.strip()


@dataclass
class Week:
    """Every pickup group, in sheet order."""

    groups: tuple
