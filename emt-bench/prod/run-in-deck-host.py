#!/usr/bin/env python3
"""
EM Translation Toy → The Deck Host (the card-table toy, not the bench)
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
CONCOR_SYS = PROD / "concor_sys"
# le-awn-industries/emt-bench/prod → parents[2] = ALICE_BOX
DECK_HOST_PY = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"

PORT = os.environ.get("CONCOR_PORT", "43150")
URL = os.environ.get("CONCOR_URL", f"http://127.0.0.1:{PORT}/")
HEALTH = os.environ.get("CONCOR_HEALTH", f"http://127.0.0.1:{PORT}/api/health")


def main() -> int:
    if not (CONCOR_SYS / "server.py").is_file():
        print(f"server missing: {CONCOR_SYS}", file=sys.stderr)
        return 1
    if not DECK_HOST_PY.is_file():
        print(f"Deck Host not found: {DECK_HOST_PY}", file=sys.stderr)
        return 1

    # Full desk — not pocket 800×600. Override with CONCOR_WIDTH/HEIGHT if needed.
    profile = os.environ.get("DECK_HOST_PROFILE", "desk").strip() or "desk"
    width = os.environ.get("CONCOR_WIDTH", "1280")
    height = os.environ.get("CONCOR_HEIGHT", "800")
    server_cmd = f"{sys.executable} server.py"
    cmd = [
        sys.executable,
        str(DECK_HOST_PY),
        "--title",
        "EM Translation Toy",
        "--profile",
        profile,
        "--width",
        str(width),
        "--height",
        str(height),
        "--url",
        URL,
        "--health",
        HEALTH,
        "--health-timeout",
        "20",
        "--spawn",
        server_cmd,
        "--spawn-cwd",
        str(CONCOR_SYS),
    ]
    print("EM Translation Toy · CO.LEA-002-EMT · Deck Host")
    print(f"  url:     {URL}")
    print(f"  size:    {width}x{height}")
    print(f"  profile: {profile}")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
