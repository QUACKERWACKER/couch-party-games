"""Compatibility entry point for running Blitz 7 directly."""

from pathlib import Path
import os
import sys


if __name__ == "__main__":
    launcher = Path(__file__).resolve().parent.parent / "serve.py"
    os.execv(sys.executable, [sys.executable, str(launcher), "--game", "blitz", *sys.argv[1:]])
