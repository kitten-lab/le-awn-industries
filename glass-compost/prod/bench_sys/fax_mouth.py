"""
Glass Compost · find / CXR seal / fax mouth

Yard text stays read-only. Seals write bench.db + store/reports/.
Fax copies markdown into PocketGo go.glass/shards.
"""

from __future__ import annotations

import json
import re
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Any

# bound from server.py
S: Any = None

REPORTS_DIR_NAME = "reports"
CXR_RE = re.compile(r"^CXR-(\d+)$", re.I)
FTS_MARK_OPEN = "\x02"
FTS_MARK_CLOSE = "\x03"
FM_CHIPS_MAX = 220
FIND_LIMIT_MAX = 2000
FIND_LIMIT_DEFAULT = 800

GRAVITY_WORD = {-1: "don't-care", 0: "moderate", 1: "important"}


def bind(mod: Any) -> None:
    global S
    S = mod


def reports_dir() -> Path:
    d = S.STORE / REPORTS_DIR_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def shards_dir() -> Path:
    # bench_sys → prod → glass-compost → le-awn-industries → ALICE_BOX
    alice = S.BENCH.parents[3]
    d = (
        alice
        / "my-pocket-things"
        / "pocket-go"
        / "~hosts"
        / "glass"
        / "shards"
    )
    d.mkdir(parents=True, exist_ok=True)
    return d


def init_tables(con: Any) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cxr TEXT NOT NULL UNIQUE,
            kind TEXT NOT NULL DEFAULT 'find',
            title TEXT DEFAULT '',
            keyword TEXT DEFAULT '',
            scope TEXT DEFAULT '',
            face_id TEXT DEFAULT '',
            created INTEGER,
            faxed INTEGER NOT NULL DEFAULT 0,
            faxed_at INTEGER,
            fax_path TEXT DEFAULT '',
            body_path TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_reports_cxr ON reports(cxr);

        CREATE TABLE IF NOT EXISTS report_chips (
            report_id INTEGER NOT NULL,
            chip TEXT NOT NULL,
            face_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            leaf_n INTEGER,
            kind TEXT DEFAULT 'branch',
            PRIMARY KEY (report_id, chip)
        );
        CREATE INDEX IF NOT EXISTS idx_report_chips_chip ON report_chips(chip);
        """
    )
    con.commit()


def format_when_full(create_time: Any) -> dict[str, Any]:
    """Full local timestamp: fractional seconds + offset. Unix kept as-is."""
    out = {
        "when": "",
        "when_full": "",
        "when_iso": "",
        "create_time": None,
    }
    if create_time is None or create_time == "":
        return out
    try:
        t = float(create_time)
    except (TypeError, ValueError):
        return out
    out["create_time"] = t
    try:
        dt = datetime.fromtimestamp(t).astimezone()
        iso = dt.isoformat(timespec="microseconds")
        off = dt.strftime("%z")
        if off and len(off) == 5:
            off_h = off[:3] + ":" + off[3:]
        else:
            off_h = off or ""
        us = dt.microsecond
        human = dt.strftime("%Y-%m-%d %H:%M:%S") + f".{us:06d}"
        if off:
            human = human + " " + off
        out["when"] = dt.strftime("%Y-%m-%d %H:%M:%S")
        out["when_full"] = human
        out["when_iso"] = iso
        if off_h and iso and off_h not in iso:
            pass
    except Exception:
        try:
            out["when"] = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(t)
            )
            out["when_full"] = out["when"]
        except Exception:
            pass
    return out


def fts_match(q: str) -> str:
    s = re.sub(r"\s+", " ", (q or "").strip())
    if not s:
        return ""
    s = s.replace('"', " ")
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""
    return '"' + s + '"'


def has_messages_fts() -> bool:
    try:
        row = S.yard().execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='messages_fts'"
        ).fetchone()
        return bool(row)
    except Exception:
        return False


def _trunk_cache() -> dict[str, list[int]]:
    return {}


def trunk_n_of(face_id: str, seq: int, cache: dict[str, list[int]]) -> int:
    if face_id not in cache:
        rows = S.bench().execute(
            "SELECT start_seq FROM hand_cuts WHERE face_id=? ORDER BY start_seq ASC",
            (face_id,),
        ).fetchall()
        starts = [int(r["start_seq"]) for r in rows]
        if not starts or starts[0] != 0:
            starts = [0] + [s for s in starts if s != 0]
        cache[face_id] = starts
    tn = 1
    for i, st in enumerate(cache[face_id]):
        if st <= seq:
            tn = i + 1
        else:
            break
    return tn


def export_count_map(chips: list[str] | None = None) -> dict[str, int]:
    con = S.bench()
    if chips:
        uniq = [c for c in dict.fromkeys(chips) if c]
        if not uniq:
            return {}
        qmarks = ",".join("?" * len(uniq))
        rows = con.execute(
            f"SELECT chip, COUNT(*) n FROM report_chips WHERE chip IN ({qmarks}) GROUP BY chip",
            uniq,
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT chip, COUNT(*) n FROM report_chips GROUP BY chip"
        ).fetchall()
    return {str(r["chip"]): int(r["n"] or 0) for r in rows}


def next_cxr() -> str:
    rows = S.bench().execute("SELECT cxr FROM reports").fetchall()
    n = 0
    for r in rows:
        m = CXR_RE.match(str(r["cxr"] or "").strip())
        if m:
            n = max(n, int(m.group(1)))
    return f"CXR-{n + 1:03d}"


def gravity_word(g: int) -> str:
    if g > 0:
        return "important"
    if g < 0:
        return "don't-care"
    return "moderate"


def _fm_value(v: Any) -> str:
    s = str(v if v is not None else "").replace("\r\n", " ").replace("\n", " ").replace("\r", " ").strip()
    if not s:
        return ""
    if any(c in s for c in (":", "#", '"')) or s.startswith(("-", "[", "{")):
        return '"' + s.replace('"', '\\"') + '"'
    return s


def slug_title(title: str, cxr: str) -> str:
    base = re.sub(r"[^\w\s-]+", "", (title or "").strip(), flags=re.UNICODE)
    base = re.sub(r"[-\s]+", "-", base).strip("-").lower()
    if not base:
        base = cxr.lower()
    return base[:60]


def ensure_bench_fts() -> bool:
    """Pointer index on bench when yard has no messages_fts. Not a second mountain."""
    con = S.bench()
    con.execute(
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS glass_fts USING fts5(
            face_id UNINDEXED,
            seq UNINDEXED,
            text
        )
        """
    )
    n = int(con.execute("SELECT COUNT(*) c FROM glass_fts").fetchone()["c"] or 0)
    if n > 0:
        return True
    y = S.yard()
    batch: list[tuple[str, int, str]] = []
    for r in y.execute("SELECT face_id, seq, text FROM messages"):
        batch.append(
            (str(r["face_id"]), int(r["seq"] or 0), r["text"] or "")
        )
        if len(batch) >= 400:
            con.executemany(
                "INSERT INTO glass_fts(face_id, seq, text) VALUES (?,?,?)",
                batch,
            )
            batch = []
    if batch:
        con.executemany(
            "INSERT INTO glass_fts(face_id, seq, text) VALUES (?,?,?)",
            batch,
        )
    con.commit()
    return True


def _stamp_hits(rows: list[Any]) -> list[dict[str, Any]]:
    tcache: dict[str, list[int]] = {}
    faces_needed: set[str] = set()
    hits: list[dict[str, Any]] = []
    chips: list[str] = []
    for r in rows:
        fid = str(r["face_id"])
        seq = int(r["seq"] if r["seq"] is not None else 0)
        faces_needed.add(fid)
        code = S.log_code(r["testament"], r["face_serial"])
        tn = trunk_n_of(fid, seq, tcache)
        chip = S.branch_chip(code, tn, seq)
        chips.append(chip)
        clock = format_when_full(r["create_time"])
        title = (r["working_title"] or r["title"] or code or "").strip()
        hits.append(
            {
                "face_id": fid,
                "seq": seq,
                "role": r["role"] or "",
                "log_code": code,
                "log_title": title,
                "bag_code": r["bag_code"] or "",
                "trunk_n": tn,
                "chip": chip,
                "chars": int(r["chars"] or 0),
                "snippet": r["snippet"] or "",
                "when": clock["when"],
                "when_full": clock["when_full"],
                "when_iso": clock["when_iso"],
                "create_time": clock["create_time"],
                "gravity": 0,
                "exported": 0,
            }
        )
    grav: dict[str, dict[int, int]] = {}
    for fid in faces_needed:
        grav[fid] = S.gravity_map(fid)
    for h in hits:
        h["gravity"] = int(grav.get(h["face_id"], {}).get(h["seq"], 0))
    counts = export_count_map(chips)
    for h in hits:
        h["exported"] = int(counts.get(h["chip"], 0))
    return hits


def find_hits(
    q: str,
    *,
    scope: str = "forest",
    face_id: str = "",
    turn: str = "all",
    limit: int = FIND_LIMIT_DEFAULT,
    offset: int = 0,
) -> dict[str, Any]:
    q = (q or "").strip()
    if not q:
        return {"ok": False, "error": "query required"}
    match = fts_match(q)
    if not match:
        return {"ok": False, "error": "query empty after clean"}
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = FIND_LIMIT_DEFAULT
    limit = max(1, min(limit, FIND_LIMIT_MAX))
    try:
        offset = max(0, int(offset))
    except (TypeError, ValueError):
        offset = 0
    scope = (scope or "forest").strip().lower()
    if scope not in ("forest", "log", "this", "this-log"):
        scope = "forest"
    if scope in ("log", "this", "this-log"):
        scope = "log"
    turn = (turn or "all").strip().lower()
    if turn in ("asst", "assistant", "machine"):
        turn = "assistant"
    elif turn in ("user", "you", "hands"):
        turn = "user"
    else:
        turn = "all"
    face_id = (face_id or "").strip()
    if scope == "log" and not face_id:
        return {"ok": False, "error": "this log requires an open face_id"}

    use_yard_fts = has_messages_fts()
    if not use_yard_fts:
        try:
            ensure_bench_fts()
        except Exception as e:
            return {
                "ok": False,
                "error": f"no messages_fts and bench index failed: {e}",
            }

    if use_yard_fts:
        where = ["messages_fts MATCH ?"]
        args: list[Any] = [match]
        if scope == "log":
            where.append("m.face_id = ?")
            args.append(face_id)
        if turn in ("user", "assistant"):
            where.append("m.role = ?")
            args.append(turn)
        where_sql = " AND ".join(where)
        y = S.yard()
        count_row = y.execute(
            f"""
            SELECT COUNT(*) c
            FROM messages_fts
            JOIN messages m ON m.chip_id = messages_fts.chip_id
            WHERE {where_sql}
            """,
            args,
        ).fetchone()
        total = int(count_row["c"] or 0) if count_row else 0
        rows = y.execute(
            f"""
            SELECT m.chip_id, m.face_id, m.seq, m.role, m.create_time, m.bag_chip,
                   length(m.text) AS chars,
                   snippet(messages_fts, 2, ?, ?, ' … ', 12) AS snippet,
                   f.testament, f.face_serial, f.title, f.working_title,
                   f.bag_code, f.create_date_utc
            FROM messages_fts
            JOIN messages m ON m.chip_id = messages_fts.chip_id
            JOIN faces f ON f.face_id = m.face_id
            WHERE {where_sql}
            ORDER BY
              CASE WHEN m.create_time IS NULL THEN 1 ELSE 0 END,
              m.create_time ASC,
              f.face_serial ASC,
              m.seq ASC
            LIMIT ? OFFSET ?
            """,
            [FTS_MARK_OPEN, FTS_MARK_CLOSE, *args, limit, offset],
        ).fetchall()
        hits = _stamp_hits(rows)
    else:
        b = S.bench()
        where = ["glass_fts MATCH ?"]
        args = [match]
        if scope == "log":
            where.append("glass_fts.face_id = ?")
            args.append(face_id)
        where_sql = " AND ".join(where)
        ptrs = b.execute(
            f"""
            SELECT glass_fts.face_id AS face_id, glass_fts.seq AS seq,
                   snippet(glass_fts, 2, ?, ?, ' … ', 12) AS snippet
            FROM glass_fts
            WHERE {where_sql}
            """,
            [FTS_MARK_OPEN, FTS_MARK_CLOSE, *args],
        ).fetchall()
        y = S.yard()
        packed = []
        for p in ptrs:
            m = y.execute(
                """
                SELECT m.face_id, m.seq, m.role, m.create_time, m.bag_chip,
                       length(m.text) AS chars,
                       f.testament, f.face_serial, f.title, f.working_title,
                       f.bag_code
                FROM messages m
                JOIN faces f ON f.face_id = m.face_id
                WHERE m.face_id=? AND m.seq=?
                """,
                (p["face_id"], int(p["seq"] or 0)),
            ).fetchone()
            if not m:
                continue
            if turn in ("user", "assistant") and (m["role"] or "") != turn:
                continue
            packed.append(
                {
                    "face_id": m["face_id"],
                    "seq": m["seq"],
                    "role": m["role"],
                    "create_time": m["create_time"],
                    "bag_chip": m["bag_chip"],
                    "chars": m["chars"],
                    "snippet": p["snippet"],
                    "testament": m["testament"],
                    "face_serial": m["face_serial"],
                    "title": m["title"],
                    "working_title": m["working_title"],
                    "bag_code": m["bag_code"],
                }
            )
        packed.sort(
            key=lambda r: (
                r["create_time"] is None,
                r["create_time"] or 0,
                r["face_serial"] or 0,
                r["seq"] or 0,
            )
        )
        total = len(packed)
        hits = _stamp_hits(packed[offset : offset + limit])

    return {
        "ok": True,
        "q": q,
        "match": match,
        "scope": scope,
        "turn": turn,
        "face_id": face_id,
        "total": total,
        "offset": offset,
        "limit": limit,
        "hits": hits,
        "truncated": offset + len(hits) < total,
        "index": "yard" if use_yard_fts else "bench",
    }


def load_hit(face_id: str, seq: int) -> dict[str, Any]:
    face_id = (face_id or "").strip()
    if not face_id:
        return {"ok": False, "error": "face_id required"}
    try:
        seq = int(seq)
    except (TypeError, ValueError):
        return {"ok": False, "error": "seq required"}
    y = S.yard()
    m = y.execute(
        """
        SELECT chip_id, face_id, seq, role, create_time, text, bag_chip
        FROM messages WHERE face_id=? AND seq=?
        """,
        (face_id, seq),
    ).fetchone()
    if not m:
        return {"ok": False, "error": "message not found"}
    face = y.execute(
        "SELECT testament, face_serial, title, working_title, bag_code FROM faces WHERE face_id=?",
        (face_id,),
    ).fetchone()
    if not face:
        return {"ok": False, "error": "log not found"}
    code = S.log_code(face["testament"], face["face_serial"])
    tn = trunk_n_of(face_id, seq, {})
    text = m["text"] or ""
    clock = format_when_full(m["create_time"])
    g = int(S.gravity_map(face_id).get(seq, 0))
    chip = S.branch_chip(code, tn, seq)
    leaves = S.ensure_message_leaves(face_id, seq, len(text))
    for lf in leaves:
        ln = int(lf.get("leaf_n") or 0)
        lf["chip"] = S.leaf_chip(code, tn, seq, ln)
        lf["chip_short"] = f"L{ln:02d}"
    counts = export_count_map([chip])
    return {
        "ok": True,
        "face_id": face_id,
        "seq": seq,
        "role": m["role"] or "",
        "text": text,
        "log_code": code,
        "log_title": (face["working_title"] or face["title"] or code or "").strip(),
        "bag_code": face["bag_code"] or "",
        "trunk_n": tn,
        "chip": chip,
        "gravity": g,
        "exported": int(counts.get(chip, 0)),
        "leaves": leaves,
        "bag_chip": m["bag_chip"] or "",
        **clock,
    }


def load_around(
    face_id: str, seq: int, before: int = 2, after: int = 2
) -> dict[str, Any]:
    """Lived-order neighbors around a hit. Keyword may be absent on them."""
    face_id = (face_id or "").strip()
    if not face_id:
        return {"ok": False, "error": "face_id required"}
    try:
        seq = int(seq)
        before = int(before)
        after = int(after)
    except (TypeError, ValueError):
        return {"ok": False, "error": "seq, before, after required"}
    before = max(0, min(before, 24))
    after = max(0, min(after, 24))
    start = max(0, seq - before)
    end = seq + after
    units, err = load_face_range(face_id, start, end)
    if err:
        return {"ok": False, "error": err}
    out_units: list[dict[str, Any]] = []
    for u in units:
        text = str(u.get("text") or "")
        peek = re.sub(r"\s+", " ", text).strip()
        if len(peek) > 280:
            peek = peek[:280] + "…"
        out_units.append(
            {
                "face_id": u["face_id"],
                "seq": u["seq"],
                "chip": u["chip"],
                "role": u.get("role") or "",
                "peek": peek,
                "chars": len(text),
                "gravity": int(u.get("gravity") or 0),
                "when": u.get("when") or "",
                "when_full": u.get("when_full") or "",
                "when_iso": u.get("when_iso") or "",
                "create_time": u.get("create_time"),
                "log_code": u.get("log_code") or "",
                "log_title": u.get("log_title") or "",
                "bag_code": u.get("bag_code") or "",
                "trunk_n": u.get("trunk_n") or 1,
                "is_center": int(u["seq"]) == seq,
            }
        )
    return {
        "ok": True,
        "face_id": face_id,
        "seq": seq,
        "before": before,
        "after": after,
        "units": out_units,
    }


def load_face_range(
    face_id: str, start_seq: int, end_seq: int
) -> tuple[list[dict[str, Any]], str]:
    """Lived-order units for a seq range. One yard pass."""
    face_id = (face_id or "").strip()
    if not face_id:
        return [], "face_id required"
    y = S.yard()
    face = y.execute(
        "SELECT testament, face_serial, title, working_title, bag_code FROM faces WHERE face_id=?",
        (face_id,),
    ).fetchone()
    if not face:
        return [], "log not found"
    rows = y.execute(
        """
        SELECT chip_id, face_id, seq, role, create_time, text, bag_chip
        FROM messages
        WHERE face_id=? AND seq>=? AND seq<=?
        ORDER BY seq ASC
        """,
        (face_id, int(start_seq), int(end_seq)),
    ).fetchall()
    if not rows:
        return [], "no messages in range"
    code = S.log_code(face["testament"], face["face_serial"])
    title = (face["working_title"] or face["title"] or code or "").strip()
    grav = S.gravity_map(face_id)
    tcache: dict[str, list[int]] = {}
    units: list[dict[str, Any]] = []
    for m in rows:
        seq = int(m["seq"] if m["seq"] is not None else 0)
        tn = trunk_n_of(face_id, seq, tcache)
        clock = format_when_full(m["create_time"])
        units.append(
            {
                "face_id": face_id,
                "seq": seq,
                "leaf_n": None,
                "kind": "branch",
                "chip": S.branch_chip(code, tn, seq),
                "role": m["role"] or "",
                "text": m["text"] or "",
                "log_code": code,
                "log_title": title,
                "bag_code": face["bag_code"] or "",
                "trunk_n": tn,
                "gravity": int(grav.get(seq, 0)),
                "bag_chip": m["bag_chip"] or "",
                **clock,
            }
        )
    return units, ""


def _collect_units(body: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, str]:
    kind = str(body.get("kind") or "find").strip().lower()
    if kind not in ("find", "branch", "trunk", "log", "leaf"):
        kind = "find"
    y = S.yard()
    units: list[dict[str, Any]] = []

    def add_msg(face_id: str, seq: int, leaf_n: int | None = None) -> str | None:
        hit = load_hit(face_id, seq)
        if not hit.get("ok"):
            return str(hit.get("error") or "load fail")
        text = hit["text"] or ""
        chip = hit["chip"]
        unit_kind = "branch"
        if leaf_n is not None:
            unit_kind = "leaf"
            found = None
            for lf in hit.get("leaves") or []:
                if int(lf.get("leaf_n") or 0) == int(leaf_n):
                    found = lf
                    break
            if not found:
                return f"leaf L{int(leaf_n):02d} not found"
            a = int(found.get("start_off") or 0)
            b = int(found.get("end_off") or 0)
            text = text[a:b]
            chip = found.get("chip") or (chip + f".L{int(leaf_n):02d}")
            g = int(found.get("gravity") or 0)
        else:
            g = int(hit.get("gravity") or 0)
        units.append(
            {
                "face_id": face_id,
                "seq": seq,
                "leaf_n": leaf_n,
                "kind": unit_kind,
                "chip": chip,
                "role": hit.get("role") or "",
                "text": text,
                "log_code": hit.get("log_code") or "",
                "log_title": hit.get("log_title") or "",
                "bag_code": hit.get("bag_code") or "",
                "trunk_n": hit.get("trunk_n") or 1,
                "gravity": g,
                "when": hit.get("when") or "",
                "when_full": hit.get("when_full") or "",
                "when_iso": hit.get("when_iso") or "",
                "create_time": hit.get("create_time"),
                "bag_chip": hit.get("bag_chip") or "",
            }
        )
        return None

    raw_units = body.get("units")
    if isinstance(raw_units, list) and raw_units:
        for u in raw_units:
            if not isinstance(u, dict):
                continue
            fid = str(u.get("face_id") or "").strip()
            if not fid:
                return None, "unit face_id required"
            try:
                seq = int(u.get("seq"))
            except (TypeError, ValueError):
                return None, "unit seq required"
            ln = u.get("leaf_n")
            leaf_n = int(ln) if ln is not None and str(ln) != "" else None
            err = add_msg(fid, seq, leaf_n)
            if err:
                return None, err
        return units, kind

    face_id = str(body.get("face_id") or "").strip()
    if kind == "branch" or kind == "leaf":
        if not face_id:
            return None, "face_id required"
        try:
            seq = int(body.get("seq"))
        except (TypeError, ValueError):
            return None, "seq required"
        ln = body.get("leaf_n") if kind == "leaf" else None
        leaf_n = int(ln) if ln is not None and str(ln) != "" else None
        err = add_msg(face_id, seq, leaf_n)
        if err:
            return None, err
        return units, kind

    if kind == "trunk":
        if not face_id:
            return None, "face_id required"
        max_row = y.execute(
            "SELECT MAX(seq) m FROM messages WHERE face_id=?", (face_id,)
        ).fetchone()
        max_seq = int(max_row["m"] or 0) if max_row and max_row["m"] is not None else 0
        branches = S.branches_for(face_id, max_seq)
        start_seq = body.get("start_seq")
        trunk_n = body.get("trunk_n")
        br = None
        if start_seq is not None and str(start_seq) != "":
            try:
                st = int(start_seq)
            except (TypeError, ValueError):
                return None, "start_seq invalid"
            br = next((b for b in branches if int(b["start_seq"]) == st), None)
        elif trunk_n is not None:
            try:
                tn = int(trunk_n)
            except (TypeError, ValueError):
                return None, "trunk_n invalid"
            br = next(
                (
                    b
                    for b in branches
                    if int(b.get("trunk_n") or b.get("branch_n") or 0) == tn
                ),
                None,
            )
        if not br:
            return None, "trunk not found"
        ranged, err = load_face_range(
            face_id, int(br["start_seq"]), int(br["end_seq"])
        )
        if err:
            return None, err
        return ranged, kind

    if kind == "log":
        if not face_id:
            return None, "face_id required"
        max_row = y.execute(
            "SELECT MAX(seq) m FROM messages WHERE face_id=?", (face_id,)
        ).fetchone()
        max_seq = int(max_row["m"] or 0) if max_row and max_row["m"] is not None else 0
        ranged, err = load_face_range(face_id, 0, max_seq)
        if err:
            return None, err
        return ranged, kind

    return None, "units required"


def render_markdown(
    *,
    cxr: str,
    title: str,
    keyword: str,
    kind: str,
    units: list[dict[str, Any]],
) -> str:
    chips = [u["chip"] for u in units if u.get("chip")]
    chips_line = ", ".join(chips)
    fm = [
        "---",
        f"title: {_fm_value(title or cxr)}",
        "source: glass-compost",
        f"report: {cxr}",
    ]
    if keyword:
        fm.append(f"keyword: {_fm_value(keyword)}")
    if chips_line and len(chips_line) <= FM_CHIPS_MAX:
        fm.append(f"chips: {chips_line}")
    fm.append("---")
    parts = ["\n".join(fm), ""]
    for u in units:
        chip = u.get("chip") or ""
        turn = (u.get("role") or "").strip() or "?"
        g = gravity_word(int(u.get("gravity") or 0))
        bag = (u.get("bag_code") or "").strip()
        when_full = (u.get("when_full") or "").strip()
        when_iso = (u.get("when_iso") or "").strip()
        unix = u.get("create_time")
        unix_s = ""
        if unix is not None:
            try:
                unix_s = f"{float(unix):.6f}"
            except (TypeError, ValueError):
                unix_s = str(unix)
        meta_bits = [f"turn: {turn}", g]
        kicker = " · ".join(x for x in meta_bits if x)
        lines = [f"## ^{chip}", "", kicker]
        if when_full:
            lines.append(f"when: {when_full}")
        if when_iso:
            lines.append(f"iso: {when_iso}")
        if unix_s:
            lines.append(f"unix: {unix_s}")
        if bag:
            lines.append(f"bag: {bag}")
        log_title = (u.get("log_title") or "").strip()
        if log_title:
            lines.append(f"log: {u.get('log_code') or ''} · {log_title}".strip())
        lines.append("")
        text = str(u.get("text") or "")
        lines.append(text.rstrip() + ("\n" if text else ""))
        parts.append("\n".join(lines).rstrip() + "\n")
    return "\n".join(parts).rstrip() + "\n"


def seal_report(body: dict[str, Any]) -> dict[str, Any]:
    units, kind_or_err = _collect_units(body)
    if units is None:
        return {"ok": False, "error": kind_or_err}
    kind = kind_or_err
    title = str(body.get("title") or "").strip()
    keyword = str(body.get("keyword") or "").strip()
    scope = str(body.get("scope") or "").strip()
    face_id = str(body.get("face_id") or "").strip()
    if not title:
        if keyword:
            title = f"find · {keyword}"
        elif kind == "log" and units:
            title = f"log · {units[0].get('log_code') or 'OT'}"
        elif kind == "trunk" and units:
            title = f"trunk · {units[0].get('chip', '').rsplit('.B', 1)[0]}"
        elif units:
            title = units[0].get("chip") or "CXR"
        else:
            title = "CXR"
    cxr = next_cxr()
    md = render_markdown(
        cxr=cxr, title=title, keyword=keyword, kind=kind, units=units
    )
    fname = f"{cxr}.md"
    path = reports_dir() / fname
    path.write_text(md, encoding="utf-8")
    con = S.bench()
    cur = con.execute(
        """
        INSERT INTO reports(cxr, kind, title, keyword, scope, face_id, created, body_path)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (
            cxr,
            kind,
            title,
            keyword,
            scope,
            face_id,
            S.now(),
            str(path),
        ),
    )
    rid = int(cur.lastrowid)
    for u in units:
        con.execute(
            """
            INSERT OR REPLACE INTO report_chips(report_id, chip, face_id, seq, leaf_n, kind)
            VALUES (?,?,?,?,?,?)
            """,
            (
                rid,
                u["chip"],
                u["face_id"],
                int(u["seq"]),
                u.get("leaf_n"),
                u.get("kind") or "branch",
            ),
        )
    con.commit()
    faxed = None
    if body.get("fax"):
        faxed = fax_report(cxr)
    row = report_row(cxr)
    out = {"ok": True, "report": row, "count": len(units)}
    if faxed is not None:
        out["fax"] = faxed
    return out


def report_row(cxr: str) -> dict[str, Any] | None:
    r = S.bench().execute(
        "SELECT * FROM reports WHERE cxr=?", (cxr,)
    ).fetchone()
    if not r:
        return None
    chips = S.bench().execute(
        "SELECT chip, face_id, seq, leaf_n, kind FROM report_chips WHERE report_id=? ORDER BY seq ASC",
        (r["id"],),
    ).fetchall()
    return {
        "id": r["id"],
        "cxr": r["cxr"],
        "kind": r["kind"],
        "title": r["title"] or "",
        "keyword": r["keyword"] or "",
        "scope": r["scope"] or "",
        "face_id": r["face_id"] or "",
        "created": r["created"],
        "faxed": bool(r["faxed"]),
        "faxed_at": r["faxed_at"],
        "fax_path": r["fax_path"] or "",
        "body_path": r["body_path"] or "",
        "chip_count": len(chips),
        "chips": [str(c["chip"]) for c in chips],
    }


def list_reports() -> list[dict[str, Any]]:
    rows = S.bench().execute(
        "SELECT * FROM reports ORDER BY id DESC"
    ).fetchall()
    out = []
    for r in rows:
        n = S.bench().execute(
            "SELECT COUNT(*) c FROM report_chips WHERE report_id=?",
            (r["id"],),
        ).fetchone()
        out.append(
            {
                "id": r["id"],
                "cxr": r["cxr"],
                "kind": r["kind"],
                "title": r["title"] or "",
                "keyword": r["keyword"] or "",
                "created": r["created"],
                "faxed": bool(r["faxed"]),
                "faxed_at": r["faxed_at"],
                "fax_path": r["fax_path"] or "",
                "chip_count": int(n["c"] or 0) if n else 0,
            }
        )
    return out


def read_report_md(cxr: str) -> tuple[dict[str, Any] | None, str]:
    row = report_row(cxr)
    if not row:
        return None, ""
    p = Path(row["body_path"]) if row.get("body_path") else reports_dir() / f"{cxr}.md"
    text = ""
    if p.is_file():
        text = p.read_text(encoding="utf-8", errors="replace")
    return row, text


def fax_report(cxr: str) -> dict[str, Any]:
    cxr = (cxr or "").strip().upper()
    if not cxr.startswith("CXR-"):
        # allow cxr-1 → CXR-001? keep as stored
        pass
    row = S.bench().execute(
        "SELECT * FROM reports WHERE upper(cxr)=?", (cxr.upper(),)
    ).fetchone()
    if not row:
        return {"ok": False, "error": "report not found"}
    src = Path(row["body_path"] or "")
    if not src.is_file():
        src = reports_dir() / f"{row['cxr']}.md"
    if not src.is_file():
        return {"ok": False, "error": "report file missing"}
    dest_dir = shards_dir()
    dest = dest_dir / f"{row['cxr']}.md"
    shutil.copy2(src, dest)
    t = S.now()
    S.bench().execute(
        """
        UPDATE reports SET faxed=1, faxed_at=?, fax_path=?
        WHERE id=?
        """,
        (t, str(dest), row["id"]),
    )
    S.bench().commit()
    return {
        "ok": True,
        "cxr": row["cxr"],
        "fax_path": str(dest),
        "host": "go.glass/shards",
        "faxed_at": t,
    }
