"""Export the order list from Google Sheets to an xlsx file.

A native Google Sheet cannot be downloaded. This asks Sheets for the xlsx
export. With no argument it exports the farm's order list. Pass a
docs.google.com URL or a bare spreadsheet id to export a different sheet.

    python3 pull.py
    python3 pull.py SHEET_URL_OR_ID
    python3 pull.py SHEET_URL_OR_ID DEV_CSA_lista.xlsx
"""

import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

DEFAULT_SHEET = ( ""
)
DEFAULT_OUT = "DEV_CSA_lista.xlsx"
_ID_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")


def main(argv):
    address = argv[1] if len(argv) > 1 else DEFAULT_SHEET
    destination = Path(argv[2] if len(argv) > 2 else DEFAULT_OUT)
    try:
        url = export_url(address)
    except ValueError as error:
        raise SystemExit(str(error))
    data = fetch_xlsx(url)
    destination.write_bytes(data)
    print(destination, flush=True)
    return 0


def export_url(address):
    return f"https://docs.google.com/spreadsheets/d/{sheet_id(address)}/export?format=xlsx"


def sheet_id(address):
    text = address.strip()
    marker = "/spreadsheets/d/"
    if marker in text:
        sheet = text.split(marker, 1)[1]
        sheet = sheet.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    elif "://" in text or "/" in text:
        raise ValueError("Pass a docs.google.com spreadsheet URL or a bare spreadsheet id")
    else:
        sheet = text
    if not sheet or any(character not in _ID_CHARS for character in sheet):
        raise ValueError("Pass a docs.google.com spreadsheet URL or a bare spreadsheet id")
    return sheet


def fetch_xlsx(url):
    try:
        with urlopen(url, timeout=60) as response:
            data = response.read()
    except (URLError, TimeoutError, OSError) as error:
        raise SystemExit(f"Could not export the sheet: {error}")
    if not data.startswith(b"PK"):
        raise SystemExit(
            "Google did not return a spreadsheet export. "
            "The sheet has to be shared so this machine can open it."
        )
    return data


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
