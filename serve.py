"""Serve the generated pages so a tester can open them in a browser.

Binds on every interface. Each generated page asks for its own password before
showing the week's lists. /refresh is separate: a passphrase checked on the
server runs the pull-and-generate command, then the new files are served.

The passphrase file and the command come from the environment, so neither the
passphrase nor the sheet address lives in this repo:

    CSA_REFRESH_PASSFILE=~/.local/state/csa-refresh-pass
    CSA_REFRESH_COMMAND=python3 /path/to/csa_script/tools/refresh.py

Without those, /refresh is not there.
"""

import hmac
import html
import os
import shlex
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

REFRESH_PATH = "/refresh"
REFRESH_TIMEOUT = 180


def main(argv):
    out = Path(argv[1] if len(argv) > 1 else "out")
    port = int(argv[2]) if len(argv) > 2 else 8080
    if not (out / "index.html").is_file():
        raise SystemExit(f"No index.html in {out}. Run generate.py first.")
    server = serve(out, port, load_refresh())
    bound_host, bound_port = server.server_address
    print(f"Serving {out.resolve()} on {bound_host}:{bound_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()


def serve(out, port, refresh, host="0.0.0.0"):
    handler = partial(Handler, directory=str(Path(out).resolve()), refresh=refresh)
    return ThreadingHTTPServer((host, port), handler)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory, refresh, **kwargs):
        self.refresh = refresh
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self):
        if urlparse(self.path).path.rstrip("/") == REFRESH_PATH:
            self._refresh_get()
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path.rstrip("/") != REFRESH_PATH:
            self.send_error(404)
            return
        self._refresh_post()

    def _refresh_get(self):
        if self.refresh is None:
            self.send_error(404)
            return
        self._html(200, refresh_form())

    def _refresh_post(self):
        if self.refresh is None:
            self.send_error(404)
            return
        status, message = self.refresh.run(posted_passphrase(self))
        self._html(status, result_page(message))
        print(f"refresh {status}", flush=True)

    def _html(self, status, text):
        body = text.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


class Refresh:
    def __init__(self, command, passphrase):
        self.command = command
        self.passphrase = passphrase
        self.lock = threading.Lock()

    def run(self, given):
        if not passphrase_ok(given, self.passphrase):
            return 403, "Wrong passphrase."
        if not self.lock.acquire(blocking=False):
            return 409, "A refresh is already running."
        try:
            completed = subprocess.run(
                self.command,
                capture_output=True,
                text=True,
                timeout=REFRESH_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            return 504, "Refresh took too long."
        finally:
            self.lock.release()
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or "Refresh failed.").strip()
            return 500, detail
        return 200, "Pages regenerated. Reload the lists."


def load_refresh():
    command = os.environ.get("CSA_REFRESH_COMMAND", "").strip()
    passfile = os.environ.get("CSA_REFRESH_PASSFILE", "").strip()
    if not command and not passfile:
        return None
    if not command or not passfile:
        raise SystemExit("Set both CSA_REFRESH_COMMAND and CSA_REFRESH_PASSFILE.")
    path = Path(passfile)
    if not path.is_file():
        raise SystemExit(f"No refresh passphrase at {path}")
    lines = path.read_text().splitlines()
    passphrase = lines[0] if lines else ""
    if not passphrase:
        raise SystemExit(f"Refresh passphrase file {path} is empty")
    return Refresh(shlex.split(command), passphrase)


def passphrase_ok(given, expected):
    if not given or not expected:
        return False
    return hmac.compare_digest(given.encode(), expected.encode())


def posted_passphrase(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        return ""
    if length < 0 or length > 1024:
        return ""
    raw = handler.rfile.read(length).decode()
    return parse_qs(raw, keep_blank_values=True).get("passphrase", [""])[0]


def refresh_form():
    return """<!DOCTYPE html>
<meta charset="utf-8">
<title>Refresh</title>
<form method="post" action="/refresh">
<label>Passphrase <input name="passphrase" type="password" autofocus></label>
<button type="submit">Pull and regenerate</button>
</form>
"""


def result_page(message):
    return f"""<!DOCTYPE html>
<meta charset="utf-8">
<title>Refresh</title>
<p>{html.escape(message)}</p>
"""


if __name__ == "__main__":
    main(sys.argv)
