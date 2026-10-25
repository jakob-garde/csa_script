"""Serve the generated pages so a tester can open them in a browser.

Binds on every interface. This server only hands out the files. Each page
asks for its own password before showing the week's lists.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main(argv):
    out = Path(argv[1] if len(argv) > 1 else "out")
    port = int(argv[2]) if len(argv) > 2 else 8080
    if not (out / "index.html").is_file():
        raise SystemExit(f"No index.html in {out}. Run generate.py first.")
    handler = partial(SimpleHTTPRequestHandler, directory=str(out.resolve()))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"Serving {out.resolve()} at http://127.0.0.1:{port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main(sys.argv)
