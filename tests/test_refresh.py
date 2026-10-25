"""refresh.py targets the checkout that contains generate.py."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from refresh import _default_csa, python_for


class DefaultCheckoutTest(unittest.TestCase):
    def test_tools_folder_uses_this_checkout(self):
        self.assertEqual(_default_csa(), Path(__file__).resolve().parents[1])

    def test_generate_uses_the_virtualenv_when_it_exists(self):
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as directory:
            checkout = Path(directory)
            venv = checkout / "venv" / "bin" / "python3"
            venv.parent.mkdir(parents=True)
            venv.write_text("")
            self.assertEqual(python_for(checkout), str(venv))
            venv.unlink()
            self.assertEqual(python_for(checkout), sys.executable)


if __name__ == "__main__":
    unittest.main()
