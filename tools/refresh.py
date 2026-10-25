"""Pull the order list and regenerate the pages.

Writes a fresh out/ directory for the sibling csa_script checkout. The server
keeps running; it reads the new files on the next request.

    python3 refresh.py
    python3 refresh.py /path/to/csa_script
"""

import shutil
import subprocess
import sys
from pathlib import Path

from pull import DEFAULT_SHEET, main as pull_main


def main(argv):
    csa = Path(argv[1] if len(argv) > 1 else _default_csa())
    regenerate(csa, _pull, _generate)
    print(csa / "out" / "index.html", flush=True)
    return 0


def regenerate(csa, pull, generate):
    staging = csa / "out.next"
    live = csa / "out"
    previous = csa / "out.prev"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    source = csa / "DEV_CSA_lista.xlsx"
    try:
        pull(source)
        generate(csa, source, staging)
        if not (staging / "index.html").is_file():
            raise SystemExit("generate produced no index.html")
        if previous.exists():
            shutil.rmtree(previous)
        if live.exists():
            live.rename(previous)
        try:
            staging.rename(live)
        except OSError:
            if previous.exists() and not live.exists():
                previous.rename(live)
            raise
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    if previous.exists():
        shutil.rmtree(previous)


def _default_csa():
    return Path(__file__).resolve().parent.parent / "csa_script"


def _pull(destination):
    pull_main(["pull.py", DEFAULT_SHEET, str(destination)])


def _generate(csa, source, destination):
    subprocess.run(
        [sys.executable, "generate.py", str(source), str(destination)],
        cwd=csa,
        check=True,
    )


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
