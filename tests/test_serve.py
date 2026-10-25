"""The outside trigger checks a passphrase, then runs the refresh command."""

import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlencode

from serve import Refresh, passphrase_ok, posted_passphrase, serve


class PassphraseTest(unittest.TestCase):
    def test_matching_passphrase_is_accepted(self):
        self.assertTrue(passphrase_ok("tomat-refresh", "tomat-refresh"))

    def test_wrong_or_empty_passphrase_is_refused(self):
        self.assertFalse(passphrase_ok("nope", "tomat-refresh"))
        self.assertFalse(passphrase_ok("", "tomat-refresh"))


class PostedPassphraseTest(unittest.TestCase):
    def test_form_body_is_the_passphrase(self):
        handler = _Body(urlencode({"passphrase": "secret phrase"}))
        self.assertEqual(posted_passphrase(handler), "secret phrase")


class RefreshHttpTest(unittest.TestCase):
    def test_missing_hook_hides_the_page(self):
        with _running(None) as server:
            status, body = _get(server, "/refresh")
        self.assertEqual(status, 404)
        self.assertNotIn(b"Passphrase", body)

    def test_get_shows_the_form_and_post_runs_the_command(self):
        with TemporaryDirectory() as directory:
            marker = Path(directory) / "ran"
            refresh = Refresh(
                [__import__("sys").executable, "-c", f"open({str(marker)!r}, 'w').write('ok')"],
                "secret",
            )
            with _running(refresh) as server:
                status, body = _get(server, "/refresh")
                self.assertEqual(status, 200)
                self.assertIn(b'name="passphrase"', body)
                lists, _ = _get(server, "/index.html")
                self.assertEqual(lists, 200)
                wrong, _ = _post(server, "nope")
                self.assertEqual(wrong, 403)
                self.assertFalse(marker.exists())
                ok, page = _post(server, "secret")
            self.assertEqual(ok, 200)
            self.assertIn(b"Pages regenerated", page)
            self.assertEqual(marker.read_text(), "ok")

    def test_a_second_refresh_waits_outside(self):
        refresh = Refresh(["python3", "-c", "pass"], "secret")
        refresh.lock.acquire()
        try:
            with _running(refresh) as server:
                status, body = _post(server, "secret")
        finally:
            refresh.lock.release()
        self.assertEqual(status, 409)
        self.assertIn(b"already running", body)


class _Body:
    def __init__(self, text):
        self.headers = {"Content-Length": str(len(text.encode()))}
        self.rfile = _Reader(text.encode())


class _Reader:
    def __init__(self, data):
        self.data = data

    def read(self, length):
        return self.data[:length]


class _running:
    def __init__(self, refresh):
        self.directory = TemporaryDirectory()
        Path(self.directory.name, "index.html").write_text("<p>lists</p>")
        self.refresh = refresh

    def __enter__(self):
        self.httpd = serve(self.directory.name, 0, self.refresh, host="127.0.0.1")
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self.httpd

    def __exit__(self, *args):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.directory.cleanup()


def _get(server, path):
    connection = HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
    connection.request("GET", path)
    response = connection.getresponse()
    return response.status, response.read()


def _post(server, passphrase):
    body = urlencode({"passphrase": passphrase})
    connection = HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
    connection.request("POST", "/refresh", body=body)
    response = connection.getresponse()
    return response.status, response.read()


if __name__ == "__main__":
    unittest.main()
