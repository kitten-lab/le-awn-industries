#!/usr/bin/env python3
"""EM Translation Bench → The Deck Host."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
SYS = PROD / "bench_sys"
DECK_HOST_PY = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"
PORT = os.environ.get("EMB_PORT", "43174")


def main() -> int:
    if not (SYS / "server.py").is_file():
        print("server missing", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"Deck Host missing: {DECK_HOST_PY}", file=sys.stderr)
        return 1
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "EM Translation Bench",
        "--profile",
        os.environ.get("DECK_HOST_PROFILE", "desk").strip() or "desk",
        "--width",
        os.environ.get("EMB_WIDTH", "1280"),
        "--height",
        os.environ.get("EMB_HEIGHT", "800"),
        "--url",
        f"http://127.0.0.1:{PORT}/",
        "--health",
        f"http://127.0.0.1:{PORT}/api/health",
        "--health-timeout",
        "20",
        "--spawn",
        f"{sys.executable} server.py",
        "--spawn-cwd",
        str(SYS),
    ]
    print("EM Translation Bench · CO.LEA-004-EMB · Deck Host")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
