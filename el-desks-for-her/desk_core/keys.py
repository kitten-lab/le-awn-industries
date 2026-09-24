"""Key chips — tiny keyboard tiles on the felt.

Island store.py calls these with itself as `st` so spawn/save/pose stay in one
place instead of four copies. Heading is 8-way compass. Face is a glyph or SVG.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

HEADINGS = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
HEADING_DEG = {
    "N": 0,
    "NE": 45,
    "E": 90,
    "SE": 135,
    "S": 180,
    "SW": 225,
    "W": 270,
    "NW": 315,
}
KEY_SIZE = 52
GLYPH_MAX = 12
SVG_MAX = 8000

_SVG_TAG_OK = re.compile(
    r"^(/?)(svg|path|g|circle|rect|line|polyline|polygon|text|defs|use)$",
    re.I,
)
_ON_ATTR = re.compile(r"\son\w+\s*=", re.I)
_BAD_TAG = re.compile(
    r"<(script|foreignObject|iframe|object|embed|link|meta)[\s>]",
    re.I,
)


def to_key_id(oid: str) -> str:
    s = str(oid or "").strip()
    if s.endswith(".chip"):
        s = s[: -len(".chip")]
    if s.startswith("chip-"):
        s = s[5:]
    m = re.match(r"^(key\[\d+\])", s)
    if m:
        return m.group(1)
    m = re.match(r"^key\[(\d+)\]", s)
    if m:
        return f"key[{m.group(1)}]"
    m = re.match(r"^key(\d+)$", s)
    if m:
        return f"key[{m.group(1)}]"
    return ""


def is_key_id(oid: str) -> bool:
    return bool(re.match(r"^key\[\d+\]$", to_key_id(oid)))


def n_from_key_uid(uid: str) -> int:
    m = re.match(r"^key\[(\d+)\]", to_key_id(uid))
    return int(m.group(1)) if m else 0


def normalize_heading(raw: Any) -> str:
    s = str(raw or "N").strip().upper().replace("-", "")
    aliases = {
        "NORTH": "N",
        "NORTHEAST": "NE",
        "EAST": "E",
        "SOUTHEAST": "SE",
        "SOUTH": "S",
        "SOUTHWEST": "SW",
        "WEST": "W",
        "NORTHWEST": "NW",
        "0": "N",
        "45": "NE",
        "90": "E",
        "135": "SE",
        "180": "S",
        "225": "SW",
        "270": "W",
        "315": "NW",
    }
    s = aliases.get(s, s)
    return s if s in HEADINGS else "N"


def turn_heading(cur: str, steps: int = 1) -> str:
    i = HEADINGS.index(normalize_heading(cur))
    return HEADINGS[(i + int(steps)) % len(HEADINGS)]


def heading_deg(cur: str) -> int:
    return HEADING_DEG[normalize_heading(cur)]


KEY_FACES = ("plain", "octagon", "hexagon")
FACE_ALIAS = {
    "octogon": "octagon",
    "octogons": "octagon",
    "octagons": "octagon",
    "hex": "hexagon",
    "hexagons": "hexagon",
    "square": "plain",
    "rounded": "plain",
}

KEY_COLORS = {
    "cream": "#f4efe4",
    "amber": "#d4a04a",
    "gold": "#e0c060",
    "brass": "#c4a060",
    "red": "#c44030",
    "rose": "#c07070",
    "blue": "#3a6090",
    "green": "#3a6040",
    "black": "#1a1410",
    "white": "#f6f1e8",
    "ink": "#2a1c10",
    "violet": "#5a3a70",
    "slate": "#4a5058",
}


def normalize_key_face(raw: Any) -> str:
    s = str(raw or "plain").strip().lower()
    s = FACE_ALIAS.get(s, s)
    if s in ("text", "svg", "_base", ""):
        return "plain"
    return s if s in KEY_FACES else "plain"


def normalize_key_color(raw: Any) -> str:
    s = str(raw or "").strip()
    if not s or s.lower() in ("none", "clear", "off", "default"):
        return ""
    if re.match(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", s):
        return s.lower()
    name = re.sub(r"\s+", "", s.lower())
    if name in KEY_COLORS:
        return KEY_COLORS[name]
    if name in ("red", "blue", "green", "black", "white", "gold", "orange", "purple"):
        return name
    return ""


def sanitize_svg(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if _BAD_TAG.search(text):
        return ""
    text = _ON_ATTR.sub(" ", text)
    # keep only a single svg tree
    m = re.search(r"<svg[\s\S]*?</svg>", text, re.I)
    if not m:
        return ""
    blob = m.group(0)

    def _keep_tag(mm: re.Match[str]) -> str:
        name = mm.group(2)
        if _SVG_TAG_OK.match(name):
            return mm.group(0)
        return ""

    blob = re.sub(r"<(/?)([A-Za-z][\w:-]*)\b[^>]*>", _keep_tag, blob)
    if len(blob) > SVG_MAX:
        blob = blob[:SVG_MAX]
    return blob


def key_filename_for(st: Any, uid: str, title: str) -> str:
    uid = to_key_id(uid)
    slug = st.title_slug(title, fallback="key")
    uid_safe = re.sub(r"[^\w.\[\]-]+", "_", uid)
    return f"{uid_safe}-{slug}.chip"


def next_key_uid(st: Any, safe: Path) -> str:
    used: set[int] = set()
    lib = st.library_root(safe)
    if lib.is_dir():
        for f in lib.glob("key[*.chip"):
            m = re.match(r"^key\[(\d+)\]", f.name)
            if m:
                used.add(int(m.group(1)))
    root = st.configs_root(safe)
    if root.is_dir():
        for f in root.glob("chip-key[*.cfg"):
            m = re.search(r"key\[(\d+)\]", f.stem)
            if m:
                used.add(int(m.group(1)))
    n = 0
    while n in used:
        n += 1
    return f"key[{n}]"


def key_path(st: Any, safe: Path, key_id: str) -> Path | None:
    uid = to_key_id(key_id)
    if not uid:
        return None
    lib = st.library_root(safe)
    if not lib.is_dir():
        return None
    for f in lib.glob("key[*.chip"):
        if f.name.startswith(uid + "-") or f.stem == uid:
            return f
    for f in lib.glob("key[*.chip"):
        try:
            meta, _ = st.parse_nested_fm(f.read_text(encoding="utf-8"))
            ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
            cid = to_key_id(str(ch.get("uid") or ch.get("id") or ""))
            if cid == uid:
                return f
        except OSError:
            continue
    return None


def key_api_from_file(st: Any, path: Path) -> dict[str, Any] | None:
    if not path.is_file() or path.suffix.lower() != ".chip":
        return None
    try:
        meta, body = st.parse_nested_fm(path.read_text(encoding="utf-8"))
    except OSError:
        return None
    ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
    pin = meta.get("pin") if isinstance(meta.get("pin"), dict) else {}
    store = meta.get("store") if isinstance(meta.get("store"), dict) else {}
    uid = to_key_id(str(ch.get("uid") or ch.get("id") or path.stem))
    if not uid:
        return None
    body = body or ""
    mode = str(ch.get("face") or ch.get("face_mode") or "text").strip().lower()
    if mode not in ("text", "svg"):
        mode = "svg" if "<svg" in body.lower() else "text"
    glyph = str(ch.get("glyph") or "").strip()
    if mode == "text" and not glyph:
        glyph = (body.strip().splitlines() or [""])[0][:GLYPH_MAX]
    svg = sanitize_svg(body) if mode == "svg" else ""
    heading = normalize_heading(ch.get("heading") or "N")
    color = normalize_key_color(ch.get("color") or "")
    return {
        "id": uid,
        "uid": uid,
        "kind": "key",
        "type": "key",
        "title": ch.get("name") or glyph or "key",
        "name": ch.get("name") or glyph or "key",
        "author": ch.get("auth") or "unknown",
        "auth": ch.get("auth") or "unknown",
        "glyph": glyph,
        "svg": svg,
        "face": mode,
        "face_mode": mode,
        "color": color,
        "heading": heading,
        "heading_deg": heading_deg(heading),
        "body": body,
        "created": pin.get("tps_created"),
        "updated": pin.get("tps_updated"),
        "tags": pin.get("tags") if isinstance(pin.get("tags"), list) else [],
        "package_id": "key",
        "_file": path.name,
        "_path": str(path.resolve()),
        "_chip": True,
        "store": store,
    }


def write_key_chip(st: Any, safe: Path, key: dict[str, Any]) -> Path:
    st.ensure_user_tree(safe)
    uid = to_key_id(str(key.get("uid") or key.get("id") or next_key_uid(st, safe)))
    if not uid:
        uid = next_key_uid(st, safe)
    title = (key.get("title") or key.get("name") or "key").strip() or "key"
    author = (key.get("author") or key.get("auth") or "unknown").strip() or "unknown"
    t = st.now()
    created = int(key.get("created") or t)
    heading = normalize_heading(key.get("heading") or "N")
    mode = str(key.get("face_mode") or key.get("face") or "text").strip().lower()
    if mode not in ("text", "svg"):
        mode = "text"
    glyph = str(key.get("glyph") or "").strip()[:GLYPH_MAX]
    svg = sanitize_svg(str(key.get("svg") or ""))
    color = normalize_key_color(key.get("color") or "")
    body = key.get("body")
    old = key_path(st, safe, uid)
    if body is None and old and old.is_file():
        try:
            _, prev = st.parse_nested_fm(old.read_text(encoding="utf-8"))
            body = prev
        except OSError:
            body = ""
    if svg:
        mode = "svg"
        body = svg
    elif mode == "svg" and body:
        body = sanitize_svg(str(body))
        if not body:
            mode = "text"
    if mode != "svg":
        mode = "text"
        if glyph:
            body = glyph
        else:
            body = str(body or "").strip().splitlines()[0][:GLYPH_MAX] if body else ""
            glyph = body
    tags = key.get("tags") if isinstance(key.get("tags"), list) else []
    fname = key_filename_for(st, uid, title if title != "key" else (glyph or "key"))
    path = st.library_root(safe) / fname
    path.parent.mkdir(parents=True, exist_ok=True)
    if old and old.is_file() and old.resolve() != path.resolve():
        try:
            if path.is_file():
                path.unlink()
            old.replace(path)
        except OSError:
            pass
    sections = {
        "store": {"file": fname, "type": "chip", "subtype": "key"},
        "chip": {
            "uid": uid,
            "name": title,
            "auth": author,
            "type": "key",
            "heading": heading,
            "face": mode,
            **({"glyph": glyph} if glyph else {}),
            **({"color": color} if color else {}),
        },
        "pin": {
            "tps_created": created,
            "tps_updated": t,
            "tags": tags,
        },
    }
    path.write_text(st.dump_nested_fm(sections, body or ""), encoding="utf-8")
    for f in st.library_root(safe).glob("key[*.chip"):
        if f.resolve() == path.resolve():
            continue
        try:
            meta, _ = st.parse_nested_fm(f.read_text(encoding="utf-8"))
            ch = meta.get("chip") if isinstance(meta.get("chip"), dict) else {}
            if to_key_id(str(ch.get("uid") or "")) == uid:
                f.unlink()
        except OSError:
            pass
    return path


def write_key_config(
    st: Any,
    safe: Path,
    key_id: str,
    pose: dict[str, Any] | None = None,
    dressup: dict[str, Any] | None = None,
    prop: dict[str, Any] | None = None,
    username: str | None = None,
    surface_folder: str | None = None,
) -> Path:
    username = username or st.DEFAULT_USERNAME
    surface_folder = surface_folder or st.DEFAULT_SURFACE_FOLDER
    st.ensure_user_tree(safe)
    cid = to_key_id(key_id)
    cfg_id = f"chip-{cid}"
    path = st.configs_root(safe, username, surface_folder) / f"{cfg_id}.cfg"
    path.parent.mkdir(parents=True, exist_ok=True)
    prev: dict[str, Any] = {}
    if path.is_file():
        try:
            prev, _ = st.parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            prev = {}
    prev_du = prev.get("dressup") if isinstance(prev.get("dressup"), dict) else {}
    prev_prop = prev.get("prop") if isinstance(prev.get("prop"), dict) else {}
    if pose:
        pose_out = st._normalize_pose_dict(pose)
        pose_out.pop("open", None)
        heading = pose.get("heading")
        if heading:
            pose_out["heading"] = normalize_heading(heading)
        if pose_out:
            owner = st.leaf_owner_bin(safe, cid)
            if owner and re.match(r"^(board|deck)\[", str(owner)):
                st.upsert_bin_member_pose(
                    safe, str(owner), cid, pose_out, username, surface_folder
                )
                st.remove_surface_object_pose(safe, cid, username, surface_folder)
            else:
                st.upsert_surface_object_pose(
                    safe, cid, pose_out, username, surface_folder
                )
    raw_du = dict(prev_du)
    if dressup:
        raw_du.update(dressup)
    du = {
        "id": raw_du.get("id") or cid,
        "shell": "key",
        "face": normalize_key_face(raw_du.get("face") or raw_du.get("style") or "plain"),
        "style": normalize_key_face(raw_du.get("style") or raw_du.get("face") or "plain"),
    }
    prop_out = dict(prev_prop)
    if prop:
        for k, v in prop.items():
            if k == "heading" and v:
                prop_out["heading"] = normalize_heading(v)
                continue
            if k == "color":
                c = normalize_key_color(v)
                if c:
                    prop_out["color"] = c
                elif k in prop_out:
                    prop_out.pop("color", None)
                continue
            if v is None or v == "":
                continue
            prop_out[k] = v
    if pose and pose.get("heading"):
        prop_out["heading"] = normalize_heading(pose.get("heading"))
    surf = {
        "id": st.DEFAULT_SURFACE_ID,
        "name": st.DEFAULT_SURFACE_NAME,
        "auth": username,
    }
    sections = {
        "config": {
            "type": "chip",
            "subtype": "key",
            "id": cfg_id,
        },
        "surface": surf,
        "dressup": du,
        "prop": prop_out,
    }
    st._atomic_write_text(path, st.dump_nested_fm(sections, ""))
    return path


def read_key_config(
    st: Any,
    safe: Path,
    key_id: str,
    username: str | None = None,
    surface_folder: str | None = None,
) -> dict[str, Any] | None:
    username = username or st.DEFAULT_USERNAME
    surface_folder = surface_folder or st.DEFAULT_SURFACE_FOLDER
    cid = to_key_id(key_id)
    if not cid:
        return None
    path = st.configs_root(safe, username, surface_folder) / f"chip-{cid}.cfg"
    meta: dict[str, Any] = {}
    if path.is_file():
        try:
            meta, _ = st.parse_nested_fm(path.read_text(encoding="utf-8"))
        except OSError:
            meta = {}
    dress = meta.get("dressup") if isinstance(meta.get("dressup"), dict) else {}
    prop = meta.get("prop") if isinstance(meta.get("prop"), dict) else {}
    pos = dict(st._normalize_pose_dict(meta.get("pose") or meta.get("pos") or {}))
    owner = st.leaf_owner_bin(safe, cid)
    if owner and re.match(r"^(board|deck)\[", str(owner)):
        pin = st.get_bin_member_pose(safe, str(owner), cid, username, surface_folder)
        if pin:
            pos.update(pin)
    else:
        surface_pose = st.get_surface_object_pose(safe, cid, username, surface_folder)
        if surface_pose:
            pos.update(surface_pose)
    heading = normalize_heading(prop.get("heading") or pos.get("heading") or "N")
    pos["heading"] = heading
    prop = dict(prop)
    prop["heading"] = heading
    rel = st.rel_from_bay(safe, path) if path.is_file() else ""
    return {
        "uid": cid,
        "id": cid,
        "kind": "key",
        "dressup": dress or {"id": cid, "shell": "key", "face": "plain", "style": "plain"},
        "prop": prop,
        "pose": pos,
        "pos": pos,
        "_file": path.name if path.is_file() else f"chip-{cid}.cfg",
        "_rel": rel,
    }


def list_key_chips(st: Any, safe: Path) -> list[dict[str, Any]]:
    st.ensure_user_tree(safe)
    out: list[dict[str, Any]] = []
    lib = st.library_root(safe)
    if not lib.is_dir():
        return out
    seen: set[str] = set()
    for f in sorted(lib.glob("key[*.chip")):
        row = key_api_from_file(st, f)
        if not row:
            continue
        uid = str(row["uid"])
        if uid in seen:
            continue
        seen.add(uid)
        row["_rel"] = st.rel_from_bay(safe, f)
        row["bin"] = st.leaf_owner_bin(safe, uid)
        out.append(row)
    return out


def spawn_key(
    st: Any,
    safe: Path,
    title: str = "key",
    author: str = "unknown",
    glyph: str = "",
    svg: str = "",
    heading: str = "N",
    x: float | None = None,
    y: float | None = None,
) -> dict[str, Any]:
    st.ensure_user_tree(safe)
    uid = next_key_uid(st, safe)
    t = st.now()
    g = str(glyph or "").strip()[:GLYPH_MAX]
    if not g and title and title.strip().lower() not in ("key", "untitled"):
        g = title.strip()[:GLYPH_MAX]
    if not g:
        g = ""
    key = {
        "id": uid,
        "uid": uid,
        "title": (title or g or "key").strip() or "key",
        "author": (author or "unknown").strip() or "unknown",
        "glyph": g,
        "svg": svg,
        "heading": heading,
        "face": "svg" if sanitize_svg(svg) else "text",
        "created": t,
        "updated": t,
        "tags": [],
    }
    write_key_chip(st, safe, key)
    ni = n_from_key_uid(uid)
    pose = {
        "x": int(x) if x is not None else 48 + (ni % 10) * 56,
        "y": int(y) if y is not None else 48 + (ni % 8) * 56,
        "openW": KEY_SIZE,
        "openH": KEY_SIZE,
        "heading": normalize_heading(heading),
    }
    write_key_config(
        st,
        safe,
        uid,
        pose=pose,
        dressup={"id": uid, "shell": "key", "face": "plain", "style": "plain"},
        prop={"heading": pose["heading"]},
    )
    p = key_path(st, safe, uid)
    full = key_api_from_file(st, p) if p else key
    if full and p:
        full["_rel"] = st.rel_from_bay(safe, p)
    cfg = read_key_config(st, safe, uid)
    return {"key": full, "config": cfg, "package_id": "key"}


def bind(st: Any) -> None:
    """Install key helpers onto an island store module."""

    def _spawn(safe, **kw):
        return spawn_key(st, safe, **kw)

    def _write_chip(safe, key):
        return write_key_chip(st, safe, key)

    def _write_cfg(safe, key_id, **kw):
        return write_key_config(st, safe, key_id, **kw)

    def _read_cfg(safe, key_id, **kw):
        return read_key_config(st, safe, key_id, **kw)

    def _list(safe):
        return list_key_chips(st, safe)

    def _path(safe, key_id):
        return key_path(st, safe, key_id)

    def _api(path):
        return key_api_from_file(st, path)

    st.to_key_id = to_key_id
    st.is_key_id = is_key_id
    st.spawn_key = _spawn
    st.write_key_chip = _write_chip
    st.write_key_config = _write_cfg
    st.read_key_config = _read_cfg
    st.list_key_chips = _list
    st.key_path = _path
    st.key_api_from_file = _api
    st.normalize_key_heading = normalize_heading
    st.turn_key_heading = turn_heading
