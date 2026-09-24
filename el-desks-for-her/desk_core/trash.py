"""Soft trash. Empty does not wipe — it moves files to ~local/<auth>/~trash/.

Each desk has its own can and its own ~trash. Recover by copying a file
back into library/ (and a cfg into surfaces/.../configs/) if you need it.
"""

from __future__ import annotations

import time
from pathlib import Path


def trash_dir(local_root: Path, auth: str) -> Path:
    return Path(local_root) / str(auth) / "~trash"


def unique_dest(folder: Path, name: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / name
    if not dest.exists():
        return dest
    stem, suf = dest.stem, dest.suffix
    n = 1
    while True:
        cand = folder / f"{stem}~{n}{suf}"
        if not cand.exists():
            return cand
        n += 1


def bury_files(paths: list[Path], dest_dir: Path) -> list[str]:
    """Move existing files into dest_dir. Stamp names so empties sort by time."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    note = dest_dir / "README.txt"
    if not note.is_file():
        note.write_text(
            "Desk World trash. Files land here when you empty the can.\n"
            "They are off the felt on purpose. Copy a .chip back to library/\n"
            "if you need it on the desk again.\n",
            encoding="utf-8",
        )
    stamp = time.strftime("%Y-%m-%dT%H%M%S")
    moved: list[str] = []
    seen: set[str] = set()
    for raw in paths:
        src = Path(raw) if raw else None
        if not src or not src.is_file():
            continue
        key = str(src.resolve())
        if key in seen:
            continue
        seen.add(key)
        dest = unique_dest(dest_dir, f"{stamp}_{src.name}")
        try:
            src.replace(dest)
            moved.append(str(dest))
        except OSError:
            continue
    return moved
