#!/usr/bin/env python3
"""Read the Berean table once. Keep Genesis and Strong's. Their files stay put."""

from __future__ import annotations

import csv
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path

BENCH = Path(__file__).resolve().parents[2]
BASE = BENCH / "base"
TSV = BASE / "bsb_tables.tsv"
XML = BASE / "HebrewStrong.xml"
DB = BASE / "bench.sqlite"


def strong_id(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    if raw[0] in "HhGg":
        return raw.upper()
    return "H" + raw


def build() -> None:
    if not TSV.is_file():
        raise SystemExit(f"missing {TSV}")
    if DB.exists():
        DB.unlink()
    conn = sqlite3.connect(DB)
    conn.executescript(
        """
        CREATE TABLE tokens (
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            heb_sort REAL NOT NULL,
            bsb_sort REAL NOT NULL,
            surface TEXT NOT NULL,
            translit TEXT,
            strong TEXT,
            english TEXT,
            language TEXT,
            parsing TEXT,
            parsing_full TEXT
        );
        CREATE INDEX tokens_cv ON tokens (chapter, verse, heb_sort);
        CREATE INDEX tokens_strong ON tokens (strong);
        CREATE TABLE strongs (
            id TEXT PRIMARY KEY,
            lemma TEXT,
            xlit TEXT,
            pron TEXT,
            source TEXT,
            meaning TEXT,
            usage TEXT
        );
        """
    )
    rows = []
    current = None
    with TSV.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        next(reader)
        for cols in reader:
            if len(cols) < 19:
                continue
            vid = cols[12].strip()
            if vid.startswith("Genesis "):
                chapter_s, verse_s = vid.split(" ", 1)[1].split(":")
                current = (int(chapter_s), int(verse_s))
            elif vid and not vid.startswith("Genesis"):
                current = None
            if current is None:
                continue
            surface = cols[5].strip()
            if not surface:
                continue
            rows.append(
                (
                    current[0],
                    current[1],
                    float(cols[0] or 0),
                    float(cols[2] or 0),
                    surface,
                    cols[7].strip(),
                    strong_id(cols[10]),
                    cols[18].strip(),
                    cols[4].strip(),
                    cols[8].strip(),
                    cols[9].strip(),
                )
            )
    conn.executemany(
        "INSERT INTO tokens (chapter, verse, heb_sort, bsb_sort, surface, translit, strong, english, language, parsing, parsing_full) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        rows,
    )
    if XML.is_file():
        NS = "{http://openscriptures.github.com/morphhb/namespace}"
        tree = ET.parse(XML)
        strong_rows = []
        for entry in tree.getroot().iter(NS + "entry"):
            eid = entry.get("id") or ""
            w = entry.find(NS + "w")
            def text_of(tag: str) -> str:
                node = entry.find(NS + tag)
                if node is None:
                    return ""
                return "".join(node.itertext()).strip()
            strong_rows.append(
                (
                    eid,
                    ("".join(w.itertext()).strip() if w is not None else ""),
                    (w.get("xlit") if w is not None else "") or "",
                    (w.get("pron") if w is not None else "") or "",
                    text_of("source"),
                    text_of("meaning"),
                    text_of("usage"),
                )
            )
        conn.executemany(
            "INSERT INTO strongs (id, lemma, xlit, pron, source, meaning, usage) VALUES (?,?,?,?,?,?,?)",
            strong_rows,
        )
    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM tokens").fetchone()[0]
    chapters = conn.execute("SELECT COUNT(DISTINCT chapter) FROM tokens").fetchone()[0]
    conn.close()
    print(f"Genesis tokens {count} across {chapters} chapters → {DB}")


if __name__ == "__main__":
    build()
