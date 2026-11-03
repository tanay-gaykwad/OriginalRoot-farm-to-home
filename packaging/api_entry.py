"""Frozen entry point for the OriginalRoot desktop installer."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.server import main


if __name__ == "__main__":
    main()
