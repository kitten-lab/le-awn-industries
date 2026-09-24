#!/usr/bin/env python3
"""SophiaDesk → Deck Host (consider desk · L.E. AWN · not a notepad)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
SYS = PROD / "desk_sys"

_EL_DESKS = PROD.parent.parent
if str(_EL_DESKS) not in sys.path:
    sys.path.insert(0, str(_EL_DESKS))
from desk_core.house import load_house

_HOUSE = load_house(PROD.parent)



def _alice_box() -> Path:
    """Walk up until the-deck-host/shell/deck_host.py is found (depth-safe)."""
    here = PROD
    for p in [here, *here.parents]:
        deck = p / "the-deck-host" / "shell" / "deck_host.py"
        if deck.is_file():
            return p
    raise FileNotFoundError("ALICE_BOX root not found (no the-deck-host/shell/deck_host.py)")


DECK = _alice_box() / "the-deck-host" / "shell" / "deck_host.py"
PORT = os.environ.get("POCKET_DESKTOP_PORT", str(_HOUSE.port))
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
        _HOUSE.title,
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
