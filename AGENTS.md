# Marcello's Farm CSA

Context for work in this repo. The public site is [marcellosfarm.se](https://marcellosfarm.se/). A lot of it is outdated, and a lot of it is still roughly right. Ignore prices and sign-up formalities there.

Marcello's Farm is a biodynamic, KRAV-certified farm at Ugerupsdal, outside Kristianstad. It grows field vegetables and keeps cattle. Marcel van Sitteren (Marcello) and Inge Schwagermann started it. Members share the harvest through a weekly order, not a shop transaction.

The community is part of the farm. People are encouraged, and expected, to take part. Inge and her workers are "the farm" in the weekly work below: they set what can be picked, reconcile amounts, lock the sheet, pick, and make the lists.

A few volunteers maintain and improve the order list, picking list, and family sheets. This repo is an evolution of that system. Agents are considered an entity in the community, recruited for some of the knarly coding tasks and systems design collaboration.

## Weekly flow

Each week, the farm sets what is available for picking in the order list, a shared google sheets document. That is vegetables, and also meat and yoghurt, sometimes small plants, and sometimes a few other seasonal items.

Members then write what they want into that same list. The farm consolidates those requests against the volumes on hand, and may change a requested amount to match what is actually available.

At a set time (Monday night, for example), Inge locks the ordering sheet so the community can no longer edit it. From the locked sheet they make a **picking list**, pick the food, then make **family lists** and **totals* used for packing the delivery trucks. The food is delivered to drop-off points in towns around Skåne.

## How the sheets are organized

People are grouped by pick-up point, then by family.

In the order list, each pick-up point is a tab. Each family has a pair of columns on that tab: the amount, and a note beside it. Rows, on every sheet and tab, are the items available to order that week. Column A is the item. Column B is that group's total.

The rows are split by two labels in column A: `Mejeri` and `Små Plantor`. Above `Mejeri` is vegetables. Between the labels is dairy, meat, and yoghurt. Below `Små Plantor` is small plants. A band whose only text is "slut för säsongen" is skipped, so a week can have fewer printouts than three bands. Groups are not always lined up row for row. Inge edits tabs separately.

With the vegetable drop-off come printouts of the actual amounts for each family. There are currently two printouts per family: one for vegetables, one for meat and yoghurt.

## Where the code is

A local export of the live Google Sheet, not the sheet itself, is currently used by the python implementation. The Apps Script snapshot that runs on that sheet is in `current_gscode/`. The menu is `onOpen` in `main.gs`. The Python generator that reads an export and writes HTML lives in `generate.py` and `csa/`.

The script in `current_gscode/` is the V2 code only. The menu in `main.gs` calls those functions. The copy, formatting, and picking-list labels still say `[V2]`. The family-sheet labels do not.

`utils_v2.gs` copies column A and B from the first tab onto the other tabs (`copyValuesAndFormatting_v2`), and leaves each family's columns alone. `resetSheetFormatting_v2` puts a consistent layout back on every tab: header colors, alternating row colors, borders between families, fonts, alignment, column widths, and frozen rows. It does not change values or formulas. `TrimGroupName` lives in this file too.

`family_sheets_v2.gs` and `picking_list_v2.gs` build the printouts and the picking lists.

V2 family sheets are written as three files, one per delivery round:

- Maria, Annica, Linnéa, Mygel, Mattias
- Frode&Åsa, Irene, Sandra
- Gården

This is for performance reasons - and performance scaling is exactly one of the risks this project adresses. We should not port that heuristic.

Inside each file the order is group, then category, then a totals page and the family pages. Gården follows the same order as the other groups.

The V2 picking list is a separate spreadsheet per band. It matches items by name across tabs, because the rows differ. Each pickup group becomes a column, with a total next to the item. Long note rows with no numbers are dropped.

## What we are porting

The order list stays a Google Sheet. Copying items across tabs and resetting formatting stay Apps Script on that sheet. Those tools fit there.

What we port is the step after the sheet is locked: read the orders and generate the picking list, the family pages, and the packing totals. The current scripts keep printing during the transition, so paper and screen can both exist. The new work is a screen the farm can use instead of printing and clamping around a hundred pages a week. Printed pages, while they last, still take the last edit with a pen. How that should be handled in the screen-based solution is currently an unresolved question, since tracking changes to orders made by the farm will be desired.

Three stages:

1. Read-only raw HTML, generated from the order-list export. Refresh means generating again, not updating. This pass is done.
2. Make those pages usable on a phone.
3. Host them so a member can open their own page. The first step, for testers, is `serve.py`: it serves the `out/` folder on port 8080. The server only hands out files. Each generated page asks for the password `tomat` before it shows the lists. The check is in the page, so a host that can only serve files is enough. One correct entry opens the other pages in that browser. Anyone who can read the file can read the password. A public test points a Cloudflare quick tunnel at that server. The address lasts while this machine, `serve.py`, and the tunnel are running, and it changes each time the tunnel starts. The pages stay on this machine. They are not copied into the git repo.

Run `generate.py` with the export and an output directory (`out/` by default). It writes:

- `index.html`, groups first, then the families in each group. Under the title is the date and time the pages were generated
- `picking.html`, one table per band, a column per group
- `groups/group_<name>.html`, the packing totals for one delivery spot, bands as tables on that page
- `families/group_<name>/<family>.html`, one page per family, including families who have not ordered yet

Headings say `Group Annica`, and the same for the other groups. On a family page and on a totals page the bands are separate tables. A row is left off a family page when that family wrote neither an amount nor a note. A family with no such rows still gets the band tables, with every item listed and the amount and note left blank. A band whose whole text is "slut för säsongen" is left out.

`csa/read.py` builds the model. `csa/picking.py` and `csa/pages.py` decide the rows. `csa/html.py` is the only place that writes tags. Structural tests are in `tests/test_structure.py` and use a tiny workbook, not the weekly export.

Output files from the current scripts come later, as a check. Maintenance time is scarce, so the port stays small. One pinned library (`openpyxl` in `requirements.txt`), a Python program, and plain HTML with no framework or build step. The weekly vegetables can change freely. What the code may rely on is the sheet's structure: a tab per pickup group, an amount and a note per family, and the band labels `Mejeri` and `Små Plantor`. Hosting, when it comes, is a place to put those files.

Showing that an amount changed after the lock (ordered 2, got 1) matters to Inge, and it depends on how the farm writes that change. Leave the notation until Inge has been asked. Until then, a page shows the one number that is in the sheet.

