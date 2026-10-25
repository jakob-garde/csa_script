"""Check the published address and that the pages answer on this machine.

Run once a day from cron. Prints nothing when the saved address still matches
and the pages answer, so cron mail stays empty. Prints when something is off,
and keeps saying so each day until the address is accepted or the pages answer.

    15 7 * * * python3 /path/to/csa_script_tools/check.py

The first run records the address it sees. After a real change, run
``python3 check.py --accept`` once the new address is the one members should use.
"""

import sys
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ECHOES = (
    "https://ipv4.icanhazip.com",
    "https://ifconfig.me/ip",
    "https://api.ipify.org",
)
STATE = Path.home() / ".local/state/csa-public-ip"
LOG = Path.home() / ".local/state/csa-check.log"
PORT = 8080


def main(argv):
    accept = "--accept" in argv[1:]
    learned, learn_error = read_public_ipv4()
    server_ok = pages_answer(PORT)
    saved = STATE.read_text().strip() if STATE.is_file() else None
    notices, problems = assess(saved, learned, learn_error, server_ok)

    if learned and (accept or saved is None) and not learn_error:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(learned + "\n")
        if accept:
            problems = [item for item in problems if not item.startswith("public address changed")]
            if saved and saved != learned:
                notices.append(f"accepted public address {learned}")

    line = "ok" if not problems else "off " + "; ".join(problems)
    if learned and not learn_error:
        line = f"{line} {learned}"
    _log(line)
    for notice in notices + problems:
        print(notice, flush=True)
    return 1 if problems else 0


def assess(saved, learned, learn_error, server_ok):
    notices = []
    problems = []
    if learn_error:
        problems.append(learn_error)
    elif saved is None:
        notices.append(f"recorded public address {learned}")
    elif learned != saved:
        problems.append(f"public address changed from {saved} to {learned}")
    if not server_ok:
        problems.append(f"pages did not answer on 127.0.0.1:{PORT}")
    return notices, problems


def read_public_ipv4():
    found = []
    for url in ECHOES:
        try:
            found.append(_fetch_ip(url))
        except (URLError, TimeoutError, ValueError, OSError):
            continue
    unique = sorted(set(found))
    if len(unique) == 1:
        return unique[0], None
    if len(unique) > 1:
        return None, "public-address lookups disagreed: " + ", ".join(unique)
    return None, "could not learn the public address"


def pages_answer(port):
    try:
        with urlopen(f"http://127.0.0.1:{port}/index.html", timeout=5) as response:
            body = response.read(64)
            return response.status == 200 and b"<" in body
    except (URLError, TimeoutError, OSError, ValueError):
        return False


def _fetch_ip(url):
    with urlopen(url, timeout=8) as response:
        text = response.read(64).decode().strip()
    parts = text.split(".")
    if len(parts) != 4 or any(not part.isdigit() or not 0 <= int(part) <= 255 for part in parts):
        raise ValueError(text)
    return text


def _log(line):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    with LOG.open("a") as handle:
        handle.write(f"{stamp} {line}\n")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
