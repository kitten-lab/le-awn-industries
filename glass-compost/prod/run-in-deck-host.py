#!/usr/bin/env python3
"""The Glass Compost → Deck Host (hand-cut branches · L.E. AWN)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
SYS = PROD / "bench_sys"
DECK = PROD.parents[2] / "the-deck-host" / "shell" / "deck_host.py"
PORT = os.environ.get("GLASS_COMPOST_PORT", os.environ.get("NIM_BENCH_PORT", "43182"))
# house phosphor: green | red | blue (or archivist/detective/lover)
HOUSE = (
    os.environ.get("GLASS_COMPOST_HOUSE")
    or os.environ.get("COMPOST_HOUSE")
    or ""
).strip().lower()
_q = f"?house={HOUSE}" if HOUSE else ""
URL = f"http://127.0.0.1:{PORT}/{_q}"
HEALTH = f"http://127.0.0.1:{PORT}/api/health"


def main() -> int:
    if not (SYS / "server.py").is_file():
        print("server missing", file=sys.stderr)
        return 1
    if not DECK.is_file():
        print(f"Deck Host missing: {DECK}", file=sys.stderr)
        return 1
    os.environ.setdefault("DECK_HOST_WINDOW_MODE", "maximized")
    title = "The Glass Compost"
    if HOUSE in ("green", "red", "blue", "archivist", "detective", "lover", "adm", "kme", "her"):
        title = f"Glass Compost · {HOUSE}"
    cmd = [
        sys.executable,
        str(DECK),
        "--title",
        title,
        "--profile",
        "bench",
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
    print(
        "The Glass Compost · CO.LEA-003-GLASS · terminal phosphor · port",
        PORT,
        "· house",
        HOUSE or "green(default)",
    )
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
