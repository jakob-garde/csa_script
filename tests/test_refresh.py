"""refresh.py targets the checkout that contains generate.py."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from refresh import _default_csa


class DefaultCheckoutTest(unittest.TestCase):
    def test_tools_folder_uses_this_checkout(self):
        self.assertEqual(_default_csa(), Path(__file__).resolve().parents[1])


if __name__ == "__main__":
    unittest.main()
