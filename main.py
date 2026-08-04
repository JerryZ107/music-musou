"""Android entry point for the Buildozer/python-for-android build."""

import os
import sys
from pathlib import Path

_DEMO_DIR = Path(__file__).resolve().parent / "demo"
sys.path.insert(0, str(_DEMO_DIR))

from prototype import main  # noqa: E402

if __name__ == "__main__":
    main()
