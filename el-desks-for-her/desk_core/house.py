"""
house.txt — who sits at this desk, which surface, which dresses it likes.

Not a look book. Auth (ADM / KME / HER) is the seat. Felt + Mira are sheet
names in the general store (~store/marketplace/…).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

_FOLDER_DEFAULTS: dict[str, dict[str, Any]] = {
    "sophia-desk": {
        "auth": "ADM",
        "title": "SophiaDesk",
        "surface_folder": "ArchivistDesk",
        "surface_name": "Archivist Desk",
        "surface_id": "desk_ArchivistDesk[0]",
        "surface_config_id": "surf-desk_ArchivistDesk[0]",
        "port": 43167,
        "felt": "green",
        "mira": "phosphor",
        "sku": "CO.LEA-001-DESK",
        "whisper": "we are in the future",
    },
    "cassandra-desk": {
        "auth": "KME",
        "title": "CassandraDesk",
        "surface_folder": "DetectiveDesk",
        "surface_name": "Detective Desk",
        "surface_id": "desk_DetectiveDesk[0]",
        "surface_config_id": "surf-desk_DetectiveDesk[0]",
        "port": 43168,
        "felt": "velvet",
        "mira": "neon-red",
        "sku": "RED-KME-689",
        "whisper": "the red thread",
    },
    "ava-desk": {
        "auth": "HER",
        "title": "AvaDesk",
        "surface_folder": "LetterDesk",
        "surface_name": "Letter Desk",
        "surface_id": "desk_LetterDesk[0]",
        "surface_config_id": "surf-desk_LetterDesk[0]",
        "port": 43171,
        "felt": "blue",
        "mira": "electric",
        "sku": "BLUE-HER-001",
        "whisper": "the living mirror",
    },
    "key-desk": {
        "auth": "QUA",
        "title": "QuaDesk",
        "surface_folder": "KeyDesk",
        "surface_name": "Key Desk",
        "surface_id": "desk_KeyDesk[0]",
        "surface_config_id": "surf-desk_KeyDesk[0]",
        "port": 43172,
        "felt": "amber",
        "mira": "electric",
        "sku": "AMBER-QUA-001",
        "whisper": "turn the count",
    },
}


@dataclass
class House:
    auth: str
    title: str
    surface_folder: str
    surface_name: str
    surface_id: str
    surface_config_id: str
    port: int
    felt: str
    mira: str
    sku: str = ""
    whisper: str = ""
    surface_subtype: str = "desk"
    desk_root: str = ""

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["port"] = int(self.port)
        return d


def desks_root() -> Path:
    return Path(__file__).resolve().parent.parent


def parse_house_text(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, rest = line.partition(":")
        elif "=" in line:
            key, _, rest = line.partition("=")
        else:
            continue
        k = key.strip().lower().replace("-", "_")
        v = rest.strip()
        if k and v:
            out[k] = v
    return out


def _defaults_for_folder(desk_root: Path) -> dict[str, Any]:
    name = desk_root.name.lower()
    if name in _FOLDER_DEFAULTS:
        return dict(_FOLDER_DEFAULTS[name])
    return {
        "auth": "ADM",
        "title": desk_root.name,
        "surface_folder": "Desk",
        "surface_name": "Desk",
        "surface_id": "desk_Desk[0]",
        "surface_config_id": "surf-desk_Desk[0]",
        "port": 43167,
        "felt": "green",
        "mira": "phosphor",
        "sku": "",
        "whisper": "",
    }


def _house_paths(desk_root: Path) -> list[Path]:
    return [
        desk_root / "house.txt",
        desk_root / "prod" / "house.txt",
        desk_root / "prod" / "desk_sys" / "house.txt",
    ]


def load_house(desk_root: Path | None = None) -> House:
    root = Path(desk_root) if desk_root is not None else Path.cwd()
    base = _defaults_for_folder(root)
    parsed: dict[str, str] = {}
    for path in _house_paths(root):
        if path.is_file():
            try:
                parsed.update(parse_house_text(path.read_text(encoding="utf-8")))
            except OSError:
                continue
    # aliases
    if "username" in parsed and "auth" not in parsed:
        parsed["auth"] = parsed["username"]
    if "surface" in parsed and "surface_folder" not in parsed:
        parsed["surface_folder"] = parsed["surface"]
    if "name" in parsed and "surface_name" not in parsed:
        parsed["surface_name"] = parsed["name"]
    merged = dict(base)
    for k in (
        "auth",
        "title",
        "surface_folder",
        "surface_name",
        "surface_id",
        "surface_config_id",
        "felt",
        "mira",
        "sku",
        "whisper",
        "surface_subtype",
    ):
        if parsed.get(k):
            merged[k] = parsed[k]
    if parsed.get("port"):
        try:
            merged["port"] = int(str(parsed["port"]).strip())
        except ValueError:
            pass
    folder = str(merged.get("surface_folder") or "Desk")
    if not merged.get("surface_id"):
        merged["surface_id"] = f"desk_{folder}[0]"
    if not merged.get("surface_config_id"):
        merged["surface_config_id"] = f"surf-desk_{folder}[0]"
    if not merged.get("surface_name"):
        merged["surface_name"] = folder
    return House(
        auth=str(merged["auth"]),
        title=str(merged["title"]),
        surface_folder=folder,
        surface_name=str(merged["surface_name"]),
        surface_id=str(merged["surface_id"]),
        surface_config_id=str(merged["surface_config_id"]),
        port=int(merged["port"]),
        felt=str(merged["felt"]),
        mira=str(merged["mira"]),
        sku=str(merged.get("sku") or ""),
        whisper=str(merged.get("whisper") or ""),
        surface_subtype=str(merged.get("surface_subtype") or "desk"),
        desk_root=str(root),
    )
