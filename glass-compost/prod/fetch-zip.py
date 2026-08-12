#!/usr/bin/env python3
"""
Glass Compost · ZIP lookup

Hand a cite like a leaf number:

  python fetch-zip.py OT-093.T01.B011
  python fetch-zip.py OT-093.T01.B011 --json
  python fetch-zip.py OT-093              # bag face only
  python fetch-zip.py OT-093.T01.B011.L01 # leaf slice if chipped in bench

ZIP grammar (Glass Compost):
  OT-093           log / bag (testament + face_serial)
  .T01             trunk (hand-cut pocket; T01 = first / whole until cuts)
  .B011            branch = message seq (0-based in yard, printed B000…)
  .L02             optional leaf bit inside a fat message (bench.db cuts)

Same mountain as the cut room: yard.db (messages) + bench.db (hand cuts / leaves).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
BENCH_DB = PROD / "bench_sys" / "store" / "bench.db"
_DEFAULT_YARD = Path(
    r"C:\Builds\_mausoleum\alice-box-exiles\nim-data-forestry\prod\yard_sys\store\yard.db"
)
YARD_DB = Path(os.environ.get("GLASS_COMPOST_YARD_DB", str(_DEFAULT_YARD)))

# OT-093 · OT-093.T01 · OT-093.T01.B011 · OT-093.T01.B011.L02
# also tolerate 056-OT-093 bag_code prefix noise
ZIP_RE = re.compile(
    r"""
    ^\s*
    (?:(?P<import>\d{1,4})-)?          # optional import-order prefix
    (?P<testament>[A-Za-z]+)-(?P<serial>\d{1,4})
    (?:\.T(?P<trunk>\d{1,3}))?
    (?:\.B(?P<branch>\d{1,4}))?
    (?:\.L(?P<leaf>\d{1,3}))?
    \s*$
    """,
    re.VERBOSE | re.IGNORECASE,
)


def parse_zip(raw: str) -> dict:
    s = (raw or "").strip()
    m = ZIP_RE.match(s)
    if not m:
        raise SystemExit(
            f"not a glass ZIP: {raw!r}\n"
            "  try: OT-093 · OT-093.T01.B011 · OT-093.T01.B011.L01"
        )
    return {
        "raw": s,
        "testament": m.group("testament").upper(),
        "serial": int(m.group("serial")),
        "trunk": int(m.group("trunk")) if m.group("trunk") is not None else None,
        "branch": int(m.group("branch")) if m.group("branch") is not None else None,
        "leaf": int(m.group("leaf")) if m.group("leaf") is not None else None,
        "log": f"{m.group('testament').upper()}-{int(m.group('serial')):03d}",
    }


def connect_ro(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SystemExit(f"missing db: {path}")
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def find_face(y: sqlite3.Connection, testament: str, serial: int) -> sqlite3.Row:
    # preferred: face_serial + testament match
    row = y.execute(
        """
        SELECT face_id, title, working_title, bag_code, glass_id, face_serial,
               testament, msg_count, create_date_utc, display_line, import_order
        FROM faces
        WHERE face_serial = ?
          AND UPPER(COALESCE(testament, '')) = ?
        LIMIT 1
        """,
        (serial, testament),
    ).fetchone()
    if row:
        return row
    # bag_code like 056-OT-093
    row = y.execute(
        """
        SELECT face_id, title, working_title, bag_code, glass_id, face_serial,
               testament, msg_count, create_date_utc, display_line, import_order
        FROM faces
        WHERE bag_code LIKE ?
           OR bag_code = ?
        LIMIT 1
        """,
        (f"%-{testament}-{serial:03d}", f"{testament}-{serial:03d}"),
    ).fetchone()
    if row:
        return row
    # last resort: serial only (OT mountain is unique enough for hand-off)
    row = y.execute(
        """
        SELECT face_id, title, working_title, bag_code, glass_id, face_serial,
               testament, msg_count, create_date_utc, display_line, import_order
        FROM faces
        WHERE face_serial = ?
        LIMIT 1
        """,
        (serial,),
    ).fetchone()
    if row:
        return row
    raise SystemExit(f"no bag for {testament}-{serial:03d}")


def fetch(zip_raw: str) -> dict:
    z = parse_zip(zip_raw)
    y = connect_ro(YARD_DB)
    face = find_face(y, z["testament"], z["serial"])
    out: dict = {
        "zip": z["raw"],
        "log": z["log"],
        "face_id": face["face_id"],
        "title": face["title"],
        "working_title": face["working_title"],
        "bag_code": face["bag_code"],
        "msg_count": face["msg_count"],
        "create_date_utc": face["create_date_utc"],
        "display_line": face["display_line"],
        "yard_db": str(YARD_DB),
    }

    if z["branch"] is None:
        out["kind"] = "log"
        return out

    seq = z["branch"]
    msg = y.execute(
        """
        SELECT chip_id, face_id, seq, role, create_time, text, bag_chip, summary
        FROM messages
        WHERE face_id = ? AND seq = ?
        LIMIT 1
        """,
        (face["face_id"], seq),
    ).fetchone()
    if not msg:
        raise SystemExit(
            f"{z['log']}.B{seq:03d} not found · bag has seq 0..{int(face['msg_count'] or 1) - 1}"
        )

    branch_zip = f"{z['log']}.T{(z['trunk'] or 1):02d}.B{seq:03d}"
    out.update(
        {
            "kind": "branch",
            "trunk": z["trunk"] or 1,
            "seq": seq,
            "branch_zip": branch_zip,
            "role": msg["role"],
            "create_time": msg["create_time"],
            "bag_chip": msg["bag_chip"],
            "chip_id": msg["chip_id"],
            "chars": len(msg["text"] or ""),
            "text": msg["text"] or "",
            "summary": msg["summary"],
        }
    )

    if z["leaf"] is None:
        return out

    # optional leaf from bench hand-cuts
    leaf_n = z["leaf"]
    if not BENCH_DB.is_file():
        out["leaf_note"] = "bench.db missing · full message returned"
        return out
    b = connect_ro(BENCH_DB)
    # msg_leaves table? check schema from server — leaves in bench
    tables = {
        r[0]
        for r in b.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    leaf_row = None
    if "msg_leaves" in tables:
        leaf_row = b.execute(
            """
            SELECT seq, leaf_n, start_off, end_off, title, note, gravity
            FROM msg_leaves
            WHERE face_id = ? AND seq = ? AND leaf_n = ?
            LIMIT 1
            """,
            (face["face_id"], seq, leaf_n),
        ).fetchone()
    text = msg["text"] or ""
    if leaf_row:
        a, c = int(leaf_row["start_off"]), int(leaf_row["end_off"])
        slice_txt = text[a:c]
        out.update(
            {
                "kind": "leaf",
                "leaf_n": leaf_n,
                "leaf_zip": f"{branch_zip}.L{leaf_n:02d}",
                "start_off": a,
                "end_off": c,
                "leaf_title": leaf_row["title"],
                "leaf_note": leaf_row["note"],
                "text": slice_txt,
                "chars": len(slice_txt),
            }
        )
    else:
        out.update(
            {
                "kind": "leaf",
                "leaf_n": leaf_n,
                "leaf_zip": f"{branch_zip}.L{leaf_n:02d}",
                "leaf_note": "no bench cut for this L · full branch text kept",
            }
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Glass Compost ZIP → message (like leaf[n])")
    ap.add_argument("zip", help="OT-093.T01.B011")
    ap.add_argument("--json", action="store_true", help="machine dump")
    ap.add_argument(
        "--max",
        type=int,
        default=0,
        help="truncate text to N chars (0 = full)",
    )
    args = ap.parse_args()
    data = fetch(args.zip)
    if args.max and data.get("text"):
        t = data["text"]
        if len(t) > args.max:
            data["text"] = t[: args.max] + f"\n… [{len(t) - args.max} more chars]"
            data["truncated"] = True
    if args.json:
        json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return

    # human card
    print(data.get("branch_zip") or data.get("leaf_zip") or data["log"])
    print(
        f"  bag  {data.get('bag_code') or data['log']} · {data.get('title') or ''}"
    )
    if data.get("working_title"):
        print(f"  work {data['working_title'][:100]}")
    if data.get("create_date_utc"):
        print(f"  when {data['create_date_utc']} · {data.get('msg_count')} msgs")
    if data.get("kind") in ("branch", "leaf"):
        print(
            f"  turn {data.get('role')} · seq {data.get('seq')} · {data.get('chars')}c"
        )
        if data.get("bag_chip"):
            print(f"  yard {data['bag_chip']}")
        print("---")
        print(data.get("text") or "")
    else:
        print(f"  face {data.get('face_id')}")
        if data.get("display_line"):
            print(f"  line {data['display_line']}")


if __name__ == "__main__":
    main()
