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

HOST = "127.0.0.1"
PORT = 43182

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

        -- leaves: hand-split a fat message into smaller citeable bits
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
    con.commit()


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
            # comma / semicolon list
            raw = re.split(r"[,;|/]+", s)
    if not isinstance(raw, (list, tuple)):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in raw:
        tag = re.sub(r"\s+", " ", str(t or "").strip())
        if not tag:
            continue
        if len(tag) > 40:
            tag = tag[:40].rstrip()
        key = tag.casefold()
        if key in seen:
            continue
        seen.add(key)
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


def all_tag_vocab() -> list[str]:
    """Every tag you've ever put on a branch — for reuse / suggest."""
    con = bench()
    rows = con.execute(
        "SELECT tags_json FROM hand_cuts WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '[]'"
    ).fetchall()
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
        SELECT seq, leaf_n, start_off, end_off, title, note, created, gravity
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
        out.setdefault(seq, []).append(
            {
                "leaf_n": int(r["leaf_n"]),
                "start_off": int(r["start_off"] or 0),
                "end_off": int(r["end_off"] or 0),
                "title": (r["title"] or "").strip(),
                "note": (r["note"] or "").strip(),
                "created": r["created"],
                "gravity": g,
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
        items.append(
            {
                "start_off": a,
                "end_off": b if n else 0,
                "title": (lf.get("title") or "").strip(),
                "note": (lf.get("note") or "").strip(),
                "created": lf.get("created"),
                "gravity": g,
                "chipped": bool(
                    lf.get("chipped")
                    or (lf.get("title") or "").strip()
                    or (lf.get("note") or "").strip()
                    or not lf.get("implicit")
                ),
                "implicit": bool(lf.get("implicit")),
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
        cleaned.append(
            {
                "start_off": a,
                "end_off": b,
                "title": (lf.get("title") or "").strip(),
                "note": (lf.get("note") or "").strip(),
                "created": lf.get("created"),
                "gravity": g,
                # chipped = user cut / titled bit (not auto gap fill)
                "chipped": bool(
                    lf.get("chipped")
                    or (lf.get("title") or "").strip()
                    or (lf.get("note") or "").strip()
                    or not lf.get("implicit")
                ),
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

    filled: list[dict[str, Any]] = []
    cursor = 0
    for p in merged:
        if p["start_off"] > cursor:
            # gap → absorb into previous (or pull this leaf left). Never mint
            # a remainder ship for \n\n holes between real cuts.
            if filled:
                filled[-1]["end_off"] = p["start_off"]
            else:
                p = dict(p)
                p["start_off"] = cursor
        filled.append(p)
        cursor = max(cursor, p["end_off"])
    if cursor < text_len:
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
                "chipped": True,  # user-stored cut
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
        # if title was empty because leaf was blank-adjacent, keep content first line
        if not title and body and body[a:b].strip():
            title = body[a:b].strip().split("\n")[0].strip()[:48]
        cleaned.append(
            {
                "start_off": a,
                "end_off": b,
                "title": title,
                "note": str(p.get("note") or "").strip()[:400],
                "gravity": g,
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
            INSERT INTO msg_leaves(face_id, seq, leaf_n, start_off, end_off, title, note, created, gravity)
            VALUES (?,?,?,?,?,?,?,?,?)
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
                int(p.get("gravity") or 0),
            ),
        )
        out.append(
            {
                "leaf_n": i,
                "start_off": p["start_off"],
                "end_off": p["end_off"],
                "title": p["title"],
                "note": p["note"],
                "created": t,
                "gravity": int(p.get("gravity") or 0),
                "implicit": False,
                "chipped": True,
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
    Partitions the whole body: gaps stay as leaves too (so nothing is only a 'reference').
    Unsplit message = L01 only (implicit until first cut writes the partition).
    """
    text_len = _msg_text_len(face_id, seq)
    if end_off < start_off:
        start_off, end_off = end_off, start_off
    start_off = max(0, min(int(start_off), text_len))
    end_off = max(start_off, min(int(end_off), text_len))
    if end_off <= start_off:
        raise ValueError("empty selection")

    current = ensure_message_leaves(face_id, seq, text_len)
    # If only implicit L01, start from full span
    if len(current) == 1 and current[0].get("implicit"):
        spans = [{"start_off": 0, "end_off": text_len, "title": "", "note": ""}]
    else:
        spans = [
            {
                "start_off": c["start_off"],
                "end_off": c["end_off"],
                "title": c.get("title") or "",
                "note": c.get("note") or "",
            }
            for c in current
        ]

    new_spans: list[dict[str, Any]] = []
    hit = False
    for sp in spans:
        a, b = sp["start_off"], sp["end_off"]
        # no overlap
        if end_off <= a or start_off >= b:
            new_spans.append(sp)
            continue
        hit = True
        # before
        if start_off > a:
            new_spans.append(
                {
                    "start_off": a,
                    "end_off": start_off,
                    "title": sp.get("title") or "",
                    "note": sp.get("note") or "",
                }
            )
        # the cut (chipped leaf)
        new_spans.append(
            {
                "start_off": max(a, start_off),
                "end_off": min(b, end_off),
                "title": (title or "").strip()[:120],
                "note": (note or "").strip()[:400],
            }
        )
        # after
        if end_off < b:
            new_spans.append(
                {
                    "start_off": end_off,
                    "end_off": b,
                    "title": "",
                    "note": "",
                }
            )
    if not hit:
        # selection outside stored spans — treat as new piece + fill remainder once
        new_spans = list(spans)
        new_spans.append(
            {
                "start_off": start_off,
                "end_off": end_off,
                "title": (title or "").strip()[:120],
                "note": (note or "").strip()[:400],
            }
        )

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
    Partition message text into leaf spans by line breaks.

    Prefer blank lines (two or more \\n / \\r\\n / \\r).
    If that yields a single block, fall back to single newlines.

    Returns a full cover of 0..len(text): content paragraphs absorb
    surrounding newline-only gaps so we never store empty "dead" leaves.
    """
    if not text:
        return [(0, 0)]
    # find non-empty content islands
    multi = list(re.finditer(r"(?:\r\n|\n|\r){2,}", text))
    raw: list[tuple[int, int]] = []
    if multi:
        last = 0
        for m in multi:
            if m.start() > last:
                raw.append((last, m.start()))
            last = m.end()
        if last < len(text):
            raw.append((last, len(text)))
    if len(raw) <= 1:
        raw = []
        last = 0
        for m in re.finditer(r"\r\n|\n|\r", text):
            if m.start() > last:
                raw.append((last, m.start()))
            last = m.end()
        if last < len(text):
            raw.append((last, len(text)))
    content = [(a, b) for a, b in raw if b > a and text[a:b].strip()]
    if not content:
        return [(0, len(text))]
    if len(content) == 1:
        return [(0, len(text))]
    # absorb leading/trailing breaks into neighbors — full cover, no holes
    covered: list[tuple[int, int]] = []
    cursor = 0
    for i, (a, b) in enumerate(content):
        end = content[i + 1][0] if i + 1 < len(content) else len(text)
        # this leaf owns from cursor through end of this content (and
        # following whitespace until next content starts)
        covered.append((cursor, end if i + 1 < len(content) else len(text)))
        # actually: leaf should end at `b` for content but include trailing
        # ws until next `a`. So end = next a, or len.
        covered[-1] = (cursor, content[i + 1][0] if i + 1 < len(content) else len(text))
        cursor = covered[-1][1]
    # ensure last reaches end
    if covered and covered[-1][1] < len(text):
        a0, _ = covered[-1]
        covered[-1] = (a0, len(text))
    if covered and covered[0][0] != 0:
        covered[0] = (0, covered[0][1])
    return covered


def auto_split_message_by_breaks(face_id: str, seq: int) -> list[dict[str, Any]]:
    """
    One-click leaf cut: split whole message on blank lines / newlines.
    Replaces any prior leaf partition for this turn.
    No empty remainder leaves for lone newlines.
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
        title = chunk.strip().split("\n")[0].strip()[:48]
        parts.append(
            {
                "start_off": a,
                "end_off": b,
                "title": title,
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
    con.commit()
    return {"face_id": face_id, "cut_done": done}


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

    def log_message(self, fmt: str, *args: Any) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        q = parse_qs(urlparse(self.path).query)

        if path == "/api/health":
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "app": "nim-bench",
                    "yard_db": str(YARD_DB),
                    "yard_exists": YARD_DB.is_file(),
                    "bench_db": str(BENCH_DB),
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
            out = []
            for r in rows:
                code = log_code(r["testament"], r["face_serial"])
                title = (
                    r["working_title"] or r["title"] or code
                ).strip()
                if qstr:
                    blob = f"{code} {title} {r['bag_code'] or ''}".lower()
                    if qstr not in blob:
                        continue
                out.append(
                    {
                        "face_id": r["face_id"],
                        "log_code": code,
                        "testament": r["testament"],
                        "face_serial": r["face_serial"],
                        "title": title,
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
            for x in out:
                x["cut_done"] = bool(done.get(x["face_id"], False))
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
            # stamp trunk_n + gravity + parse + leaves on each message
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
                text_len = len(m.get("text") or "")
                m["char_count"] = text_len
                # partition: unsplit → L01 whole body; split → real ranges
                m["leaves"] = ensure_message_leaves(face_id, m["seq"], text_len)
                m["split"] = not (
                    len(m["leaves"]) == 1 and m["leaves"][0].get("implicit")
                )
            code = log_code(face["testament"], face["face_serial"])
            stamp_tree_chips(code, branches, msg_out)
            n_up = sum(1 for m in msg_out if m["gravity"] > 0)
            n_down = sum(1 for m in msg_out if m["gravity"] < 0)
            n_parsed = sum(1 for m in msg_out if m.get("parsed"))
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "log": {
                        "face_id": face_id,
                        "log_code": code,
                        "title": (
                            face["working_title"]
                            or face["title"]
                            or code
                        ),
                        "date": face["create_date_utc"] or "",
                        "msg_count": len(msg_out),
                        "testament": face["testament"],
                        "face_serial": face["face_serial"],
                        "cut_done": is_cut_done(face_id),
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
                },
            )

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
            con.execute(
                "DELETE FROM hand_cuts WHERE face_id=? AND start_seq=?",
                (face_id, start_seq),
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

        if path == "/api/msg/gravity":
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

        return jsend(self, 404, {"ok": False, "error": "not found"})


def main() -> None:
    STORE.mkdir(parents=True, exist_ok=True)
    init_bench(bench())
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Nim Bench · http://{HOST}:{PORT}/")
    print(f"  yard:  {YARD_DB} ({'ok' if YARD_DB.is_file() else 'MISSING'})")
    print(f"  cuts:  {BENCH_DB}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
