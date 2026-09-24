"""Shared Hands frontend.

Physics lives here. Papers live in each desk's ~local. Editing app.js / app.css
in desk_core/hands/ is editing every desk. Islands keep index.html + house.txt.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

HANDS_DIR = Path(__file__).resolve().parent / "hands"

_HANDLED = {"app.js", "app.css"}
_TYPES = {
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
}


def hands_path(name: str) -> Path | None:
    if name not in _HANDLED:
        return None
    p = (HANDS_DIR / name).resolve()
    try:
        p.relative_to(HANDS_DIR.resolve())
    except ValueError:
        return None
    return p if p.is_file() else None


def serve_hands(handler: Any, url_path: str) -> bool:
    """Serve /app.js or /app.css from the shared Hands folder. True if handled."""
    name = url_path.rsplit("/", 1)[-1]
    p = hands_path(name)
    if not p:
        return False
    data = p.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", _TYPES.get(p.suffix.lower(), "application/octet-stream"))
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)
    return True
