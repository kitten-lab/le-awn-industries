"""
Pocket Desktop — paper store (Hands). Consider desk, not a notepad.

  Origin: Receiver fork so data storage is VISIBLE as papers (chip / bin / cfg /
  surface). "One paper" was a thrash tourniquet, not the product. Now multi-leaf
  + containers + tools; write about the project so thrash can't invent a new law.

  Matter (library):
    ~local/<user>/library/leaf[n]-<slug>.chip
    uid = leaf[n] · file renames with title slug · spine is uid
    ~local/<user>/library/board[n]-….bin · book[n] · shelf[n]
    membership = bin.chips

  Instance config (dress + prop; pose lives on host surface layout):
    ~local/<user>/surfaces/<SurfaceFolder>/configs/chip-leaf[n].cfg
    …/bin-board[n].cfg · tool-stamper[n].cfg · tool-chipper[n].cfg
    board config may hold layout: for pin poses (board is a surface)

  Desk surface:
    …/surfaces/<SurfaceFolder>/surface.cfg
    layout: = objects ON this desk (not nested pin geometry)

  surfaces/ reserved under user so a surface may be named "library".
  User folder name == surface.auth. Bay = pocket-desktop/ (prod = code only).
  NEVER rewrite chip body on boot — only Hands/UI save.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
from pathlib import Path
from typing import Any

LOCAL_DIRNAME = "~local"
SURFACES_DIRNAME = "surfaces"
DEFAULT_USERNAME = "ADM"
LEGACY_USERNAMES = ("abl",)  # prior path segments to migrate
DEFAULT_SURFACE_FOLDER = "ArchivistDesk"
DEFAULT_SURFACE_ID = "desk_ArchivistDesk[0]"
DEFAULT_SURFACE_NAME = "Archivist Desk"
DEFAULT_SURFACE_CONFIG_ID = "surf-desk_ArchivistDesk[0]"
DEFAULT_SURFACE_SUBTYPE = "desk"
SURFACE_PAPER_NAME = "surface.cfg"
# primary leaf — stable uid leaf[0]; file tail follows title slug
PRIMARY_CHIP_ID = "leaf[0]"  # uid
PRIMARY_CONFIG_ID = "chip-leaf[0]"
PRIMARY_TITLE = "the paper"
# legacy ids to migrate (hash / thepaper[0] era)
LEGACY_CHIP_IDS = (
    "leaf_thepaper[0]",
    "leaf_thepaper-993fxe32",
    "leaf_1785806183",
)

# nested FM section order (Hands rearrange)
_SECTION_ORDER = (
    "store",
    "config",
    "chip",
    "bin",
    "package",
    "pin",
    "surface",
    "dressup",
    "layout",  # surface owns object positions (id → pose map)
    "prop",  # object properties (AIDM lineage) — not pose, not dress
    "pos",
    "pose",
)
_KEY_ORDER: dict[str, tuple[str, ...]] = {
    "store": ("file", "type", "subtype", "bit_count"),
    "config": ("type", "subtype", "id"),
    # uid · name · auth — uid stable; name is face
    "chip": ("uid", "id", "name", "auth", "bud", "stamps"),  # id = legacy alias of uid
    # bin matter — container paper; board is a type of bin
    "bin": ("uid", "id", "type", "name", "auth", "class", "chips"),
    # guest editor package paper
    "package": ("uid", "name", "auth", "src"),
    "pin": ("tps_created", "tps_updated", "tags", "cites", "stamps"),
    "surface": ("id", "name", "auth", "host", "user"),
    # dressup:
    #   leaf/board: shell + style (+ color)
    #   tool instance: id + slot selections (tool / mark) — no package path, no shell
    "dressup": (
        "id",
        "tool",
        "mark",
        "shell",
        "style",
        "color",
        "cloth",  # bookbox cloth set (oxblood/forest/navy/sand)
        "class",
        "package",
    ),
    # prop:
    #   package catalog: can* + Mark.types + Dressup.*.dscs + defaults
    #   tool instance: canMark + Mark.type (current plate only)
    #   leaf: isMarkable (accepts stamps) · isMarked + Mark.* scar
    #   board: isTardis + maxLoad
    "prop": (
        "isTardis",
        "maxLoad",
        # flags always first
        "isMarkable",
        "isMarked",
        # card filing · home deck when checked out (not membership alone)
        "homeBin",
        # tool capacities
        "canMark",
        "canDressup",
        # karaoke / pull fidget
        "Kven.last",
        "Pull.kven",
        # Mark.* only dumped when isMarked (see _ordered_prop_items)
        "Mark.class",
        "Mark.types",
        "Mark.type.default",
        "Mark.type",
        "Mark.labels",
        "Mark.label",
        "Mark.style",
        "Mark.style.default",
        "Mark.pos.x",
        "Mark.pos.y",
        "Dressup.types",
        "Dressup.tool.dscs",
        "Dressup.tool.default",
        "Dressup.mark.dscs",
        "Dressup.mark.default",
    ),
    # open: leaves stay open; books use open yes/no (folded cloth face)
    "pos": (
        "x",
        "y",
        "openW",
        "openH",
        "open",
        "w",
        "h",
        "termW",
        "termH",
    ),
    "pose": (  # legacy alias → prefer pos
        "x",
        "y",
        "openW",
        "openH",
        "open",
        "w",
        "h",
        "termW",
        "termH",
    ),
}

# board prop defaults — surface-fit cork, not a bag of holding
DEFAULT_BIN_PROP: dict[str, Any] = {
    "isTardis": False,  # bigger on the inside? no → clip to face
    "maxLoad": 10,  # max chips (leaves) in membership
}


def now() -> int:
    return int(time.time())


def prod_root(safe: Path) -> Path:
    return safe.parent


def bay_root(safe: Path) -> Path:
    if safe.name == "safe_box" and safe.parent.name == "prod":
        return safe.parent.parent
    if safe.name == "safe_box":
        return safe.parent
    return safe.parent


def local_root(safe: Path) -> Path:
    return bay_root(safe) / LOCAL_DIRNAME


def host_root(safe: Path) -> Path:
    """bay/~host — marketplace / store (shared host, not per-user ~local)."""
    return bay_root(safe) / "~host"


def marketplace_root(safe: Path) -> Path:
    return host_root(safe) / "marketplace"


def leaf_dressups_root(safe: Path) -> Path:
    """~host/marketplace/chips/leaf/dressups/ — .dsc costumes for leaf shell."""
    return marketplace_root(safe) / "chips" / "leaf" / "dressups"


def list_leaf_dressups(safe: Path) -> list[dict[str, Any]]:
    """Catalog of .dsc files (id = stem)."""
    root = leaf_dressups_root(safe)
    root.mkdir(parents=True, exist_ok=True)
    out: list[dict[str, Any]] = []
    for p in sorted(root.glob("*.dsc")):
        out.append(
            {
                "id": p.stem,
                "file": p.name,
                "path_display": rel_from_bay(safe, p),
                "chars": p.stat().st_size,
            }
        )
    return out


def read_leaf_dressup(
    safe: Path, dress_id: str
) -> tuple[Path | None, str | None, str | None]:
    """Returns (path, css text, path_display)."""
    root = leaf_dressups_root(safe)
    stem = re.sub(r"[^\w.-]+", "", (dress_id or "").strip())
    if not stem:
        return None, None, None
    path = root / f"{stem}.dsc"
    if not path.is_file():
        # dictation alias: lines → lined
        if stem == "lines":
            path = root / "lined.dsc"
            stem = "lined"
        if not path.is_file():
            return None, None, None
    try:
        return path, path.read_text(encoding="utf-8"), rel_from_bay(safe, path)
    except OSError:
        return path, None, rel_from_bay(safe, path)


def write_leaf_dressup(safe: Path, dress_id: str, css_text: str) -> Path:
    """Save costume sheet (.dsc). Local studio edit of host marketplace dress."""
    root = leaf_dressups_root(safe)
    root.mkdir(parents=True, exist_ok=True)
    stem = re.sub(r"[^\w.-]+", "", (dress_id or "").strip())
    if stem == "lines":
        stem = "lined"
    if not stem:
        raise ValueError("dress id required")
    path = root / f"{stem}.dsc"
    path.write_text("" if css_text is None else str(css_text), encoding="utf-8")
    return path


def discover_username(safe: Path) -> str:
    """Who owns ~local right now (folder name). Prefer DEFAULT, else first user dir."""
    migrate_username_folder(safe, DEFAULT_USERNAME)
    local = local_root(safe)
    if not local.is_dir():
        return DEFAULT_USERNAME
    if (local / DEFAULT_USERNAME).is_dir():
        return DEFAULT_USERNAME
    for p in sorted(local.iterdir()):
        if p.is_dir() and not p.name.startswith("."):
            return p.name
    return DEFAULT_USERNAME


def library_root(safe: Path, username: str | None = None) -> Path:
    """~local/<user>/library/ — chip matter."""
    u = username or discover_username(safe)
    return local_root(safe) / u / "library"


def surfaces_root(safe: Path, username: str | None = None) -> Path:
    """~local/<user>/surfaces/ — all named surfaces live under this shelf."""
    u = username or discover_username(safe)
    return local_root(safe) / u / SURFACES_DIRNAME


def surface_root(
    safe: Path,
    username: str | None = None,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    """~local/<user>/surfaces/<SurfaceFolder>/"""
    return surfaces_root(safe, username) / (surface_folder or DEFAULT_SURFACE_FOLDER)


def configs_root(
    safe: Path,
    username: str | None = None,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    return surface_root(safe, username, surface_folder) / "configs"


def legacy_chips_root(safe: Path) -> Path:
    return safe / "USER" / "chips"


def ensure_user_tree(safe: Path) -> None:
    migrate_username_folder(safe)
    library_root(safe).mkdir(parents=True, exist_ok=True)
    configs_root(safe).mkdir(parents=True, exist_ok=True)
    ensure_surface_paper(safe)


def migrate_username_folder(safe: Path, target: str = DEFAULT_USERNAME) -> None:
    """~local/abl → ~local/ADM (etc). Does not touch chip bodies."""
    local = local_root(safe)
    local.mkdir(parents=True, exist_ok=True)
    dest = local / target
    for old_name in LEGACY_USERNAMES:
        if old_name == target:
            continue
        src = local / old_name
        if not src.is_dir():
            continue
        if not dest.exists():
            try:
                shutil.move(str(src), str(dest))
            except OSError:
                pass
            continue
        # merge into existing ADM
        for child in list(src.iterdir()):
            target_child = dest / child.name
            if not target_child.exists():
                try:
                    shutil.move(str(child), str(target_child))
                except OSError:
                    pass
        shutil.rmtree(src, ignore_errors=True)


def safe_user_segment(name: str) -> str:
    """Folder-safe owner id (no path tricks)."""
    s = re.sub(r"[^\w.-]+", "_", (name or "").strip())
    return s or DEFAULT_USERNAME


def rename_user_folder(safe: Path, old_auth: str, new_auth: str) -> str:
    """
    Rename ~local/<old>/ → ~local/<new>/.
    Returns the auth segment actually used.
    """
    old_a = safe_user_segment(old_auth)
    new_a = safe_user_segment(new_auth)
    if old_a == new_a:
        return new_a
    local = local_root(safe)
    src = local / old_a
    dest = local / new_a
    if not src.is_dir():
        # already at new, or missing
        dest.mkdir(parents=True, exist_ok=True)
        return new_a
    if dest.exists():
        # refuse silent merge of two full users — require empty dest
        if any(dest.iterdir()):
            raise OSError(f"user folder already exists: {new_a}")
        dest.rmdir()
    shutil.move(str(src), str(dest))
    return new_a


def surface_paper_path(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    return surface_root(safe, username, surface_folder) / SURFACE_PAPER_NAME


def ensure_surface_paper(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    """Surface identity paper — full config + surface + dressup (felt)."""
    path = surface_paper_path(safe, username, surface_folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        # upgrade legacy surface-only papers to Hands shape (keep auth/name)
        try:
            meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
            if not isinstance(meta.get("config"), dict):
                surf = meta.get("surface") if isinstance(meta.get("surface"), dict) else {}
                write_surface_paper(
                    safe,
                    {
                        "id": surf.get("id") or DEFAULT_SURFACE_ID,
                        "name": surf.get("name") or DEFAULT_SURFACE_NAME,
                        "auth": surf.get("auth") or username or DEFAULT_USERNAME,
                    },
                    username=username,
                    surface_folder=surface_folder,
                    body=body or "",
                    dressup=meta.get("dressup")
                    if isinstance(meta.get("dressup"), dict)
                    else None,
                )
        except OSError:
            pass
        return path
    sections = {
        "config": {
            "type": "surface",
            "subtype": DEFAULT_SURFACE_SUBTYPE,
            "id": DEFAULT_SURFACE_CONFIG_ID,
        },
        "surface": {
            "id": DEFAULT_SURFACE_ID,
            "name": DEFAULT_SURFACE_NAME,
            "auth": username or DEFAULT_USERNAME,
        },
        "dressup": {
            "shell": "felt",
            "style": "green",
        },
    }
    path.write_text(dump_nested_fm(sections, ""), encoding="utf-8")
    return path


def read_surface_paper(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any] | None:
    migrate_username_folder(safe, username)
    path = surface_paper_path(safe, username, surface_folder)
    if not path.is_file():
        ensure_surface_paper(safe, username, surface_folder)
    path = surface_paper_path(safe, username, surface_folder)
    if not path.is_file():
        return None
    meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
    surf = meta.get("surface") if isinstance(meta.get("surface"), dict) else {}
    cfg = meta.get("config") if isinstance(meta.get("config"), dict) else {}
    dress = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
    return {
        "config": cfg
        or {
            "type": "surface",
            "subtype": DEFAULT_SURFACE_SUBTYPE,
            "id": DEFAULT_SURFACE_CONFIG_ID,
        },
        "surface": {
            "id": surf.get("id") or DEFAULT_SURFACE_ID,
            "name": surf.get("name") or DEFAULT_SURFACE_NAME,
            "auth": surf.get("auth") or username or DEFAULT_USERNAME,
        },
        "dressup": dress
        or {
            "shell": "felt",
            "style": "green",
        },
        "body": body or "",
        "_path": str(path.resolve()),
        "_file": path.name,
        "_rel": rel_from_bay(safe, path),
        "path_display": rel_from_bay(safe, path),
    }


def layout_object_id(raw: str) -> str:
    """Canonical id for surface.layout keys: leaf[n] | book[n] | board[n] | shelf[n] | inbox[0]."""
    s = str(raw or "").strip()
    if not s:
        return s
    if s.startswith("tool-"):
        s = s[5:]
    if s.startswith("chip-"):
        s = s[5:]
    if s.startswith("bin-"):
        # bin-book[0] → book[0]
        m = re.match(r"^bin-(board|book|shelf)\[(\d+)\]", s)
        if m:
            return f"{m.group(1)}[{m.group(2)}]"
        s = s[4:]
    if re.match(r"^leaf(\[|_)", s):
        return to_leaf_chip_id(s)
    if re.match(r"^card(\[|_)", s):
        return to_card_id(s)
    if re.match(r"^(board|book|shelf|deck)\[", s) or is_bin_id(s):
        return to_bin_id(s)
    return s


def _normalize_pose_dict(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    for k in ("x", "y", "openW", "openH", "open", "w", "h", "termW", "termH"):
        if k not in raw or raw[k] is None or raw[k] == "":
            continue
        v = raw[k]
        if k == "open":
            if isinstance(v, bool):
                out[k] = "yes" if v else "no"
            else:
                s = str(v).strip().lower()
                out[k] = (
                    "yes"
                    if s in ("true", "yes", "1", "on", "open")
                    else "no"
                )
        else:
            try:
                if isinstance(v, (int, float)):
                    out[k] = v
                else:
                    fv = float(v)
                    out[k] = int(fv) if fv == int(fv) else fv
            except (TypeError, ValueError):
                out[k] = v
    return out


def read_surface_layout(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, dict[str, Any]]:
    """id → pose from surface.cfg layout: section (surface owns positions)."""
    path = surface_paper_path(safe, username, surface_folder)
    if not path.is_file():
        return {}
    try:
        meta, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
    except OSError:
        return {}
    raw = meta.get("layout") if isinstance(meta.get("layout"), dict) else {}
    out: dict[str, dict[str, Any]] = {}
    for k, v in raw.items():
        oid = layout_object_id(str(k))
        if not oid:
            continue
        pose = _normalize_pose_dict(v if isinstance(v, dict) else {})
        if pose:
            out[oid] = pose
    return out


def _atomic_write_text(path: Path, text: str) -> None:
    """Write text with unique temp + replace. Retries on Windows file lock."""
    path.parent.mkdir(parents=True, exist_ok=True)
    last_err: OSError | None = None
    for attempt in range(10):
        tmp = path.with_name(f"{path.name}.{os.getpid()}.{attempt}.tmp")
        try:
            tmp.write_text(text, encoding="utf-8")
            os.replace(str(tmp), str(path))
            return
        except OSError as e:
            last_err = e
            try:
                tmp.unlink(missing_ok=True)  # type: ignore[call-arg]
            except TypeError:
                try:
                    if tmp.is_file():
                        tmp.unlink()
                except OSError:
                    pass
            except OSError:
                pass
            time.sleep(0.015 * (attempt + 1))
    # last resort — direct write (better than crashing every GET)
    try:
        path.write_text(text, encoding="utf-8")
    except OSError:
        if last_err:
            raise last_err
        raise


def write_surface_layout(
    safe: Path,
    layout: dict[str, dict[str, Any]],
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    *,
    allow_shrink: bool = False,
) -> Path:
    """Replace surface.cfg layout: map (preserves config/surface/dressup/body).

    Thrash guard: concurrent pose writes can read an empty mid-replace file and
    rewrite layout with 1–2 keys, dumping the desk into the corner. If the disk
    still has a large layout and the new map is tiny, merge instead of clobber
    unless allow_shrink=True (explicit wipe).
    """
    ensure_surface_paper(safe, username, surface_folder)
    path = surface_paper_path(safe, username, surface_folder)
    try:
        raw_text = path.read_text(encoding="utf-8")
    except OSError:
        raw_text = "---\n---\n"
    meta, body = parse_nested_fm(raw_text)
    clean: dict[str, Any] = {}
    for k, v in (layout or {}).items():
        oid = layout_object_id(str(k))
        pose = _normalize_pose_dict(v)
        if oid and pose:
            clean[oid] = pose
    # re-parse disk layout for thrash guard (same text we just read)
    disk_raw = meta.get("layout") if isinstance(meta.get("layout"), dict) else {}
    disk_clean: dict[str, Any] = {}
    for k, v in disk_raw.items():
        oid = layout_object_id(str(k))
        pose = _normalize_pose_dict(v if isinstance(v, dict) else {})
        if oid and pose:
            disk_clean[oid] = pose
    if (
        not allow_shrink
        and disk_clean
        and len(disk_clean) >= 4
        and len(clean) < max(3, len(disk_clean) // 2)
    ):
        # keep disk, overlay new keys (upsert-safe; still drops keys only if
        # caller passed a nearly-full map after a good read)
        merged = dict(disk_clean)
        merged.update(clean)
        clean = merged
    meta["layout"] = clean
    # keep known sections; drop empty layout if none
    if not clean:
        meta.pop("layout", None)
    _atomic_write_text(path, dump_nested_fm(meta, body or ""))
    return path


def upsert_surface_object_pose(
    safe: Path,
    object_id: str,
    pose: dict[str, Any],
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """Merge one object's pose into surface layout. Returns that pose."""
    oid = layout_object_id(object_id)
    if not oid:
        return {}
    layout: dict[str, dict[str, Any]] = {}
    # retry if we read empty while file still has substance (mid-replace race)
    path = surface_paper_path(safe, username, surface_folder)
    for attempt in range(6):
        layout = read_surface_layout(safe, username, surface_folder)
        try:
            size = path.stat().st_size if path.is_file() else 0
        except OSError:
            size = 0
        if layout or size < 180 or attempt >= 5:
            break
        time.sleep(0.02 * (attempt + 1))
    cur = dict(layout.get(oid) or {})
    cur.update(_normalize_pose_dict(pose))
    if not cur:
        return {}
    layout[oid] = cur
    write_surface_layout(safe, layout, username, surface_folder)
    return cur


def get_surface_object_pose(
    safe: Path,
    object_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    oid = layout_object_id(object_id)
    return dict(read_surface_layout(safe, username, surface_folder).get(oid) or {})


def remove_surface_object_pose(
    safe: Path,
    object_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> bool:
    """Drop one id from desk surface.layout (e.g. leaf moved into a board pocket)."""
    oid = layout_object_id(object_id)
    layout = read_surface_layout(safe, username, surface_folder)
    if oid not in layout:
        return False
    layout.pop(oid, None)
    write_surface_layout(safe, layout, username, surface_folder)
    return True


def _bin_host_subtype(safe: Path, bin_id: str) -> str:
    """board | book | shelf | deck from matter, else from uid prefix."""
    uid = to_bin_id(bin_id)
    p = bin_path(safe, uid)
    if p:
        row = bin_api_from_file(p)
        if row:
            st = str(row.get("subtype") or row.get("bin_type") or "").strip()
            if st in ("board", "book", "shelf", "deck"):
                return st
    if re.match(r"^book\[", uid):
        return "book"
    if re.match(r"^shelf\[", uid):
        return "shelf"
    if re.match(r"^deck\[", uid):
        return "deck"
    if re.match(r"^board\[", uid):
        return "board"
    return "board"


def read_bin_layout(
    safe: Path,
    bin_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, dict[str, Any]]:
    """
    Member → pose on this bin's config paper (layout:).
    The board is the surface for its pins; desk surface only places the board itself.
    """
    cfg = read_bin_config(safe, bin_id, username, surface_folder)
    if not cfg:
        return {}
    path = Path(cfg["_path"])
    try:
        meta, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
    except OSError:
        return {}
    raw = meta.get("layout") if isinstance(meta.get("layout"), dict) else {}
    out: dict[str, dict[str, Any]] = {}
    for k, v in raw.items():
        mid = layout_object_id(str(k))
        if not mid:
            continue
        pose = _normalize_pose_dict(v if isinstance(v, dict) else {})
        if pose:
            out[mid] = pose
    return out


def write_bin_layout(
    safe: Path,
    bin_id: str,
    layout: dict[str, dict[str, Any]],
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    """Replace layout: on bin cfg (preserves dress/prop). Ensures cfg exists."""
    uid = to_bin_id(bin_id)
    st = _bin_host_subtype(safe, uid)
    path = configs_root(safe, username, surface_folder) / f"{bin_config_id(uid, st)}.cfg"
    path.parent.mkdir(parents=True, exist_ok=True)
    meta: dict[str, Any] = {}
    body = ""
    if path.is_file():
        try:
            meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            meta, body = {}, ""
    else:
        # seed minimal cfg so layout has a home (no pose write — desk owns bin xy)
        write_bin_config(
            safe,
            uid,
            pose=None,
            dressup={"id": uid},
            username=username,
            surface_folder=surface_folder,
            subtype=st,
        )
        try:
            meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            meta, body = {}, ""
    clean: dict[str, Any] = {}
    for k, v in (layout or {}).items():
        mid = layout_object_id(str(k))
        pose = _normalize_pose_dict(v)
        if mid and pose:
            clean[mid] = pose
    if clean:
        meta["layout"] = clean
    else:
        meta.pop("layout", None)
    # atomic-ish: write temp then replace (Windows: replace in place via same path)
    _atomic_write_text(path, dump_nested_fm(meta, body or ""))
    return path


def upsert_bin_member_pose(
    safe: Path,
    bin_id: str,
    member_id: str,
    pose: dict[str, Any],
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """Merge one member's pocket pose into the host bin's layout."""
    mid = layout_object_id(member_id)
    layout = read_bin_layout(safe, bin_id, username, surface_folder)
    cur = dict(layout.get(mid) or {})
    cur.update(_normalize_pose_dict(pose))
    layout[mid] = cur
    write_bin_layout(safe, bin_id, layout, username, surface_folder)
    return cur


def get_bin_member_pose(
    safe: Path,
    bin_id: str,
    member_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    mid = layout_object_id(member_id)
    return dict(read_bin_layout(safe, bin_id, username, surface_folder).get(mid) or {})


def remove_bin_member_pose(
    safe: Path,
    bin_id: str,
    member_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> bool:
    mid = layout_object_id(member_id)
    layout = read_bin_layout(safe, bin_id, username, surface_folder)
    if mid not in layout:
        return False
    layout.pop(mid, None)
    write_bin_layout(safe, bin_id, layout, username, surface_folder)
    return True


def upsert_leaf_pose(
    safe: Path,
    leaf_id: str,
    pose: dict[str, Any],
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """
    Route leaf geometry by host surface:
      · on a board  → that board's config layout: (pocket-local)
      · free / book → desk surface.layout (felt coords; books have no pin field)
    """
    cid = to_leaf_chip_id(leaf_id)
    pose_out = _normalize_pose_dict(pose)
    pose_out.pop("open", None)
    if not pose_out:
        return {}
    owner = leaf_owner_bin(safe, cid)
    if owner and re.match(r"^(board|deck)\[", str(owner)):
        upsert_bin_member_pose(
            safe, str(owner), cid, pose_out, username, surface_folder
        )
        remove_surface_object_pose(safe, cid, username, surface_folder)
        return pose_out
    # free on desk (or book-held — no pocket surface)
    # membership remove already dropped the leaf from boards; do not scan/rewrite
    # every board cfg on every free drag (that caused launch file locks).
    upsert_surface_object_pose(safe, cid, pose_out, username, surface_folder)
    return pose_out


def resolve_leaf_pose(
    safe: Path,
    leaf_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    *,
    legacy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Pose for API/boot: board/deck pocket layout wins when nested; else desk surface."""
    cid = to_leaf_chip_id(leaf_id)
    pos = dict(_normalize_pose_dict(legacy or {}))
    owner = leaf_owner_bin(safe, cid)
    if owner and re.match(r"^(board|deck)\[", str(owner)):
        pin = get_bin_member_pose(safe, str(owner), cid, username, surface_folder)
        if pin:
            pos.update(pin)
            return pos
        # fallback: leftover on desk layout from pre-migrate
        surf = get_surface_object_pose(safe, cid, username, surface_folder)
        if surf:
            pos.update(surf)
        return pos
    surf = get_surface_object_pose(safe, cid, username, surface_folder)
    if surf:
        pos.update(surf)
    return pos


def migrate_nested_leaf_poses_onto_boards(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """
    Leaves that live in a board: move desk surface.layout coords onto that board's
    config layout: (pocket-local). Desk only keeps free-felt / non-board hosts.
    Idempotent.
    """
    surf = read_surface_layout(safe, username, surface_folder)
    moved = 0
    for row in list_bin_rows(safe):
        bid = str(row.get("uid") or row.get("id") or "")
        st = str(row.get("subtype") or row.get("bin_type") or "board")
        if st != "board" and not re.match(r"^board\[", bid):
            continue
        if not re.match(r"^board\[", bid):
            continue
        chips = row.get("chips") or []
        for raw in chips:
            lid = to_leaf_chip_id(str(raw))
            if not lid.startswith("leaf"):
                continue
            pose = surf.get(lid)
            if not pose:
                # already only on board, or never had coords
                continue
            # board already has pin → board wins, still strip desk
            existing = get_bin_member_pose(safe, bid, lid, username, surface_folder)
            if not existing:
                upsert_bin_member_pose(
                    safe, bid, lid, pose, username, surface_folder
                )
                moved += 1
            else:
                # keep board; still drop desk duplicate
                pass
            surf.pop(lid, None)
    write_surface_layout(safe, surf, username, surface_folder)
    return {"ok": True, "moved": moved, "surface_objects": len(surf)}


def migrate_surface_layout_from_object_configs(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    *,
    strip_object_pos: bool = True,
) -> dict[str, Any]:
    """
    Pull pos from chip/bin/tool cfgs into surface.cfg layout, then strip pos from objects.
    Safe to call repeatedly (idempotent).
    """
    ensure_surface_paper(safe, username, surface_folder)
    root = configs_root(safe, username, surface_folder)
    layout = read_surface_layout(safe, username, surface_folder)
    migrated = 0
    stripped = 0
    if not root.is_dir():
        write_surface_layout(safe, layout, username, surface_folder)
        return {"ok": True, "migrated": 0, "stripped": 0, "objects": len(layout)}

    for path in sorted(root.glob("*.cfg")):
        try:
            meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            continue
        pos = meta.get("pos") if isinstance(meta.get("pos"), dict) else {}
        if not pos and isinstance(meta.get("pose"), dict):
            pos = meta["pose"]
        pose = _normalize_pose_dict(pos)
        # id from dressup.id or config
        du = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
        cfg = meta.get("config") if isinstance(meta.get("config"), dict) else {}
        oid = ""
        if du.get("id"):
            oid = layout_object_id(str(du.get("id")))
        if not oid and cfg.get("id"):
            oid = layout_object_id(str(cfg.get("id")))
        if not oid:
            # chip-leaf[3].cfg / bin-book[0].cfg / tool-inbox[0].cfg
            stem = path.stem
            if stem.startswith("chip-"):
                oid = layout_object_id(stem[5:])
            elif stem.startswith("bin-"):
                oid = layout_object_id(stem)
            elif stem.startswith("tool-"):
                oid = layout_object_id(stem[5:])
        if pose and oid:
            # surface wins if already present; only fill gaps from object file
            if oid not in layout:
                layout[oid] = pose
                migrated += 1
            else:
                merged = dict(pose)
                merged.update(layout[oid])  # existing surface wins
                layout[oid] = merged
        if strip_object_pos and ("pos" in meta or "pose" in meta):
            meta.pop("pos", None)
            meta.pop("pose", None)
            try:
                path.write_text(dump_nested_fm(meta, body or ""), encoding="utf-8")
                stripped += 1
            except OSError:
                pass

    write_surface_layout(safe, layout, username, surface_folder)
    return {
        "ok": True,
        "migrated": migrated,
        "stripped": stripped,
        "objects": len(layout),
    }


def write_surface_paper(
    safe: Path,
    surface: dict[str, Any],
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    body: str = "",
    dressup: dict[str, Any] | None = None,
    config: dict[str, Any] | None = None,
    layout: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Write surface.cfg. If surface.auth changes, rename ~local/<user>/ folder.
    Returns updated read_surface_paper dict (paths after rename).
    Preserves layout: (object positions) unless layout= is passed.
    """
    migrate_username_folder(safe, username)
    cur = read_surface_paper(safe, username, surface_folder) or {}
    old_auth = (cur.get("surface") or {}).get("auth") or username
    new_auth = safe_user_segment(
        str(surface.get("auth") or old_auth or DEFAULT_USERNAME)
    )
    new_name = (surface.get("name") or DEFAULT_SURFACE_NAME).strip() or DEFAULT_SURFACE_NAME
    new_id = (surface.get("id") or DEFAULT_SURFACE_ID).strip() or DEFAULT_SURFACE_ID

    if new_auth != safe_user_segment(str(old_auth)):
        new_auth = rename_user_folder(safe, str(old_auth), new_auth)
        username = new_auth

    cur_dress = (cur.get("dressup") or {}) if isinstance(cur.get("dressup"), dict) else {}
    du = dict(dressup or cur_dress or {})
    dress_block = {
        "shell": du.get("shell") or "felt",
        "style": du.get("style") or "green",
    }
    cfg_in = config if isinstance(config, dict) else (cur.get("config") or {})
    cfg_block = {
        "type": cfg_in.get("type") or "surface",
        "subtype": cfg_in.get("subtype") or DEFAULT_SURFACE_SUBTYPE,
        "id": cfg_in.get("id") or DEFAULT_SURFACE_CONFIG_ID,
    }

    # preserve layout from disk unless caller replaces it
    path_pre = surface_paper_path(safe, new_auth, surface_folder)
    layout_block: dict[str, Any] = {}
    if layout is not None:
        for k, v in layout.items():
            oid = layout_object_id(str(k))
            pose = _normalize_pose_dict(v)
            if oid and pose:
                layout_block[oid] = pose
    elif path_pre.is_file():
        try:
            prev_meta, _ = parse_nested_fm(path_pre.read_text(encoding="utf-8"))
            prev_lay = prev_meta.get("layout") if isinstance(prev_meta.get("layout"), dict) else {}
            for k, v in prev_lay.items():
                oid = layout_object_id(str(k))
                pose = _normalize_pose_dict(v if isinstance(v, dict) else {})
                if oid and pose:
                    layout_block[oid] = pose
        except OSError:
            pass

    sections: dict[str, Any] = {
        "config": cfg_block,
        "surface": {
            "id": new_id,
            "name": new_name,
            "auth": new_auth,
        },
        "dressup": dress_block,
    }
    if layout_block:
        sections["layout"] = layout_block
    path = surface_paper_path(safe, new_auth, surface_folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    # preserve body if not explicitly provided empty wipe — use cur body when body=""
    body_out = body if body is not None else (cur.get("body") or "")
    path.write_text(dump_nested_fm(sections, body_out or ""), encoding="utf-8")

    # keep chip-cfg surface.auth in sync for open configs
    cfg_root = configs_root(safe, new_auth, surface_folder)
    if cfg_root.is_dir():
        for cf in cfg_root.glob("*.cfg"):
            try:
                meta, _b = parse_nested_fm(cf.read_text(encoding="utf-8"))
                if "surface" in meta and isinstance(meta["surface"], dict):
                    meta["surface"]["auth"] = new_auth
                    meta["surface"]["name"] = new_name
                    meta["surface"]["id"] = new_id
                    # rewrite keeping other sections
                    cf.write_text(dump_nested_fm(meta, _b), encoding="utf-8")
            except OSError:
                pass

    return read_surface_paper(safe, new_auth, surface_folder) or {
        "surface": sections["surface"],
        "path_display": rel_from_bay(safe, path),
    }


def read_surface_raw(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> tuple[Path | None, str | None, str | None]:
    data = read_surface_paper(safe, username, surface_folder)
    if not data:
        return None, None, None
    path = Path(data["_path"])
    try:
        return path, path.read_text(encoding="utf-8"), data.get("path_display")
    except OSError:
        return path, None, data.get("path_display")


def rel_from_bay(safe: Path, path: Path) -> str:
    try:
        bay = bay_root(safe).resolve()
        p = path.resolve()
        return p.relative_to(bay).as_posix()
    except Exception:
        return path.name


# ── nested frontmatter ───────────────────────────────────────────


def parse_nested_fm(text: str) -> tuple[dict[str, Any], str]:
    raw = text.replace("\r\n", "\n")
    if not raw.startswith("---\n"):
        return {}, raw
    end = raw.find("\n---\n", 4)
    if end < 0:
        return {}, raw
    block = raw[4:end]
    body = raw[end + 5 :]
    if body.startswith("\n"):
        body = body[1:]
    meta: dict[str, Any] = {}
    section: str | None = None
    for line in block.split("\n"):
        if not line.strip():
            continue
        if re.match(r"^[a-zA-Z_][\w]*:\s*$", line):
            section = line.split(":", 1)[0].strip()
            meta[section] = {}
            continue
        # allow dotted prop keys + layout ids: Mark.label · leaf[16] · shelf[0]
        m = re.match(r"^  ([a-zA-Z_][\w.\[\]]*)\s*:\s*(.*)$", line)
        if m and section:
            k, v = m.group(1), m.group(2).strip()
            meta[section][k] = _coerce_val(v)
            continue
        if ":" in line and not line.startswith(" "):
            section = None
            k, v = line.split(":", 1)
            meta[k.strip()] = _coerce_val(v.strip())
    return meta, body


def _coerce_val(v: str) -> Any:
    if v.startswith('"') and v.endswith('"'):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return v[1:-1]
    if v.startswith("[") or v.startswith("{"):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            pass
    if v.isdigit() or (v.startswith("-") and v[1:].isdigit()):
        return int(v)
    if v in ("true", "false"):
        return v == "true"
    # Hands plain words (not only JSON bools)
    if v in ("yes", "no"):
        return v == "yes"
    return v


def normalize_bin_prop(raw: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Bin/board config properties (config paper, not .bin membership).
      isTardis — bigger on the inside? (scroll/deep vs surface-fit clip)
      maxLoad  — max chips this bin will hold
    Flat prop: block (not prop.bin nesting) — one living shape for papers please.
    """
    out = dict(DEFAULT_BIN_PROP)
    if not isinstance(raw, dict):
        return out
    # tolerate accidental nesting prop.bin: {…}
    src = raw
    if isinstance(raw.get("bin"), dict) and "isTardis" not in raw and "maxLoad" not in raw:
        src = raw["bin"]
    if "isTardis" in src:
        v = src["isTardis"]
        if isinstance(v, bool):
            out["isTardis"] = v
        elif isinstance(v, str):
            out["isTardis"] = v.strip().lower() in ("true", "yes", "1", "on")
        else:
            out["isTardis"] = bool(v)
    if "maxLoad" in src:
        try:
            out["maxLoad"] = max(0, int(src["maxLoad"]))
        except (TypeError, ValueError):
            pass
    # office floor / multi-place (desk pocket → room) · keep through pose saves
    for k in ("place", "roomX", "roomY", "officeScale", "accepts"):
        if k not in src or src[k] is None or src[k] == "":
            continue
        if k in ("roomX", "roomY", "officeScale"):
            try:
                out[k] = float(src[k])
            except (TypeError, ValueError):
                out[k] = src[k]
        else:
            out[k] = src[k]
    return out


def _ordered_items(section: str, content: dict[str, Any]) -> list[tuple[str, Any]]:
    order = _KEY_ORDER.get(section) or ()
    seen: set[str] = set()
    out: list[tuple[str, Any]] = []
    for k in order:
        if k in content and content[k] is not None and content[k] != "":
            out.append((k, content[k]))
            seen.add(k)
    for k in sorted(content.keys()):
        if k in seen:
            continue
        v = content[k]
        if v is None or v == "":
            continue
        out.append((k, v))
    return out


def _prop_family(key: str) -> str:
    """Group prop keys so dump can leave a blank line between families."""
    k = str(key)
    if k in ("isTardis", "maxLoad"):
        return "board"
    # flags first: isMarkable + isMarked always together
    if k in ("isMarkable", "isMarked"):
        return "mark-flags"
    if k.startswith("can") or k.startswith("Can"):
        return "can"
    if k.startswith("Mark."):
        return "mark-detail"
    if k.startswith("Dressup."):
        return "dress"
    return "other"


def _ordered_prop_items(content: dict[str, Any]) -> list[tuple[str, Any]]:
    """prop dump order: isMarkable / isMarked first when leaf-like; Mark.* only when marked.

    Tool/receiver papers (canReceive, canMark, no leaf flags) dump without
    inventing isMarkable — that pair is for leaf scars, not every prop block.
    """
    def _yes(v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "yes", "1", "on")
        return bool(v)

    marked = _yes(content.get("isMarked"))
    leafish = (
        "isMarkable" in content
        or "isMarked" in content
        or any(str(k).startswith("Mark.") for k in content)
    )
    seen: set[str] = set()
    out: list[tuple[str, Any]] = []
    if leafish:
        for k in ("isMarkable", "isMarked"):
            if k in content and content[k] is not None and content[k] != "":
                out.append((k, content[k]))
                seen.add(k)
            elif k == "isMarkable":
                out.append((k, True))
                seen.add(k)
            elif k == "isMarked":
                out.append((k, False if not marked else True))
                seen.add(k)
    # tool plates: canMark + Mark.type is selection, not a leaf scar
    tool_plate = _yes(content.get("canMark"))
    for k, v in _ordered_items("prop", content):
        if k in seen:
            continue
        if str(k).startswith("Mark.") and not marked:
            # keep Mark.type on stampers (current plate); skip other Mark.* scars
            if tool_plate and k in ("Mark.type", "Mark.class", "Mark.types"):
                out.append((k, v))
                seen.add(k)
            continue
        out.append((k, v))
        seen.add(k)
    return out


def _fmt_fm_value(v: Any, *, yes_no: bool = False) -> str:
    if isinstance(v, bool):
        if yes_no:
            return "yes" if v else "no"
        return "true" if v else "false"
    if isinstance(v, (list, dict)):
        return json.dumps(v, ensure_ascii=False)
    sv = str(v)
    if ":" in sv or sv.startswith(" ") or sv == "":
        return json.dumps(sv, ensure_ascii=False)
    return sv


def dump_nested_fm(sections: dict[str, Any], body: str) -> str:
    """Write nested frontmatter. prop: gets blank lines between families (can / Mark / Dressup)."""
    lines = ["---"]
    names: list[str] = []
    for n in _SECTION_ORDER:
        if n in sections:
            names.append(n)
    for n in sections:
        if n not in names:
            names.append(n)
    for name in names:
        content = sections.get(name)
        if content is None:
            continue
        if isinstance(content, dict):
            lines.append(f"{name}:")
            items = (
                _ordered_prop_items(content)
                if name == "prop"
                else _ordered_items(name, content)
            )
            prev_family: str | None = None
            for k, v in items:
                if name == "prop":
                    fam = _prop_family(k)
                    if prev_family is not None and fam != prev_family:
                        lines.append("")  # open space between property sets
                    prev_family = fam
                    # capacities / is* flags read nicer as yes/no (AIDM ear)
                    yn = fam in ("can", "mark-flags") or k in (
                        "isTardis",
                        "isMarked",
                        "isMarkable",
                    )
                    lines.append(f"  {k}: {_fmt_fm_value(v, yes_no=yn)}")
                else:
                    lines.append(f"  {k}: {_fmt_fm_value(v)}")
        else:
            lines.append(f"{name}: {content}")
    lines.append("---")
    body = "" if body is None else str(body)
    return "\n".join(lines) + "\n" + body


def to_leaf_chip_id(old_id: str) -> str:
    """Normalize to stable uid: leaf[0], leaf[1], … (also accepts leaf_thepaper[0] legacy).

    Never invents leaf_* for card chips — those use to_card_id.
    """
    s = str(old_id or "").strip()
    if not s:
        return "leaf[0]"
    # strip chip- prefix / .chip
    if s.endswith(".chip"):
        s = s[: -len(".chip")]
    if s.startswith("chip-"):
        s = s[5:]
    # card[0]-title → not a leaf (Jason bug: used to become leaf_card[0])
    if re.match(r"^card(\[|_)", s) or re.match(r"^card\d", s):
        return ""  # empty · callers must reject
    # leaf[0]-thepaper → leaf[0]
    m = re.match(r"^(leaf\[[0-9]+\])", s)
    if m:
        return m.group(1)
    m = re.match(r"^(leaf_\w*\[[0-9]+\])", s)
    if m:
        return m.group(1)
    if s.startswith("leaf[") or s.startswith("leaf_"):
        return s
    if s.startswith("lf-"):
        return "leaf_" + s[3:]
    return s if s.startswith("leaf") else "leaf_" + s


def title_slug(title: str, fallback: str = "untitled") -> str:
    """Filesystem-safe tail from current face name (searchable)."""
    s = (title or "").strip().lower()
    s = re.sub(r"['’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "", s)  # thepaper from "the paper"
    if not s:
        s = fallback
    return s[:48]


def chip_filename_for(uid: str, title: str) -> str:
    """leaf[0]-thepaper.chip — uid fixed, tail follows name."""
    uid = to_leaf_chip_id(uid)
    slug = title_slug(title)
    # allow [0] in uid
    uid_safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    return f"{uid_safe}-{slug}.chip"


def chip_filename(chip_id: str) -> str:
    """Legacy helper: uid-only name (prefer chip_filename_for)."""
    uid = to_leaf_chip_id(chip_id)
    safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    if not safe.endswith(".chip"):
        safe = safe + ".chip"
    return safe


def chip_path(safe: Path, chip_id: str) -> Path | None:
    """Resolve by uid: leaf[0]-*.chip, store.file, or chip.uid / chip.id in frontmatter."""
    raw = str(chip_id or "").strip()
    # never treat cards (or empty) as leaves — to_leaf_chip_id("") → leaf[0]
    # was the card-drop trap that yanked Sophia's paper into boards
    if not raw:
        return None
    if re.match(r"^card(\[|_)", raw) or re.match(r"^card\d", raw):
        return None
    uid = to_leaf_chip_id(chip_id)
    if not uid:
        return None
    uid_safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    for root in (library_root(safe), legacy_chips_root(safe)):
        if not root.is_dir():
            continue
        # exact legacy uid.chip
        p = root / f"{uid_safe}.chip"
        if p.is_file():
            return p
        # hybrid: leaf[0]-*.chip
        matches = sorted(root.glob(f"{uid_safe}-*.chip"))
        if matches:
            return matches[0]
        for f in root.glob("*.chip"):
            try:
                meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
            except OSError:
                continue
            chip = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
            store = meta.get("store") if isinstance(meta.get("store"), dict) else {}
            cid = (chip or {}).get("uid") or (chip or {}).get("id")
            if cid and to_leaf_chip_id(str(cid)) == uid:
                return f
            if store.get("file") == f.name:
                # verify uid if present
                if not cid or to_leaf_chip_id(str(cid)) == uid:
                    return f
    return None


def leaf_api_from_chip_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    # store vend card · never mount as leaf (even if someone globs *.chip)
    name = path.name
    if name.startswith("card[") or name.startswith("card_"):
        return None
    meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
    chip = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
    pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}
    store = meta.get("store") if isinstance(meta.get("store"), dict) else {}
    if str(store.get("subtype") or "").lower() == "card":
        return None
    if str(chip.get("type") or "").lower() == "card":
        return None
    raw_probe = str(chip.get("uid") or chip.get("id") or path.stem)
    if re.match(r"^card(\[|_)", raw_probe):
        return None
    if not chip and meta.get("id"):
        chip = {
            "uid": meta.get("id"),
            "id": meta.get("id"),
            "auth": meta.get("author") or meta.get("auth") or "unknown",
            "name": meta.get("title") or meta.get("name") or meta.get("bud") or "untitled",
        }
        pin = {
            "tps_created": meta.get("created") or 0,
            "tps_updated": meta.get("updated") or 0,
            "tags": meta.get("tags") or [],
            "stamps": meta.get("stamps") or [],
        }
    raw_id = chip.get("uid") or chip.get("id") or path.stem
    # stem leaf[0]-thepaper → uid leaf[0]
    cid = to_leaf_chip_id(str(raw_id))
    if not cid or not (cid.startswith("leaf[") or cid.startswith("leaf_")):
        return None
    if "-" in path.stem and path.stem.startswith("leaf"):
        cid = to_leaf_chip_id(path.stem)
        if not cid:
            return None
    stamps = pin.get("stamps") or chip.get("stamps") or []
    if isinstance(stamps, str):
        try:
            stamps = json.loads(stamps)
        except json.JSONDecodeError:
            stamps = []
    tags = pin.get("tags") or []
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except json.JSONDecodeError:
            tags = []
    cites = pin.get("cites") or []
    if isinstance(cites, str):
        try:
            cites = json.loads(cites)
        except json.JSONDecodeError:
            cites = [cites] if cites.strip() else []
    if not isinstance(cites, list):
        cites = []
    title = chip.get("name") or chip.get("bud") or "untitled leaf"
    return {
        "id": cid,
        "uid": cid,
        "title": title,
        "author": chip.get("auth") or "unknown",
        "kind": "leaf",
        "shell": "paper",
        "style": "lined",
        "paper": "lined",
        "stamps": stamps if isinstance(stamps, list) else [],
        "tags": tags if isinstance(tags, list) else [],
        "cites": [str(c).strip() for c in cites if str(c).strip()],
        "created": int(pin.get("tps_created") or 0),
        "updated": int(pin.get("tps_updated") or 0),
        "body": body if body is not None else "",
        "store_file": store.get("file") or path.name,
        "_file": path.name,
        "_path": str(path.resolve()),
        "_rel": None,
        "_chip": True,
    }


def write_leaf_chip(safe: Path, leaf: dict[str, Any]) -> Path:
    """
    Write chip to library.
    uid stable; filename = leaf[0]-<title-slug>.chip renames when name changes.
    Never invent/wipe body on accidental empty (None preserves).
    """
    ensure_user_tree(safe)
    uid = to_leaf_chip_id(str(leaf.get("uid") or leaf.get("id") or PRIMARY_CHIP_ID))
    leaf["id"] = uid
    leaf["uid"] = uid
    title = leaf.get("title") or leaf.get("name") or "untitled leaf"
    t = now()
    created = int(leaf.get("created") or t)
    tags = leaf.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    stamps = leaf.get("stamps") or []
    if not isinstance(stamps, list):
        stamps = []
    cites = leaf.get("cites") or []
    if not isinstance(cites, list):
        cites = []
    cites = [str(c).strip() for c in cites if str(c).strip()]

    fname = chip_filename_for(uid, title)
    path = library_root(safe) / fname
    path.parent.mkdir(parents=True, exist_ok=True)

    # existing file for this uid (maybe old name tail)
    old = chip_path(safe, uid)
    body = leaf.get("body")
    if body is None and old and old.is_file():
        try:
            _, prev_body = parse_nested_fm(old.read_text(encoding="utf-8"))
            body = prev_body
        except OSError:
            body = ""
    if body is None and path.is_file():
        try:
            _, prev_body = parse_nested_fm(path.read_text(encoding="utf-8"))
            body = prev_body
        except OSError:
            body = ""
    if body is None:
        body = ""

    # rename if title slug changed
    if old and old.is_file() and old.resolve() != path.resolve():
        try:
            if path.is_file():
                path.unlink()
            old.replace(path)
        except OSError:
            try:
                path.write_text(old.read_text(encoding="utf-8"), encoding="utf-8")
                old.unlink()
            except OSError:
                pass

    store_block: dict[str, Any] = {"file": fname}
    chip_block: dict[str, Any] = {
        "uid": uid,
        "name": title,
        "auth": (leaf.get("author") or "unknown").strip() or "unknown",
    }
    if stamps:
        chip_block["stamps"] = stamps
    pin_block: dict[str, Any] = {
        "tps_created": created,
        "tps_updated": t,
        "tags": tags,
    }
    if cites:
        pin_block["cites"] = cites
    # preserve cites from existing file when save doesn't pass them
    if not cites and old and old.is_file():
        try:
            prev_meta, _ = parse_nested_fm(old.read_text(encoding="utf-8"))
            prev_pin = (
                prev_meta.get("pin")
                if isinstance(prev_meta.get("pin"), dict)
                else {}
            )
            prev_cites = prev_pin.get("cites") or []
            if isinstance(prev_cites, list) and prev_cites:
                pin_block["cites"] = [
                    str(c).strip() for c in prev_cites if str(c).strip()
                ]
        except OSError:
            pass
    sections: dict[str, Any] = {
        "store": store_block,
        "chip": chip_block,
        "pin": pin_block,
    }

    # remove other copies same uid (legacy names / empty dups)
    for root in (library_root(safe), legacy_chips_root(safe)):
        if not root.is_dir():
            continue
        for f in root.glob("*.chip"):
            if f.resolve() == path.resolve():
                continue
            try:
                meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
                ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
                cid = (ch or {}).get("uid") or (ch or {}).get("id")
                stem_uid = to_leaf_chip_id(f.stem)
                if (cid and to_leaf_chip_id(str(cid)) == uid) or stem_uid == uid:
                    f.unlink()
            except OSError:
                pass

    path.write_text(dump_nested_fm(sections, body), encoding="utf-8")
    return path


def list_leaf_chips(safe: Path) -> list[dict[str, Any]]:
    ensure_user_tree(safe)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    paths: list[Path] = []
    for root in (library_root(safe), legacy_chips_root(safe)):
        if not root.is_dir():
            continue
        # only leaf matter — never card[n]-*.chip (those are store vend cards)
        paths.extend(root.glob("leaf[*.chip"))
        paths.extend(root.glob("leaf_*.chip"))
    for p in sorted(paths, key=lambda x: x.stat().st_mtime):
        leaf = leaf_api_from_chip_file(p)
        if not leaf:
            continue
        lid = str(leaf["id"])
        if not (lid.startswith("leaf[") or lid.startswith("leaf_")):
            continue
        if lid in seen:
            continue
        seen.add(lid)
        leaf["_rel"] = rel_from_bay(safe, p)
        out.append(
            {
                "id": lid,
                "uid": lid,
                "title": leaf["title"],
                "author": leaf.get("author") or "unknown",
                "updated": leaf.get("updated") or 0,
                "chars": len(leaf.get("body") or ""),
                "file": leaf.get("_file") or leaf.get("store_file") or p.name,
                "_rel": leaf["_rel"],
            }
        )
    return out


def delete_leaf_chip(safe: Path, chip_id: str) -> bool:
    p = chip_path(safe, to_leaf_chip_id(chip_id))
    if not p or not p.is_file():
        return False
    try:
        p.unlink()
        return True
    except OSError:
        return False


def primary_leaf(safe: Path) -> dict[str, Any] | None:
    # prefer named primary
    p = chip_path(safe, PRIMARY_CHIP_ID)
    if p:
        leaf = leaf_api_from_chip_file(p)
        if leaf:
            leaf["_rel"] = rel_from_bay(safe, p)
            return leaf
    rows = list_leaf_chips(safe)
    non_red = [r for r in rows if "red" not in str(r["id"]).lower()]
    if not non_red:
        return None
    # oldest created
    best = None
    best_t = 1 << 62
    for r in non_red:
        p = chip_path(safe, r["id"])
        if not p:
            continue
        leaf = leaf_api_from_chip_file(p)
        if not leaf:
            continue
        t = int(leaf.get("created") or 0)
        if t < best_t:
            best_t = t
            best = leaf
            best["_rel"] = rel_from_bay(safe, p)
    return best


def normalize_leaf_dressup(du: dict[str, Any] | None) -> dict[str, Any]:
    """
    Hands law: shell = form (paper) · style = costume (lined .dsc).
    Fix inverted legacy {style: paper, shell: lined}.
    """
    du = dict(du or {})
    shell = str(du.get("shell") or "").strip()
    style = str(du.get("style") or "").strip()
    costumes = {"lined", "plain", "dotted", "letter"}
    forms = {"paper", "card", "ticket", "fragment"}
    # shell must be form; if shell is a costume name, it's inverted/wrong
    if shell in costumes:
        if not style or style in forms or style == shell:
            style = shell if shell in costumes else (style or "lined")
        shell = "paper"
    if style in forms:
        style = "lined"
    if not shell or shell in costumes:
        shell = "paper"
    if not style or style in forms:
        style = "lined"
    out = {"shell": shell, "style": style}
    if du.get("id"):
        out["id"] = du["id"]
    return out


def ensure_primary_leaf(safe: Path) -> dict[str, Any]:
    """
    Ensure primary chip path exists. Does NOT rewrite body if the chip is already there.
    """
    ensure_user_tree(safe)
    apply_primary_migration(safe)
    leaf = primary_leaf(safe)
    if leaf:
        return leaf
    # only first birth of the desk
    t = now()
    leaf = {
        "id": PRIMARY_CHIP_ID,
        "title": PRIMARY_TITLE,
        "author": "unknown",
        "paper": "lined",
        "shell": "paper",
        "style": "lined",
        "stamps": [],
        "tags": [],
        "body": "",
        "created": t,
        "updated": t,
    }
    write_leaf_chip(safe, leaf)
    write_leaf_config(
        safe,
        PRIMARY_CHIP_ID,
        pose={"x": 48, "y": 48, "openW": 360, "openH": 460},
        dressup={"shell": "paper", "style": "lined", "id": PRIMARY_CHIP_ID},
        config_id=PRIMARY_CONFIG_ID,
    )
    p = chip_path(safe, PRIMARY_CHIP_ID)
    out = leaf_api_from_chip_file(p) if p else leaf
    if out and p:
        out["_rel"] = rel_from_bay(safe, p)
    return out


def apply_primary_migration(safe: Path) -> None:
    """
    Path / naming migrations only. Never wipe body of an existing primary chip.
    """
    ensure_user_tree(safe)
    lib = library_root(safe)
    old_ids = LEGACY_CHIP_IDS + ("leaf_1785806183", "leaf_thepaper[0]")

    existing = chip_path(safe, PRIMARY_CHIP_ID)
    # hybrid already present (leaf[0]-*.chip)
    if existing and existing.name.startswith("leaf[0]-"):
        pass
    else:
        body = None
        created = None
        author = "unknown"
        title = PRIMARY_TITLE
        src = existing
        for oid in old_ids:
            op = chip_path(safe, oid)
            if not op:
                for cand in (
                    lib / f"{oid}.chip",
                    lib / chip_filename(oid),
                    legacy_chips_root(safe) / chip_filename(oid),
                ):
                    if cand.is_file():
                        op = cand
                        break
            if op and op.is_file():
                old = leaf_api_from_chip_file(op)
                if old and (old.get("body") or "").strip():
                    body = old.get("body")
                    created = old.get("created")
                    author = old.get("author") or "unknown"
                    title = old.get("title") or PRIMARY_TITLE
                    src = op
                    break
                if old and body is None:
                    body = old.get("body") or ""
                    created = old.get("created")
                    author = old.get("author") or "unknown"
                    title = old.get("title") or PRIMARY_TITLE
                    src = op
        if src is not None or body is not None:
            leaf = {
                "id": PRIMARY_CHIP_ID,
                "uid": PRIMARY_CHIP_ID,
                "title": title,
                "author": author,
                "body": body if body is not None else "",
                "created": created or now(),
                "tags": [],
                "stamps": [],
            }
            write_leaf_chip(safe, leaf)
            # cleanup legacy single-name files
            for f in lib.glob("*.chip"):
                if f.name.startswith("leaf[0]-"):
                    continue
                try:
                    meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
                    ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
                    cid = (ch or {}).get("uid") or (ch or {}).get("id") or f.stem
                    if to_leaf_chip_id(str(cid)) in (
                        PRIMARY_CHIP_ID,
                        "leaf_thepaper[0]",
                    ) or f.stem in old_ids:
                        # only delete if we have the hybrid primary
                        if chip_path(safe, PRIMARY_CHIP_ID):
                            f.unlink()
                except OSError:
                    pass

    # config migrate → chip-leaf[0].cfg
    new_cfg = configs_root(safe) / f"{PRIMARY_CONFIG_ID}.cfg"
    migrate_surface_under_surfaces_shelf(safe)
    ensure_surface_paper(safe)

    pose: dict[str, Any] = {
        "x": 360,
        "y": 600,
        "openW": 420,
        "openH": 360,
        "termW": 400,
        "termH": 500,
    }
    dress = {"shell": "paper", "style": "lined", "id": PRIMARY_CHIP_ID}
    # true legacy names only — never treat live chip-leaf[0].cfg as "old"
    # (that rewrote leaf[0] to x:1853 on every boot and hammered surface.cfg)
    legacy_cfg_names = (
        "chip-leaf_1785806183.cfg",
        "leaf_1785806183.cfg",
        "chip-leaf_thepaper-993fxe32.cfg",
        "chip-leaf_thepaper-993fxe32.1.cfg",
        "chip-leaf_thepaper[0].cfg",
    )
    search_dirs = [
        configs_root(safe),
        local_root(safe) / DEFAULT_USERNAME / DEFAULT_SURFACE_FOLDER / "configs",
        safe / "USER" / "configs" / "pocket-desktop",
    ]
    found_legacy: Path | None = None
    for d in search_dirs:
        if not d.is_dir():
            continue
        for name in legacy_cfg_names:
            op = d / name
            if not op.is_file():
                continue
            found_legacy = op
            try:
                meta, _ = parse_nested_fm(op.read_text(encoding="utf-8"))
            except OSError:
                meta = {}
            pos = meta.get("pos") or meta.get("pose") or {}
            if isinstance(pos, dict) and pos:
                pose = {**pose, **pos}
            du = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
            if du:
                dress = normalize_leaf_dressup(du)
                dress["id"] = PRIMARY_CHIP_ID
            break
        if found_legacy:
            break

    # only mint primary cfg when missing — never thrash pose every ensure()
    if not new_cfg.is_file():
        # prefer existing surface layout pose if any
        existing = get_surface_object_pose(safe, PRIMARY_CHIP_ID)
        if existing:
            pose = {**pose, **existing}
        write_leaf_config(
            safe,
            PRIMARY_CHIP_ID,
            pose=pose,
            dressup=dress,
            config_id=PRIMARY_CONFIG_ID,
        )
    elif found_legacy:
        # one-shot fold dress from legacy file; do NOT pass pose (surface owns it)
        write_leaf_config(
            safe,
            PRIMARY_CHIP_ID,
            pose=None,
            dressup=dress,
            config_id=PRIMARY_CONFIG_ID,
        )
    for d in search_dirs:
        if not d.is_dir():
            continue
        for name in legacy_cfg_names:
            op = d / name
            if op.is_file():
                try:
                    op.unlink()
                except OSError:
                    pass
    migrate_surface_under_surfaces_shelf(safe)


def migrate_surface_under_surfaces_shelf(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> None:
    """
    Move ~local/user/ArchivistDesk → ~local/user/surfaces/ArchivistDesk
    so surface names never collide with library/.
    """
    old = local_root(safe) / (username or DEFAULT_USERNAME) / (surface_folder or DEFAULT_SURFACE_FOLDER)
    new = surface_root(safe, username, surface_folder)
    if not old.is_dir():
        return
    # if old path is already under surfaces/, skip
    try:
        old.resolve().relative_to(surfaces_root(safe, username).resolve())
        return
    except ValueError:
        pass
    if new.resolve() == old.resolve():
        return
    new.parent.mkdir(parents=True, exist_ok=True)
    if not new.exists():
        try:
            shutil.move(str(old), str(new))
            return
        except OSError:
            pass
    # merge configs if both exist
    old_cfg = old / "configs"
    new_cfg = new / "configs"
    if old_cfg.is_dir():
        new_cfg.mkdir(parents=True, exist_ok=True)
        for f in old_cfg.glob("*"):
            dest = new_cfg / f.name
            if not dest.exists():
                try:
                    shutil.move(str(f), str(dest))
                except OSError:
                    shutil.copy2(f, dest)
                    try:
                        f.unlink()
                    except OSError:
                        pass
    # remove emptied old tree
    try:
        if old.exists():
            shutil.rmtree(old, ignore_errors=True)
    except OSError:
        pass


# ── config ───────────────────────────────────────────────────────


def config_path_for_leaf(
    safe: Path,
    leaf_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    config_id: str | None = None,
) -> Path:
    cid = to_leaf_chip_id(leaf_id)
    if config_id:
        stem = config_id
    elif cid == PRIMARY_CHIP_ID:
        stem = PRIMARY_CONFIG_ID
    else:
        stem = f"chip-{cid}"
    if not stem.endswith(".cfg"):
        stem = stem + ".cfg" if not stem.endswith(".cfg") else stem
    # stem may already include .1; ensure .cfg
    fname = stem if stem.endswith(".cfg") else stem + ".cfg"
    return configs_root(safe, username, surface_folder) / fname


def write_leaf_config(
    safe: Path,
    leaf_id: str,
    pose: dict[str, Any] | None = None,
    dressup: dict[str, Any] | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    config_id: str | None = None,
    prop: dict[str, Any] | None = None,
) -> Path:
    """Write leaf instance cfg. Always preserves existing prop (stamps) on pose-only saves.

    prop=None → keep previous prop section (drag must not erase isMarked / Mark.*).
    prop=dict → merge into previous (use write_leaf_config_with_prop for marks).
    """
    # single writer — never drop scar marks when only pose/dress moves
    return write_leaf_config_with_prop(
        safe,
        leaf_id,
        pose=pose,
        dressup=dressup,
        prop=prop,
        username=username,
        surface_folder=surface_folder,
        config_id=config_id,
    )


def read_leaf_config(
    safe: Path,
    leaf_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any] | None:
    cid = to_leaf_chip_id(leaf_id)
    path = config_path_for_leaf(safe, cid, username, surface_folder)
    root = configs_root(safe, username, surface_folder)
    # prefer primary chip-leaf[n].cfg; fall back to legacy chip-leaf[n].1.cfg
    if not path.is_file() and root.is_dir():
        legacy_1 = root / f"chip-{cid}.1.cfg"
        if legacy_1.is_file():
            path = legacy_1
        else:
            for f in root.glob("chip-*.cfg"):
                if cid in f.stem or f.stem == f"chip-{cid}":
                    path = f
                    break
    if not path.is_file():
        return None
    meta, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
    # geometry: board pocket layout if nested, else desk surface.layout
    legacy = meta.get("pos") if isinstance(meta.get("pos"), dict) else {}
    if not legacy and isinstance(meta.get("pose"), dict):
        legacy = meta["pose"]
    pos = resolve_leaf_pose(
        safe, cid, username, surface_folder, legacy=legacy
    )
    dress = normalize_leaf_dressup(
        meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
    )
    if not dress.get("id"):
        dress["id"] = cid
    cfg = meta.get("config") if isinstance(meta.get("config"), dict) else {}
    surf = meta.get("surface") if isinstance(meta.get("surface"), dict) else {}
    prop = normalize_leaf_prop(
        meta.get("prop") if isinstance(meta.get("prop"), dict) else None
    )
    rel = rel_from_bay(safe, path)
    return {
        "config": cfg,
        "surface": surf,
        "pose": pos,  # pocket-local if on board; felt if free
        "pos": pos,
        "dressup": dress,
        "prop": prop,
        "_path": str(path.resolve()),
        "_file": path.name,
        "_rel": rel,
        "path_display": rel,
    }


def read_config_raw(
    safe: Path,
    leaf_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> tuple[Path | None, str | None, str | None]:
    cfg = read_leaf_config(safe, leaf_id, username, surface_folder)
    if not cfg:
        return None, None, None
    path = Path(cfg["_path"])
    try:
        return path, path.read_text(encoding="utf-8"), cfg.get("path_display")
    except OSError:
        return path, None, cfg.get("path_display")


def n_from_uid(uid: str) -> int:
    m = re.match(r"^leaf\[(\d+)\]", to_leaf_chip_id(uid))
    return int(m.group(1)) if m else 0


def next_leaf_uid(safe: Path) -> str:
    """Next free primary unit leaf[n] (not instance leaf[n.m])."""
    used: set[int] = set()
    for row in list_leaf_chips(safe):
        uid = to_leaf_chip_id(str(row.get("uid") or row.get("id") or ""))
        m = re.match(r"^leaf\[(\d+)\]$", uid)
        if m:
            used.add(int(m.group(1)))
    n = 0
    while n in used:
        n += 1
    return f"leaf[{n}]"


def spawn_leaf(
    safe: Path,
    title: str = "untitled",
    author: str = "unknown",
    x: float | None = None,
    y: float | None = None,
) -> dict[str, Any]:
    """
    New primary leaf on the surface (local studio spawn).
    uid = next leaf[n]; file = leaf[n]-<slug>.chip; cfg with pos at click.
    """
    ensure_user_tree(safe)
    uid = next_leaf_uid(safe)
    t = now()
    leaf = {
        "id": uid,
        "uid": uid,
        "title": (title or "untitled").strip() or "untitled",
        "author": (author or "unknown").strip() or "unknown",
        "body": "",
        "created": t,
        "updated": t,
        "stamps": [],
        "tags": [],
        "paper": "lined",
        "shell": "paper",
        "style": "lined",
    }
    write_leaf_chip(safe, leaf)
    ni = n_from_uid(uid)
    pose = {
        "x": int(x) if x is not None else 48 + (ni % 8) * 28,
        "y": int(y) if y is not None else 48 + (ni % 6) * 24,
        "openW": 360,
        "openH": 460,
    }
    write_leaf_config(
        safe,
        uid,
        pose=pose,
        dressup={"shell": "paper", "style": "lined", "id": uid},
        prop={"isMarkable": True, "isMarked": False},
        config_id=f"chip-{uid}",
    )
    p = chip_path(safe, uid)
    full = leaf_api_from_chip_file(p) if p else leaf
    if full and p:
        full["_rel"] = rel_from_bay(safe, p)
        full["style"] = "lined"
        full["paper"] = "lined"
        full["shell"] = "paper"
    cfg = read_leaf_config(safe, uid)
    return {"leaf": full, "config": cfg}


# ── card chips (store vend · index face · not a leaf) ───────────────────────
# Face/kit/dress live in ~host/marketplace/chips/card/ — not baked into app.js.
# Matter: library/card[n]-slug.chip · config: chip-card[n].cfg

CARD_BODY_MAX = 520


def to_card_id(raw: str) -> str:
    """Canonical card uid: card[n]."""
    s = str(raw or "").strip()
    if not s:
        return "card[0]"
    if s.endswith(".chip"):
        s = s[: -len(".chip")]
    if s.startswith("chip-"):
        s = s[5:]
    m = re.match(r"^(card\[[0-9]+\])", s)
    if m:
        return m.group(1)
    m = re.search(r"card\[(\d+)\]", s)
    if m:
        return f"card[{m.group(1)}]"
    return s if s.startswith("card[") else f"card_{s}"


def is_card_id(oid: str) -> bool:
    return bool(re.match(r"^card\[\d+\]$", to_card_id(oid)))


def n_from_card_uid(uid: str) -> int:
    m = re.match(r"^card\[(\d+)\]", to_card_id(uid))
    return int(m.group(1)) if m else 0


def next_card_uid(safe: Path) -> str:
    used: set[int] = set()
    lib = library_root(safe)
    if lib.is_dir():
        for f in lib.glob("card[*.chip"):
            m = re.match(r"^card\[(\d+)\]", f.name)
            if m:
                used.add(int(m.group(1)))
    root = configs_root(safe)
    if root.is_dir():
        for f in root.glob("chip-card[*.cfg"):
            m = re.search(r"card\[(\d+)\]", f.stem)
            if m:
                used.add(int(m.group(1)))
    n = 0
    while n in used:
        n += 1
    return f"card[{n}]"


def card_filename_for(uid: str, title: str) -> str:
    uid = to_card_id(uid)
    slug = title_slug(title, fallback="card")
    uid_safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    return f"{uid_safe}-{slug}.chip"


def card_path(safe: Path, card_id: str) -> Path | None:
    uid = to_card_id(card_id)
    lib = library_root(safe)
    if not lib.is_dir():
        return None
    for f in lib.glob("card[*.chip"):
        if f.name.startswith(uid + "-") or f.stem == uid:
            return f
    # slow path: read uid from matter
    for f in lib.glob("card[*.chip"):
        try:
            meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
            ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
            cid = to_card_id(str(ch.get("uid") or ch.get("id") or ""))
            if cid == uid:
                return f
        except OSError:
            continue
    return None


def card_api_from_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file() or path.suffix.lower() != ".chip":
        return None
    try:
        meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
    except OSError:
        return None
    ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
    pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}
    store = meta.get("store") if isinstance(meta.get("store"), dict) else {}
    uid = to_card_id(str(ch.get("uid") or ch.get("id") or path.stem))
    body = body or ""
    if len(body) > CARD_BODY_MAX:
        body = body[:CARD_BODY_MAX]
    return {
        "id": uid,
        "uid": uid,
        "kind": "card",
        "type": "card",
        "title": ch.get("name") or "untitled card",
        "name": ch.get("name") or "untitled card",
        "author": ch.get("auth") or "unknown",
        "auth": ch.get("auth") or "unknown",
        "subject": ch.get("subject") or "",
        "body": body,
        "created": pin.get("tps_created"),
        "updated": pin.get("tps_updated"),
        "tags": pin.get("tags") if isinstance(pin.get("tags"), list) else [],
        "stamps": ch.get("stamps") if isinstance(ch.get("stamps"), list) else [],
        "package_id": "card",
        "_file": path.name,
        "_path": str(path.resolve()),
        "_chip": True,
        "store": store,
    }


def write_card_chip(safe: Path, card: dict[str, Any]) -> Path:
    """Write card matter · limited body · title / by / subject."""
    ensure_user_tree(safe)
    uid = to_card_id(str(card.get("uid") or card.get("id") or next_card_uid(safe)))
    title = (card.get("title") or card.get("name") or "untitled card").strip() or "untitled card"
    author = (card.get("author") or card.get("auth") or "unknown").strip() or "unknown"
    subject = (card.get("subject") or "").strip()
    t = now()
    created = int(card.get("created") or t)
    body = card.get("body")
    old = card_path(safe, uid)
    if body is None and old and old.is_file():
        try:
            _, prev = parse_nested_fm(old.read_text(encoding="utf-8"))
            body = prev
        except OSError:
            body = ""
    if body is None:
        body = ""
    body = str(body)
    if len(body) > CARD_BODY_MAX:
        body = body[:CARD_BODY_MAX]
    stamps = card.get("stamps") if isinstance(card.get("stamps"), list) else []
    tags = card.get("tags") if isinstance(card.get("tags"), list) else []
    fname = card_filename_for(uid, title)
    path = library_root(safe) / fname
    path.parent.mkdir(parents=True, exist_ok=True)
    if old and old.is_file() and old.resolve() != path.resolve():
        try:
            if path.is_file():
                path.unlink()
            old.replace(path)
        except OSError:
            pass
    sections = {
        "store": {"file": fname, "type": "chip", "subtype": "card"},
        "chip": {
            "uid": uid,
            "name": title,
            "auth": author,
            "type": "card",
            **({"subject": subject} if subject else {}),
            **({"stamps": stamps} if stamps else {}),
        },
        "pin": {
            "tps_created": created,
            "tps_updated": t,
            "tags": tags,
        },
    }
    path.write_text(dump_nested_fm(sections, body), encoding="utf-8")
    # drop other copies of same uid
    for f in library_root(safe).glob("card[*.chip"):
        if f.resolve() == path.resolve():
            continue
        try:
            meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
            ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
            if to_card_id(str(ch.get("uid") or "")) == uid:
                f.unlink()
        except OSError:
            pass
    return path


def write_card_config(
    safe: Path,
    card_id: str,
    pose: dict[str, Any] | None = None,
    dressup: dict[str, Any] | None = None,
    prop: dict[str, Any] | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    """Card instance cfg · dress + prop; pose routes like leaves:

    · on a board → that board's config layout: (pocket-local)
    · free on desk → surface.layout
    """
    ensure_user_tree(safe)
    cid = to_card_id(card_id)
    cfg_id = f"chip-{cid}"
    path = configs_root(safe, username, surface_folder) / f"{cfg_id}.cfg"
    path.parent.mkdir(parents=True, exist_ok=True)
    prev: dict[str, Any] = {}
    if path.is_file():
        try:
            prev, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            prev = {}
    prev_du = prev.get("dressup") if isinstance(prev.get("dressup"), dict) else {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}
    if pose:
        pose_out = _normalize_pose_dict(pose)
        pose_out.pop("open", None)
        if pose_out:
            owner = leaf_owner_bin(safe, cid)
            if owner and re.match(r"^(board|deck)\[", str(owner)):
                # pin on the box/deck — not desk surface
                upsert_bin_member_pose(
                    safe, str(owner), cid, pose_out, username, surface_folder
                )
                remove_surface_object_pose(
                    safe, cid, username, surface_folder
                )
            else:
                upsert_surface_object_pose(
                    safe, cid, pose_out, username, surface_folder
                )
    raw_du = dict(prev_du)
    if dressup:
        raw_du.update(dressup)
    face = (
        raw_du.get("face")
        or raw_du.get("style")
        or raw_du.get("tool")
        or "plain"
    )
    du = {
        "id": raw_du.get("id") or cid,
        "shell": "card",
        "face": str(face).strip() or "plain",
        "style": str(face).strip() or "plain",
    }
    prop_out = dict(prev_prop)
    if prop:
        for k, v in prop.items():
            # allow clearing home (unfile) with empty/null/false
            if k == "homeBin" and (
                v is None or v is False or (isinstance(v, str) and not v.strip())
            ):
                prop_out.pop("homeBin", None)
                continue
            if v is None or v == "":
                continue
            if k in ("isMarked", "isMarkable", "canMark"):
                prop_out[k] = _truthy_yes(v)
            else:
                prop_out[k] = v
    if "isMarkable" not in prop_out:
        prop_out["isMarkable"] = True
    if "isMarked" not in prop_out:
        prop_out["isMarked"] = False
    # never keep a blank homeBin scar
    hb = prop_out.get("homeBin")
    if hb is None or hb is False or (isinstance(hb, str) and not str(hb).strip()):
        prop_out.pop("homeBin", None)
    prop_out = normalize_leaf_prop(prop_out)
    surf_paper = read_surface_paper(safe, username, surface_folder)
    surf = (surf_paper or {}).get("surface") or {}
    sections: dict[str, Any] = {
        "config": {
            "type": "chip",
            "subtype": "card",
            "id": cfg_id,
        },
        "surface": {
            "id": surf.get("id") or DEFAULT_SURFACE_ID,
            "name": surf.get("name") or DEFAULT_SURFACE_NAME,
            "auth": surf.get("auth") or username or DEFAULT_USERNAME,
        },
        "dressup": du,
        "prop": prop_out,
    }
    path.write_text(dump_nested_fm(sections, ""), encoding="utf-8")
    return path


def read_card_config(
    safe: Path,
    card_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any] | None:
    cid = to_card_id(card_id)
    path = configs_root(safe, username, surface_folder) / f"chip-{cid}.cfg"
    if not path.is_file():
        return None
    meta, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
    legacy = meta.get("pos") if isinstance(meta.get("pos"), dict) else {}
    pos = dict(_normalize_pose_dict(legacy))
    # board/deck pocket layout wins when nested (same law as leaves)
    owner = leaf_owner_bin(safe, cid)
    if owner and re.match(r"^(board|deck)\[", str(owner)):
        pin = get_bin_member_pose(
            safe, str(owner), cid, username, surface_folder
        )
        if pin:
            pos.update(pin)
        else:
            # pre-migrate: leftover desk coords
            surface_pose = get_surface_object_pose(
                safe, cid, username, surface_folder
            )
            if surface_pose:
                pos.update(surface_pose)
    else:
        surface_pose = get_surface_object_pose(
            safe, cid, username, surface_folder
        )
        if surface_pose:
            pos.update(surface_pose)
    dress = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
    cfg = meta.get("config") if isinstance(meta.get("config"), dict) else {}
    surf = meta.get("surface") if isinstance(meta.get("surface"), dict) else {}
    prop = normalize_leaf_prop(
        meta.get("prop") if isinstance(meta.get("prop"), dict) else None
    )
    return {
        "config": cfg,
        "surface": surf,
        "pose": pos,
        "pos": pos,
        "dressup": dress,
        "prop": prop,
        "package_id": "card",
        "bin": owner,
        "_path": str(path.resolve()),
        "_file": path.name,
        "_rel": rel_from_bay(safe, path),
        "path_display": rel_from_bay(safe, path),
    }


def list_card_chips(safe: Path) -> list[dict[str, Any]]:
    ensure_user_tree(safe)
    out: list[dict[str, Any]] = []
    lib = library_root(safe)
    if not lib.is_dir():
        return out
    seen: set[str] = set()
    for f in sorted(lib.glob("card[*.chip")):
        row = card_api_from_file(f)
        if not row:
            continue
        uid = str(row["uid"])
        if uid in seen:
            continue
        seen.add(uid)
        row["_rel"] = rel_from_bay(safe, f)
        row["bin"] = leaf_owner_bin(safe, uid)
        out.append(row)
    return out


def spawn_card(
    safe: Path,
    title: str = "untitled card",
    author: str = "unknown",
    subject: str = "",
    x: float | None = None,
    y: float | None = None,
) -> dict[str, Any]:
    """Mint card matter + surface cfg · install store face package if needed."""
    ensure_user_tree(safe)
    try:
        install_tool_package(safe, "card")
    except ValueError:
        pass
    uid = next_card_uid(safe)
    t = now()
    card = {
        "id": uid,
        "uid": uid,
        "title": (title or "untitled card").strip() or "untitled card",
        "author": (author or "unknown").strip() or "unknown",
        "subject": (subject or "").strip(),
        "body": "",
        "created": t,
        "updated": t,
        "stamps": [],
        "tags": [],
    }
    write_card_chip(safe, card)
    ni = n_from_card_uid(uid)
    pose = {
        "x": int(x) if x is not None else 48 + (ni % 8) * 24,
        "y": int(y) if y is not None else 48 + (ni % 6) * 20,
        "openW": 275,
        "openH": 165,  # roomy 5×3 · matches desk default spawn
    }
    write_card_config(
        safe,
        uid,
        pose=pose,
        dressup={"id": uid, "shell": "card", "face": "plain", "style": "plain"},
        prop={"isMarkable": True, "isMarked": False},
    )
    p = card_path(safe, uid)
    full = card_api_from_file(p) if p else card
    if full and p:
        full["_rel"] = rel_from_bay(safe, p)
    cfg = read_card_config(safe, uid)
    return {"card": full, "config": cfg, "package_id": "card"}


# ── bins (board first: container of leaf chips on the felt) ──────────────────


def to_bin_id(old_id: str) -> str:
    """
    Canonical bin face uid: board[n] | book[n] | shelf[n] | deck[n].
    Accepts legacy bin[n], bin-board[n], bin-book[n], bin-deck[n].
    """
    s = str(old_id or "").strip()
    if not s:
        return "board[0]"
    if s.endswith(".bin"):
        s = s[: -len(".bin")]
    if s.startswith("chip-"):
        s = s[5:]
    # config id bin-board[0] / bin-book[0] / bin-shelf[0] / bin-deck[0]
    m = re.match(r"^bin-(board|book|shelf|deck)\[(\d+)\]", s)
    if m:
        return f"{m.group(1)}[{m.group(2)}]"
    if s.startswith("bin-") and not s.startswith("bin["):
        s = s[4:]
    m = re.match(r"^(board|book|shelf|deck)\[(\d+)\]", s)
    if m:
        return f"{m.group(1)}[{m.group(2)}]"
    m = re.match(r"^bin\[(\d+)\]", s)
    if m:
        return f"board[{m.group(1)}]"
    if (
        s.startswith("board[")
        or s.startswith("book[")
        or s.startswith("shelf[")
        or s.startswith("deck[")
    ):
        return s
    return (
        s
        if s.startswith("board")
        or s.startswith("book")
        or s.startswith("shelf")
        or s.startswith("deck")
        else "board_" + s
    )


def is_bin_id(oid: str) -> bool:
    s = str(oid or "").strip()
    if not s:
        return False
    if (
        s.startswith("board[")
        or s.startswith("book[")
        or s.startswith("shelf[")
        or s.startswith("deck[")
        or s.startswith("bin[")
        or s.startswith("bin-board[")
        or s.startswith("bin-book[")
        or s.startswith("bin-shelf[")
        or s.startswith("bin-deck[")
    ):
        return True
    canon = to_bin_id(s)
    return bool(re.match(r"^(board|book|shelf|deck)\[[0-9]+\]", canon))


def bin_filename_for(uid: str, title: str) -> str:
    uid = to_bin_id(uid)
    slug = title_slug(title)
    uid_safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    return f"{uid_safe}-{slug}.bin"


def bin_path(safe: Path, bin_id: str) -> Path | None:
    uid = to_bin_id(bin_id)
    n = n_from_bin_uid(uid)
    uid_safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    root = library_root(safe)
    if not root.is_dir():
        return None
    # law: board[0]-*.bin · legacy: bin[0]-*.bin
    for pattern in (
        f"{uid_safe}.bin",
        f"{uid_safe}-*.bin",
        f"bin[{n}].bin",
        f"bin[{n}]-*.bin",
    ):
        if "*" in pattern:
            matches = sorted(root.glob(pattern))
            if matches:
                return matches[0]
        else:
            p = root / pattern
            if p.is_file():
                return p
    for f in root.glob("*.bin"):
        try:
            meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
            b = meta.get("bin") if isinstance(meta.get("bin"), dict) else {}
            bid = (b or {}).get("uid") or (b or {}).get("id")
            if bid and to_bin_id(str(bid)) == uid:
                return f
        except OSError:
            continue
    return None


def n_from_bin_uid(uid: str) -> int:
    m = re.match(r"^(?:board|book|shelf|deck|bin)\[(\d+)\]", to_bin_id(uid))
    if m:
        return int(m.group(1))
    m = re.search(r"\[(\d+)\]", to_bin_id(uid))
    return int(m.group(1)) if m else 0


def board_face_id(bin_uid: str, subtype: str = "board") -> str:
    """dressup id = board[n] / deck[n] (same as matter uid under current law)."""
    return to_bin_id(bin_uid)


def bin_config_id(bin_uid: str, subtype: str = "board") -> str:
    """config.id = bin-board[0] / bin-deck[0]."""
    n = n_from_bin_uid(bin_uid)
    st = (subtype or "board").strip() or "board"
    return f"bin-{st}[{n}]"


def next_bin_uid(safe: Path, subtype: str = "board") -> str:
    """Next free board[n] / book[n] / shelf[n] / deck[n] (per-prefix n-space)."""
    st = (subtype or "board").strip() or "board"
    if st not in ("board", "book", "shelf", "deck"):
        st = "board"
    used: set[int] = set()
    for row in list_bin_rows(safe):
        uid = to_bin_id(str(row.get("uid") or row.get("id") or ""))
        m = re.match(rf"^{re.escape(st)}\[(\d+)\]$", uid)
        if m:
            used.add(int(m.group(1)))
    n = 0
    while n in used:
        n += 1
    return f"{st}[{n}]"


def to_tool_member_id(raw: str) -> str:
    """stamper[0] · eraser[1] · tool-chipper[0] → living tool uid (no tool- prefix)."""
    s = str(raw or "").strip()
    if not s:
        return ""
    if s.startswith("tool-"):
        s = s[5:]
    # refuse bin/leaf/card shapes
    if re.match(r"^(leaf|card|board|book|shelf|deck)(\[|_)", s, re.I):
        return ""
    m = re.match(r"^([a-zA-Z][\w]*\[\d+\])", s)
    return m.group(1) if m else ""


def is_tool_member_id(raw: str) -> bool:
    return bool(to_tool_member_id(raw))


def normalize_bin_member_id(raw: str) -> str:
    """Leaf/card uids stay chip ids; book/board/shelf/deck stay bin ids; tools keep living uid."""
    s = str(raw or "").strip()
    if not s:
        return s
    if re.match(r"^(book|board|shelf|deck)\[\d+\]", s):
        return to_bin_id(s)
    if re.match(r"^card\[", s) or s.startswith("card"):
        return to_card_id(s)
    # tools BEFORE to_leaf_chip_id — else stamper[0] becomes leaf_stamper[0]
    tid = to_tool_member_id(s)
    if tid:
        return tid
    return to_leaf_chip_id(s)


def bin_api_from_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file() or path.suffix.lower() != ".bin":
        return None
    try:
        meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
    except OSError:
        return None
    store = meta.get("store") if isinstance(meta.get("store"), dict) else {}
    b = meta.get("bin") if isinstance(meta.get("bin"), dict) else {}
    pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}
    uid = to_bin_id(str((b or {}).get("uid") or (b or {}).get("id") or path.stem))
    chips_raw = (b or {}).get("chips") or []
    if isinstance(chips_raw, str):
        try:
            chips_raw = json.loads(chips_raw)
        except json.JSONDecodeError:
            chips_raw = []
    if not isinstance(chips_raw, list):
        chips_raw = []
    chips = [normalize_bin_member_id(str(c)) for c in chips_raw if c]
    title = (b or {}).get("name") or (b or {}).get("title") or "untitled board"
    auth = (b or {}).get("auth") or "unknown"
    # bin.type = board | book | shelf | deck · store.type = bin
    bin_type = (b or {}).get("type") or (store or {}).get("subtype") or "board"
    # uid prefix wins when matter omits type
    if re.match(r"^deck\[", uid):
        bin_type = "deck"
    elif re.match(r"^book\[", uid):
        bin_type = "book"
    elif re.match(r"^shelf\[", uid):
        bin_type = "shelf"
    elif re.match(r"^board\[", uid):
        bin_type = "board"
    return {
        "id": uid,
        "uid": uid,
        "title": title,
        "name": title,
        "author": auth,
        "auth": auth,
        "type": "bin",
        "subtype": bin_type,
        "bin_type": bin_type,
        "class": (b or {}).get("class") or "box",
        "chips": chips,
        "created": pin.get("tps_created"),
        "updated": pin.get("tps_updated"),
        "tags": pin.get("tags") if isinstance(pin.get("tags"), list) else [],
        "body": body or "",
        "_file": path.name,
        "_path": str(path.resolve()),
        "_rel": None,
        "_bin": True,
    }


def write_bin_file(safe: Path, bin_row: dict[str, Any]) -> Path:
    """Write membership .bin matter (Hands board paper shape)."""
    ensure_user_tree(safe)
    uid = to_bin_id(str(bin_row.get("uid") or bin_row.get("id") or "board[0]"))
    title = (
        bin_row.get("title") or bin_row.get("name") or "untitled board"
    ).strip() or "untitled board"
    t = now()
    created = int(bin_row.get("created") or t)
    chips_raw = bin_row.get("chips")
    if chips_raw is None:
        old = bin_path(safe, uid)
        if old and old.is_file():
            prev = bin_api_from_file(old)
            chips_raw = (prev or {}).get("chips") or []
        else:
            chips_raw = []
    if not isinstance(chips_raw, list):
        chips_raw = []
    chips = [normalize_bin_member_id(str(c)) for c in chips_raw if c]
    # de-dupe preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for c in chips:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    chips = uniq
    tags = bin_row.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    bin_type = bin_row.get("bin_type") or bin_row.get("subtype")
    if not bin_type:
        t = bin_row.get("type")
        bin_type = t if t and t != "bin" else "board"
    if bin_type == "bin":
        bin_type = "board"
    bin_class = (bin_row.get("class") or "").strip()
    if not bin_class:
        # book · leaf pages; shelf · books; deck · cards only; box · pinboard
        if bin_type == "book":
            bin_class = "book"
        elif bin_type == "shelf":
            bin_class = "shelf"
        elif bin_type == "deck":
            bin_class = "deck"
        else:
            bin_class = "box"
    fname = bin_filename_for(uid, title)
    path = library_root(safe) / fname
    path.parent.mkdir(parents=True, exist_ok=True)
    old = bin_path(safe, uid)
    if old and old.is_file() and old.resolve() != path.resolve():
        try:
            if path.is_file():
                path.unlink()
            old.replace(path)
        except OSError:
            try:
                path.write_text(old.read_text(encoding="utf-8"), encoding="utf-8")
                old.unlink()
            except OSError:
                pass
    sections = {
        "store": {
            "file": fname,
            "type": "bin",
            "bit_count": len(chips),
        },
        "bin": {
            "uid": uid,
            "type": bin_type,
            "name": title,
            "auth": (bin_row.get("author") or bin_row.get("auth") or "unknown")
            .strip()
            or "unknown",
            "class": bin_class,
            "chips": chips,
        },
        "pin": {
            "tps_created": created,
            "tps_updated": t,
            "tags": tags,
        },
    }
    # drop other copies same uid (incl. legacy bin[n]-*)
    root = library_root(safe)
    if root.is_dir():
        for f in root.glob("*.bin"):
            if f.resolve() == path.resolve():
                continue
            try:
                meta, _ = parse_nested_fm(f.read_text(encoding="utf-8"))
                b = meta.get("bin") if isinstance(meta.get("bin"), dict) else {}
                bid = (b or {}).get("uid") or (b or {}).get("id")
                if bid and to_bin_id(str(bid)) == uid:
                    f.unlink()
            except OSError:
                pass
    path.write_text(dump_nested_fm(sections, ""), encoding="utf-8")
    return path


def list_bin_rows(safe: Path) -> list[dict[str, Any]]:
    ensure_user_tree(safe)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    root = library_root(safe)
    if not root.is_dir():
        return out
    for p in sorted(root.glob("*.bin"), key=lambda x: x.stat().st_mtime):
        row = bin_api_from_file(p)
        if not row:
            continue
        uid = str(row["uid"])
        if uid in seen:
            continue
        seen.add(uid)
        row["_rel"] = rel_from_bay(safe, p)
        out.append(row)
    return out


def write_bin_config(
    safe: Path,
    bin_id: str,
    pose: dict[str, Any] | None = None,
    dressup: dict[str, Any] | None = None,
    prop: dict[str, Any] | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    config_id: str | None = None,
    subtype: str = "board",
) -> Path:
    """Bin instance cfg. Dress + prop + pin layout; bin pose is on desk surface.layout."""
    ensure_user_tree(safe)
    uid = to_bin_id(bin_id)
    st = (subtype or "board").strip() or "board"
    # face uid prefix wins over caller subtype (book[0] is always book)
    if re.match(r"^book\[", uid):
        st = "book"
    elif re.match(r"^shelf\[", uid):
        st = "shelf"
    elif re.match(r"^deck\[", uid):
        st = "deck"
    elif re.match(r"^board\[", uid):
        st = "board"
    cfg_id = config_id or bin_config_id(uid, st)
    if cfg_id.endswith(".cfg"):
        cfg_id = cfg_id[: -len(".cfg")]
    # law: config file name = config.id
    path = configs_root(safe, username, surface_folder) / f"{cfg_id}.cfg"
    path.parent.mkdir(parents=True, exist_ok=True)

    # merge with disk so dress/prop/layout save never wipes the others
    prev: dict[str, Any] = {}
    if path.is_file():
        try:
            prev, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            prev = {}

    prev_du = prev.get("dressup") if isinstance(prev.get("dressup"), dict) else {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}
    # pin map: this board is a surface for its members — never drop
    prev_layout = prev.get("layout") if isinstance(prev.get("layout"), dict) else {}

    # desk surface owns WHERE the bin sits (incl. book/shelf/deck open)
    if pose:
        pose_out = _normalize_pose_dict(pose)
        if st not in ("book", "shelf", "deck"):
            pose_out.pop("open", None)
        if pose_out:
            upsert_surface_object_pose(
                safe, uid, pose_out, username, surface_folder
            )

    raw_du = dict(prev_du)
    if dressup:
        raw_du.update(dressup)
    face = raw_du.get("id") or board_face_id(uid, st)
    default_shell = (
        "bookbox"
        if st == "book"
        else "bookshelf"
        if st == "shelf"
        else "deckbox"
        if st == "deck"
        else "boardbox"
    )
    du: dict[str, Any] = {
        "id": face,
        "shell": raw_du.get("shell") or default_shell,
        "style": raw_du.get("style") or raw_du.get("paper") or "plain",
    }
    if raw_du.get("color"):
        du["color"] = raw_du.get("color")
    if st == "book" or raw_du.get("cloth"):
        cloth = (raw_du.get("cloth") or "oxblood").strip() or "oxblood"
        du["cloth"] = cloth

    prop_out = normalize_bin_prop(prev_prop)
    if prop is not None:
        prop_out = normalize_bin_prop({**prop_out, **prop})

    layout_out: dict[str, Any] = {}
    for k, v in prev_layout.items():
        mid = layout_object_id(str(k))
        pose_m = _normalize_pose_dict(v if isinstance(v, dict) else {})
        if mid and pose_m:
            layout_out[mid] = pose_m
    # re-read disk layout right before write (concurrent pin saves)
    if path.is_file():
        try:
            fresh, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
            fl = fresh.get("layout") if isinstance(fresh.get("layout"), dict) else {}
            for k, v in fl.items():
                mid = layout_object_id(str(k))
                pose_m = _normalize_pose_dict(v if isinstance(v, dict) else {})
                if mid and pose_m and mid not in layout_out:
                    layout_out[mid] = pose_m
        except OSError:
            pass

    surf_paper = read_surface_paper(safe, username, surface_folder)
    surf = (surf_paper or {}).get("surface") or {}
    sections: dict[str, Any] = {
        "config": {
            "type": "bin",
            "subtype": st,
            "id": cfg_id,
        },
        "surface": {
            "id": surf.get("id") or DEFAULT_SURFACE_ID,
            "name": surf.get("name") or DEFAULT_SURFACE_NAME,
            "auth": surf.get("auth") or username or DEFAULT_USERNAME,
        },
        "dressup": du,
        "prop": prop_out,
    }
    if layout_out:
        sections["layout"] = layout_out
    _atomic_write_text(path, dump_nested_fm(sections, ""))
    # drop legacy misnamed cfg (bin-bin[0].cfg)
    legacy = configs_root(safe, username, surface_folder) / f"bin-{uid}.cfg"
    if legacy.is_file() and legacy.resolve() != path.resolve():
        try:
            legacy.unlink()
        except OSError:
            pass
    return path


def read_bin_config(
    safe: Path,
    bin_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    subtype: str = "board",
) -> dict[str, Any] | None:
    uid = to_bin_id(bin_id)
    # infer face from uid (book[0] → book, shelf[0] → shelf)
    if re.match(r"^book\[", uid):
        st = "book"
    elif re.match(r"^shelf\[", uid):
        st = "shelf"
    elif re.match(r"^deck\[", uid):
        st = "deck"
    elif re.match(r"^board\[", uid):
        st = "board"
    else:
        st = (subtype or "board").strip() or "board"
    root = configs_root(safe, username, surface_folder)
    # law path first: bin-board[0].cfg / bin-book[0].cfg / bin-shelf[0].cfg / bin-deck[0].cfg
    candidates = [
        root / f"{bin_config_id(uid, st)}.cfg",
        root / f"bin-{uid}.cfg",  # legacy
    ]
    path: Path | None = None
    for c in candidates:
        if c.is_file():
            path = c
            break
    if path is None and root.is_dir():
        # exact uid in stem only (book[0] must not match board[0])
        for f in root.glob("bin-*.cfg"):
            if uid in f.stem:
                path = f
                break
    # no bare-index fallback — shelf[0] must never resolve to board[0]
    if path is None or not path.is_file():
        return None
    meta, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
    legacy = meta.get("pos") if isinstance(meta.get("pos"), dict) else {}
    if not legacy and isinstance(meta.get("pose"), dict):
        legacy = meta["pose"]
    pos = dict(_normalize_pose_dict(legacy))
    surface_pose = get_surface_object_pose(safe, uid, username, surface_folder)
    if surface_pose:
        pos.update(surface_pose)
    dress = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
    cfg = meta.get("config") if isinstance(meta.get("config"), dict) else {}
    surf = meta.get("surface") if isinstance(meta.get("surface"), dict) else {}
    prop = normalize_bin_prop(
        meta.get("prop") if isinstance(meta.get("prop"), dict) else None
    )
    rel = rel_from_bay(safe, path)
    return {
        "config": cfg,
        "surface": surf,
        "pose": pos,
        "pos": pos,
        "dressup": dress,
        "prop": prop,
        "_path": str(path.resolve()),
        "_file": path.name,
        "_rel": rel,
        "path_display": rel,
    }


def read_bin_config_raw(
    safe: Path,
    bin_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> tuple[Path | None, str | None, str | None]:
    cfg = read_bin_config(safe, bin_id, username, surface_folder)
    if not cfg:
        return None, None, None
    path = Path(cfg["_path"])
    try:
        return path, path.read_text(encoding="utf-8"), cfg.get("path_display")
    except OSError:
        return path, None, cfg.get("path_display")


def spawn_bin(
    safe: Path,
    title: str = "untitled board",
    author: str = "unknown",
    subtype: str = "board",
    x: float | None = None,
    y: float | None = None,
) -> dict[str, Any]:
    """New bin on surface (board | book | shelf | deck) — empty membership, pose at click."""
    ensure_user_tree(safe)
    st = (subtype or "board").strip() or "board"
    if st not in ("board", "book", "shelf", "deck"):
        st = "board"
    if st == "deck":
        # face kit from store (like card) — core only knows membership law
        try:
            install_tool_package(safe, "deck")
        except ValueError:
            pass
    uid = next_bin_uid(safe, st)
    t = now()
    if st == "book":
        default_title = "untitled book"
        bin_class = "book"
        dress_shell = "bookbox"
        open_w, open_h = 380, 480
        prop = dict(DEFAULT_BIN_PROP)
        prop["maxLoad"] = 40
    elif st == "shelf":
        default_title = "bookshelf"
        bin_class = "shelf"
        dress_shell = "bookshelf"
        open_w, open_h = 320, 200
        prop = dict(DEFAULT_BIN_PROP)
        prop["maxLoad"] = 24
        prop["isTardis"] = False
    elif st == "deck":
        default_title = "untitled deck"
        bin_class = "deck"
        dress_shell = "deckbox"
        open_w, open_h = 148, 108  # closed box size; open grows in client
        prop = dict(DEFAULT_BIN_PROP)
        prop["maxLoad"] = 40
        prop["accepts"] = ["card", "leaf"]
        prop["isTardis"] = False
    else:
        default_title = "untitled board"
        bin_class = "box"
        dress_shell = "boardbox"
        open_w, open_h = 420, 520
        prop = dict(DEFAULT_BIN_PROP)
    row = {
        "id": uid,
        "uid": uid,
        "title": (title or default_title).strip() or default_title,
        "author": (author or "unknown").strip() or "unknown",
        "subtype": st,
        "class": bin_class,
        "chips": [],
        "created": t,
        "updated": t,
        "tags": [],
    }
    write_bin_file(safe, row)
    ni = n_from_bin_uid(uid)
    pose = {
        "x": int(x) if x is not None else 80 + (ni % 5) * 36,
        "y": int(y) if y is not None else 80 + (ni % 4) * 32,
        "openW": open_w,
        "openH": open_h,
    }
    if st == "shelf":
        pose["open"] = False  # closed ledge by default
    if st == "deck":
        pose["open"] = False  # closed card box by default
    write_bin_config(
        safe,
        uid,
        pose=pose,
        dressup={
            "shell": dress_shell,
            "style": "plain",
            "id": board_face_id(uid, st),
            **({"face": "plain", "package_id": "deck"} if st == "deck" else {}),
        },
        prop=prop,
        config_id=bin_config_id(uid, st),
        subtype=st,
    )
    p = bin_path(safe, uid)
    full = bin_api_from_file(p) if p else row
    if full and p:
        full["_rel"] = rel_from_bay(safe, p)
    cfg = read_bin_config(safe, uid)
    return {"bin": full, "config": cfg}


def despawn_bin(
    safe: Path,
    bin_id: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """
    Remove a book or shelf (and its cfg/layout) from the desk.
    Ejects members first so leaves/cards/volumes are not deleted with the host.
    """
    ensure_user_tree(safe)
    bid = to_bin_id(bin_id)
    p = bin_path(safe, bid)
    if not p or not p.is_file():
        return {"ok": False, "error": "bin not found · " + bid}
    row = bin_api_from_file(p) or {}
    host_uid = str(row.get("uid") or row.get("id") or bid)
    st = str(row.get("subtype") or row.get("bin_type") or "").strip()
    if re.match(r"^book\[", host_uid):
        st = "book"
    elif re.match(r"^shelf\[", host_uid):
        st = "shelf"
    elif re.match(r"^deck\[", host_uid):
        st = "deck"
    elif re.match(r"^board\[", host_uid):
        st = "board"
    if st not in ("book", "shelf"):
        return {
            "ok": False,
            "error": "despawn · books and shelves only (not boards/envelopes)",
        }
    # eject members (pages off book · volumes off shelf)
    for raw in list(row.get("chips") or []):
        try:
            set_bin_membership(
                safe,
                bid,
                str(raw),
                add=False,
                username=username,
                surface_folder=surface_folder,
            )
        except Exception:
            pass
    # drop surface pose (face id = book[n] / shelf[n])
    try:
        remove_surface_object_pose(safe, bid, username, surface_folder)
    except Exception:
        pass
    # delete instance cfg(s)
    root = configs_root(safe, username, surface_folder)
    for name in (
        f"{bin_config_id(bid, st)}.cfg",
        f"bin-{bid}.cfg",
        f"bin-{st}[{n_from_bin_uid(bid)}].cfg",
    ):
        cp = root / name
        if cp.is_file():
            try:
                cp.unlink()
            except OSError:
                pass
    # remove matter so /api/bins will not remount
    try:
        p.unlink()
    except OSError as e:
        return {"ok": False, "error": "could not remove bin file · " + str(e)}
    return {"ok": True, "id": bid, "subtype": st}


def leaf_owner_bin(safe: Path, leaf_id: str) -> str | None:
    """Which bin exclusively owns this leaf, card, or tool (if any)."""
    raw = str(leaf_id or "").strip()
    if re.match(r"^card\[", raw) or raw.startswith("card"):
        lid = to_card_id(raw)
    elif is_tool_member_id(raw):
        lid = to_tool_member_id(raw)
    else:
        lid = to_leaf_chip_id(raw)
    if not lid:
        return None
    for row in list_bin_rows(safe):
        chips = [normalize_bin_member_id(str(c)) for c in (row.get("chips") or [])]
        if lid in chips:
            return str(row.get("uid") or row.get("id"))
    return None


def set_bin_membership(
    safe: Path,
    bin_id: str,
    leaf_id: str,
    *,
    add: bool,
) -> dict[str, Any]:
    """
    Exclusive membership: member in at most one bin.
    Leaves go in boards/books; books go on shelves.
    add=True → put member in bin (remove from others of same kind).
    add=False → remove member from this bin only.
    """
    bid = to_bin_id(bin_id)
    p = bin_path(safe, bid)
    if not p:
        raise ValueError("bin not found")
    peek = bin_api_from_file(p)
    if not peek:
        raise ValueError("bin unreadable")
    raw_m = str(leaf_id or "").strip()
    if not raw_m:
        raise ValueError("member id required")
    host_type = str(peek.get("subtype") or peek.get("bin_type") or "board")
    # uid prefix can outrank stale subtype on disk
    host_uid = str(peek.get("uid") or peek.get("id") or bid)
    if re.match(r"^deck\[", host_uid):
        host_type = "deck"
    elif re.match(r"^book\[", host_uid):
        host_type = "book"
    elif re.match(r"^shelf\[", host_uid):
        host_type = "shelf"
    elif re.match(r"^board\[", host_uid):
        host_type = "board"
    # shelf holds book[n] + deck[n] (closed volumes);
    # deck/envelope holds card[n] OR leaf[n] (pull via list);
    # boards hold leaf[n] + card[n] + tools; books hold leaf pages only.
    if host_type == "shelf":
        mid = to_bin_id(raw_m)
        if not (
            re.match(r"^book\[\d+\]$", mid) or re.match(r"^deck\[\d+\]$", mid)
        ):
            raise ValueError("shelf holds books or decks · drop a closed volume")
    elif host_type == "book":
        if re.match(r"^card\[", raw_m) or raw_m.startswith("card"):
            raise ValueError("cards go in a deck · not book pages")
        if is_tool_member_id(raw_m):
            raise ValueError("tools go in a board · not book pages")
        mid = to_leaf_chip_id(raw_m)
        if not mid:
            raise ValueError("invalid leaf id")
        if mid.startswith("leaf_") and not mid.startswith("leaf["):
            if re.match(r"^book\[\d+\]$", raw_m):
                raise ValueError("books go on a shelf, not a board")
    elif host_type == "deck":
        # manila envelope · cards and papers (leaves)
        if (
            re.match(r"^card\[", raw_m)
            or raw_m.startswith("card")
            or is_card_id(raw_m)
        ):
            mid = to_card_id(raw_m)
            if not mid:
                raise ValueError("invalid card id")
            if not card_path(safe, mid):
                raise ValueError("card not found · " + mid)
        else:
            mid = to_leaf_chip_id(raw_m)
            if not mid:
                raise ValueError(
                    "envelope holds cards or papers · drop a card or leaf"
                )
            if not chip_path(safe, mid):
                raise ValueError("leaf not found · " + mid)
    else:
        # board · leaf, card, or guest tool (stamper / eraser / chipper / …)
        if re.match(r"^card\[", raw_m) or raw_m.startswith("card"):
            mid = to_card_id(raw_m)
            if not mid:
                raise ValueError("invalid card id")
        elif is_tool_member_id(raw_m):
            mid = to_tool_member_id(raw_m)
            if not mid:
                raise ValueError("invalid tool id")
            # refuse if no tool config (inbox/rom ok if present)
            if not read_tool_config(safe, mid):
                raise ValueError("tool not found · " + mid)
        else:
            mid = to_leaf_chip_id(raw_m)
            if not mid:
                raise ValueError("invalid leaf id")
            if mid.startswith("leaf_") and not mid.startswith("leaf["):
                if re.match(r"^book\[\d+\]$", raw_m):
                    raise ValueError("books go on a shelf, not a board")
    # strip member from all bins first when adding
    if add:
        for row in list_bin_rows(safe):
            chips = list(row.get("chips") or [])
            # normalize row chips for compare
            chips_n = [normalize_bin_member_id(str(c)) for c in chips]
            if mid not in chips_n:
                continue
            other = to_bin_id(str(row.get("uid")))
            if other == bid:
                continue
            row["chips"] = [c for c in chips_n if c != mid]
            write_bin_file(safe, row)
    target = bin_api_from_file(p)
    if not target:
        raise ValueError("bin unreadable")
    chips = [normalize_bin_member_id(str(c)) for c in (target.get("chips") or [])]
    if add:
        if mid not in chips:
            cfg = read_bin_config(safe, bid) or {}
            prop = normalize_bin_prop(
                cfg.get("prop") if isinstance(cfg.get("prop"), dict) else None
            )
            max_load = int(prop.get("maxLoad") or 0)
            if max_load > 0 and len(chips) >= max_load:
                raise ValueError(
                    f"bin full · maxLoad {max_load} · take something out first"
                )
            chips.append(mid)
    else:
        chips = [c for c in chips if c != mid]
    target["chips"] = chips
    write_bin_file(safe, target)
    p2 = bin_path(safe, bid)
    full = bin_api_from_file(p2) if p2 else target
    if full and p2:
        full["_rel"] = rel_from_bay(safe, p2)
    return {"bin": full, "config": read_bin_config(safe, bid)}


# ── guest packages (host → local install → surface instance) ────────────────
# Hands path law:
#   marketplace/editors/<uid>/   ·  ~local/<user>/editors/<uid>/   (e.g. stamper)
#   marketplace/receivers/<uid>/ ·  ~local/<user>/receivers/<uid>/ (e.g. inbox)
# Folder uid is the -ins name. Not "tools/".

DEFAULT_STAMPER_LABELS = [
    "urgent",
    "draft",
    "outdated",
    "cancelled",
    "misinformed",
]

# cute slug for Receive.address mint (ADM.slug — ASCII only, no alt-code bullets)
INBOX_ADDRESS_SLUGS = [
    "cork",
    "felt",
    "parcel",
    "ribbon",
    "quiet",
    "deskmail",
    "slot",
    "tray",
    "pigeon",
    "hermes",
]

# chips/ = content faces (card); editors/receivers = tools
MARKETPLACE_PACKAGE_KINDS = ("receivers", "editors", "chips")


def editors_root(safe: Path) -> Path:
    """~host/marketplace/editors/"""
    return marketplace_root(safe) / "editors"


def receivers_root(safe: Path) -> Path:
    """~host/marketplace/receivers/"""
    return marketplace_root(safe) / "receivers"


def resolve_package_id(name: str) -> str:
    """Package folder uid. Exact name only — no alias map.

    Folder / -ins / package.uid (e.g. stamper, inbox, chipper).
    """
    return (name or "").strip().lower()


def package_from_tool_uid(tool_uid: str) -> str:
    """chipper[0] → chipper · stamper[2] → stamper · tool-inbox[0] → inbox.

    Living uid prefix is law for package; never let a stale config.subtype
    (e.g. chipper written as subtype: stamper) steal the face package.
    """
    s = str(tool_uid or "").strip()
    if s.startswith("tool-"):
        s = s[5:]
    m = re.match(r"^([a-zA-Z][\w]*)\[", s)
    if m:
        return resolve_package_id(m.group(1))
    m = re.match(r"^([a-zA-Z][\w]*)$", s)
    if m:
        return resolve_package_id(m.group(1))
    return ""


def package_marketplace_kind(safe: Path, package_id: str) -> str | None:
    """Which marketplace shelf holds this package: receivers | editors."""
    pid = resolve_package_id(package_id)
    if not pid:
        return None
    for kind in MARKETPLACE_PACKAGE_KINDS:
        root = marketplace_root(safe) / kind / pid
        if root.is_dir() and (
            (root / f"{pid}.manifest").is_file() or (root / f"{pid}.set").is_file()
        ):
            return kind
    for kind in MARKETPLACE_PACKAGE_KINDS:
        if (marketplace_root(safe) / kind / pid).is_dir():
            return kind
    return None


def host_tool_package_dir(safe: Path, package_id: str) -> Path:
    """Host package dir under editors/ or receivers/."""
    pid = resolve_package_id(package_id)
    kind = package_marketplace_kind(safe, pid)
    if kind:
        return marketplace_root(safe) / kind / pid
    # default probe path (error messages still meaningful)
    return editors_root(safe) / pid


def local_editors_root(safe: Path, username: str | None = None) -> Path:
    """~local/<user>/editors/ — loc mirror of installed editor packages."""
    u = username or discover_username(safe)
    return local_root(safe) / u / "editors"


def local_receivers_root(safe: Path, username: str | None = None) -> Path:
    """~local/<user>/receivers/ — loc mirror of installed receiver packages."""
    u = username or discover_username(safe)
    return local_root(safe) / u / "receivers"


def local_tool_dir(safe: Path, package_id: str, username: str | None = None) -> Path:
    """Local install dir — same kind shelf as host (editors vs receivers)."""
    pid = resolve_package_id(package_id)
    u = username or discover_username(safe)
    kind = package_marketplace_kind(safe, pid)
    # if already installed only under one local shelf, prefer that
    if kind is None:
        for k in MARKETPLACE_PACKAGE_KINDS:
            p = local_root(safe) / u / k / pid
            if p.is_dir():
                kind = k
                break
    kind = kind or "editors"
    return local_root(safe) / u / kind / pid


def _as_str_list(v: Any) -> list[str]:
    if isinstance(v, list):
        out = []
        for x in v:
            s = str(x).strip()
            # flatten accidental "[chip]" single tokens
            if s.startswith("[") and s.endswith("]") and "," not in s:
                s = s[1:-1].strip().strip("\"'")
            if s:
                out.append(s)
        return out
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return []
        try:
            j = json.loads(s)
            if isinstance(j, list):
                return _as_str_list(j)
        except json.JSONDecodeError:
            pass
        # bare YAML-ish [chip] or [chip, leaf]
        if s.startswith("[") and s.endswith("]"):
            inner = s[1:-1].strip()
            if not inner:
                return []
            return [
                p.strip().strip("\"'")
                for p in inner.split(",")
                if p.strip().strip("\"'")
            ]
        return [p.strip() for p in s.split(",") if p.strip()]
    return []


def read_tool_manifest(safe: Path, package_id: str) -> dict[str, Any] | None:
    """
    Prefer local install, else host package.

    Package paper is a *catalog*: can* capacities + Mark/Dressup option lists.
    Core files are by convention: <uid>.set · <uid>.kit · dressups/<slot>/<id>.dsc
    """
    pid = resolve_package_id(package_id)
    if not pid:
        return None
    for root in (local_tool_dir(safe, pid), host_tool_package_dir(safe, pid)):
        man = root / f"{pid}.manifest"
        if not man.is_file():
            continue
        try:
            text = man.read_text(encoding="utf-8")
        except OSError:
            continue
        meta, body = parse_nested_fm(text)
        pkg = meta.get("package") if isinstance(meta.get("package"), dict) else {}
        prop = meta.get("prop") if isinstance(meta.get("prop"), dict) else {}
        store = meta.get("store") if isinstance(meta.get("store"), dict) else {}
        pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}

        # mark plate options: Mark.types (catalog) preferred
        mark_types = _as_str_list(
            prop.get("Mark.types") or prop.get("Mark.labels") or DEFAULT_STAMPER_LABELS
        )
        def_label = str(
            prop.get("Mark.type.default")
            or prop.get("Mark.label")
            or (mark_types[0] if mark_types else "urgent")
        )
        def_mark_style = str(
            prop.get("Mark.style.default")
            or prop.get("Mark.style")
            or prop.get("Dressup.mark.default")
            or "classic"
        )
        mark_class = str(prop.get("Mark.class") or "stamp")
        tool_dscs = _as_str_list(prop.get("Dressup.tool.dscs") or ["plain", "brass"])
        def_tool = str(
            prop.get("Dressup.tool.default")
            or (tool_dscs[0] if tool_dscs else "plain")
        )
        mark_dscs = _as_str_list(prop.get("Dressup.mark.dscs") or ["classic"])
        dress_types = _as_str_list(prop.get("Dressup.types") or ["tool", "mark"])

        out: dict[str, Any] = {
            "id": pkg.get("uid") or pid,
            "title": pkg.get("name") or pid,
            "auth": pkg.get("auth") or "marketplace",
            "src": pkg.get("src") or "",
            # projected for spawn
            "mark_types": mark_types,
            "labels": ",".join(mark_types),
            "default_label": def_label,
            "default_style": def_mark_style,
            "default_tool_dress": def_tool,
            "mark_class": mark_class,
            "tool_dscs": tool_dscs,
            "mark_dscs": mark_dscs,
            "dress_types": dress_types,
            # convention paths (not listed on package paper)
            "set": f"{pid}.set",
            "kit": f"{pid}.kit",
            "dress_tool": "dressups/tool",
            "dress_mark": "dressups/mark",
            "package": pkg,
            "prop": prop,
            "store": store,
            "pin": pin,
            "body": body or "",
            "_path": str(man.resolve()),
            "_root": str(root.resolve()),
            "package_id": pid,
            "_meta": meta,
        }
        return out
    return None


def install_tool_package(
    safe: Path,
    package_id: str,
    username: str | None = None,
) -> dict[str, Any]:
    """
    Copy host package → ~local/<user>/{editors|receivers}/<package>/.
    Does not overwrite if local has .godfork marker (god-modded).
    """
    ensure_user_tree(safe)
    pid = resolve_package_id(package_id)
    host = host_tool_package_dir(safe, pid)
    kind = package_marketplace_kind(safe, pid) or "editors"
    if not host.is_dir():
        raise ValueError(f"no host package · marketplace/{kind}/{pid}")
    dest = local_tool_dir(safe, pid, username)
    god = dest / ".godfork"
    if god.is_file():
        return {
            "ok": True,
            "skipped": True,
            "reason": "god-fork · will not clobber local mods",
            "local": rel_from_bay(safe, dest),
            "package_id": pid,
            "kind": kind,
        }
    dest.mkdir(parents=True, exist_ok=True)
    for src in host.rglob("*"):
        if src.is_dir():
            continue
        rel = src.relative_to(host)
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(src.read_bytes())
    return {
        "ok": True,
        "skipped": False,
        "local": rel_from_bay(safe, dest),
        "host": rel_from_bay(safe, host),
        "package_id": pid,
        "kind": kind,
    }


def tool_package_file(
    safe: Path, package_id: str, name: str, username: str | None = None
) -> Path | None:
    """Resolve file from local install first, else host. Exact path only."""
    pid = resolve_package_id(package_id)
    if not pid:
        return None
    rel = name.replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    for root in (local_tool_dir(safe, pid, username), host_tool_package_dir(safe, pid)):
        p = root / rel
        if p.is_file():
            return p
    return None


def next_tool_uid(safe: Path, subtype: str = "stamper") -> str:
    """stamper[0], stamper[1], … from existing tool configs."""
    used: set[int] = set()
    root = configs_root(safe)
    if root.is_dir():
        for f in root.glob(f"tool-{subtype}*.cfg"):
            m = re.search(rf"{re.escape(subtype)}\[(\d+)\]", f.stem)
            if m:
                used.add(int(m.group(1)))
    n = 0
    while n in used:
        n += 1
    return f"{subtype}[{n}]"


def _truthy_yes(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("true", "yes", "1", "on")
    return bool(v)


def normalize_leaf_prop(raw: dict[str, Any] | None = None) -> dict[str, Any]:
    """Leaf instance prop.

    Always:
      isMarkable: yes|no   (default yes)
      isMarked: yes|no     (default no)
    When isMarked: Mark.* detail block lives under those flags.
    """
    out: dict[str, Any] = {"isMarkable": True, "isMarked": False}
    if not isinstance(raw, dict):
        return out
    for k, v in raw.items():
        if v is None or v == "":
            continue
        if k in ("isMarkable", "isMarked", "canMark", "canDressup", "isTardis"):
            out[k] = _truthy_yes(v)
        else:
            out[k] = v
    # base rules when absent
    if not isinstance(raw, dict) or "isMarkable" not in raw:
        out["isMarkable"] = True
    if not isinstance(raw, dict) or "isMarked" not in raw:
        # if Mark.* scar fields present, treat as marked
        has_scar = any(str(k).startswith("Mark.") for k in (raw or {}))
        out["isMarked"] = bool(has_scar)
    # when not marked, drop Mark.* from living prop (clean paper)
    if not out.get("isMarked"):
        for k in list(out.keys()):
            if str(k).startswith("Mark."):
                del out[k]
    # cite scar is independent of rubber stamp
    if "isCited" in out:
        out["isCited"] = _truthy_yes(out.get("isCited"))
    elif any(str(k).startswith("Cite.") for k in out):
        out["isCited"] = True
    if not out.get("isCited"):
        for k in list(out.keys()):
            if str(k).startswith("Cite."):
                del out[k]
        out.pop("isCited", None)
    return out


def leaf_is_markable(prop: dict[str, Any] | None) -> bool:
    """Whether this leaf may receive / keep a Mark scar."""
    p = prop if isinstance(prop, dict) else {}
    if "isMarkable" not in p:
        return True  # base rule
    return _truthy_yes(p.get("isMarkable"))


def package_can_receive(man: dict[str, Any] | None) -> bool:
    """True if package catalog says canReceive (inbox / receivers)."""
    if not isinstance(man, dict):
        return False
    prop = man.get("prop") if isinstance(man.get("prop"), dict) else {}
    if "canReceive" in prop:
        return _truthy_yes(prop.get("canReceive"))
    # bare flag on projected manifest
    if "canReceive" in man:
        return _truthy_yes(man.get("canReceive"))
    return False


def mint_inbox_address(
    safe: Path,
    *,
    username: str | None = None,
    tool_uid: str = "inbox[0]",
) -> str:
    """Mint Receive.address: USER.slug (typeable ASCII — no middle-dot bullets)."""
    u = (username or discover_username(safe) or DEFAULT_USERNAME).strip() or "ADM"
    # strip fancy separators if someone pasted an old address shape
    u = re.sub(r"[·•‧∙\.]+", "", u) or "ADM"
    m = re.search(r"\[(\d+)\]", str(tool_uid))
    n = int(m.group(1)) if m else 0
    slug = INBOX_ADDRESS_SLUGS[n % len(INBOX_ADDRESS_SLUGS)]
    if n == 0:
        return f"{u}.{slug}"
    return f"{u}.{slug}{n}"


def normalize_tool_prop(
    raw: dict[str, Any] | None = None,
    *,
    package_id: str | None = None,
    man: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Tool *instance* prop — thin selection only.

    Stamper (editor):
      canMark: yes
      Mark.type: urgent

    Inbox (receiver):
      canReceive: yes
      Receive.kinds / Receive.address / Receive.hasMail

    ROM cart (desk object → launch packaged rom):
      Rom.id / Rom.title / Rom.sku
    """
    raw = raw if isinstance(raw, dict) else {}
    man = man if isinstance(man, dict) else {}
    pkg_prop = man.get("prop") if isinstance(man.get("prop"), dict) else {}
    pkg = resolve_package_id(str(package_id or ""))
    # ROM cart · not a stamper plate · face from ROM Cat fields
    if pkg == "rom" or raw.get("Rom.id") or raw.get("rom_id"):
        rid = str(raw.get("Rom.id") or raw.get("rom_id") or "").strip()
        out_rom: dict[str, Any] = {
            "canMark": False,
            "Rom.id": rid,
            "Rom.title": str(raw.get("Rom.title") or raw.get("title") or rid).strip(),
            "Rom.sku": str(raw.get("Rom.sku") or raw.get("sku") or "").strip(),
            "Rom.shell": str(
                raw.get("Rom.shell") or raw.get("case_shell") or "classicboi"
            ).strip()
            or "classicboi",
            "Rom.tint": str(
                raw.get("Rom.tint") or raw.get("julie_tint") or ""
            ).strip(),
            "Rom.plate_css": str(
                raw.get("Rom.plate_css") or raw.get("plate_css") or ""
            ).strip(),
            "Rom.catalog_id": str(
                raw.get("Rom.catalog_id") or raw.get("catalog_id") or ""
            ).strip(),
        }
        return out_rom
    # karaoke pull fidget · no Mark plate · last KVEN only
    if pkg == "karaoke" or raw.get("Kven.last") is not None or raw.get("Pull.kven"):
        if pkg == "karaoke" or (
            not package_can_receive(man)
            and not _truthy_yes(raw.get("canMark"))
            and (raw.get("Kven.last") is not None or raw.get("Pull.kven") is not None)
        ):
            last = str(
                raw.get("Kven.last") or raw.get("Pull.kven") or "— — —"
            ).strip() or "— — —"
            return {
                "canMark": False,
                "Kven.last": last,
                "Pull.kven": last,
            }

    is_recv = package_can_receive(man) or _truthy_yes(
        raw.get("canReceive")
    ) or (
        pkg == "inbox"
    )

    if is_recv:
        kinds = _as_str_list(
            raw.get("Receive.kinds")
            or pkg_prop.get("Receive.kinds")
            or ["chip"]
        )
        if not kinds:
            kinds = ["chip"]
        addr = (
            raw.get("Receive.address")
            or raw.get("address")
            or ""
        )
        mail = _as_str_list(raw.get("Receive.mail") or [])
        has_mail = (
            _truthy_yes(raw.get("Receive.hasMail"))
            if "Receive.hasMail" in raw
            else bool(mail)
        )
        if mail:
            has_mail = True
        out: dict[str, Any] = {
            "canReceive": True,
            "Receive.kinds": kinds,
            "Receive.address": str(addr).strip(),
            "Receive.hasMail": has_mail,
            "Receive.mail": mail,
        }
        # keep foundation flags if present
        if "canMark" in raw:
            out["canMark"] = _truthy_yes(raw.get("canMark"))
        elif "canMark" in pkg_prop:
            out["canMark"] = _truthy_yes(pkg_prop.get("canMark"))
        else:
            out["canMark"] = False
        return out

    out = {
        "canMark": True,
        "Mark.type": "urgent",
    }
    plate = raw.get("Mark.type")
    if plate is None or plate == "" or str(plate).lower() in ("stamp",):
        plate = raw.get("Mark.label") or raw.get("Mark.type.default") or "urgent"
    if str(plate).lower() == "stamp" and raw.get("Mark.label"):
        plate = raw.get("Mark.label")
    out["Mark.type"] = str(plate).strip().lower() or "urgent"
    if "canMark" in raw:
        out["canMark"] = _truthy_yes(raw.get("canMark"))
    return out


def normalize_tool_dressup(
    raw: dict[str, Any] | None = None,
    *,
    living_id: str = "stamper[0]",
    default_tool: str = "brass",
    default_mark: str = "classic",
) -> dict[str, Any]:
    """Tool instance dressup — slot selections only.

      dressup:
        id: stamper[0]
        tool: brass      # dressups/tool/<id>.dsc
        mark: classic    # dressups/mark/<id>.dsc
    """
    raw = raw if isinstance(raw, dict) else {}
    tool = (
        raw.get("tool")
        or raw.get("style")  # old field = tool dress
        or default_tool
    )
    mark = raw.get("mark") or default_mark
    return {
        "id": raw.get("id") or living_id,
        "tool": str(tool).strip() or default_tool,
        "mark": str(mark).strip() or default_mark,
    }


def write_tool_config(
    safe: Path,
    tool_uid: str,
    *,
    subtype: str = "stamper",
    package_id: str | None = None,
    pose: dict[str, Any] | None = None,
    dressup: dict[str, Any] | None = None,
    prop: dict[str, Any] | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> Path:
    """Write tool instance cfg (dress + prop). Pose lives on surface.layout.

    Package folder = config.subtype (not dressup.package).
    Dressup = current slot styles. Prop = canMark + Mark.type plate.
    """
    ensure_user_tree(safe)
    uid = tool_uid
    cfg_id = f"tool-{uid}" if not str(tool_uid).startswith("tool-") else str(tool_uid)
    if cfg_id.startswith("tool-tool-"):
        cfg_id = cfg_id[len("tool-") :]
    if not cfg_id.startswith("tool-"):
        cfg_id = f"tool-{uid}"
    living = uid[5:] if str(uid).startswith("tool-") else str(uid)
    path = configs_root(safe, username, surface_folder) / f"{cfg_id}.cfg"
    path.parent.mkdir(parents=True, exist_ok=True)

    prev: dict[str, Any] = {}
    if path.is_file():
        try:
            prev, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            prev = {}
    prev_du = prev.get("dressup") if isinstance(prev.get("dressup"), dict) else {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}
    prev_cfg = prev.get("config") if isinstance(prev.get("config"), dict) else {}

    # surface owns geometry — never rewrite pos on the tool paper
    if pose:
        pose_out = _normalize_pose_dict(pose)
        pose_out.pop("open", None)
        if pose_out:
            upsert_surface_object_pose(
                safe, living, pose_out, username, surface_folder
            )

    raw_du = dict(prev_du)
    if dressup:
        raw_du.update(dressup)
    # ink style used to live on prop.Mark.style — fold into dressup.mark
    if "mark" not in raw_du and isinstance(prev_prop, dict) and prev_prop.get("Mark.style"):
        raw_du["mark"] = prev_prop.get("Mark.style")
    if prop and isinstance(prop, dict) and prop.get("Mark.style") and "mark" not in (
        dressup or {}
    ):
        raw_du.setdefault("mark", prop.get("Mark.style"))

    # living uid prefix wins over stale subtype (chipper[0] must not stay stamper)
    uid_pkg = package_from_tool_uid(living)
    sub = resolve_package_id(
        str(
            package_id
            or uid_pkg
            or prev_cfg.get("subtype")
            or subtype
            or "stamper"
        )
    ) or "stamper"
    if uid_pkg:
        sub = uid_pkg
    # package paper defaults for missing dress slots
    man = read_tool_manifest(safe, sub) or {}
    du = normalize_tool_dressup(
        raw_du,
        living_id=str(raw_du.get("id") or living),
        default_tool=str(man.get("default_tool_dress") or "brass"),
        default_mark=str(man.get("default_style") or "classic"),
    )

    merged_prop = dict(prev_prop)
    if prop is not None:
        merged_prop.update(prop)
        # pose saves used to send stamper-only prop and wipe inbox mail list
        if package_can_receive(man) or sub == "inbox":
            if "Receive.mail" not in prop and prev_prop.get("Receive.mail") is not None:
                merged_prop["Receive.mail"] = prev_prop.get("Receive.mail")
            if (
                "Receive.address" not in prop
                and prev_prop.get("Receive.address") is not None
            ):
                merged_prop["Receive.address"] = prev_prop.get("Receive.address")
            if "Receive.kinds" not in prop and prev_prop.get("Receive.kinds") is not None:
                merged_prop["Receive.kinds"] = prev_prop.get("Receive.kinds")
            if "canReceive" not in prop:
                merged_prop["canReceive"] = True
    prop_out = normalize_tool_prop(merged_prop, package_id=sub, man=man)

    surf_paper = read_surface_paper(safe, username, surface_folder)
    surf = (surf_paper or {}).get("surface") or {}
    sections = {
        "config": {
            "type": "tool",
            "subtype": sub,
            "id": cfg_id,
        },
        "surface": {
            "id": surf.get("id") or DEFAULT_SURFACE_ID,
            "name": surf.get("name") or DEFAULT_SURFACE_NAME,
            "auth": surf.get("auth") or username or DEFAULT_USERNAME,
        },
        "dressup": du,
        "prop": prop_out,
    }
    path.write_text(dump_nested_fm(sections, ""), encoding="utf-8")
    return path


def read_tool_config(
    safe: Path,
    tool_uid: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any] | None:
    path = configs_root(safe, username, surface_folder) / f"tool-{tool_uid}.cfg"
    if not path.is_file():
        root = configs_root(safe, username, surface_folder)
        if root.is_dir():
            for f in root.glob("tool-*.cfg"):
                if tool_uid in f.stem:
                    path = f
                    break
    if not path.is_file():
        return None
    meta, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
    legacy = meta.get("pos") if isinstance(meta.get("pos"), dict) else {}
    if not legacy and isinstance(meta.get("pose"), dict):
        legacy = meta["pose"]
    pos = dict(_normalize_pose_dict(legacy))
    # living id without tool- prefix (inbox[0], stamper[0], rom[0])
    living = str(tool_uid)
    if living.startswith("tool-"):
        living = living[5:]
    surface_pose = get_surface_object_pose(safe, living, username, surface_folder)
    if surface_pose:
        pos.update(surface_pose)
    dress_raw = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
    cfg = meta.get("config") if isinstance(meta.get("config"), dict) else {}
    surf = meta.get("surface") if isinstance(meta.get("surface"), dict) else {}
    prop_raw = meta.get("prop") if isinstance(meta.get("prop"), dict) else {}
    uid_pkg = package_from_tool_uid(living)
    sub = (
        uid_pkg
        or resolve_package_id(str(cfg.get("subtype") or "stamper"))
        or "stamper"
    )
    man = read_tool_manifest(safe, sub) or {}
    # fold old Mark.style into dress before normalize
    if "mark" not in dress_raw and prop_raw.get("Mark.style"):
        dress_raw = dict(dress_raw)
        dress_raw["mark"] = prop_raw.get("Mark.style")
    dress = normalize_tool_dressup(
        dress_raw,
        living_id=str(dress_raw.get("id") or living or tool_uid),
        default_tool=str(man.get("default_tool_dress") or "brass"),
        default_mark=str(man.get("default_style") or "classic"),
    )
    # heal stale subtype on disk (chipper written as stamper) without thrashing pose
    if uid_pkg and str(cfg.get("subtype") or "") != uid_pkg:
        cfg = dict(cfg)
        cfg["subtype"] = uid_pkg
        try:
            write_tool_config(
                safe,
                living,
                package_id=uid_pkg,
                subtype=uid_pkg,
                pose=None,
                dressup=dress,
                prop=prop_raw if prop_raw else None,
                username=username,
                surface_folder=surface_folder,
            )
        except OSError:
            pass
    prop = normalize_tool_prop(prop_raw, package_id=sub, man=man)
    # runtime helpers for UI (not re-written unless save)
    runtime_prop = dict(prop)
    if package_can_receive(man) or _truthy_yes(prop.get("canReceive")):
        runtime_prop["canReceive"] = True
        if not runtime_prop.get("Receive.address"):
            runtime_prop["Receive.address"] = mint_inbox_address(
                safe, tool_uid=tool_uid
            )
    elif sub == "karaoke" or not _truthy_yes(prop.get("canMark")):
        # fidget / non-marking tools — no rubber-stamp plate mirrors
        runtime_prop["canMark"] = False
    else:
        runtime_prop["Mark.label"] = prop.get("Mark.type") or "urgent"
        runtime_prop["Mark.labels"] = list(
            man.get("mark_types") or DEFAULT_STAMPER_LABELS
        )
        runtime_prop["Mark.style"] = dress.get("mark") or "classic"
        runtime_prop["Mark.class"] = man.get("mark_class") or "stamp"
    return {
        "config": cfg if isinstance(cfg, dict) else {"subtype": sub},
        "surface": surf,
        "pose": pos,
        "pos": pos,
        "dressup": dress,
        "prop": runtime_prop,
        "package_id": sub,
        "_path": str(path.resolve()),
        "_file": path.name,
        "_rel": rel_from_bay(safe, path),
        "path_display": rel_from_bay(safe, path),
    }


def delete_tool_config(
    safe: Path,
    tool_uid: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> bool:
    """Remove a tool instance config from the surface (despawn)."""
    uid = str(tool_uid or "").strip()
    if uid.startswith("tool-"):
        uid = uid[5:]
    if not uid:
        return False
    path = configs_root(safe, username, surface_folder) / f"tool-{uid}.cfg"
    if not path.is_file():
        # try exact
        path2 = configs_root(safe, username, surface_folder) / f"tool-{tool_uid}.cfg"
        if path2.is_file():
            path = path2
        else:
            return False
    try:
        path.unlink()
        return True
    except OSError:
        return False


def list_tool_configs(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> list[dict[str, Any]]:
    root = configs_root(safe, username, surface_folder)
    out: list[dict[str, Any]] = []
    if not root.is_dir():
        return out
    for f in sorted(root.glob("tool-*.cfg")):
        m = re.search(r"tool-(.+)\.cfg$", f.name)
        if not m:
            continue
        uid = m.group(1)
        # strip accidental double
        cfg = read_tool_config(safe, uid, username, surface_folder)
        if cfg:
            cfg["uid"] = uid
            out.append(cfg)
    return out


def spawn_tool(
    safe: Path,
    *,
    cli: str = "stamper",
    label: str | None = None,
    tool_dress: str | None = None,
    x: float | None = None,
    y: float | None = None,
) -> dict[str, Any]:
    """
    Install package (if needed) + mint tool instance cfg on surface.
    `cli` here = Hands -ins name = package folder uid (stamper | inbox).
    """
    ensure_user_tree(safe)
    package_id = resolve_package_id(cli)
    install = install_tool_package(safe, package_id)
    man = read_tool_manifest(safe, package_id) or {}
    subtype = package_id  # folder → subtype[n]
    uid = next_tool_uid(safe, subtype)
    mark_style = (man.get("default_style") or "classic").strip()
    dress = (tool_dress or man.get("default_tool_dress") or "brass").strip()
    pkg_prop = man.get("prop") if isinstance(man.get("prop"), dict) else {}

    if package_can_receive(man):
        kinds = _as_str_list(pkg_prop.get("Receive.kinds") or ["chip"]) or ["chip"]
        addr = mint_inbox_address(safe, tool_uid=uid)
        prop = {
            "canReceive": True,
            "canMark": False,
            "Receive.kinds": kinds,
            "Receive.address": addr,
            "Receive.hasMail": False,
        }
        dress = (tool_dress or man.get("default_tool_dress") or "plain").strip()
        pose = {
            "x": int(x) if x is not None else 140,
            "y": int(y) if y is not None else 140,
            "openW": 132,
            "openH": 148,
        }
    elif package_id == "karaoke":
        # fidget · pull KVEN · copy to clipboard (not a rubber stamp yet)
        dress = (
            tool_dress
            or man.get("default_tool_dress")
            or str(
                (man.get("prop") or {}).get("Dressup.tool.default")
                if isinstance(man.get("prop"), dict)
                else ""
            )
            or "karaoke"
        ).strip() or "karaoke"
        mark_style = ""
        prop = {
            "canMark": False,
            "Kven.last": "— — —",
            "Pull.kven": "— — —",
        }
        pose = {
            "x": int(x) if x is not None else 160,
            "y": int(y) if y is not None else 100,
            "openW": 200,
            "openH": 118,
        }
    elif package_id == "eraser":
        # rubber that wipes stamp + cite scars (not a plate word tool)
        dress = (
            tool_dress
            or man.get("default_tool_dress")
            or str(
                (man.get("prop") or {}).get("Dressup.tool.default")
                if isinstance(man.get("prop"), dict)
                else ""
            )
            or "pink"
        ).strip() or "pink"
        mark_style = ""
        prop = {
            "canMark": True,
            "canErase": True,
            "Mark.class": "erase",
            "Mark.type": "wipe",
        }
        pose = {
            "x": int(x) if x is not None else 150,
            "y": int(y) if y is not None else 130,
            "openW": 100,
            "openH": 88,
        }
    else:
        def_label = (label or man.get("default_label") or "urgent").strip()
        # chipper keeps case on tree cites; rubber stamps stay loud lowercase words
        if package_id != "chipper":
            def_label = def_label.lower()
        prop = {
            "canMark": True,
            "Mark.type": def_label,
        }
        if package_id == "chipper":
            prop["Mark.class"] = "cite"
            prop["Cite.code"] = def_label
            prop["Mark.style"] = (man.get("default_style") or "ticket").strip()
            mark_style = (man.get("default_style") or "ticket").strip()
            dress = (tool_dress or man.get("default_tool_dress") or "ink").strip()
        pose = {
            "x": int(x) if x is not None else 120,
            "y": int(y) if y is not None else 120,
            "openW": 110,
            "openH": 120,
        }

    set_file = man.get("set") or f"{package_id}.set"
    kit_file = man.get("kit") or f"{package_id}.kit"
    path = write_tool_config(
        safe,
        uid,
        subtype=subtype,
        package_id=package_id,
        pose=pose,
        dressup={
            "id": uid,
            "tool": dress,
            "mark": mark_style,
        },
        prop=prop,
    )
    cfg = read_tool_config(safe, uid)
    return {
        "tool": {
            "uid": uid,
            "id": uid,
            "kind": "tool",
            "subtype": subtype,
            "package_id": package_id,
            "title": man.get("title") or subtype,
            "prop": (cfg or {}).get("prop") or prop,
            "dress": dress,
        },
        "config": cfg,
        "install": install,
        "files": {
            "set": rel_from_bay(safe, p)
            if (p := tool_package_file(safe, package_id, set_file))
            else None,
            "kit": rel_from_bay(safe, p)
            if (p := tool_package_file(safe, package_id, kit_file))
            else None,
            "manifest": man.get("_path"),
        },
    }


def place_rom_cart(
    safe: Path,
    *,
    rom_id: str,
    title: str = "",
    sku: str = "",
    case_shell: str = "classicboi",
    julie_tint: str = "",
    plate_css: str = "",
    catalog_id: str = "",
    x: float | None = None,
    y: float | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    refresh_face: bool = True,
) -> dict[str, Any]:
    """
    Place a ROM cart on the surface — desk object with ROM Cat face fields.
    Double-click / open later boots the packaged ROM.
    """
    ensure_user_tree(safe)
    rid = (rom_id or "").strip().lower()
    if not rid:
        raise ValueError("rom_id required")
    face_prop = {
        "canMark": False,
        "Rom.id": rid,
        "Rom.title": (title or rid).strip(),
        "Rom.sku": (sku or "").strip(),
        "Rom.shell": (case_shell or "classicboi").strip() or "classicboi",
        "Rom.tint": (julie_tint or "").strip(),
        "Rom.plate_css": (plate_css or "").strip(),
        "Rom.catalog_id": (catalog_id or "").strip(),
    }
    # one cart per rom_id on this surface (reuse if already placed)
    for cfg in list_tool_configs(safe, username, surface_folder):
        prop = cfg.get("prop") if isinstance(cfg.get("prop"), dict) else {}
        sub = (cfg.get("config") or {}).get("subtype") if isinstance(cfg.get("config"), dict) else ""
        uid_existing = str(cfg.get("uid") or cfg.get("id") or "")
        if str(sub).lower() == "rom" and str(prop.get("Rom.id") or "").lower() == rid:
            if refresh_face:
                # rewrite face from catalog so brown-box era gets real cart paint
                write_tool_config(
                    safe,
                    uid_existing,
                    subtype="rom",
                    package_id="rom",
                    pose=None,
                    dressup={"id": uid_existing, "tool": "cart", "mark": "classic"},
                    prop=face_prop,
                    username=username,
                    surface_folder=surface_folder,
                )
                cfg = read_tool_config(safe, uid_existing, username, surface_folder) or cfg
                prop = (cfg or {}).get("prop") or face_prop
            return {
                "tool": {
                    "uid": uid_existing,
                    "id": uid_existing,
                    "kind": "tool",
                    "subtype": "rom",
                    "package_id": "rom",
                    "title": prop.get("Rom.title") or title or rid,
                    "prop": prop,
                },
                "config": cfg,
                "reused": True,
            }
    uid = next_tool_uid(safe, "rom")
    pose = {
        "x": int(x) if x is not None else 180,
        "y": int(y) if y is not None else 160,
        "openW": 108,
        "openH": 128,
    }
    write_tool_config(
        safe,
        uid,
        subtype="rom",
        package_id="rom",
        pose=pose,
        dressup={"id": uid, "tool": "cart", "mark": "classic"},
        prop=face_prop,
        username=username,
        surface_folder=surface_folder,
    )
    cfg = read_tool_config(safe, uid, username, surface_folder)
    return {
        "tool": {
            "uid": uid,
            "id": uid,
            "kind": "tool",
            "subtype": "rom",
            "package_id": "rom",
            "title": face_prop["Rom.title"],
            "prop": face_prop,
        },
        "config": cfg,
        "reused": False,
    }


def clear_pin_cites(safe: Path, leaf_id: str) -> list[str]:
    """Wipe pin.cites on the library chip paper (eraser)."""
    lid = to_leaf_chip_id(leaf_id)
    path = chip_path(safe, lid)
    if not path or not path.is_file():
        return []
    meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
    pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}
    if not isinstance(pin, dict):
        pin = {}
    pin["cites"] = []
    pin["tps_updated"] = now()
    meta["pin"] = pin
    path.write_text(dump_nested_fm(meta, body), encoding="utf-8")
    return []


def clear_leaf_prop_marks(
    safe: Path,
    leaf_id: str,
) -> dict[str, Any]:
    """Eraser: strip every Mark.* and Cite.* scar from leaf or card.

    Also clears pin.cites on leaves. Keeps isMarkable so paper can be re-stamped.
    """
    raw = str(leaf_id or "").strip()
    is_card = bool(re.match(r"^card\[", raw) or raw.startswith("card"))
    if is_card:
        lid = to_card_id(raw)
        prev = read_card_config(safe, lid) or {}
    else:
        lid = to_leaf_chip_id(raw)
        prev = read_leaf_config(safe, lid) or {}
    pose = prev.get("pose") or prev.get("pos") or {}
    dress = prev.get("dressup") or {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}
    if not leaf_is_markable(prev_prop):
        raise ValueError("not markable · prop.isMarkable: no")

    # keep non-scar flags (homeBin, filing, etc.) — drop only stamp/cite scars
    kept: dict[str, Any] = {}
    for k, v in prev_prop.items():
        sk = str(k)
        if sk.startswith("Mark.") or sk.startswith("Cite."):
            continue
        if sk in ("isMarked", "isCited"):
            continue
        kept[k] = v
    kept["isMarkable"] = True
    kept["isMarked"] = False
    # isCited omitted = clean

    if is_card:
        # write_card_config merges and skips empty — force clean prop by rewrite
        path = write_card_config(safe, lid, pose=pose, dressup=dress, prop=None)
        # re-read and replace prop section fully
        cfg_path = path
        meta, body = parse_nested_fm(cfg_path.read_text(encoding="utf-8"))
        meta["prop"] = normalize_leaf_prop(kept)
        cfg_path.write_text(dump_nested_fm(meta, body), encoding="utf-8")
        cites: list[str] = []
    else:
        path = write_leaf_config_with_prop(
            safe, lid, pose=pose, dressup=dress, prop=None
        )
        # force full prop replace (merge cannot delete Mark.* keys alone)
        cfg = read_leaf_config(safe, lid) or {}
        cfg_path = Path(cfg["_path"]) if cfg.get("_path") else path
        meta, body = parse_nested_fm(cfg_path.read_text(encoding="utf-8"))
        meta["prop"] = normalize_leaf_prop(kept)
        cfg_path.write_text(dump_nested_fm(meta, body), encoding="utf-8")
        path = cfg_path
        cites = clear_pin_cites(safe, lid)

    clean = normalize_leaf_prop(kept)
    return {
        "ok": True,
        "erased": True,
        "path": str(path),
        "prop": clean,
        "leaf_id": lid,
        "card_id": lid if is_card else None,
        "cites": cites,
    }


def merge_leaf_prop_mark(
    safe: Path,
    leaf_id: str,
    mark_prop: dict[str, Any],
) -> dict[str, Any]:
    """Write isMarked + Mark.* onto leaf or card config prop (merge).

    Requires prop isMarkable (default yes). Tool canMark is separate —
    that lives on the tool instance.
    Cite marks (Mark.class=cite / Cite.code) also append pin.cites on leaves.
    eraseAll / canErase wipe every stamp+cite scar instead.
    """
    scar = dict(mark_prop or {})
    # eraser path — full wipe of stamp + cite scars
    if (
        scar.get("eraseAll") is True
        or scar.get("eraseAll") == "yes"
        or str(scar.get("Mark.class") or "").strip().lower() == "erase"
        or scar.get("canErase") is True
    ):
        return clear_leaf_prop_marks(safe, leaf_id)

    raw = str(leaf_id or "").strip()
    is_card = bool(re.match(r"^card\[", raw) or raw.startswith("card"))
    if is_card:
        lid = to_card_id(raw)
        prev = read_card_config(safe, lid) or {}
    else:
        lid = to_leaf_chip_id(raw)
        prev = read_leaf_config(safe, lid) or {}
    pose = prev.get("pose") or prev.get("pos") or {}
    dress = prev.get("dressup") or {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}
    if not leaf_is_markable(prev_prop):
        raise ValueError("not markable · prop.isMarkable: no")
    scar.setdefault("isMarkable", True)
    if is_card:
        path = write_card_config(safe, lid, pose=pose, dressup=dress, prop=scar)
        cites: list[str] = []
    else:
        path = write_leaf_config_with_prop(
            safe, lid, pose=pose, dressup=dress, prop=scar
        )
        cites = []
        klass = str(scar.get("Mark.class") or "").strip().lower()
        cite = str(scar.get("Cite.code") or "").strip()
        if not cite and klass in ("cite", "chip", "chipper"):
            cite = str(scar.get("Mark.type") or "").strip()
        if cite and (
            scar.get("isCited")
            or scar.get("Cite.code")
            or klass in ("cite", "chip", "chipper")
        ):
            cites = append_pin_cite(safe, lid, cite)
    return {
        "ok": True,
        "path": str(path),
        "prop": normalize_leaf_prop(
            {**prev_prop, **scar, "isMarked": scar.get("isMarked", True)}
        ),
        "leaf_id": lid,
        "card_id": lid if is_card else None,
        "cites": cites,
    }


_CITE_RE = re.compile(
    r"\b([A-Za-z]{1,6}-\d{1,4}"
    r"(?:\.T\d{1,3})?"
    r"(?:\.B\d{1,5})?"
    r"(?:\.L\d{1,3})?)\b"
)


def extract_cite_code(raw: str) -> str:
    """Pull OT-001.T02.B014-style cite from clipboard / paste text."""
    s = (raw or "").strip()
    if not s:
        return ""
    # prefer full tree cite if present
    best = ""
    for m in _CITE_RE.finditer(s):
        cand = m.group(1)
        if ".B" in cand or ".T" in cand or len(cand) > len(best):
            best = cand
    return best


def append_pin_cite(safe: Path, leaf_id: str, cite: str) -> list[str]:
    """Append a Nim/tree cite to pin.cites on the library chip paper."""
    lid = to_leaf_chip_id(leaf_id)
    code = extract_cite_code(cite) or str(cite or "").strip()
    if not code:
        return []
    path = chip_path(safe, lid)
    if not path or not path.is_file():
        raise ValueError("leaf chip not found · " + lid)
    meta, body = parse_nested_fm(path.read_text(encoding="utf-8"))
    pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}
    if not isinstance(pin, dict):
        pin = {}
    cites = pin.get("cites") or []
    if isinstance(cites, str):
        try:
            cites = json.loads(cites)
        except json.JSONDecodeError:
            cites = [cites] if cites.strip() else []
    if not isinstance(cites, list):
        cites = []
    out: list[str] = []
    seen: set[str] = set()
    for c in list(cites) + [code]:
        t = str(c).strip()
        if not t:
            continue
        k = t.casefold()
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
    pin["cites"] = out
    pin["tps_updated"] = now()
    if "tps_created" not in pin:
        pin["tps_created"] = now()
    if "tags" not in pin:
        pin["tags"] = []
    meta["pin"] = pin
    path.write_text(dump_nested_fm(meta, body), encoding="utf-8")
    return out


def write_leaf_config_with_prop(
    safe: Path,
    leaf_id: str,
    pose: dict[str, Any] | None = None,
    dressup: dict[str, Any] | None = None,
    prop: dict[str, Any] | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
    config_id: str | None = None,
) -> Path:
    """Leaf instance cfg writer. Dress + prop only; pose routes to host surface."""
    ensure_user_tree(safe)
    cid = to_leaf_chip_id(leaf_id)
    cfg_id = config_id or (
        PRIMARY_CONFIG_ID if cid == PRIMARY_CHIP_ID else f"chip-{cid}"
    )
    path = config_path_for_leaf(safe, cid, username, surface_folder, cfg_id)
    path.parent.mkdir(parents=True, exist_ok=True)

    prev: dict[str, Any] = {}
    if path.is_file():
        try:
            prev, _ = parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            prev = {}
    prev_du = prev.get("dressup") if isinstance(prev.get("dressup"), dict) else {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}

    # never rewrite pos on the leaf paper — host surface owns geometry
    if pose:
        upsert_leaf_pose(safe, cid, pose, username, surface_folder)

    raw_du = dict(prev_du)
    if dressup:
        raw_du.update(dressup)
    if raw_du.get("paper") and not raw_du.get("style"):
        raw_du["style"] = raw_du["paper"]
    du = normalize_leaf_dressup(raw_du)
    du["id"] = raw_du.get("id") or cid

    prop_out = dict(prev_prop)
    if prop:
        for k, v in prop.items():
            if v is None or v == "":
                continue
            if k in ("isMarked", "isMarkable", "canMark", "canDressup", "isTardis"):
                prop_out[k] = _truthy_yes(v)
            else:
                prop_out[k] = v
    prop_out = normalize_leaf_prop(prop_out)

    surf_paper = read_surface_paper(safe, username, surface_folder)
    surf = (surf_paper or {}).get("surface") or {}
    sections: dict[str, Any] = {
        "config": {
            "type": "chip",
            "subtype": "leaf",
            "id": cfg_id.replace(".cfg", "") if cfg_id.endswith(".cfg") else cfg_id,
        },
        "surface": {
            "id": surf.get("id") or DEFAULT_SURFACE_ID,
            "name": surf.get("name") or DEFAULT_SURFACE_NAME,
            "auth": surf.get("auth") or username or DEFAULT_USERNAME,
        },
        "dressup": du,
    }
    if prop_out:
        sections["prop"] = prop_out
    path.write_text(dump_nested_fm(sections, ""), encoding="utf-8")
    return path

# -- Hermes mail / deliver chips into inbox receivers -----------------------

INBOX_HELD_TAG = "inbox-held"


def list_inbox_instances(
    safe: Path,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> list[dict[str, Any]]:
    """All tool configs that canReceive (inbox receivers on this surface)."""
    out: list[dict[str, Any]] = []
    for cfg in list_tool_configs(safe, username, surface_folder):
        prop = cfg.get("prop") if isinstance(cfg.get("prop"), dict) else {}
        sub = resolve_package_id(str(cfg.get("package_id") or ""))
        if not (_truthy_yes(prop.get("canReceive")) or sub == "inbox"):
            continue
        uid = str(cfg.get("uid") or "")
        out.append(
            {
                "uid": uid,
                "address": str(prop.get("Receive.address") or "").strip(),
                "hasMail": _truthy_yes(prop.get("Receive.hasMail")),
                "mail": _as_str_list(prop.get("Receive.mail") or []),
                "prop": prop,
                "config": cfg,
            }
        )
    return out


def _norm_mail_address(s: str) -> str:
    return (
        (s or "")
        .strip()
        .lower()
        .replace("-", "\u00b7")
        .replace("*", "\u00b7")
        .replace(" ", "")
    )


def find_inbox_by_address(
    safe: Path,
    address: str,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any] | None:
    """Match Receive.address (case-insensitive; hyphen or middle-dot)."""
    want_n = _norm_mail_address(address)
    if not want_n:
        return None
    for row in list_inbox_instances(safe, username, surface_folder):
        got_n = _norm_mail_address(str(row.get("address") or ""))
        if got_n and got_n == want_n:
            return row
        if got_n and got_n.endswith("\u00b7" + want_n):
            return row
    return None


def leaf_is_inbox_held(leaf: dict[str, Any] | None) -> bool:
    if not isinstance(leaf, dict):
        return False
    tags = leaf.get("tags") or []
    if not isinstance(tags, list):
        return False
    return any(str(t).strip().lower() == INBOX_HELD_TAG for t in tags)


def scan_held_mail_for_inbox(
    safe: Path,
    inbox_uid: str,
    *,
    address: str | None = None,
) -> list[str]:
    """Recover Receive.mail by scanning library for inbox-held chips."""
    want_uid = str(inbox_uid or "").strip()
    addr_n = _norm_mail_address(address or "")
    found: list[str] = []
    orphans: list[str] = []
    for row in list_leaf_chips(safe):
        lid = str(row.get("uid") or row.get("id") or "")
        p = chip_path(safe, to_leaf_chip_id(lid))
        if not p:
            continue
        full = leaf_api_from_chip_file(p)
        if not full or not leaf_is_inbox_held(full):
            continue
        cfg = read_leaf_config(safe, to_leaf_chip_id(lid))
        prop = (
            (cfg or {}).get("prop")
            if isinstance((cfg or {}).get("prop"), dict)
            else {}
        )
        mail_inbox = str(prop.get("Mail.inbox") or "").strip()
        mail_addr = _norm_mail_address(str(prop.get("Mail.address") or ""))
        lid_c = to_leaf_chip_id(lid)
        if mail_inbox and mail_inbox == want_uid:
            found.append(lid_c)
            continue
        if addr_n and mail_addr and mail_addr == addr_n:
            found.append(lid_c)
            continue
        tags = [str(t).lower() for t in (full.get("tags") or [])]
        if "hermes" in tags or "mail" in tags or INBOX_HELD_TAG in tags:
            orphans.append(lid_c)
    # only claim orphans if nothing matched by id/address (one-inbox desk)
    use = found if found else orphans
    seen: set[str] = set()
    out: list[str] = []
    for x in use:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def reconcile_inbox_mail(
    safe: Path,
    inbox_uid: str,
    *,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """Rebuild Receive.mail from held chips; write inbox cfg."""
    prev = read_tool_config(safe, inbox_uid, username, surface_folder)
    if not prev:
        raise ValueError("inbox not found")
    prop = dict(prev.get("prop") or {})
    addr = str(prop.get("Receive.address") or "")
    scanned = scan_held_mail_for_inbox(safe, inbox_uid, address=addr)
    listed = _as_str_list(prop.get("Receive.mail") or [])
    # union: listed first, then scanned
    mail: list[str] = []
    seen: set[str] = set()
    for x in listed + scanned:
        lid = to_leaf_chip_id(str(x))
        # only keep still-held
        p = chip_path(safe, lid)
        full = leaf_api_from_chip_file(p) if p else None
        if not full or not leaf_is_inbox_held(full):
            continue
        if lid not in seen:
            seen.add(lid)
            mail.append(lid)
    prop["Receive.mail"] = mail
    prop["Receive.hasMail"] = bool(mail)
    prop["canReceive"] = True
    pose = prev.get("pos") or prev.get("pose") or {}
    dress = prev.get("dressup") or {}
    write_tool_config(
        safe,
        inbox_uid,
        subtype="inbox",
        package_id="inbox",
        pose={k: pose.get(k) for k in ("x", "y", "openW", "openH") if k in pose},
        dressup=dress,
        prop=prop,
        username=username,
        surface_folder=surface_folder,
    )
    return {
        "uid": inbox_uid,
        "address": prop.get("Receive.address"),
        "mail": mail,
        "hasMail": bool(mail),
    }


def deliver_mail(
    safe: Path,
    *,
    address: str,
    title: str = "letter",
    body: str = "",
    from_auth: str = "Hermes",
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """
    Mint a leaf chip held by the matching inbox (not dumped on the felt).
    Appends uid to inbox Receive.mail; sets Receive.hasMail: yes.
    """
    ensure_user_tree(safe)
    box = find_inbox_by_address(safe, address, username, surface_folder)
    if not box:
        known = [
            r.get("address")
            for r in list_inbox_instances(safe, username, surface_folder)
        ]
        raise ValueError(
            "no inbox for address / "
            + (address or "?")
            + " / known: "
            + (", ".join(str(a) for a in known if a) or "(none installed)")
        )
    inbox_uid = str(box.get("uid") or "")
    t = now()
    leaf_uid = next_leaf_uid(safe)
    subj = (title or "letter").strip() or "letter"
    author = (from_auth or "Hermes").strip() or "Hermes"
    text = body if body is not None else ""
    leaf = {
        "id": leaf_uid,
        "uid": leaf_uid,
        "title": subj,
        "author": author,
        "body": text,
        "created": t,
        "updated": t,
        "tags": [INBOX_HELD_TAG, "mail", "hermes"],
        "stamps": [],
        "paper": "lined",
        "shell": "paper",
        "style": "lined",
    }
    write_leaf_chip(safe, leaf)
    write_leaf_config(
        safe,
        leaf_uid,
        pose={"x": 40, "y": 40, "openW": 420, "openH": 520},
        dressup={"shell": "paper", "style": "lined", "id": leaf_uid},
        prop={
            "isMarkable": True,
            "isMarked": False,
            "Mail.inbox": inbox_uid,
            "Mail.address": box.get("address") or address,
            "Mail.from": author,
        },
        username=username,
        surface_folder=surface_folder,
        config_id=f"chip-{leaf_uid}",
    )

    prev = read_tool_config(safe, inbox_uid, username, surface_folder) or {}
    prop = dict(prev.get("prop") or {})
    mail_list = _as_str_list(prop.get("Receive.mail") or [])
    if leaf_uid not in mail_list:
        mail_list.append(leaf_uid)
    prop["canReceive"] = True
    prop["Receive.mail"] = mail_list
    prop["Receive.hasMail"] = True
    if not prop.get("Receive.address"):
        prop["Receive.address"] = box.get("address") or address
    if not prop.get("Receive.kinds"):
        prop["Receive.kinds"] = ["chip"]
    pose = prev.get("pos") or prev.get("pose") or {}
    dress = prev.get("dressup") or {
        "id": inbox_uid,
        "tool": "plain",
        "mark": "classic",
    }
    write_tool_config(
        safe,
        inbox_uid,
        subtype="inbox",
        package_id="inbox",
        pose={k: pose.get(k) for k in ("x", "y", "openW", "openH") if k in pose},
        dressup=dress,
        prop=prop,
        username=username,
        surface_folder=surface_folder,
    )
    p = chip_path(safe, leaf_uid)
    return {
        "ok": True,
        "leaf_id": leaf_uid,
        "inbox_uid": inbox_uid,
        "address": prop.get("Receive.address"),
        "title": subj,
        "from": author,
        "mail_count": len(mail_list),
        "chip_rel": rel_from_bay(safe, p) if p else None,
    }


def take_mail_from_inbox(
    safe: Path,
    leaf_id: str,
    *,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """Remove inbox-held tag so leaf can appear on the felt; refresh inbox mail list."""
    lid = to_leaf_chip_id(leaf_id)
    p = chip_path(safe, lid)
    if not p or not p.is_file():
        raise ValueError("leaf not found")
    leaf = leaf_api_from_chip_file(p)
    if not leaf:
        raise ValueError("leaf unreadable")
    tags = [str(t) for t in (leaf.get("tags") or []) if str(t).strip()]
    tags = [t for t in tags if t.lower() != INBOX_HELD_TAG]
    leaf["tags"] = tags
    leaf["updated"] = now()
    write_leaf_chip(safe, leaf)

    for box in list_inbox_instances(safe, username, surface_folder):
        uid = str(box.get("uid") or "")
        prop = dict(box.get("prop") or {})
        mail = [m for m in _as_str_list(prop.get("Receive.mail") or []) if m != lid]
        if mail == _as_str_list(prop.get("Receive.mail") or []):
            continue
        prop["Receive.mail"] = mail
        prop["Receive.hasMail"] = bool(mail)
        prev = read_tool_config(safe, uid, username, surface_folder) or {}
        pose = prev.get("pos") or prev.get("pose") or {}
        dress = prev.get("dressup") or {}
        write_tool_config(
            safe,
            uid,
            subtype="inbox",
            package_id="inbox",
            pose={k: pose.get(k) for k in ("x", "y", "openW", "openH") if k in pose},
            dressup=dress,
            prop=prop,
            username=username,
            surface_folder=surface_folder,
        )
    # checked out onto the desk surface (full paper, not held)
    full = leaf_api_from_chip_file(p)
    cfg = read_leaf_config(safe, lid)
    pose = {}
    if isinstance(cfg, dict):
        pose = dict(cfg.get("pos") or cfg.get("pose") or {})
    if not pose:
        pose = {"x": 48, "y": 48, "openW": 420, "openH": 520}
    upsert_surface_object_pose(safe, lid, pose, username, surface_folder)
    cfg = read_leaf_config(safe, lid)
    full = leaf_api_from_chip_file(p)
    return {"ok": True, "leaf": full, "config": cfg}


def file_leaf_to_inbox(
    safe: Path,
    leaf_id: str,
    *,
    address: str | None = None,
    inbox_uid: str | None = None,
    username: str = DEFAULT_USERNAME,
    surface_folder: str = DEFAULT_SURFACE_FOLDER,
) -> dict[str, Any]:
    """
    Park an existing leaf in a mailbox (banker-box / CASE STREET MAIL).

    · tag inbox-held (not on felt)
    · append to Receive.mail
    · Mail.inbox / Mail.address for return address
    · strip desk surface pose + any bin membership (honest: not free, not in board)
    Does not mint a new chip — Hermes mints; this files what you already have.
    """
    lid = to_leaf_chip_id(leaf_id)
    if not lid:
        raise ValueError("leaf id required")
    p = chip_path(safe, lid)
    if not p or not p.is_file():
        raise ValueError("leaf not found")
    leaf = leaf_api_from_chip_file(p)
    if not leaf:
        raise ValueError("leaf unreadable")

    box = None
    if address:
        box = find_inbox_by_address(safe, address, username, surface_folder)
    elif inbox_uid:
        want = str(inbox_uid).replace("tool-", "").strip()
        for r in list_inbox_instances(safe, username, surface_folder):
            got = str(r.get("uid") or "").replace("tool-", "").strip()
            if got == want or r.get("uid") == inbox_uid:
                box = r
                break
    if not box:
        # single-inbox desk fallback
        rows = list_inbox_instances(safe, username, surface_folder)
        if len(rows) == 1:
            box = rows[0]
        else:
            raise ValueError("inbox not found · pass address or uid")

    inbox_id = str(box.get("uid") or "").strip()
    addr = str(box.get("address") or address or "").strip()

    # leave any board/book/deck that claimed this paper
    owner = leaf_owner_bin(safe, lid)
    if owner:
        try:
            set_bin_membership(safe, owner, lid, add=False)
        except ValueError:
            pass
        try:
            remove_bin_member_pose(safe, owner, lid, username, surface_folder)
        except Exception:
            pass

    # not free on desk while held
    remove_surface_object_pose(safe, lid, username, surface_folder)

    tags = [str(t) for t in (leaf.get("tags") or []) if str(t).strip()]
    if not any(t.lower() == INBOX_HELD_TAG for t in tags):
        tags.append(INBOX_HELD_TAG)
    # soft mail tags · not hermes-only (this is desk filing)
    for soft in ("mail", "casestreet"):
        if not any(t.lower() == soft for t in tags):
            tags.append(soft)
    leaf["tags"] = tags
    leaf["updated"] = now()
    write_leaf_chip(safe, leaf)

    prev_cfg = read_leaf_config(safe, lid) or {}
    prev_prop = (
        prev_cfg.get("prop") if isinstance(prev_cfg.get("prop"), dict) else {}
    )
    prev_du = (
        prev_cfg.get("dressup") if isinstance(prev_cfg.get("dressup"), dict) else {}
    )
    prop_merge = dict(prev_prop)
    prop_merge["Mail.inbox"] = inbox_id
    prop_merge["Mail.address"] = addr
    write_leaf_config(
        safe,
        lid,
        pose=None,  # held — no desk pose write
        dressup=prev_du or None,
        prop=prop_merge,
        username=username,
        surface_folder=surface_folder,
    )

    prev = read_tool_config(safe, inbox_id, username, surface_folder) or {}
    prop = dict(prev.get("prop") or {})
    mail_list = _as_str_list(prop.get("Receive.mail") or [])
    if lid not in mail_list:
        mail_list.append(lid)
    prop["canReceive"] = True
    prop["Receive.mail"] = mail_list
    prop["Receive.hasMail"] = True
    if addr and not prop.get("Receive.address"):
        prop["Receive.address"] = addr
    if not prop.get("Receive.kinds"):
        prop["Receive.kinds"] = ["chip"]
    pose = prev.get("pos") or prev.get("pose") or {}
    dress = prev.get("dressup") or {
        "id": inbox_id,
        "tool": "plain",
        "mark": "classic",
    }
    write_tool_config(
        safe,
        inbox_id,
        subtype="inbox",
        package_id="inbox",
        pose={k: pose.get(k) for k in ("x", "y", "openW", "openH") if k in pose},
        dressup=dress,
        prop=prop,
        username=username,
        surface_folder=surface_folder,
    )
    full = leaf_api_from_chip_file(p)
    return {
        "ok": True,
        "leaf_id": lid,
        "inbox_uid": inbox_id,
        "address": prop.get("Receive.address") or addr,
        "title": (full or {}).get("title") or lid,
        "mail_count": len(mail_list),
        "mail": mail_list,
    }
