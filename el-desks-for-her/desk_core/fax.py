"""Chester's Imports fax.

Desk writes. The dock stores a markdown note. Frontmatter is the story slip:
title, author, from (the function desk), origin (ADM.card[0] call of the source
chip), color, dates, tags, mark, cite. No separate kind/uid/auth keys — origin
is that cite. No stamp geometry. No dress.
"""

from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any

from desk_core.house import House, desks_root
from desk_core.mail import cites_of, traveling_prop

# house felt → PocketGo color: (accent the receiving page understands)
FELT_TO_COLOR = {
    "green": "green",
    "blue": "blue",
    "velvet": "red",
}

FALLBACK_DESTINATIONS: list[dict[str, str]] = [
    {
        "id": "port-qxa",
        "label": "Port QXA",
        "path": r"C:\ALICE_REBORN\PORT-QXA\docks",
    },
]

def parse_hosts_file(path: Path) -> list[dict[str, str]]:
    """id | label | folder   or   id | folder"""
    rows: list[dict[str, str]] = []
    if not path.is_file():
        return rows
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return rows
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) < 2:
            continue
        did = parts[0].strip().lower()
        if len(parts) == 2:
            label, folder = did, parts[1]
        else:
            label, folder = parts[1], "|".join(parts[2:]).strip()
        if did and folder:
            rows.append({"id": did, "label": label, "path": folder})
    return rows


def host_list_paths(desk_root: Path, island_hosts: Path | None = None) -> list[Path]:
    root = Path(desk_root)
    paths = [
        root / "prod" / "desk_sys" / "fax-hosts.txt",
        desks_root() / "fax-hosts.txt",
    ]
    if island_hosts is not None:
        paths.append(Path(island_hosts))
    return paths


def list_destinations(
    desk_root: Path,
    island_hosts: Path | None = None,
) -> list[dict[str, str]]:
    """Outbound fax docks. Later file wins on the same id."""
    by_id: dict[str, dict[str, str]] = {}
    order: list[str] = []
    for path in host_list_paths(desk_root, island_hosts):
        for row in parse_hosts_file(path):
            did = row["id"]
            if did not in by_id:
                order.append(did)
            by_id[did] = row
    if by_id:
        return [by_id[i] for i in order]
    out: list[dict[str, str]] = []
    for row in FALLBACK_DESTINATIONS:
        did = str(row.get("id") or "").strip().lower()
        label = str(row.get("label") or did).strip()
        path = str(row.get("path") or "").strip()
        if did and path:
            out.append({"id": did, "label": label, "path": path})
    return out


def get_destination(
    dest_id: str,
    desk_root: Path,
    island_hosts: Path | None = None,
) -> dict[str, str] | None:
    want = str(dest_id or "").strip().lower()
    if not want:
        return None
    for row in list_destinations(desk_root, island_hosts):
        if row["id"] == want or row["label"].lower() == want:
            return row
    return None


def slug(title: str, uid: str) -> str:
    base = re.sub(r"[^\w\s-]+", "", (title or "").strip(), flags=re.UNICODE)
    base = re.sub(r"[-\s]+", "-", base).strip("-").lower()
    if not base:
        base = re.sub(r"[^\w]+", "-", uid).strip("-").lower() or "faxed"
    return base[:80]


def _fm_value(v: Any) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return "yes" if v else "no"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return str(v)
    if isinstance(v, list):
        parts = [str(x).strip() for x in v if str(x).strip()]
        return ", ".join(parts) if parts else None
    s = str(v).replace("\r\n", " ").replace("\n", " ").replace("\r", " ").strip()
    if not s:
        return None
    if any(c in s for c in (":", "#", '"')) or s.startswith(("-", "[", "{")):
        return '"' + s.replace('"', '\\"') + '"'
    return s


def _day(ts: Any) -> str | None:
    try:
        n = int(ts or 0)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    if n < 10_000_000_000:
        return time.strftime("%Y-%m-%d", time.localtime(n))
    return time.strftime("%Y-%m-%d", time.localtime(n / 1000.0))


# Same law as PocketGo TAG_RE. Mira is the desk editor; this only lifts leftover
# inline hashes so the slip matches Go search. Headings (`# Title`) do not match.
BODY_HASH_RE = re.compile(r"(?<![&/\w])#([A-Za-z][\w/-]*)")


def harvest_body_tags(body: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for m in BODY_HASH_RE.finditer(body or ""):
        s = (m.group(1) or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def story_tags(tags: Any) -> list[str]:
    """Every tag on the paper, unique. Desk operator pins them; fax does not filter."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in tags or []:
        s = str(raw).strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def story_scars(prop: Any) -> dict[str, Any]:
    """Face of the stamp / cite ticket. No geometry, no dress, no flags."""
    traveled = traveling_prop(prop)
    out: dict[str, Any] = {}
    mark = traveled.get("Mark.type")
    if mark:
        out["mark"] = mark
    cite = traveled.get("Cite.code")
    if cite:
        out["cite"] = cite
    return out


def _fm_block(pairs: list[tuple[str, Any]]) -> str:
    lines = ["---"]
    seen: set[str] = set()
    for k, v in pairs:
        if k in seen:
            continue
        rendered = _fm_value(v)
        if rendered is None:
            continue
        lines.append(f"{k}: {rendered}")
        seen.add(k)
    lines.append("---")
    return "\n".join(lines)


def pack_note(
    *,
    title: str,
    body: str,
    uid: str,
    kind: str = "leaf",
    author: str = "",
    tags: list[Any] | None = None,
    cites: list[Any] | None = None,
    prop: Any = None,
    house: House | None = None,
    created: Any = None,
) -> dict[str, Any]:
    """Leaf/card → markdown: title, author, place, color, dates, tags, mark, cite."""
    title = (title or "untitled").strip() or "untitled"
    uid = str(uid or "").strip()
    kind = (kind or "leaf").strip() or "leaf"
    body = (body or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    h1 = f"# {title}".strip()
    body_lines = body.split("\n") if body else []
    if body_lines and body_lines[0].strip().lower() == h1.lower():
        body = "\n".join(body_lines[1:]).lstrip("\n")

    place = (house.surface_name if house else "") or ""
    felt = (house.felt if house else "") or ""
    color = FELT_TO_COLOR.get(felt.lower(), felt.lower() if felt else "")
    seat = (house.auth if house else "") or ""
    origin = f"{seat}.{uid}" if seat and uid else uid
    scars = story_scars(prop)
    pin_cites = cites_of({"cites": cites}) if cites is not None else []
    story = story_tags(list(tags or []) + harvest_body_tags(body))

    pairs: list[tuple[str, Any]] = [
        ("title", title),
        ("author", author),
        ("from", place),
        ("origin", origin),
        ("color", color),
        ("created", _day(created)),
        ("faxed", _day(time.time())),
        ("tags", story),
        ("mark", scars.get("mark")),
        ("cite", scars.get("cite")),
        ("cites", pin_cites),
    ]

    lines = [_fm_block(pairs), "", f"# {title}", ""]
    if body:
        lines.append(body)
        lines.append("")
    who = place or "desk"
    lines.append(f"<!-- faxed from {who} · Chester's Imports -->")
    lines.append("")
    md = "\n".join(lines)
    return {
        "uid": uid,
        "kind": kind,
        "title": title,
        "markdown": md,
        "slug": slug(title, uid),
    }


def write_dock(dest: dict[str, str], pack: dict[str, Any]) -> dict[str, Any]:
    """Push pack['markdown'] to dest path as slug.md. Overwrites on re-fax."""
    docks = Path(dest["path"])
    docks.mkdir(parents=True, exist_ok=True)
    fname = f"{pack['slug']}.md"
    out_path = docks / fname
    out_path.write_text(pack["markdown"], encoding="utf-8", newline="\n")
    return {
        "ok": True,
        "uid": pack["uid"],
        "kind": pack["kind"],
        "title": pack["title"],
        "dest": dest["id"],
        "dest_label": dest.get("label") or dest["id"],
        "path": str(out_path),
        "file": fname,
        "docks": str(docks),
    }
