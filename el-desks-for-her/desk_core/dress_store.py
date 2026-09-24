"""
General dress store. Named CSS sheets (.dsc) live once, under
el-desks-for-her/~store/marketplace/.

An island ~host/marketplace file with the same path is a local overlay
(studio experiment). Shared wins the catalog so look books are not cloned.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from desk_core.house import desks_root

KIND_REL: dict[str, tuple[str, ...]] = {
    "leaf": ("chips", "leaf", "dressups"),
    "card": ("chips", "card", "dressups", "face"),
    "key": ("chips", "key", "dressups", "face"),
    "envelope": ("chips", "envelope", "dressups", "face"),
    "desk": ("desk", "dressups"),
    "mira": ("mira", "dressups"),
}

_STEM_OK = re.compile(r"[^\w.-]+")


def shared_marketplace() -> Path:
    return desks_root() / "~store" / "marketplace"


def island_marketplace(desk_root: Path) -> Path:
    return Path(desk_root) / "~host" / "marketplace"


def kind_rel(kind: str) -> tuple[str, ...]:
    k = (kind or "leaf").strip().lower()
    return KIND_REL.get(k, KIND_REL["leaf"])


def dress_dirs(desk_root: Path, kind: str) -> list[Path]:
    rel = Path(*kind_rel(kind))
    return [
        shared_marketplace() / rel,
        island_marketplace(desk_root) / rel,
    ]


def clean_stem(dress_id: str) -> str:
    stem = _STEM_OK.sub("", (dress_id or "").strip())
    if stem == "lines":
        return "lined"
    return stem


def is_base_stem(stem: str) -> bool:
    s = (stem or "").strip().lower()
    return s in ("_base", "base")


def display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(desks_root().resolve()).as_posix()
    except ValueError:
        return str(path)


def resolve_dress_file(
    desk_root: Path, kind: str, dress_id: str
) -> Path | None:
    stem = clean_stem(dress_id)
    if not stem:
        return None
    name = f"{stem}.dsc"
    shared, island = dress_dirs(desk_root, kind)
    for root in (shared, island):
        p = root / name
        if p.is_file():
            return p
    return None


def list_dressups(
    desk_root: Path, kind: str, *, include_base: bool = False
) -> list[dict[str, Any]]:
    found: dict[str, Path] = {}
    shared, island = dress_dirs(desk_root, kind)
    # island first into the map, then shared overwrites — shared is canon
    for root in (island, shared):
        if not root.is_dir():
            continue
        for p in root.glob("*.dsc"):
            found[p.stem] = p
    rows: list[dict[str, Any]] = []
    for stem in sorted(found):
        if is_base_stem(stem) and not include_base:
            continue
        p = found[stem]
        try:
            chars = p.stat().st_size
        except OSError:
            chars = 0
        rows.append(
            {
                "id": stem,
                "file": p.name,
                "path_display": display_path(p),
                "chars": chars,
                "base": is_base_stem(stem),
                "kind": kind,
            }
        )
    return rows


def read_dressup(
    desk_root: Path, kind: str, dress_id: str
) -> tuple[Path | None, str | None, str | None]:
    path = resolve_dress_file(desk_root, kind, dress_id)
    if path is None:
        return None, None, None
    try:
        return path, path.read_text(encoding="utf-8"), display_path(path)
    except OSError:
        return path, None, display_path(path)


def write_dressup(desk_root: Path, kind: str, dress_id: str, css_text: str) -> Path:
    """Write to the general store (shared). Island overlays are not the canon."""
    stem = clean_stem(dress_id)
    if not stem:
        raise ValueError("dress id required")
    root = dress_dirs(desk_root, kind)[0]
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{stem}.dsc"
    path.write_text("" if css_text is None else str(css_text), encoding="utf-8")
    return path
