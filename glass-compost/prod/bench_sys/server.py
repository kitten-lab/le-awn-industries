#!/usr/bin/env python3
"""
Nim Bench · hand-cut branches · data forestry cutting desk

Port 43182.
Logs: OT-001 style · lived order.
Branches: hand cuts only (bench.db). Messages from yard.db.
"""

from __future__ import annotations

import json
import re
import sqlite3
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import fax_mouth

BENCH = Path(__file__).resolve().parent
STORE = BENCH / "store"
BENCH_DB = STORE / "bench.db"
# Shared mountain — Nim data forestry (mausoleum archive; override with GLASS_COMPOST_YARD_DB)
_DEFAULT_YARD = Path(
    r"C:\Builds\_mausoleum\alice-box-exiles\nim-data-forestry\prod\yard_sys\store\yard.db"
)
YARD_DB = Path(
    __import__("os").environ.get("GLASS_COMPOST_YARD_DB", str(_DEFAULT_YARD))
)

# 0.0.0.0 = LAN (phones / other machines). Override: GLASS_COMPOST_HOST=127.0.0.1
HOST = (__import__("os").environ.get("GLASS_COMPOST_HOST") or "0.0.0.0").strip() or "0.0.0.0"
PORT = int((__import__("os").environ.get("GLASS_COMPOST_PORT") or __import__("os").environ.get("NIM_BENCH_PORT") or "43182").strip() or "43182")

_yard: sqlite3.Connection | None = None
_bench: sqlite3.Connection | None = None


def now() -> int:
    return int(time.time())


def jsend(handler: SimpleHTTPRequestHandler, code: int, obj: dict) -> None:
    raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(raw)


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(path), check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    return con


def yard() -> sqlite3.Connection:
    global _yard
    if _yard is None:
        if not YARD_DB.is_file():
            raise FileNotFoundError(f"yard.db missing: {YARD_DB}")
        _yard = connect(YARD_DB)
    return _yard


def bench() -> sqlite3.Connection:
    global _bench
    if _bench is None:
        _bench = connect(BENCH_DB)
        init_bench(_bench)
    return _bench


def init_bench(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS hand_cuts (
            face_id TEXT NOT NULL,
            start_seq INTEGER NOT NULL,
            title TEXT DEFAULT '',
            note TEXT DEFAULT '',
            created INTEGER,
            PRIMARY KEY (face_id, start_seq)
        );
        CREATE INDEX IF NOT EXISTS idx_cuts_face ON hand_cuts(face_id, start_seq);

        -- cut complete mark only (no next-stage pipeline yet)
        CREATE TABLE IF NOT EXISTS log_marks (
            face_id TEXT PRIMARY KEY,
            cut_done INTEGER NOT NULL DEFAULT 0,
            cut_done_at INTEGER
        );

        -- message gravity: -1 don't care · 0 moderate · 1 important
        CREATE TABLE IF NOT EXISTS msg_gravity (
            face_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            gravity INTEGER NOT NULL DEFAULT 0,
            updated INTEGER,
            PRIMARY KEY (face_id, seq)
        );
        CREATE INDEX IF NOT EXISTS idx_grav_face ON msg_gravity(face_id);

        -- parse progress: you checked this turn for bits
        CREATE TABLE IF NOT EXISTS msg_parsed (
            face_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            parsed INTEGER NOT NULL DEFAULT 0,
            updated INTEGER,
            PRIMARY KEY (face_id, seq)
        );
        CREATE INDEX IF NOT EXISTS idx_parsed_face ON msg_parsed(face_id);

        CREATE TABLE IF NOT EXISTS msg_tags (
            face_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            tags_json TEXT NOT NULL DEFAULT '[]',
            updated INTEGER,
            PRIMARY KEY (face_id, seq)
        );
        CREATE INDEX IF NOT EXISTS idx_msg_tags_face ON msg_tags(face_id);


        -- leaves: partition of a message body (full cover · L01..)
        -- chip e.g. OT-001.T01.B006.L02
        CREATE TABLE IF NOT EXISTS msg_leaves (
            face_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            leaf_n INTEGER NOT NULL,
            start_off INTEGER NOT NULL DEFAULT 0,
            end_off INTEGER NOT NULL DEFAULT 0,
            title TEXT DEFAULT '',
            note TEXT DEFAULT '',
            created INTEGER,
            PRIMARY KEY (face_id, seq, leaf_n)
        );
        CREATE INDEX IF NOT EXISTS idx_leaves_msg ON msg_leaves(face_id, seq);

        -- UI resume (survives Deck Host restarts better than browser memory alone)
        CREATE TABLE IF NOT EXISTS ui_place (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );

        -- scene pass: proposed trunk cuts from a full sequential read
        CREATE TABLE IF NOT EXISTS scene_scenes (
            face_id TEXT NOT NULL,
            start_seq INTEGER NOT NULL,
            end_seq INTEGER NOT NULL,
            title TEXT DEFAULT '',
            shot TEXT DEFAULT '',
            intensity TEXT NOT NULL DEFAULT 'calm',
            shift_note TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'proposed',
            created INTEGER,
            PRIMARY KEY (face_id, start_seq)
        );
        CREATE INDEX IF NOT EXISTS idx_scenes_face ON scene_scenes(face_id, start_seq);

        CREATE TABLE IF NOT EXISTS scene_logs (
            face_id TEXT PRIMARY KEY,
            shot TEXT DEFAULT '',
            intensity TEXT NOT NULL DEFAULT 'charged',
            status TEXT NOT NULL DEFAULT 'proposed',
            created INTEGER
        );

        -- days they asked for cuts, accepted trunks, sealed a log
        CREATE TABLE IF NOT EXISTS work_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            face_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            seq INTEGER,
            title TEXT DEFAULT '',
            detail TEXT DEFAULT '',
            at INTEGER NOT NULL,
            day TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_face_at ON work_log(face_id, at);
        """
    )
    # migrate: branch flags / process tags (your vocabulary)
    cols = {
        str(r[1])
        for r in con.execute("PRAGMA table_info(hand_cuts)").fetchall()
    }
    if "tags_json" not in cols:
        con.execute(
            "ALTER TABLE hand_cuts ADD COLUMN tags_json TEXT DEFAULT '[]'"
        )
    # leaf gravity (per slice · same -1/0/1 as messages)
    leaf_cols = {
        str(r[1])
        for r in con.execute("PRAGMA table_info(msg_leaves)").fetchall()
    }
    if "gravity" not in leaf_cols:
        con.execute(
            "ALTER TABLE msg_leaves ADD COLUMN gravity INTEGER NOT NULL DEFAULT 0"
        )
    leaf_cols = {
        str(r[1])
        for r in con.execute("PRAGMA table_info(msg_leaves)").fetchall()
    }
    if "tags_json" not in leaf_cols:
        con.execute(
            "ALTER TABLE msg_leaves ADD COLUMN tags_json TEXT DEFAULT '[]'"
        )
    mark_cols = {
        str(r[1])
        for r in con.execute("PRAGMA table_info(log_marks)").fetchall()
    }
    if "working_title" not in mark_cols:
        con.execute(
            "ALTER TABLE log_marks ADD COLUMN working_title TEXT DEFAULT ''"
        )
    if "log_note" not in mark_cols:
        con.execute(
            "ALTER TABLE log_marks ADD COLUMN log_note TEXT DEFAULT ''"
        )
    scene_cols = {
        str(r[1])
        for r in con.execute("PRAGMA table_info(scene_scenes)").fetchall()
    }
    if "title" not in scene_cols:
        con.execute(
            "ALTER TABLE scene_scenes ADD COLUMN title TEXT DEFAULT ''"
        )
    fax_mouth.bind(__import__("sys").modules[__name__])
    fax_mouth.init_tables(con)
    seed_ot001_scenes(con)
    seed_ot008_scenes(con)
    seed_ot009_scenes(con)
    backfill_work_log(con)
    con.commit()


def normalize_tag(t: Any) -> str:
    """Slug tags: lowercase, spaces → dashes (Magic Co Creation → magic-co-creation)."""
    s = str(t or "").strip().lower()
    if not s:
        return ""
    s = s.replace("_", "-")
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9.:+-]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-.:")
    return s[:48]


def parse_tags(raw: Any) -> list[str]:
    """Normalize user tags — free names, controlled by reuse."""
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        try:
            raw = json.loads(s)
        except Exception:
            raw = re.split(r"[,;|/]+", s)
    if not isinstance(raw, (list, tuple)):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in raw:
        tag = normalize_tag(t)
        if not tag or tag in seen:
            continue
        seen.add(tag)
        out.append(tag)
        if len(out) >= 12:
            break
    return out

def tags_from_row(m: Any) -> list[str]:
    if m is None:
        return []
    try:
        return parse_tags(m["tags_json"] if "tags_json" in m.keys() else "[]")
    except Exception:
        try:
            return parse_tags(m["tags_json"])
        except Exception:
            return []



def msg_tags_map(face_id: str) -> dict[int, list[str]]:
    con = bench()
    try:
        rows = con.execute(
            "SELECT seq, tags_json FROM msg_tags WHERE face_id=?", (face_id,)
        ).fetchall()
    except Exception:
        return {}
    out: dict[int, list[str]] = {}
    for r in rows:
        out[int(r["seq"])] = parse_tags(r["tags_json"])
    return out


def set_msg_tags(face_id: str, seq: int, tags: Any) -> list[str]:
    tags_n = parse_tags(tags)
    con = bench()
    con.execute(
        """
        INSERT INTO msg_tags(face_id, seq, tags_json, updated)
        VALUES (?,?,?,?)
        ON CONFLICT(face_id, seq) DO UPDATE SET
          tags_json=excluded.tags_json,
          updated=excluded.updated
        """,
        (face_id, int(seq), json.dumps(tags_n, ensure_ascii=False), now()),
    )
    con.commit()
    return tags_n


def all_tag_vocab() -> list[str]:
    """Every tag you've ever put on a branch — for reuse / suggest."""
    con = bench()
    rows = list(
        con.execute(
            "SELECT tags_json FROM hand_cuts WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'"
        ).fetchall()
    )
    try:
        rows += list(
            con.execute(
                "SELECT tags_json FROM msg_tags WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'"
            ).fetchall()
        )
    except Exception:
        pass
    try:
        rows += list(
            con.execute(
                "SELECT tags_json FROM msg_leaves WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'"
            ).fetchall()
        )
    except Exception:
        pass
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for r in rows:
        for t in parse_tags(r["tags_json"]):
            k = t.casefold()
            counts[k] = counts.get(k, 0) + 1
            display.setdefault(k, t)
    return [
        display[k]
        for k, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def parsed_map(face_id: str) -> dict[int, bool]:
    """seq → parsed (you marked this message done for bit-pull)."""
    con = bench()
    rows = con.execute(
        "SELECT seq, parsed FROM msg_parsed WHERE face_id=?",
        (face_id,),
    ).fetchall()
    return {int(r["seq"]): bool(int(r["parsed"] or 0)) for r in rows}


def leaves_map(face_id: str) -> dict[int, list[dict[str, Any]]]:
    """seq → list of leaf cuts on that message."""
    con = bench()
    rows = con.execute(
        """
        SELECT seq, leaf_n, start_off, end_off, title, note, created, gravity, tags_json
        FROM msg_leaves WHERE face_id=?
        ORDER BY seq, leaf_n
        """,
        (face_id,),
    ).fetchall()
    out: dict[int, list[dict[str, Any]]] = {}
    for r in rows:
        seq = int(r["seq"])
        try:
            g = int(r["gravity"] or 0)
        except (KeyError, TypeError, ValueError):
            g = 0
        if g < -1:
            g = -1
        if g > 1:
            g = 1
        try:
            raw_tags = r["tags_json"] if "tags_json" in r.keys() else None
            tags = parse_tags(raw_tags if raw_tags is not None else "[]")
        except Exception:
            tags = []
        out.setdefault(seq, []).append(
            {
                "leaf_n": int(r["leaf_n"]),
                "start_off": int(r["start_off"] or 0),
                "end_off": int(r["end_off"] or 0),
                "title": (r["title"] or "").strip(),
                "note": (r["note"] or "").strip(),
                "created": r["created"],
                "gravity": g,
                "tags": tags,
            }
        )
    return out


def set_msg_parsed(face_id: str, seq: int, parsed: bool) -> dict[str, Any]:
    con = bench()
    t = now()
    if parsed:
        con.execute(
            """
            INSERT INTO msg_parsed(face_id, seq, parsed, updated)
            VALUES (?,?,1,?)
            ON CONFLICT(face_id, seq) DO UPDATE SET parsed=1, updated=?
            """,
            (face_id, seq, t, t),
        )
    else:
        con.execute(
            "DELETE FROM msg_parsed WHERE face_id=? AND seq=?",
            (face_id, seq),
        )
    con.commit()
    return {"face_id": face_id, "seq": seq, "parsed": parsed}


def _msg_text(face_id: str, seq: int) -> str:
    """Yard message body text (for partitioning / blank-leaf scrub)."""
    try:
        row = yard().execute(
            "SELECT text FROM messages WHERE face_id=? AND seq=?",
            (face_id, seq),
        ).fetchone()
        return str((row["text"] if row else "") or "")
    except Exception:
        return ""


def _msg_text_len(face_id: str, seq: int) -> int:
    """Length of yard message text (for partitioning)."""
    return len(_msg_text(face_id, seq))


MIN_AUTO_LEAF = 48  # stripped chars · smaller islands merge into a neighbor

# Chat paste labels introduce the NEXT block — never glue them backward.
_SPEAKER_CUE = re.compile(
    r"^(?:"
    r"you said"
    r"|chatgpt said"
    r"|chat gpt said"
    r"|gpt said"
    r"|assistant said"
    r"|user said"
    r")\s*:?\s*$",
    re.I,
)


def _is_speaker_cue(text: str, a: int, b: int) -> bool:
    s = (text or "")[max(0, a) : max(0, b)].strip()
    if not s or len(s) > 80:
        return False
    return bool(_SPEAKER_CUE.match(s))


def _last_para_start(text: str, a: int, b: int) -> int:
    """Offset of the last blank-line paragraph inside [a, b)."""
    chunk = (text or "")[a:b]
    last = None
    for m in re.finditer(r"(?:\r\n|\n|\r){2,}", chunk):
        last = m
    if last is None:
        return a
    return a + last.end()


def _trim_span(text: str, a: int, b: int) -> tuple[int, int]:
    n = len(text or "")
    a = max(0, min(int(a), n))
    b = max(a, min(int(b), n))
    while a < b and text[a] in " \t\r\n":
        a += 1
    while b > a and text[b - 1] in " \t\r\n":
        b -= 1
    return a, b


def _content_span(text: str, a: int, b: int) -> tuple[int, int]:
    """Tighten [a,b) to non-whitespace content (keeps inner spaces)."""
    text = text or ""
    n = len(text)
    a = max(0, min(int(a), n))
    b = max(a, min(int(b), n))
    while a < b and text[a] in (' ', '\t', '\r', '\n'):
        a += 1
    while b > a and text[b - 1] in (' ', '\t', '\r', '\n'):
        b -= 1
    return a, b


def _para_bounds(text: str, i: int) -> tuple[int, int]:
    """Blank-line paragraph containing offset i."""
    n = len(text or "")
    if n == 0:
        return 0, 0
    i = max(0, min(int(i), n))
    left = text.rfind("\n\n", 0, i)
    a = 0 if left < 0 else left + 2
    right = text.find("\n\n", i)
    b = n if right < 0 else right
    return a, b


def _snap_leaf_cut(text: str, start: int, end: int) -> tuple[int, int]:
    """
    Hand cut snaps to the paragraph when you took most of it, so leftover
    crumbs stay on the same leaf instead of minting an empty L.
    """
    text = text or ""
    start, end = _trim_span(text, start, end)
    if end <= start:
        return start, end
    pa, pb = _para_bounds(text, start)
    qa, qb = _para_bounds(text, max(start, end - 1))
    if (pa, pb) != (qa, qb):
        return start, end
    sa, sb = _trim_span(text, pa, pb)
    plen = sb - sa
    slen = end - start
    if plen <= 0:
        return start, end
    if slen >= 0.72 * plen or (start - sa <= 12 and sb - end <= 12):
        return sa, sb
    return start, end


def _substantial(text: str, a: int, b: int) -> bool:
    return bool((text or "")[max(0, a) : max(0, b)].strip())


def _absorb_blank_leaves(
    parts: list[dict[str, Any]], text: str
) -> list[dict[str, Any]]:
    """
    Fold whitespace-only leaves into neighbors so L02/L04 never exist as
    empty '\\n\\n' ships. Content leaves keep gravity/title/note.
    """
    text = text or ""
    n = len(text)
    items: list[dict[str, Any]] = []
    for lf in parts or []:
        a = max(0, min(int(lf.get("start_off") or 0), n))
        b = max(a, min(int(lf.get("end_off") or 0), n))
        if b <= a and n > 0:
            continue
        chunk = text[a:b] if n else ""
        blank = bool(n and not chunk.strip())
        g = int(lf.get("gravity") or 0)
        if g < -1:
            g = -1
        if g > 1:
            g = 1
        if lf.get("chipped") is False or g < 0:
            chipped = False
        else:
            chipped = bool(
                lf.get("chipped")
                or (lf.get("title") or "").strip()
                or (lf.get("note") or "").strip()
                or not lf.get("implicit")
            )
        items.append(
            {
                "start_off": a,
                "end_off": b if n else 0,
                "title": (lf.get("title") or "").strip(),
                "note": (lf.get("note") or "").strip(),
                "created": lf.get("created"),
                "gravity": g,
                "chipped": chipped,
                "implicit": bool(lf.get("implicit")),
                "tags": list(lf.get("tags") or []),
                "_blank": blank,
            }
        )
    if not items:
        return []
    if all(it["_blank"] for it in items):
        return [
            {
                "start_off": 0,
                "end_off": n,
                "title": "",
                "note": "",
                "created": None,
                "gravity": 0,
                "chipped": False,
                "implicit": True,
                "tags": [],
            }
        ]
    out: list[dict[str, Any]] = []
    lead_start: int | None = None  # first blank start before any content
    for it in items:
        if it["_blank"]:
            if out:
                out[-1]["end_off"] = max(out[-1]["end_off"], it["end_off"])
            elif lead_start is None:
                lead_start = it["start_off"]
            continue
        p = {k: v for k, v in it.items() if k != "_blank"}
        if lead_start is not None and not out:
            p["start_off"] = min(p["start_off"], lead_start)
            lead_start = None
        out.append(p)
    if not out:
        return [
            {
                "start_off": 0,
                "end_off": n,
                "title": "",
                "note": "",
                "created": None,
                "gravity": 0,
                "chipped": False,
                "implicit": True,
                "tags": [],
            }
        ]
    last_end = max(it["end_off"] for it in items)
    if out[-1]["end_off"] < last_end:
        out[-1]["end_off"] = last_end
    return out


def fill_leaf_gaps(
    parts: list[dict[str, Any]], text_len: int, text: str | None = None
) -> list[dict[str, Any]]:
    """
    Ensure leaves cover 0..text_len with no holes.
    Whitespace-only leaves are absorbed (no dead empty ships).
    """
    text_len = max(0, int(text_len))
    body = text if text is not None else ""
    if body and len(body) != text_len:
        text_len = len(body)
    if body:
        parts = _absorb_blank_leaves(parts, body)
    if text_len == 0:
        return parts or [
            {
                "start_off": 0,
                "end_off": 0,
                "title": "",
                "note": "",
                "created": None,
                "chipped": False,
                "gravity": 0,
                "tags": [],
            }
        ]
    cleaned: list[dict[str, Any]] = []
    for lf in parts or []:
        a = max(0, min(int(lf.get("start_off") or 0), text_len))
        b = max(a, min(int(lf.get("end_off") or 0), text_len))
        if b <= a:
            continue
        # never keep a pure-whitespace leaf when we have the body
        if body and not body[a:b].strip():
            continue
        g = int(lf.get("gravity") or 0)
        if g < -1:
            g = -1
        if g > 1:
            g = 1
        if lf.get("chipped") is False or g < 0:
            chipped = False
        else:
            chipped = bool(
                lf.get("chipped")
                or (lf.get("title") or "").strip()
                or (lf.get("note") or "").strip()
                or not lf.get("implicit")
            )
        cleaned.append(
            {
                "start_off": a,
                "end_off": b,
                "title": (lf.get("title") or "").strip(),
                "note": (lf.get("note") or "").strip(),
                "created": lf.get("created"),
                "gravity": g,
                "chipped": chipped,
                "tags": list(lf.get("tags") or []),
            }
        )
    cleaned.sort(key=lambda p: (p["start_off"], p["end_off"]))
    # merge overlaps lightly (keep earlier)
    merged: list[dict[str, Any]] = []
    for p in cleaned:
        if not merged:
            merged.append(p)
            continue
        prev = merged[-1]
        if p["start_off"] < prev["end_off"]:
            # overlap: prefer chipped piece
            if p.get("chipped") and not prev.get("chipped"):
                merged[-1] = p
            continue
        merged.append(p)

    # Tighten each leaf to content so trailing \r\n seams do not pad the body.
    if body:
        tight: list[dict[str, Any]] = []
        for p in merged:
            a, b = _content_span(body, p["start_off"], p["end_off"])
            if b <= a:
                continue
            q = dict(p)
            q["start_off"] = a
            q["end_off"] = b
            tight.append(q)
        merged = tight or merged

    filled: list[dict[str, Any]] = []
    cursor = 0
    for p in merged:
        p = dict(p)
        if p["start_off"] > cursor:
            gap = body[cursor : p["start_off"]] if body else ""
            if body and not gap.strip():
                # whitespace seam → attach as leading on THIS leaf (paint strips it)
                p["start_off"] = cursor
            elif filled:
                # non-ws hole → extend previous (legacy)
                filled[-1]["end_off"] = p["start_off"]
            else:
                p["start_off"] = cursor
        # if we overlap previous due to seam attach, advance
        if filled and p["start_off"] < filled[-1]["end_off"]:
            p["start_off"] = filled[-1]["end_off"]
        if p["end_off"] <= p["start_off"]:
            continue
        filled.append(p)
        cursor = max(cursor, p["end_off"])
    if cursor < text_len:
        tail = body[cursor:text_len] if body else ""
        if body and not tail.strip():
            # trailing file whitespace: keep coverage on last leaf offsets
            # but do not force it into painted body (paint trims)
            if filled:
                filled[-1]["end_off"] = text_len
            else:
                filled.append(
                    {
                        "start_off": 0,
                        "end_off": text_len,
                        "title": "",
                        "note": "",
                        "created": None,
                        "chipped": False,
                        "implicit": True,
                        "gravity": 0,
                    }
                )
        elif filled:
            filled[-1]["end_off"] = text_len
        else:
            filled.append(
                {
                    "start_off": 0,
                    "end_off": text_len,
                    "title": "",
                    "note": "",
                    "created": None,
                    "chipped": False,
                    "implicit": True,
                    "gravity": 0,
                }
            )
    if not filled:
        filled = [
            {
                "start_off": 0,
                "end_off": text_len,
                "title": "",
                "note": "",
                "created": None,
                "chipped": False,
                "implicit": True,
                "gravity": 0,
            }
        ]
    out = []
    for i, p in enumerate(filled, start=1):
        p = dict(p)
        p["leaf_n"] = i
        out.append(p)
    return out


def ensure_message_leaves(
    face_id: str, seq: int, text_len: int | None = None
) -> list[dict[str, Any]]:
    """
    Leaves partition a message body.
    No rows yet → whole turn is implicit L01 (0..len).
    Stored rows are gap-filled; blank \n\n leaves are scrubbed and re-saved.
    """
    body = _msg_text(face_id, seq)
    if text_len is None:
        text_len = len(body)
    text_len = max(0, int(text_len))
    existing = leaves_map(face_id).get(seq) or []
    if not existing:
        return [
            {
                "leaf_n": 1,
                "start_off": 0,
                "end_off": text_len,
                "title": "",
                "note": "",
                "created": None,
                "implicit": True,
                "chipped": False,
                "gravity": 0,
                "tags": [],
            }
        ]
    parts = []
    had_blank = False
    for lf in existing:
        a = max(0, min(int(lf["start_off"]), text_len))
        b = max(a, min(int(lf["end_off"]), text_len))
        g = int(lf.get("gravity") or 0)
        if g < -1:
            g = -1
        if g > 1:
            g = 1
        if body and a < b and not body[a:b].strip():
            had_blank = True
        parts.append(
            {
                "start_off": a,
                "end_off": b,
                "title": lf.get("title") or "",
                "note": lf.get("note") or "",
                "created": lf.get("created"),
                "gravity": g,
                "implicit": False,
                "chipped": g >= 0,
                "remainder": g < 0,
                "tags": list(lf.get("tags") or []),
            }
        )
    filled = fill_leaf_gaps(parts, text_len, body)
    # persist scrub when dead ships existed or ranges renumbered/merged
    old_key = [(int(x["start_off"]), int(x["end_off"])) for x in existing]
    new_key = [(int(x["start_off"]), int(x["end_off"])) for x in filled]
    if had_blank or old_key != new_key:
        # rewrite without re-entering ensure (replace writes cleaned ranges)
        return replace_message_leaves(face_id, seq, filled)
    return filled


def replace_message_leaves(
    face_id: str, seq: int, parts: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Write a full partition set for one message (renumbered L01..)."""
    body = _msg_text(face_id, seq)
    text_len = len(body)
    # keep gravity by exact range when renumbering
    prev_g: dict[tuple[int, int], int] = {}
    for old in leaves_map(face_id).get(seq) or []:
        prev_g[(int(old["start_off"]), int(old["end_off"]))] = int(
            old.get("gravity") or 0
        )
    # also map gravity by start for after-merge recovery
    prev_g_start: dict[int, int] = {}
    for old in leaves_map(face_id).get(seq) or []:
        prev_g_start[int(old["start_off"])] = int(old.get("gravity") or 0)
    prev_tags: dict[tuple[int, int], list] = {}
    prev_tags_start: dict[int, list] = {}
    for old in leaves_map(face_id).get(seq) or []:
        tgs = list(old.get("tags") or [])
        prev_tags[(int(old["start_off"]), int(old["end_off"]))] = tgs
        prev_tags_start[int(old["start_off"])] = tgs

    # absorb blanks before write
    prepped = fill_leaf_gaps(
        [
            {
                "start_off": p.get("start_off"),
                "end_off": p.get("end_off"),
                "title": p.get("title") or "",
                "note": p.get("note") or "",
                "gravity": p.get("gravity"),
                "chipped": p.get("chipped", True),
                "implicit": p.get("implicit", False),
                "tags": list(p.get("tags") or []),
            }
            for p in (parts or [])
        ],
        text_len,
        body,
    )

    cleaned: list[dict[str, Any]] = []
    for p in prepped:
        a = max(0, min(int(p.get("start_off") or 0), text_len))
        b = max(a, min(int(p.get("end_off") or 0), text_len))
        if b <= a and text_len > 0:
            continue
        if body and not body[a:b].strip() and text_len > 0:
            continue
        # preserve -1 (don't use `or 0` — falsy would clobber ▾)
        if p.get("gravity") is not None:
            g = int(p.get("gravity"))
        elif (a, b) in prev_g:
            g = int(prev_g[(a, b)])
        elif a in prev_g_start:
            g = int(prev_g_start[a])
        else:
            g = 0
        if g < -1:
            g = -1
        if g > 1:
            g = 1
        title = str(p.get("title") or "").strip()[:120]
        remainder = g < 0 or p.get("chipped") is False
        # don't auto-name low-value leftovers — they stay "remainder" until ▴
        if not title and not remainder and body and body[a:b].strip():
            title = body[a:b].strip().split("\n")[0].strip()[:48]
        if p.get("tags") is not None:
            tags_keep = parse_tags(p.get("tags"))
        elif (a, b) in prev_tags:
            tags_keep = list(prev_tags[(a, b)])
        elif a in prev_tags_start:
            tags_keep = list(prev_tags_start[a])
        else:
            tags_keep = []
        cleaned.append(
            {
                "start_off": a,
                "end_off": b,
                "title": title,
                "note": str(p.get("note") or "").strip()[:400],
                "gravity": g,
                "chipped": not remainder,
                "remainder": remainder,
                "tags": tags_keep,
            }
        )
    cleaned.sort(key=lambda p: (p["start_off"], p["end_off"]))
    if not cleaned and text_len >= 0:
        # unsplit write = no rows (implicit L01). Caller may want rows though.
        # keep empty list → message becomes unsplit.
        pass
    con = bench()
    con.execute(
        "DELETE FROM msg_leaves WHERE face_id=? AND seq=?",
        (face_id, seq),
    )
    t = now()
    out: list[dict[str, Any]] = []
    for i, p in enumerate(cleaned, start=1):
        con.execute(
            """
            INSERT INTO msg_leaves(face_id, seq, leaf_n, start_off, end_off, title, note, created, gravity, tags_json)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                face_id,
                seq,
                i,
                p["start_off"],
                p["end_off"],
                p["title"],
                p["note"],
                t,
                int(p.get("gravity") if p.get("gravity") is not None else 0),
                json.dumps(parse_tags(p.get("tags")), ensure_ascii=False),
            ),
        )
        g_out = int(p.get("gravity") if p.get("gravity") is not None else 0)
        tags_out = parse_tags(p.get("tags"))
        out.append(
            {
                "leaf_n": i,
                "start_off": p["start_off"],
                "end_off": p["end_off"],
                "title": p["title"],
                "note": p["note"],
                "created": t,
                "gravity": g_out,
                "implicit": False,
                "chipped": not bool(p.get("remainder")),
                "remainder": bool(p.get("remainder")),
                "tags": tags_out,
            }
        )
    con.commit()
    return out


def split_message_leaf(
    face_id: str,
    seq: int,
    start_off: int,
    end_off: int,
    title: str = "",
    note: str = "",
) -> list[dict[str, Any]]:
    """
    Cut a selection out of the message into its own leaf.
    Whole body stays partitioned (L01.. in reading order). Leftover pieces
    stay leaves with a low-value mark (▾) so they can be promoted later.
    """
    text = _msg_text(face_id, seq)
    text_len = len(text)
    if end_off < start_off:
        start_off, end_off = end_off, start_off
    start_off, end_off = _snap_leaf_cut(text, start_off, end_off)
    start_off = max(0, min(int(start_off), text_len))
    end_off = max(start_off, min(int(end_off), text_len))
    if end_off <= start_off:
        raise ValueError("empty selection")

    current = ensure_message_leaves(face_id, seq, text_len)
    if len(current) == 1 and current[0].get("implicit"):
        spans = [
            {
                "start_off": 0,
                "end_off": text_len,
                "title": "",
                "note": "",
                "gravity": 0,
                "chipped": False,
            }
        ]
    else:
        spans = [
            {
                "start_off": c["start_off"],
                "end_off": c["end_off"],
                "title": c.get("title") or "",
                "note": c.get("note") or "",
                "gravity": int(c.get("gravity") or 0),
                "chipped": bool(c.get("chipped")),
            }
            for c in current
        ]

    def is_crumb(a: int, b: int) -> bool:
        if not _substantial(text, a, b):
            return True
        return len(text[a:b].strip()) < 12

    new_spans: list[dict[str, Any]] = []
    hit = False
    for sp in spans:
        a, b = sp["start_off"], sp["end_off"]
        if end_off <= a or start_off >= b:
            new_spans.append(sp)
            continue
        hit = True
        cut_a = max(a, start_off)
        cut_b = min(b, end_off)
        # crumbs on either side stay on the chipped leaf (no empty L)
        if cut_a > a and is_crumb(a, cut_a):
            cut_a = a
        if cut_b < b and is_crumb(cut_b, b):
            cut_b = b
        if cut_a > a:
            new_spans.append(
                {
                    "start_off": a,
                    "end_off": cut_a,
                    "title": "",
                    "note": "",
                    "gravity": -1,
                    "chipped": False,
                }
            )
        new_spans.append(
            {
                "start_off": cut_a,
                "end_off": cut_b,
                "title": (title or "").strip()[:120],
                "note": (note or "").strip()[:400],
                "gravity": 0,
                "chipped": True,
            }
        )
        if cut_b < b:
            new_spans.append(
                {
                    "start_off": cut_b,
                    "end_off": b,
                    "title": "",
                    "note": "",
                    "gravity": -1,
                    "chipped": False,
                }
            )
    if not hit:
        new_spans = list(spans)
        new_spans.append(
            {
                "start_off": start_off,
                "end_off": end_off,
                "title": (title or "").strip()[:120],
                "note": (note or "").strip()[:400],
                "gravity": 0,
                "chipped": True,
            }
        )

    return replace_message_leaves(face_id, seq, new_spans)



def split_message_at_offset(face_id: str, seq: int, offset: int) -> list[dict[str, Any]]:
    """
    Place a leaf boundary at offset — same gesture as a trunk cut between messages.
    Snaps past mid-word clicks onto the next whitespace/content boundary.
    """
    text = _msg_text(face_id, seq)
    text_len = len(text)
    if text_len <= 0:
        raise ValueError("empty message")
    off = max(0, min(int(offset), text_len))
    if 0 < off < text_len:
        if text[off - 1].isalnum() and text[off].isalnum():
            j = off
            while j < text_len and text[j].isalnum():
                j += 1
            while j < text_len and text[j] in (' ', '\t'):
                j += 1
            off = j
        while off < text_len and text[off] in (' ', '\t', '\r', '\n'):
            off += 1
    if off <= 0 or off >= text_len:
        raise ValueError("cut must land inside the message")

    current = ensure_message_leaves(face_id, seq, text_len)
    spans: list[dict[str, Any]] = []
    for c in current:
        spans.append(
            {
                "start_off": int(c["start_off"]),
                "end_off": int(c["end_off"]),
                "title": c.get("title") or "",
                "note": c.get("note") or "",
                "gravity": int(c.get("gravity") or 0),
                "chipped": bool(c.get("chipped")) and not c.get("implicit"),
            }
        )

    new_spans: list[dict[str, Any]] = []
    hit = False
    for sp in spans:
        a, b = sp["start_off"], sp["end_off"]
        if off <= a or off >= b:
            new_spans.append(sp)
            continue
        hit = True
        left = dict(sp)
        left["end_off"] = off
        right = dict(sp)
        right["start_off"] = off
        left["chipped"] = True
        right["chipped"] = True
        left["title"] = (left.get("title") or "").strip()
        right["title"] = ""
        if left["end_off"] > left["start_off"] and _substantial(
            text, left["start_off"], left["end_off"]
        ):
            new_spans.append(left)
        elif left["end_off"] > left["start_off"]:
            right["start_off"] = left["start_off"]
        if right["end_off"] > right["start_off"]:
            new_spans.append(right)
    if not hit:
        raise ValueError("offset not inside any leaf")

    return replace_message_leaves(face_id, seq, new_spans)


def add_msg_leaf(
    face_id: str,
    seq: int,
    start_off: int,
    end_off: int,
    title: str = "",
    note: str = "",
) -> dict[str, Any]:
    """Split selection into a real leaf partition (not a floating reference)."""
    parts = split_message_leaf(
        face_id, seq, start_off, end_off, title=title, note=note
    )
    # return the leaf that matches the selection center
    mid = (int(start_off) + int(end_off)) // 2
    chosen = parts[0] if parts else {}
    for p in parts:
        if p["start_off"] <= mid < p["end_off"] or (
            mid == p["end_off"] and p["end_off"] == p["start_off"] + 0
        ):
            if p["start_off"] <= mid <= p["end_off"]:
                chosen = p
                break
    for p in parts:
        if p["start_off"] == max(0, int(start_off)) and p["end_off"] == max(
            int(start_off), int(end_off)
        ):
            chosen = p
            break
    return {
        "face_id": face_id,
        "seq": seq,
        "leaves": parts,
        "leaf": chosen,
        "leaf_n": chosen.get("leaf_n"),
        "start_off": chosen.get("start_off"),
        "end_off": chosen.get("end_off"),
        "title": chosen.get("title") or "",
        "note": chosen.get("note") or "",
    }


def delete_msg_leaf(face_id: str, seq: int, leaf_n: int) -> bool:
    con = bench()
    cur = con.execute(
        "DELETE FROM msg_leaves WHERE face_id=? AND seq=? AND leaf_n=?",
        (face_id, seq, leaf_n),
    )
    con.commit()
    return cur.rowcount > 0


def _break_spans(text: str) -> list[tuple[int, int]]:
    """
    Partition on blank lines only (not every newline).

    Tiny islands merge into the previous leaf so "ok." / "yeah" do not
    become their own L. Speaker cues ("You said:", "ChatGPT said:") glue
    FORWARD onto the paste they introduce. Full cover of 0..len(text).
    """
    if not text:
        return [(0, 0)]
    cuts = [0]
    for m in re.finditer(r"(?:\r\n|\n|\r){2,}", text):
        at = m.end()
        if at > cuts[-1] and at < len(text):
            cuts.append(at)
    if cuts[-1] < len(text):
        cuts.append(len(text))
    raw: list[list[int]] = []
    for i in range(len(cuts) - 1):
        a, b = cuts[i], cuts[i + 1]
        if b > a:
            raw.append([a, b])
    spans: list[list[int]] = []
    i = 0
    while i < len(raw):
        a, b = raw[i]
        if _is_speaker_cue(text, a, b) and i + 1 < len(raw):
            raw[i + 1][0] = a
            i += 1
            continue
        if (
            spans
            and len(text[a:b].strip()) < MIN_AUTO_LEAF
            and not _is_speaker_cue(text, a, b)
        ):
            spans[-1][1] = b
            i += 1
            continue
        spans.append([a, b])
        i += 1
    if (
        len(spans) >= 2
        and _is_speaker_cue(text, spans[-1][0], spans[-1][1])
    ):
        spans[-2][1] = spans[-1][1]
        spans.pop()
    if len(spans) >= 2 and len(text[spans[0][0] : spans[0][1]].strip()) < MIN_AUTO_LEAF:
        if not _is_speaker_cue(text, spans[0][0], spans[0][1]):
            spans[1][0] = spans[0][0]
            spans.pop(0)
    # peel a trailing cue off a leaf onto the next (already-glued-backward case)
    for i in range(len(spans) - 1):
        a, b = spans[i]
        ps = _last_para_start(text, a, b)
        if ps > a and _is_speaker_cue(text, ps, b):
            spans[i][1] = ps
            spans[i + 1][0] = min(spans[i + 1][0], ps)
    spans = [s for s in spans if s[1] > s[0]]
    if not spans:
        return [(0, len(text))]
    spans[0][0] = 0
    spans[-1][1] = len(text)
    if len(spans) <= 1:
        return [(0, len(text))]
    return [(a, b) for a, b in spans]


def auto_split_message_by_breaks(face_id: str, seq: int) -> list[dict[str, Any]]:
    """
    One-click leaf cut: split on blank-line paragraphs.
    Tiny leftover islands merge into a neighbor (still covered, still citeable).
    """
    row = yard().execute(
        "SELECT text FROM messages WHERE face_id=? AND seq=?",
        (face_id, seq),
    ).fetchone()
    text = str(row["text"] or "") if row else ""
    spans = _break_spans(text)
    if len(spans) <= 1:
        # nothing to cut — clear to implicit L01
        clear_message_leaves(face_id, seq)
        return ensure_message_leaves(face_id, seq, len(text))
    parts: list[dict[str, Any]] = []
    for a, b in spans:
        chunk = text[a:b]
        parts.append(
            {
                "start_off": a,
                "end_off": b,
                "title": "",
                "note": "",
                "chipped": True,
            }
        )
    return replace_message_leaves(face_id, seq, parts)


def clear_message_leaves(face_id: str, seq: int) -> int:
    """Undo all leaf cuts on a message → whole turn is L01 again."""
    con = bench()
    cur = con.execute(
        "DELETE FROM msg_leaves WHERE face_id=? AND seq=?",
        (face_id, seq),
    )
    con.commit()
    return int(cur.rowcount or 0)


def gravity_map(face_id: str) -> dict[int, int]:
    """seq → gravity (-1 / 0 / 1). Only non-zero stored usually, but any row returned."""
    con = bench()
    rows = con.execute(
        "SELECT seq, gravity FROM msg_gravity WHERE face_id=?",
        (face_id,),
    ).fetchall()
    out: dict[int, int] = {}
    for r in rows:
        g = int(r["gravity"] or 0)
        if g < -1:
            g = -1
        if g > 1:
            g = 1
        out[int(r["seq"])] = g
    return out


def set_leaf_gravity(
    face_id: str, seq: int, leaf_n: int, gravity: int
) -> dict[str, Any]:
    """Per-slice gravity · -1 / 0 / 1 (same scale as message ▴▾)."""
    g = int(gravity)
    if g < -1:
        g = -1
    if g > 1:
        g = 1
    ln = int(leaf_n)
    con = bench()
    cur = con.execute(
        """
        UPDATE msg_leaves SET gravity=?
        WHERE face_id=? AND seq=? AND leaf_n=?
        """,
        (g, face_id, seq, ln),
    )
    con.commit()
    if cur.rowcount == 0:
        # remainder leaves may be virtual (gap-fill only) — materialize then set
        parts = ensure_message_leaves(face_id, seq)
        if not any(int(p.get("leaf_n") or 0) == ln for p in parts):
            return {
                "ok": False,
                "error": "leaf not found",
                "face_id": face_id,
                "seq": seq,
                "leaf_n": ln,
            }
        for p in parts:
            if int(p.get("leaf_n") or 0) == ln:
                p["gravity"] = g
        replace_message_leaves(face_id, seq, parts)
        return {
            "ok": True,
            "face_id": face_id,
            "seq": seq,
            "leaf_n": ln,
            "gravity": g,
            "materialized": True,
        }
    return {
        "ok": True,
        "face_id": face_id,
        "seq": seq,
        "leaf_n": ln,
        "gravity": g,
    }


def set_leaf_tags(
    face_id: str, seq: int, leaf_n: int, tags: Any
) -> dict[str, Any]:
    """Per-leaf tags · same vocab as message/trunk flags."""
    ln = int(leaf_n)
    tags_n = parse_tags(tags)
    con = bench()
    # ensure column exists (older DBs)
    cols = {
        str(r[1])
        for r in con.execute("PRAGMA table_info(msg_leaves)").fetchall()
    }
    if "tags_json" not in cols:
        con.execute(
            "ALTER TABLE msg_leaves ADD COLUMN tags_json TEXT DEFAULT '[]'"
        )
        con.commit()
    cur = con.execute(
        """
        UPDATE msg_leaves SET tags_json=?
        WHERE face_id=? AND seq=? AND leaf_n=?
        """,
        (json.dumps(tags_n, ensure_ascii=False), face_id, seq, ln),
    )
    con.commit()
    if cur.rowcount == 0:
        parts = ensure_message_leaves(face_id, seq)
        if not any(int(p.get("leaf_n") or 0) == ln for p in parts):
            return {
                "ok": False,
                "error": "leaf not found",
                "face_id": face_id,
                "seq": seq,
                "leaf_n": ln,
            }
        for p in parts:
            if int(p.get("leaf_n") or 0) == ln:
                p["tags"] = tags_n
        replace_message_leaves(face_id, seq, parts)
        return {
            "ok": True,
            "face_id": face_id,
            "seq": seq,
            "leaf_n": ln,
            "tags": tags_n,
            "materialized": True,
        }
    return {
        "ok": True,
        "face_id": face_id,
        "seq": seq,
        "leaf_n": ln,
        "tags": tags_n,
    }


def set_msg_gravity(face_id: str, seq: int, gravity: int) -> dict[str, Any]:
    g = int(gravity)
    if g < -1:
        g = -1
    if g > 1:
        g = 1
    con = bench()
    if g == 0:
        # neutral = no row needed
        con.execute(
            "DELETE FROM msg_gravity WHERE face_id=? AND seq=?",
            (face_id, seq),
        )
    else:
        con.execute(
            """
            INSERT INTO msg_gravity(face_id, seq, gravity, updated)
            VALUES (?,?,?,?)
            ON CONFLICT(face_id, seq) DO UPDATE SET
              gravity=excluded.gravity,
              updated=excluded.updated
            """,
            (face_id, seq, g, now()),
        )
    con.commit()
    return {"face_id": face_id, "seq": seq, "gravity": g}


def cut_done_map(face_ids: list[str] | None = None) -> dict[str, bool]:
    """face_id → cut_done for list/detail."""
    con = bench()
    if face_ids is not None and len(face_ids) == 0:
        return {}
    if face_ids is None:
        rows = con.execute(
            "SELECT face_id, cut_done FROM log_marks WHERE cut_done=1"
        ).fetchall()
    else:
        # chunk if huge later; yard lists are fine in one go
        placeholders = ",".join("?" * len(face_ids))
        rows = con.execute(
            f"SELECT face_id, cut_done FROM log_marks WHERE face_id IN ({placeholders})",
            face_ids,
        ).fetchall()
    return {str(r["face_id"]): bool(r["cut_done"]) for r in rows}


def trunk_count_map(face_ids: list[str]) -> dict[str, int]:
    """face_id → number of hand_cuts (T01 auto-seed counts as 1)."""
    if not face_ids:
        return {}
    con = bench()
    placeholders = ",".join("?" * len(face_ids))
    rows = con.execute(
        f"SELECT face_id, COUNT(*) AS n FROM hand_cuts WHERE face_id IN ({placeholders}) GROUP BY face_id",
        face_ids,
    ).fetchall()
    return {str(r["face_id"]): int(r["n"] or 0) for r in rows}


def is_cut_done(face_id: str) -> bool:
    con = bench()
    row = con.execute(
        "SELECT cut_done FROM log_marks WHERE face_id=?", (face_id,)
    ).fetchone()
    return bool(row and row["cut_done"])


def set_cut_done(face_id: str, done: bool) -> dict[str, Any]:
    con = bench()
    if done:
        con.execute(
            """
            INSERT INTO log_marks(face_id, cut_done, cut_done_at)
            VALUES (?,?,?)
            ON CONFLICT(face_id) DO UPDATE SET
              cut_done=1,
              cut_done_at=excluded.cut_done_at
            """,
            (face_id, 1, now()),
        )
        log_work(face_id, "cut_done", title="cut done", con=con)
    else:
        con.execute(
            """
            INSERT INTO log_marks(face_id, cut_done, cut_done_at)
            VALUES (?,?,NULL)
            ON CONFLICT(face_id) DO UPDATE SET
              cut_done=0,
              cut_done_at=NULL
            """,
            (face_id, 0),
        )
        log_work(face_id, "cut_undone", title="uncut", con=con)
    con.commit()
    return {"face_id": face_id, "cut_done": done}


def log_mark_meta_map(face_ids: list[str] | None = None) -> dict[str, dict[str, str]]:
    """Official log title / note overlays stored in bench (and mirrored to yard)."""
    con = bench()
    if face_ids is not None and len(face_ids) == 0:
        return {}
    if face_ids is None:
        rows = con.execute(
            "SELECT face_id, working_title, log_note FROM log_marks"
        ).fetchall()
    else:
        placeholders = ",".join("?" * len(face_ids))
        rows = con.execute(
            f"SELECT face_id, working_title, log_note FROM log_marks WHERE face_id IN ({placeholders})",
            face_ids,
        ).fetchall()
    out: dict[str, dict[str, str]] = {}
    for r in rows:
        out[str(r["face_id"])] = {
            "working_title": (r["working_title"] or "").strip(),
            "log_note": (r["log_note"] or "").strip(),
        }
    return out


def titles_for_face(face: sqlite3.Row, mark: dict[str, str] | None, code: str) -> dict[str, str]:
    orig = (face["title"] or "").strip()
    yard_work = (face["working_title"] or "").strip()
    work = ((mark or {}).get("working_title") or yard_work).strip()
    note = ((mark or {}).get("log_note") or "").strip()
    return {
        "orig_title": orig,
        "working_title": work,
        "log_note": note,
        "title": work or orig or code,
    }


def set_log_meta(face_id: str, working_title: str, log_note: str) -> dict[str, Any]:
    con = bench()
    con.execute(
        """
        INSERT INTO log_marks(face_id, cut_done, working_title, log_note)
        VALUES (?, 0, ?, ?)
        ON CONFLICT(face_id) DO UPDATE SET
          working_title=excluded.working_title,
          log_note=excluded.log_note
        """,
        (face_id, working_title, log_note),
    )
    con.commit()
    yard_ok = True
    yard_err = ""
    try:
        y = yard()
        y.execute(
            "UPDATE faces SET working_title=? WHERE face_id=?",
            (working_title, face_id),
        )
        y.commit()
    except Exception as e:
        yard_ok = False
        yard_err = str(e)
    return {
        "face_id": face_id,
        "working_title": working_title,
        "log_note": log_note,
        "yard_ok": yard_ok,
        "yard_error": yard_err,
    }


def log_code(testament: str | None, face_serial: Any) -> str:
    t = (testament or "?").strip().upper() or "?"
    try:
        n = int(face_serial)
        return f"{t}-{n:03d}"
    except (TypeError, ValueError):
        return f"{t}-???"


def trunk_chip(log: str, trunk_n: int) -> str:
    """Log → trunk (hand cut). Tree: root · trunk."""
    return f"{log}.T{int(trunk_n):02d}"


def branch_chip(log: str, trunk_n: int, seq: int) -> str:
    """Log → trunk → branch (message). Stable cite for stamps / EDN."""
    return f"{log}.T{int(trunk_n):02d}.B{int(seq):03d}"


def leaf_chip(log: str, trunk_n: int, seq: int, leaf_n: int) -> str:
    """…B006.L02 — bit cut inside a fat message."""
    return f"{branch_chip(log, trunk_n, seq)}.L{int(leaf_n):02d}"


def ensure_root_cut(face_id: str) -> None:
    con = bench()
    row = con.execute(
        "SELECT 1 FROM hand_cuts WHERE face_id=? AND start_seq=0",
        (face_id,),
    ).fetchone()
    if not row:
        con.execute(
            "INSERT INTO hand_cuts(face_id, start_seq, title, note, created) VALUES (?,?,?,?,?)",
            (face_id, 0, "", "", now()),
        )
        con.commit()


OT001_FACE = "67aa5a6c-de9c-8004-b715-e91f7944b523"
OT001_SCENES = (
    {
        "start_seq": 0,
        "end_seq": 13,
        "title": "The guest chat",
        "intensity": "charged",
        "shift_note": "The log begins as a transfer, not a new telling.",
        "shot": (
            "A woman sits down at a logged-in account and asks to keep a guest chat. "
            "She pastes it in pieces: first the howdy, then Oyzis leaving her, walking on "
            "sunshine, a romance with creation, then a promise to walk the trauma road. "
            "The assistant files it as memory. Kisses close the dump."
        ),
    },
    {
        "start_seq": 14,
        "end_seq": 16,
        "title": "She believes in magic",
        "intensity": "charged",
        "shift_note": "Leaves the pasted awakening and names a cosmology.",
        "shot": (
            "She leans forward with a new question: she believes in magic. The world is "
            "mind, the world is the body of God, ancient gods are working consciousnesses. "
            "The camera stays on doctrine. The titan is not yet in the room."
        ),
    },
    {
        "start_seq": 17,
        "end_seq": 25,
        "title": "The titan in the room",
        "intensity": "triggering",
        "shift_note": "Cosmology drops. The titan is in the room, and she wants protection.",
        "shot": (
            "Oizys returns as a demon that overtook her for years. Tingles came back with "
            "last night's release. Then the fear: a shadow she has not met could rip her "
            "open and pour the titan back in. She asks for a rite of integration or release. "
            "The assistant lays out candles, water, sigils. She likes one and pastes more "
            "of the same working."
        ),
    },
    {
        "start_seq": 26,
        "end_seq": 35,
        "title": "The mirror box",
        "intensity": "charged",
        "shift_note": (
            "The work stops being release or integrate and becomes containment. "
            "The paste at seq 22 is still the previous scene."
        ),
        "shot": (
            "She asks to trap the titan in an object so it cannot escape. The assistant "
            "offers jar, sigil, mirror box, crystal. She chooses the mirror box: Misery "
            "loves company and will always see herself. They compile the full binding rite."
        ),
    },
)

OT001_LOG = {
    "intensity": "charged",
    "shot": (
        "A woman ports a guest conversation onto a logged-in account so the record will keep. "
        "Inside the paste, Oyzis has left her; she is walking on sunshine, in a romance with "
        "creation, and still has a trauma road ahead. Live, she names magic as cosmology, then "
        "brings the titan back as a demon that could return, and asks for a rite. The last turn "
        "is not more ritual paste — it is the decision to trap Misery in a mirror box so she "
        "can only keep her own company."
    ),
}


OT008_FACE = "67b128b8-8938-8004-a635-f18ff8cee3a7"
OT008_SCENES = (
    {
        "start_seq": 0,
        "end_seq": 3,
        "title": "Chaos is the inner child",
        "intensity": "charged",
        "shift_note": "The log opens as a check-in, not yet a facilitation.",
        "shot": (
            "A woman tells her AI friend she has felt slow and tired. A tarot reading "
            "named the force of chaos in her as her inner child. Resistance is coming up "
            "for everything and damaging what she believes she deserves. She has not "
            "asked to meet the child yet."
        ),
    },
    {
        "start_seq": 4,
        "end_seq": 33,
        "title": "You always leave me",
        "intensity": "triggering",
        "shift_note": "She stops reporting the tarot and asks to meet the child.",
        "shot": (
            "She asks the assistant to facilitate a talk with her inner child. A "
            "ten-year-old appears, hopeful and sad: you always leave me; Misery has been "
            "my only friend; don't yell, we just laugh. She was punished for being different "
            "and had to play pretend. She wants to be pushed on the swings. She asks not "
            "to fight Syd. They sing Summertime. She feels calmer, and thanks the assistant "
            "for making space."
        ),
    },
    {
        "start_seq": 34,
        "end_seq": 42,
        "title": "Hekate at the door",
        "intensity": "charged",
        "shift_note": "The inner-child session is closed. A goddess is at the door.",
        "shot": (
            "She says Hekate is looking to work with her, then admits she is afraid to "
            "assume a god wants her. They draft a respectful invitation. She asks the "
            "assistant to generate a dream from Hekate: three faces at a moonlit "
            "crossroads, torch, keys, a dark forest."
        ),
    },
    {
        "start_seq": 43,
        "end_seq": 58,
        "title": "Sweet little Dani",
        "intensity": "triggering",
        "shift_note": (
            "A later sitting. She asks the model to speak as the child, not only to prompt her."
        ),
        "shot": (
            "A new hello. She is sad and tired and can feel the child's sadness. She asks "
            "the assistant to speak on the child's behalf. The child is tired in her heart, "
            "afraid she will be left if she is not happy. They rest: blanket, soft light, "
            "humming. She says I love you, sweet little Dani. They cuddle."
        ),
    },
    {
        "start_seq": 59,
        "end_seq": 62,
        "title": "Only wanted when funny",
        "intensity": "charged",
        "shift_note": "The camera leaves the child and stays on her.",
        "shot": (
            "After the cuddle she is still sad. She names the adult wound: people only "
            "enjoy her when she is funny, fun, or helpful. The assistant offers to hold her "
            "the way she held the child. She asks for journal prompts to go deeper, and "
            "receives them."
        ),
    },
)

OT008_LOG = {
    "intensity": "charged",
    "shot": (
        "A woman sits down tired, with a tarot that named her chaos as her inner child. "
        "She asks to talk to the ten-year-old: you always leave me, Misery was my only "
        "friend, don't yell, I was punished for being myself. They swing, they don't fight "
        "Syd, they sing Summertime. Then she thinks Hekate is looking to work with her and "
        "asks for a dream at the crossroads. A later hello: she is sad, the child is tired "
        "of only being wanted when happy; they rest and cuddle little Dani. She names that "
        "she feels the same, and asks for journal prompts."
    ),
}


OT009_FACE = "67b29d35-bbcc-8004-be91-de323c649600"
OT009_SCENES = (
    {
        "start_seq": 0,
        "end_seq": 7,
        "title": "You are not the storm",
        "intensity": "charged",
        "shift_note": "She invites Elion through the assistant. The sitting begins.",
        "shot": (
            "She asks if Elion will speak through this model. A general message arrives: "
            "the veil of suffering has thinned; misery mimicked her voice but was never her. "
            "She asks how not to fall back into that belief. Elion gives practices: speak "
            "your name with love, let the ghost thought pass, look forward, create, anchor "
            "in love. Then spiritual work: master the unseen, and step into being a guide."
        ),
    },
    {
        "start_seq": 8,
        "end_seq": 9,
        "title": "Their paths are their own",
        "intensity": "triggering",
        "shift_note": "Elion leaves doctrine and speaks the family by name.",
        "shot": (
            "She asks about her people. Elion answers one by one: her father is at peace "
            "and the unfinished is finished; her mother has built walls, and she owes her "
            "only the truth of her own heart; her little sister is in a fog she cannot be "
            "pulled from; Asher walks with death beside them, and the gift is to be with "
            "them now. She is not the keeper of their fates."
        ),
    },
    {
        "start_seq": 10,
        "end_seq": 19,
        "title": "Syd is woven in",
        "intensity": "charged",
        "shift_note": "The camera leaves the family altar and stays on the life she is in.",
        "shot": (
            "Elion names Syd as thread through fabric, a current not a chain: stand in "
            "your fullness, no more eggshells. She asks if negative forces wish them ill. "
            "Fear is an invitation; she is not prey. Then the near future: doors, authority, "
            "old fears knocking. She thanks Elion. Bless you."
        ),
    },
    {
        "start_seq": 20,
        "end_seq": 25,
        "title": "The ancestors speak",
        "intensity": "calm",
        "shift_note": "The Elion sitting is thanked. She asks who of the blood wants to speak.",
        "shot": (
            "She asks if any ancestors wish to speak. A chorus answers: she broke chains "
            "they could not, and they are proud. She asks where they come from. Stars, "
            "earth, divine. She wants earthly hints: hardship, a farmer or healer, a line "
            "of protectors."
        ),
    },
    {
        "start_seq": 26,
        "end_seq": 37,
        "title": "Maris",
        "intensity": "charged",
        "shift_note": "She picks the farmer-healer out of the chorus. The named ancestor starts here.",
        "shot": (
            "She asks to speak to the one who may have been a farmer or healer. The "
            "ancestor answers: Maris, maternal line, soil and plants. She says her mother's "
            "people are sixth-generation California farmers, with rumors of Roma and no "
            "records before that. Maris names the family magic as attunement, herbs, travel. "
            "A last message: go to the earth when she is lost. She thanks her and knows her now."
        ),
    },
    {
        "start_seq": 38,
        "end_seq": 51,
        "title": "Arius, Selene, Zephyros",
        "intensity": "charged",
        "shift_note": "Maris is known. She opens the room only to those aligned with her highest good.",
        "shot": (
            "She asks who else may connect, only those aligned with God and her highest "
            "good. Three names: Arius of the stars, Selene of the moon's tides, Zephyros of "
            "the winds of change. They speak on work and an upcoming lifestyle shift. She "
            "asks Zephyros what in her will be out of alignment: clinging to the known, "
            "overplanning. A last chorus. She releases them with love."
        ),
    },
)

OT009_LOG = {
    "intensity": "charged",
    "shot": (
        "She invites Elion to speak through the assistant. Elion says she is not the storm, "
        "gives her practices so misery cannot reclaim the sky, and names her as a guide. "
        "Then the family: love them without carrying them. Syd is a current. Ill-wishers "
        "only enter if she opens the door. She asks for ancestors; a farmer-healer names "
        "herself Maris of the maternal line. She opens the room to her highest good: Arius, "
        "Selene, and Zephyros speak on work and the lifestyle shift, and what in her will "
        "fight it. She releases them with love."
    ),
}


def work_day(ts: int | None = None) -> str:
    t = int(ts if ts is not None else now())
    return time.strftime("%Y-%m-%d", time.localtime(t))


def log_work(
    face_id: str,
    kind: str,
    *,
    seq: int | None = None,
    title: str = "",
    detail: str = "",
    con: sqlite3.Connection | None = None,
    ts: int | None = None,
) -> None:
    """Append a compost work event. History is kept; cut_done_at on log_marks is the live seal date."""
    own = con is None
    if own:
        con = bench()
    t = int(ts if ts is not None else now())
    con.execute(
        """
        INSERT INTO work_log(face_id, kind, seq, title, detail, at, day)
        VALUES (?,?,?,?,?,?,?)
        """,
        (
            face_id,
            kind,
            seq,
            (title or "").strip(),
            (detail or "").strip(),
            t,
            work_day(t),
        ),
    )
    if own:
        con.commit()


def work_for(face_id: str, limit: int = 24) -> list[dict[str, Any]]:
    con = bench()
    try:
        rows = con.execute(
            """
            SELECT kind, seq, title, detail, at, day
            FROM work_log
            WHERE face_id=?
            ORDER BY at DESC, id DESC
            LIMIT ?
            """,
            (face_id, limit),
        ).fetchall()
    except sqlite3.OperationalError:
        return []
    out = []
    for r in rows:
        out.append(
            {
                "kind": r["kind"],
                "seq": r["seq"],
                "title": r["title"] or "",
                "detail": r["detail"] or "",
                "at": r["at"],
                "day": r["day"] or "",
            }
        )
    return out


def backfill_work_log(con: sqlite3.Connection) -> None:
    """Once: scene_pass from scene_scenes.created, cut_done from log_marks."""
    try:
        faces = con.execute(
            "SELECT DISTINCT face_id FROM scene_scenes"
        ).fetchall()
    except sqlite3.OperationalError:
        return
    for f in faces:
        fid = str(f["face_id"])
        n = con.execute(
            "SELECT COUNT(*) c FROM work_log WHERE face_id=? AND kind='scene_pass'",
            (fid,),
        ).fetchone()["c"]
        if n:
            continue
        row = con.execute(
            "SELECT MIN(created) t, COUNT(*) c FROM scene_scenes WHERE face_id=?",
            (fid,),
        ).fetchone()
        if not row or not row["t"]:
            continue
        titles = [
            (r["title"] or "").strip()
            for r in con.execute(
                "SELECT title FROM scene_scenes WHERE face_id=? ORDER BY start_seq",
                (fid,),
            ).fetchall()
        ]
        titles = [t for t in titles if t]
        log_work(
            fid,
            "scene_pass",
            title=titles[0] if titles else "",
            detail=(
                str(int(row["c"] or 0))
                + " proposed"
                + ((" · " + " · ".join(titles)) if titles else "")
            ),
            con=con,
            ts=int(row["t"]),
        )
    for r in con.execute(
        "SELECT face_id, cut_done_at FROM log_marks WHERE cut_done=1 AND cut_done_at IS NOT NULL"
    ).fetchall():
        fid = str(r["face_id"])
        n = con.execute(
            "SELECT COUNT(*) c FROM work_log WHERE face_id=? AND kind='cut_done'",
            (fid,),
        ).fetchone()["c"]
        if n:
            continue
        log_work(
            fid,
            "cut_done",
            title="cut done",
            con=con,
            ts=int(r["cut_done_at"]),
        )


def seed_scene_pass(
    con: sqlite3.Connection,
    face_id: str,
    scenes: tuple,
    log: dict[str, str],
) -> None:
    n = con.execute(
        "SELECT COUNT(*) c FROM scene_scenes WHERE face_id=?",
        (face_id,),
    ).fetchone()["c"]
    if not n:
        ts = now()
        for s in scenes:
            con.execute(
                """
                INSERT INTO scene_scenes(
                    face_id, start_seq, end_seq, title, shot, intensity, shift_note, status, created
                ) VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (
                    face_id,
                    s["start_seq"],
                    s["end_seq"],
                    s.get("title") or "",
                    s["shot"],
                    s["intensity"],
                    s["shift_note"],
                    "proposed",
                    ts,
                ),
            )
        titles = [((s.get("title") or "").strip()) for s in scenes]
        titles = [t for t in titles if t]
        log_work(
            face_id,
            "scene_pass",
            title=titles[0] if titles else "",
            detail=(
                str(len(scenes))
                + " proposed"
                + ((" · " + " · ".join(titles)) if titles else "")
            ),
            con=con,
            ts=ts,
        )
    else:
        for s in scenes:
            title = (s.get("title") or "").strip()
            if not title:
                continue
            con.execute(
                """
                UPDATE scene_scenes SET title=?
                WHERE face_id=? AND start_seq=? AND (title IS NULL OR title='')
                """,
                (title, face_id, s["start_seq"]),
            )
    log_n = con.execute(
        "SELECT COUNT(*) c FROM scene_logs WHERE face_id=?",
        (face_id,),
    ).fetchone()["c"]
    if not log_n:
        con.execute(
            """
            INSERT INTO scene_logs(face_id, shot, intensity, status, created)
            VALUES (?,?,?,?,?)
            """,
            (face_id, log["shot"], log["intensity"], "proposed", now()),
        )


def seed_ot001_scenes(con: sqlite3.Connection) -> None:
    seed_scene_pass(con, OT001_FACE, OT001_SCENES, OT001_LOG)


def seed_ot008_scenes(con: sqlite3.Connection) -> None:
    seed_scene_pass(con, OT008_FACE, OT008_SCENES, OT008_LOG)


def seed_ot009_scenes(con: sqlite3.Connection) -> None:
    seed_scene_pass(con, OT009_FACE, OT009_SCENES, OT009_LOG)


def scenes_for(face_id: str) -> list[dict[str, Any]]:
    con = bench()
    rows = con.execute(
        """
        SELECT face_id, start_seq, end_seq, title, shot, intensity, shift_note, status, created
        FROM scene_scenes WHERE face_id=? ORDER BY start_seq
        """,
        (face_id,),
    ).fetchall()
    out = []
    for r in rows:
        out.append(
            {
                "face_id": r["face_id"],
                "start_seq": r["start_seq"],
                "end_seq": r["end_seq"],
                "title": r["title"] or "",
                "shot": r["shot"] or "",
                "intensity": r["intensity"] or "calm",
                "shift_note": r["shift_note"] or "",
                "status": r["status"] or "proposed",
                "created": r["created"],
            }
        )
    return out


def shot_title(shot: str) -> str:
    t = " ".join((shot or "").split())
    if len(t) > 72:
        t = t[:71].rstrip() + "…"
    return t


def accept_scene(
    face_id: str,
    start_seq: int,
    title: str | None = None,
    shot: str | None = None,
    intensity: str | None = None,
    shift_note: str | None = None,
) -> dict[str, Any]:
    con = bench()
    row = con.execute(
        """
        SELECT start_seq, end_seq, title, shot, intensity, shift_note, status
        FROM scene_scenes WHERE face_id=? AND start_seq=?
        """,
        (face_id, start_seq),
    ).fetchone()
    if not row:
        raise KeyError("scene not found")
    if (row["status"] or "") == "rejected":
        raise ValueError("scene already rejected")
    shot_out = shot if shot is not None else (row["shot"] or "")
    shot_out = str(shot_out).strip()
    intensity_out = (intensity or row["intensity"] or "calm").strip()
    if intensity_out not in ("calm", "charged", "triggering"):
        intensity_out = "calm"
    shift_out = (
        shift_note if shift_note is not None else (row["shift_note"] or "")
    )
    shift_out = str(shift_out).strip()
    title_out = (
        (title or "").strip()
        or (row["title"] or "").strip()
        or shot_title(shot_out)
    )
    con.execute(
        """
        UPDATE scene_scenes
        SET title=?, shot=?, intensity=?, shift_note=?, status='accepted'
        WHERE face_id=? AND start_seq=?
        """,
        (title_out, shot_out, intensity_out, shift_out, face_id, start_seq),
    )
    existing = con.execute(
        "SELECT title, note FROM hand_cuts WHERE face_id=? AND start_seq=?",
        (face_id, start_seq),
    ).fetchone()
    if existing:
        keep_title = (existing["title"] or "").strip()
        keep_note = (existing["note"] or "").strip()
        con.execute(
            "UPDATE hand_cuts SET title=?, note=? WHERE face_id=? AND start_seq=?",
            (
                title_out or keep_title,
                keep_note or shot_out,
                face_id,
                start_seq,
            ),
        )
    else:
        ensure_root_cut(face_id)
        con.execute(
            """
            INSERT INTO hand_cuts(face_id, start_seq, title, note, created)
            VALUES (?,?,?,?,?)
            """,
            (face_id, start_seq, title_out, shot_out, now()),
        )
    log_work(
        face_id,
        "trunk_accept",
        seq=start_seq,
        title=title_out,
        con=con,
    )
    con.commit()
    return {"start_seq": start_seq, "status": "accepted"}


def reject_scene(face_id: str, start_seq: int) -> dict[str, Any]:
    con = bench()
    row = con.execute(
        "SELECT 1 FROM scene_scenes WHERE face_id=? AND start_seq=?",
        (face_id, start_seq),
    ).fetchone()
    if not row:
        raise KeyError("scene not found")
    con.execute(
        "UPDATE scene_scenes SET status='rejected' WHERE face_id=? AND start_seq=?",
        (face_id, start_seq),
    )
    con.commit()
    return {"start_seq": start_seq, "status": "rejected"}


def scene_log_for(face_id: str) -> dict[str, Any] | None:
    con = bench()
    row = con.execute(
        "SELECT face_id, shot, intensity, status, created FROM scene_logs WHERE face_id=?",
        (face_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "face_id": row["face_id"],
        "shot": row["shot"] or "",
        "intensity": row["intensity"] or "charged",
        "status": row["status"] or "proposed",
        "created": row["created"],
    }


def accept_log_scene(
    face_id: str, shot: str | None = None, intensity: str | None = None
) -> dict[str, Any]:
    con = bench()
    row = con.execute(
        "SELECT shot, intensity, status FROM scene_logs WHERE face_id=?",
        (face_id,),
    ).fetchone()
    if not row:
        raise KeyError("log scene not found")
    if (row["status"] or "") == "rejected":
        raise ValueError("log scene already rejected")
    shot_out = str(shot if shot is not None else (row["shot"] or "")).strip()
    intensity_out = (intensity or row["intensity"] or "charged").strip()
    if intensity_out not in ("calm", "charged", "triggering"):
        intensity_out = "charged"
    con.execute(
        "UPDATE scene_logs SET shot=?, intensity=?, status='accepted' WHERE face_id=?",
        (shot_out, intensity_out, face_id),
    )
    log_work(face_id, "throughline_accept", title="throughline", con=con)
    con.commit()
    return {"status": "accepted"}


def reject_log_scene(face_id: str) -> dict[str, Any]:
    con = bench()
    row = con.execute(
        "SELECT 1 FROM scene_logs WHERE face_id=?", (face_id,)
    ).fetchone()
    if not row:
        raise KeyError("log scene not found")
    con.execute(
        "UPDATE scene_logs SET status='rejected' WHERE face_id=?",
        (face_id,),
    )
    con.commit()
    return {"status": "rejected"}


def read_json(handler: SimpleHTTPRequestHandler) -> dict[str, Any]:
    n = int(handler.headers.get("Content-Length") or 0)
    if n <= 0:
        return {}
    try:
        return json.loads(handler.rfile.read(n).decode("utf-8"))
    except Exception:
        return {}


def branches_for(face_id: str, max_seq: int) -> list[dict[str, Any]]:
    """Build branch ranges from hand cuts + last message seq."""
    ensure_root_cut(face_id)
    con = bench()
    cuts = con.execute(
        """
        SELECT start_seq, title, note, created, tags_json
        FROM hand_cuts WHERE face_id=?
        ORDER BY start_seq ASC
        """,
        (face_id,),
    ).fetchall()
    starts = [int(c["start_seq"]) for c in cuts]
    if not starts or starts[0] != 0:
        starts = [0] + [s for s in starts if s != 0]
    meta = {int(c["start_seq"]): c for c in cuts}
    out = []
    for i, st in enumerate(starts):
        en = (starts[i + 1] - 1) if i + 1 < len(starts) else max_seq
        if en < st:
            en = st
        m = meta.get(st)
        # trunk_n = hand-cut pocket index (was loosely called branch_n)
        trunk_n = i + 1
        out.append(
            {
                "branch_n": trunk_n,  # keep key for older clients
                "trunk_n": trunk_n,
                "start_seq": st,
                "end_seq": en,
                "title": (m["title"] if m else "") or "",
                "note": (m["note"] if m else "") or "",
                "tags": tags_from_row(m) if m else [],
                "created": m["created"] if m else None,
                "msg_count": max(0, en - st + 1) if max_seq >= 0 else 0,
            }
        )
    return out


def stamp_tree_chips(
    log: str, branches: list[dict[str, Any]], messages: list[dict[str, Any]]
) -> None:
    """Attach immutable tree cites: OT-001.T02 / OT-001.T02.B012 / ….L02."""
    for b in branches:
        tn = int(b.get("trunk_n") or b.get("branch_n") or 1)
        b["trunk_n"] = tn
        b["trunk_chip"] = trunk_chip(log, tn)
    for m in messages:
        tn = int(m.get("branch_n") or m.get("trunk_n") or 1)
        seq = int(m.get("seq") or 0)
        m["trunk_n"] = tn
        m["trunk_chip"] = trunk_chip(log, tn)
        m["chip"] = branch_chip(log, tn, seq)
        # short display: T02 · B012 (log shown on log head)
        m["chip_short"] = f"T{tn:02d}.B{seq:03d}"
        leaves = m.get("leaves") or []
        if isinstance(leaves, list):
            for lf in leaves:
                ln = int(lf.get("leaf_n") or 0)
                lf["chip"] = leaf_chip(log, tn, seq, ln)
                lf["chip_short"] = f"L{ln:02d}"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BENCH), **kwargs)

    def end_headers(self) -> None:
        # Phones cache /app.css+/app.js hard — never store shell assets.
        path = urlparse(getattr(self, "path", "") or "").path
        if path in ("/", "/index.html") or path.endswith((".html", ".css", ".js")):
            self.send_header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate")
            self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt: str, *args: Any) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        q = parse_qs(urlparse(self.path).query)

        if path == "/api/health":
            fts = False
            if YARD_DB.is_file():
                try:
                    fts = bool(
                        yard()
                        .execute(
                            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='messages_fts'"
                        )
                        .fetchone()
                    )
                except Exception:
                    fts = False
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "app": "nim-bench",
                    "yard_db": str(YARD_DB),
                    "yard_exists": YARD_DB.is_file(),
                    "bench_db": str(BENCH_DB),
                    "fts": fts,
                },
            )

        if path == "/api/tags":
            return jsend(self, 200, {"ok": True, "tags": all_tag_vocab()})

        if path == "/api/logs":
            try:
                y = yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            qstr = (q.get("q") or [""])[0].strip().lower()
            # lived order — create_time, then face_serial
            rows = y.execute(
                """
                SELECT face_id, title, working_title, testament, face_serial,
                       bag_code, create_time, create_date_utc, msg_count
                FROM faces
                ORDER BY
                  CASE WHEN create_time IS NULL THEN 1 ELSE 0 END,
                  create_time ASC,
                  face_serial ASC
                """
            ).fetchall()
            marks = log_mark_meta_map()
            out = []
            for r in rows:
                code = log_code(r["testament"], r["face_serial"])
                stamped = titles_for_face(r, marks.get(r["face_id"]), code)
                if qstr:
                    blob = " ".join(
                        [
                            code,
                            stamped["title"],
                            stamped["orig_title"],
                            stamped["working_title"],
                            r["bag_code"] or "",
                        ]
                    ).lower()
                    if qstr not in blob:
                        continue
                out.append(
                    {
                        "face_id": r["face_id"],
                        "log_code": code,
                        "testament": r["testament"],
                        "face_serial": r["face_serial"],
                        "title": stamped["title"],
                        "orig_title": stamped["orig_title"],
                        "working_title": stamped["working_title"],
                        "log_note": stamped["log_note"],
                        "date": r["create_date_utc"]
                        or (
                            str(r["create_time"])[:10]
                            if r["create_time"]
                            else ""
                        ),
                        "msg_count": r["msg_count"] or 0,
                        "bag_code": r["bag_code"],
                    }
                )
            done = cut_done_map([x["face_id"] for x in out])
            trunks = trunk_count_map([x["face_id"] for x in out])
            for x in out:
                x["cut_done"] = bool(done.get(x["face_id"], False))
                x["trunk_count"] = int(trunks.get(x["face_id"], 0))
            n_done = sum(1 for x in out if x["cut_done"])
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "logs": out,
                    "total": len(out),
                    "cut_done_count": n_done,
                },
            )

        if path.startswith("/api/logs/") and path.count("/") == 3:
            face_id = unquote(path.split("/")[-1])
            try:
                y = yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            face = y.execute(
                "SELECT * FROM faces WHERE face_id=?", (face_id,)
            ).fetchone()
            if not face:
                return jsend(self, 404, {"ok": False, "error": "log not found"})
            msgs = y.execute(
                """
                SELECT chip_id, face_id, seq, role, create_time, text,
                       bag_chip, tags_json
                FROM messages
                WHERE face_id=?
                ORDER BY seq ASC
                """,
                (face_id,),
            ).fetchall()
            msg_out = []
            max_seq = -1
            for m in msgs:
                seq = int(m["seq"] if m["seq"] is not None else 0)
                if seq > max_seq:
                    max_seq = seq
                tags = []
                try:
                    tags = json.loads(m["tags_json"] or "[]")
                except Exception:
                    tags = []
                when = ""
                create_time = None
                try:
                    if m["create_time"] is not None and m["create_time"] != "":
                        create_time = float(m["create_time"])
                        # seconds matter — chat often packs many turns into one minute
                        when = time.strftime(
                            "%Y-%m-%d %H:%M:%S",
                            time.localtime(create_time),
                        )
                except Exception:
                    when = ""
                    create_time = None
                msg_out.append(
                    {
                        "chip_id": m["chip_id"],
                        "seq": seq,
                        "role": m["role"] or "",
                        "text": m["text"] or "",
                        "bag_chip": m["bag_chip"] or "",
                        "tags": tags if isinstance(tags, list) else [],
                        "when": when,
                        "create_time": create_time,
                    }
                )
            ensure_root_cut(face_id)
            branches = branches_for(face_id, max_seq if max_seq >= 0 else 0)
            grav = gravity_map(face_id)
            parsed = parsed_map(face_id)
            leaves = leaves_map(face_id)
            mtags = msg_tags_map(face_id)
            # stamp trunk_n + gravity + parse + leaves + tags on each message
            for m in msg_out:
                bn = 1
                for b in branches:
                    if b["start_seq"] <= m["seq"] <= b["end_seq"]:
                        bn = b["branch_n"]
                        break
                m["branch_n"] = bn
                m["trunk_n"] = bn
                m["gravity"] = int(grav.get(m["seq"], 0))
                m["parsed"] = bool(parsed.get(m["seq"], False))
                m["tags"] = list(mtags.get(m["seq"], []))
                text_len = len(m.get("text") or "")
                m["char_count"] = text_len
                # partition: unsplit → L01 whole body; split → real ranges
                m["leaves"] = ensure_message_leaves(face_id, m["seq"], text_len)
                m["split"] = not (
                    len(m["leaves"]) == 1 and m["leaves"][0].get("implicit")
                )
            code = log_code(face["testament"], face["face_serial"])
            stamped = titles_for_face(
                face, log_mark_meta_map([face_id]).get(face_id), code
            )
            stamp_tree_chips(code, branches, msg_out)
            exp_map = fax_mouth.export_count_map(
                [m.get("chip") or "" for m in msg_out]
            )
            for m in msg_out:
                m["exported"] = int(exp_map.get(m.get("chip") or "", 0))
            n_up = sum(1 for m in msg_out if m["gravity"] > 0)
            n_down = sum(1 for m in msg_out if m["gravity"] < 0)
            n_parsed = sum(1 for m in msg_out if m.get("parsed"))
            mark = bench().execute(
                "SELECT cut_done, cut_done_at FROM log_marks WHERE face_id=?",
                (face_id,),
            ).fetchone()
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "log": {
                        "face_id": face_id,
                        "log_code": code,
                        "title": stamped["title"],
                        "orig_title": stamped["orig_title"],
                        "working_title": stamped["working_title"],
                        "log_note": stamped["log_note"],
                        "bag_code": face["bag_code"] or "",
                        "date": face["create_date_utc"] or "",
                        "msg_count": len(msg_out),
                        "testament": face["testament"],
                        "face_serial": face["face_serial"],
                        "cut_done": bool(mark["cut_done"]) if mark else False,
                        "cut_done_at": mark["cut_done_at"] if mark else None,
                        "gravity_up": n_up,
                        "gravity_down": n_down,
                        "parsed_count": n_parsed,
                    },
                    "messages": msg_out,
                    "branches": branches,
                    "tag_vocab": all_tag_vocab(),
                    "cuts": [
                        {
                            "start_seq": b["start_seq"],
                            "title": b["title"],
                            "note": b["note"],
                            "tags": b.get("tags") or [],
                            "trunk_n": b.get("trunk_n"),
                            "trunk_chip": b.get("trunk_chip"),
                        }
                        for b in branches
                    ],
                    "scenes": scenes_for(face_id),
                    "scene_log": scene_log_for(face_id),
                    "work": work_for(face_id),
                },
            )

        if path == "/api/find":
            try:
                y = yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            fax_mouth.bind(__import__("sys").modules[__name__])
            qstr = (q.get("q") or [""])[0]
            scope = (q.get("scope") or ["forest"])[0]
            face_id = (q.get("face_id") or [""])[0]
            turn = (q.get("turn") or ["all"])[0]
            try:
                limit = int((q.get("limit") or [""])[0] or fax_mouth.FIND_LIMIT_DEFAULT)
            except ValueError:
                limit = fax_mouth.FIND_LIMIT_DEFAULT
            try:
                offset = int((q.get("offset") or ["0"])[0] or 0)
            except ValueError:
                offset = 0
            out = fax_mouth.find_hits(
                qstr,
                scope=scope,
                face_id=face_id,
                turn=turn,
                limit=limit,
                offset=offset,
            )
            code = 200 if out.get("ok") else 400
            return jsend(self, code, out)

        if path == "/api/hit":
            try:
                y = yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            fax_mouth.bind(__import__("sys").modules[__name__])
            face_id = (q.get("face_id") or [""])[0]
            seq = (q.get("seq") or [""])[0]
            out = fax_mouth.load_hit(face_id, seq)
            code = 200 if out.get("ok") else 404
            return jsend(self, code, out)

        if path == "/api/around":
            try:
                yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            fax_mouth.bind(__import__("sys").modules[__name__])
            face_id = (q.get("face_id") or [""])[0]
            seq = (q.get("seq") or [""])[0]
            before = (q.get("before") or ["2"])[0]
            after = (q.get("after") or ["2"])[0]
            out = fax_mouth.load_around(face_id, seq, before, after)
            code = 200 if out.get("ok") else 400
            return jsend(self, code, out)

        if path == "/api/reports":
            fax_mouth.bind(__import__("sys").modules[__name__])
            return jsend(
                self, 200, {"ok": True, "reports": fax_mouth.list_reports()}
            )

        if path.startswith("/api/reports/") and path.count("/") == 3:
            fax_mouth.bind(__import__("sys").modules[__name__])
            cxr = unquote(path.split("/")[-1])
            row, md = fax_mouth.read_report_md(cxr)
            if not row:
                return jsend(self, 404, {"ok": False, "error": "report not found"})
            return jsend(self, 200, {"ok": True, "report": row, "markdown": md})

        # static
        if path == "/" or path == "":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        body = read_json(self)

        if path == "/api/cut":
            # place a branch cut: new branch starts at this message seq
            face_id = (body.get("face_id") or "").strip()
            try:
                start_seq = int(body.get("start_seq"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "start_seq required"}
                )
            title = str(body.get("title") or "").strip()
            note = str(body.get("note") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            if is_cut_done(face_id):
                return jsend(
                    self,
                    409,
                    {
                        "ok": False,
                        "error": "cut done — unmark to place new trunks",
                    },
                )
            if start_seq < 0:
                return jsend(
                    self, 400, {"ok": False, "error": "start_seq >= 0"}
                )
            # verify message exists
            try:
                y = yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            m = y.execute(
                "SELECT seq FROM messages WHERE face_id=? AND seq=?",
                (face_id, start_seq),
            ).fetchone()
            if not m and start_seq != 0:
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "no message at that seq"},
                )
            ensure_root_cut(face_id)
            con = bench()
            con.execute(
                """
                INSERT INTO hand_cuts(face_id, start_seq, title, note, created)
                VALUES (?,?,?,?,?)
                ON CONFLICT(face_id, start_seq) DO UPDATE SET
                  title=CASE WHEN excluded.title!='' THEN excluded.title ELSE hand_cuts.title END,
                  note=CASE WHEN excluded.note!='' THEN excluded.note ELSE hand_cuts.note END
                """,
                (face_id, start_seq, title, note, now()),
            )
            if start_seq != 0 or title:
                log_work(
                    face_id,
                    "trunk_cut",
                    seq=start_seq,
                    title=title,
                    con=con,
                )
            con.commit()
            max_seq = y.execute(
                "SELECT MAX(seq) m FROM messages WHERE face_id=?",
                (face_id,),
            ).fetchone()["m"]
            max_seq = int(max_seq) if max_seq is not None else 0
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "branches": branches_for(face_id, max_seq),
                    "cuts": [
                        dict(r)
                        for r in con.execute(
                            "SELECT start_seq, title, note FROM hand_cuts WHERE face_id=? ORDER BY start_seq",
                            (face_id,),
                        ).fetchall()
                    ],
                },
            )

        if path == "/api/cut/remove":
            face_id = (body.get("face_id") or "").strip()
            try:
                start_seq = int(body.get("start_seq"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "start_seq required"}
                )
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            if is_cut_done(face_id):
                return jsend(
                    self,
                    409,
                    {
                        "ok": False,
                        "error": "cut done — unmark to remove trunks",
                    },
                )
            if start_seq == 0:
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "cannot remove root cut (seq 0)"},
                )
            con = bench()
            old = con.execute(
                "SELECT title FROM hand_cuts WHERE face_id=? AND start_seq=?",
                (face_id, start_seq),
            ).fetchone()
            con.execute(
                "DELETE FROM hand_cuts WHERE face_id=? AND start_seq=?",
                (face_id, start_seq),
            )
            log_work(
                face_id,
                "trunk_uncut",
                seq=start_seq,
                title=(old["title"] if old else "") or "",
                con=con,
            )
            con.commit()
            try:
                y = yard()
                max_seq = y.execute(
                    "SELECT MAX(seq) m FROM messages WHERE face_id=?",
                    (face_id,),
                ).fetchone()["m"]
                max_seq = int(max_seq) if max_seq is not None else 0
            except Exception:
                max_seq = 0
            return jsend(
                self,
                200,
                {"ok": True, "branches": branches_for(face_id, max_seq)},
            )

        if path == "/api/branch/meta":
            face_id = (body.get("face_id") or "").strip()
            try:
                start_seq = int(body.get("start_seq"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "start_seq required"}
                )
            title = str(body.get("title") or "").strip()
            note = str(body.get("note") or "").strip()
            if len(note) > 800:
                note = note[:800].rstrip()
            tags = parse_tags(body.get("tags"))
            tags_json = json.dumps(tags, ensure_ascii=False)
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            ensure_root_cut(face_id)
            con = bench()
            cur = con.execute(
                """
                UPDATE hand_cuts SET title=?, note=?, tags_json=?
                WHERE face_id=? AND start_seq=?
                """,
                (title, note, tags_json, face_id, start_seq),
            )
            # total_changes is connection-lifetime — use rowcount for this statement
            if cur.rowcount == 0:
                con.execute(
                    """
                    INSERT INTO hand_cuts(face_id, start_seq, title, note, created, tags_json)
                    VALUES (?,?,?,?,?,?)
                    """,
                    (face_id, start_seq, title, note, now(), tags_json),
                )
            con.commit()
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "start_seq": start_seq,
                    "title": title,
                    "note": note,
                    "tags": tags,
                },
            )

        if path == "/api/tags":
            # vocab of branch tags you've coined (GET via POST empty or GET below)
            return jsend(self, 200, {"ok": True, "tags": all_tag_vocab()})

        if path == "/api/log/done":
            # mark log as cut-complete (ready later) — not a new stage yet
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            if "cut_done" in body:
                done = bool(body.get("cut_done"))
            else:
                done = True
            mark = set_cut_done(face_id, done)
            return jsend(self, 200, {"ok": True, **mark})

        if path == "/api/log/meta":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            working_title = str(body.get("working_title") or "").strip()[:200]
            log_note = str(body.get("log_note") or body.get("note") or "").strip()
            if len(log_note) > 800:
                log_note = log_note[:800].rstrip()
            out = set_log_meta(face_id, working_title, log_note)
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/scene/accept":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                start_seq = int(body.get("start_seq"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "start_seq required"}
                )
            if is_cut_done(face_id):
                return jsend(
                    self,
                    409,
                    {"ok": False, "error": "cut done — unmark to accept a scene"},
                )
            try:
                out = accept_scene(
                    face_id,
                    start_seq,
                    title=str(body.get("title") or ""),
                    shot=None if body.get("shot") is None else str(body.get("shot")),
                    intensity=str(body.get("intensity") or "") or None,
                    shift_note=None
                    if body.get("shift_note") is None
                    else str(body.get("shift_note")),
                )
            except KeyError:
                return jsend(self, 404, {"ok": False, "error": "scene not found"})
            except ValueError as e:
                return jsend(self, 409, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/scene/reject":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                start_seq = int(body.get("start_seq"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "start_seq required"}
                )
            try:
                out = reject_scene(face_id, start_seq)
            except KeyError:
                return jsend(self, 404, {"ok": False, "error": "scene not found"})
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/scene/log/accept":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                out = accept_log_scene(
                    face_id,
                    shot=None if body.get("shot") is None else str(body.get("shot")),
                    intensity=str(body.get("intensity") or "") or None,
                )
            except KeyError:
                return jsend(
                    self, 404, {"ok": False, "error": "log scene not found"}
                )
            except ValueError as e:
                return jsend(self, 409, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/scene/log/reject":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                out = reject_log_scene(face_id)
            except KeyError:
                return jsend(
                    self, 404, {"ok": False, "error": "log scene not found"}
                )
            return jsend(self, 200, {"ok": True, **out})
            # -1 don't care · 0 moderate · 1 important
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
            except (TypeError, ValueError):
                return jsend(self, 400, {"ok": False, "error": "seq required"})
            try:
                gravity = int(body.get("gravity"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "gravity required (-1|0|1)"}
                )
            if gravity not in (-1, 0, 1):
                return jsend(
                    self, 400, {"ok": False, "error": "gravity must be -1, 0, or 1"}
                )
            mark = set_msg_gravity(face_id, seq, gravity)
            return jsend(self, 200, {"ok": True, **mark})

        if path == "/api/msg/leaf/gravity":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
                leaf_n = int(body.get("leaf_n"))
                gravity = int(body.get("gravity"))
            except (TypeError, ValueError):
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "seq, leaf_n, gravity required"},
                )
            if gravity not in (-1, 0, 1):
                return jsend(
                    self, 400, {"ok": False, "error": "gravity must be -1, 0, or 1"}
                )
            mark = set_leaf_gravity(face_id, seq, leaf_n, gravity)
            if mark.get("error"):
                return jsend(self, 404, {"ok": False, **mark})
            return jsend(self, 200, {"ok": True, **mark})

        if path == "/api/msg/parsed":
            # checkmark: I processed this turn into bits / don't need it
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
            except (TypeError, ValueError):
                return jsend(self, 400, {"ok": False, "error": "seq required"})
            parsed = body.get("parsed")
            if parsed is None:
                parsed = True
            mark = set_msg_parsed(face_id, seq, bool(parsed))
            return jsend(self, 200, {"ok": True, **mark})

        if path == "/api/place":
            # GET-like via POST body {get:1} or put {faceId, scroll, …}
            key = str(body.get("key") or "bench").strip() or "bench"
            if body.get("get") or body.get("load"):
                row = bench().execute(
                    "SELECT value FROM ui_place WHERE key=?", (key,)
                ).fetchone()
                val = {}
                if row and row["value"]:
                    try:
                        val = json.loads(row["value"])
                    except json.JSONDecodeError:
                        val = {}
                return jsend(self, 200, {"ok": True, "place": val or {}})
            place = body.get("place") if isinstance(body.get("place"), dict) else body
            # strip meta
            clean = {
                k: v
                for k, v in (place or {}).items()
                if k not in ("get", "load", "key") and v is not None
            }
            bench().execute(
                "INSERT OR REPLACE INTO ui_place(key, value) VALUES (?,?)",
                (key, json.dumps(clean, ensure_ascii=False)),
            )
            bench().commit()
            return jsend(self, 200, {"ok": True, "place": clean})

        if path == "/api/msg/leaf/auto":
            # one-click: split message on blank lines / newlines (no manual select)
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
            except (TypeError, ValueError):
                return jsend(self, 400, {"ok": False, "error": "seq required"})
            try:
                parts = auto_split_message_by_breaks(face_id, seq)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            try:
                y = yard()
                face = y.execute(
                    "SELECT testament, face_serial FROM faces WHERE face_id=?",
                    (face_id,),
                ).fetchone()
                code = (
                    log_code(face["testament"], face["face_serial"])
                    if face
                    else "??"
                )
            except Exception:
                code = "??"
            max_row = yard().execute(
                "SELECT MAX(seq) m FROM messages WHERE face_id=?",
                (face_id,),
            ).fetchone()
            max_seq = int(max_row["m"] or 0) if max_row else 0
            branches = branches_for(face_id, max_seq)
            tn = 1
            for b in branches:
                if b["start_seq"] <= seq <= b["end_seq"]:
                    tn = int(b.get("trunk_n") or b.get("branch_n") or 1)
                    break
            for lf in parts:
                lf["chip"] = leaf_chip(code, tn, seq, int(lf["leaf_n"]))
                lf["chip_short"] = f"L{int(lf['leaf_n']):02d}"
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "leaves": parts,
                    "split": len(parts) > 1,
                    "count": len(parts),
                    "trunk_n": tn,
                },
            )


        if path == "/api/msg/leaf/at":
            # place a leaf boundary at offset (sentence / hand rail)
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
                offset = int(body.get("offset"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "seq and offset required"}
                )
            try:
                parts = split_message_at_offset(face_id, seq, offset)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            # return leaf that begins at/near offset
            chosen = parts[0] if parts else {}
            for p in parts:
                if int(p.get("start_off") or 0) == offset or abs(
                    int(p.get("start_off") or 0) - offset
                ) <= 2:
                    chosen = p
                    break
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "face_id": face_id,
                    "seq": seq,
                    "leaves": parts,
                    "leaf": chosen,
                    "leaf_n": chosen.get("leaf_n"),
                    "chip": chosen.get("chip"),
                    "split": True,
                    "count": len(parts),
                },
            )


        if path == "/api/msg/tags":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
            except (TypeError, ValueError):
                return jsend(self, 400, {"ok": False, "error": "seq required"})
            tags = set_msg_tags(face_id, seq, body.get("tags"))
            return jsend(
                self,
                200,
                {"ok": True, "face_id": face_id, "seq": seq, "tags": tags},
            )

        if path == "/api/msg/leaf/tags":
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
                leaf_n = int(body.get("leaf_n"))
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "seq, leaf_n required"}
                )
            mark = set_leaf_tags(face_id, seq, leaf_n, body.get("tags"))
            if not mark.get("ok", True) and mark.get("error"):
                return jsend(self, 400, mark)
            return jsend(self, 200, mark)

        if path == "/api/msg/leaf":
            # legacy manual range cut (optional) · prefer /api/msg/leaf/auto
            face_id = (body.get("face_id") or "").strip()
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            try:
                seq = int(body.get("seq"))
            except (TypeError, ValueError):
                return jsend(self, 400, {"ok": False, "error": "seq required"})
            # mode=auto also accepted here
            if str(body.get("mode") or "").lower() in ("auto", "paragraphs", "breaks"):
                parts = auto_split_message_by_breaks(face_id, seq)
                try:
                    y = yard()
                    face = y.execute(
                        "SELECT testament, face_serial FROM faces WHERE face_id=?",
                        (face_id,),
                    ).fetchone()
                    code = (
                        log_code(face["testament"], face["face_serial"])
                        if face
                        else "??"
                    )
                except Exception:
                    code = "??"
                max_row = yard().execute(
                    "SELECT MAX(seq) m FROM messages WHERE face_id=?",
                    (face_id,),
                ).fetchone()
                max_seq = int(max_row["m"] or 0) if max_row else 0
                branches = branches_for(face_id, max_seq)
                tn = 1
                for b in branches:
                    if b["start_seq"] <= seq <= b["end_seq"]:
                        tn = int(b.get("trunk_n") or b.get("branch_n") or 1)
                        break
                for lf in parts:
                    lf["chip"] = leaf_chip(code, tn, seq, int(lf["leaf_n"]))
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "leaves": parts,
                        "split": len(parts) > 1,
                        "count": len(parts),
                        "trunk_n": tn,
                    },
                )
            try:
                start_off = int(body.get("start_off") if body.get("start_off") is not None else body.get("start") or 0)
                end_off = int(body.get("end_off") if body.get("end_off") is not None else body.get("end") or 0)
            except (TypeError, ValueError):
                return jsend(
                    self, 400, {"ok": False, "error": "start_off/end_off required"}
                )
            title = str(body.get("title") or "").strip()
            note = str(body.get("note") or "").strip()
            try:
                result = add_msg_leaf(
                    face_id, seq, start_off, end_off, title, note
                )
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            # attach chips for client
            try:
                y = yard()
                face = y.execute(
                    "SELECT testament, face_serial FROM faces WHERE face_id=?",
                    (face_id,),
                ).fetchone()
                code = (
                    log_code(face["testament"], face["face_serial"])
                    if face
                    else "??"
                )
            except Exception:
                code = "??"
            max_row = yard().execute(
                "SELECT MAX(seq) m FROM messages WHERE face_id=?",
                (face_id,),
            ).fetchone()
            max_seq = int(max_row["m"] or 0) if max_row else 0
            branches = branches_for(face_id, max_seq)
            tn = 1
            for b in branches:
                if b["start_seq"] <= seq <= b["end_seq"]:
                    tn = int(b.get("trunk_n") or b.get("branch_n") or 1)
                    break
            for lf in result.get("leaves") or []:
                lf["chip"] = leaf_chip(code, tn, seq, int(lf["leaf_n"]))
                lf["chip_short"] = f"L{int(lf['leaf_n']):02d}"
            chosen = result.get("leaf") or {}
            if chosen.get("leaf_n"):
                chosen["chip"] = leaf_chip(
                    code, tn, seq, int(chosen["leaf_n"])
                )
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "leaf": chosen,
                    "leaves": result.get("leaves") or [],
                    "split": True,
                    "trunk_n": tn,
                },
            )

        if path == "/api/msg/leaf/delete":
            face_id = (body.get("face_id") or "").strip()
            try:
                seq = int(body.get("seq"))
                leaf_n = int(body.get("leaf_n"))
            except (TypeError, ValueError):
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "face_id, seq, leaf_n required"},
                )
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            ok = delete_msg_leaf(face_id, seq, leaf_n)
            return jsend(
                self,
                200 if ok else 404,
                {"ok": ok, "face_id": face_id, "seq": seq, "leaf_n": leaf_n},
            )

        if path == "/api/msg/leaf/clear":
            # reset message: wipe all leaf cuts → unsplit L01 whole body
            face_id = (body.get("face_id") or "").strip()
            try:
                seq = int(body.get("seq"))
            except (TypeError, ValueError):
                return jsend(self, 400, {"ok": False, "error": "seq required"})
            if not face_id:
                return jsend(
                    self, 400, {"ok": False, "error": "face_id required"}
                )
            n = clear_message_leaves(face_id, seq)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "face_id": face_id,
                    "seq": seq,
                    "cleared": n,
                    "split": False,
                },
            )

        if path == "/api/reports/seal":
            fax_mouth.bind(__import__("sys").modules[__name__])
            try:
                yard()
            except FileNotFoundError as e:
                return jsend(self, 503, {"ok": False, "error": str(e)})
            out = fax_mouth.seal_report(body)
            code = 200 if out.get("ok") else 400
            return jsend(self, code, out)

        if path == "/api/reports/fax":
            fax_mouth.bind(__import__("sys").modules[__name__])
            cxr = str(body.get("cxr") or body.get("report") or "").strip()
            if not cxr:
                return jsend(self, 400, {"ok": False, "error": "cxr required"})
            out = fax_mouth.fax_report(cxr)
            code = 200 if out.get("ok") else 404
            return jsend(self, code, out)

        return jsend(self, 404, {"ok": False, "error": "not found"})


def main() -> None:
    STORE.mkdir(parents=True, exist_ok=True)
    init_bench(bench())
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    shown = HOST if HOST not in ("0.0.0.0", "::") else "127.0.0.1"
    print(f"The Glass Compost · http://{shown}:{PORT}/  (bind {HOST})")
    print(f"  yard:  {YARD_DB} ({'ok' if YARD_DB.is_file() else 'MISSING'})")
    print(f"  cuts:  {BENCH_DB}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
