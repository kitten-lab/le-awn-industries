#!/usr/bin/env python3
"""SophiaDesk → Deck Host (consider desk · L.E. AWN · not a notepad)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
SYS = PROD / "desk_sys"
# prod → sophia-desk → le-awn-industries → ALICE_BOX
DECK = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"
PORT = os.environ.get("POCKET_DESKTOP_PORT", os.environ.get("SOPHIA_DESK_PORT", "43167"))
URL = f"http://127.0.0.1:{PORT}/"
HEALTH = f"http://127.0.0.1:{PORT}/api/health"


def main() -> int:
    if not (SYS / "server.py").is_file():
        print("server missing", file=sys.stderr)
        return 1
    if not DECK.is_file():
        print(f"Deck Host missing: {DECK}", file=sys.stderr)
        return 1
    os.environ.setdefault("DECK_HOST_WINDOW_MODE", "maximized")
    cmd = [
        sys.executable,
        str(DECK),
        "--title",
        "SophiaDesk",
        "--profile",
        "desk",
        "--window-mode",
        os.environ.get("DECK_HOST_WINDOW_MODE", "maximized"),
        "--url",
        URL,
        "--health",
        HEALTH,
        "--spawn",
        f"{sys.executable} server.py",
        "--spawn-cwd",
        str(SYS),
    ]
    print("SophiaDesk · CO.LEA-001-DESK · L.E. AWN Industries · not a notepad")
    print(f"  url: {URL}")
    print(f"  chips: {PROD / 'safe_box' / 'USER' / 'chips'}")
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
