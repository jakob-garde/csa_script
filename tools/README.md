# CSA script tools

Private helpers for the Marcello's Farm order list. The public `csa_script` repo does not contain these.

Pull the order list from Google Sheets. Writes `DEV_CSA_lista.xlsx`. Pass a URL or spreadsheet id to export a different sheet.

```
python3 pull.py
```

Daily check, on the machine that serves the pages. The first run records the public address. Later runs print only when that address changes or the pages stop answering. After a real change, `python3 check.py --accept` stores the new address.

```
15 7 * * * python3 /path/to/csa_script_tools/check.py
```
