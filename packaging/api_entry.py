"""Frozen entry point for the OriginalRoot desktop installer."""

import sys
import os
from pathlib import Path

sys.path.insert(0, os.environ.get("ORIGINALROOT_ROOT") or os.environ.get("OriginalRoot_ROOT") or str(Path(__file__).resolve().parents[1]))

from api.server import main


if __name__ == "__main__":
    main()
