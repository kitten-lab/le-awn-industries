#!/usr/bin/env python3
"""EM Translation Bench. Their database is read. Notes are ours."""

from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SYS = Path(__file__).resolve().parent
BENCH = SYS.parents[1]
DB = BENCH / "base" / "bench.sqlite"
NOTES = BENCH / "notes"
JX_PAPER = BENCH.parents[1] / "charlies-toys" / "sdk-import-station" / "paper" / "jx"
PORT = int(os.environ.get("EMB_PORT", "43174"))
LOCK = threading.Lock()
VERSE_RE = re.compile(r"^Genesis (\d+):(\d+)$")


def note_path(verse: str, index: int | None) -> Path:
    match = VERSE_RE.match(verse.strip())
    if not match:
        raise ValueError("verse looks wrong")
    chapter, verse_n = match.group(1), match.group(2)
    if index is None:
        return NOTES / "line" / f"Genesis-{chapter}-{verse_n}.md"
    return NOTES / "word" / f"Genesis-{chapter}-{verse_n}-{index}.md"


FRAGMENT_KINDS = ("translation", "definition", "consideration", "comparison", "question", "reading")
KIND_RE = re.compile(
    r"^(translation|definition|consideration|comparison|question|reading)(?:\s+([1-5]))?$",
    re.IGNORECASE,
)
SKIP_ENGLISH = {"-", "—", "–", "‐"}


def read_body_text(path: Path) -> tuple[dict[str, str], str]:
    if not path.is_file():
        return {}, ""
    text = path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end >= 0:
            for row in text[3:end].splitlines():
                if ":" in row:
                    key, val = row.split(":", 1)
                    meta[key.strip()] = val.strip().strip('"')
            return meta, text[end + 4 :].lstrip("\n")
    return meta, text


def fragment_heat(raw) -> int:
    try:
        heat = int(raw or 0)
    except (TypeError, ValueError):
        return 0
    return heat if 1 <= heat <= 5 else 0


def read_fragments(path: Path) -> list[dict]:
    _meta, body = read_body_text(path)
    body = body.strip()
    if not body:
        return []
    if not re.search(r"(?m)^### ", body):
        return [{"kind": "reading", "text": body, "heat": 0, "headline": ""}]
    out: list[dict] = []
    for part in re.split(r"(?m)^### ", body):
        part = part.strip()
        if not part:
            continue
        line, _, rest = part.partition("\n")
        match = KIND_RE.match(line.strip())
        if match:
            kind = match.group(1).lower()
            heat = fragment_heat(match.group(2))
        else:
            kind, heat = "reading", 0
        headline = ""
        scope = ""
        lines = rest.splitlines()
        cursor = 0
        while cursor < len(lines) and not lines[cursor].strip():
            cursor += 1
        while cursor < len(lines):
            raw = lines[cursor].strip()
            low = raw.lower()
            if low.startswith("headline:"):
                headline = raw.split(":", 1)[1].strip()
                cursor += 1
                continue
            if low.startswith("scope:"):
                scope = raw.split(":", 1)[1].strip().lower()
                cursor += 1
                continue
            break
        text = "\n".join(lines[cursor:]).strip()
        item = {"kind": kind, "text": text, "heat": heat, "headline": headline}
        if scope in {"position", "strong"}:
            item["scope"] = scope
        out.append(item)
    return out


def fragment_block(frag: dict, with_scope: bool) -> str:
    kind = str(frag.get("kind") or "reading").strip().lower()
    if kind not in FRAGMENT_KINDS:
        kind = "reading"
    text = str(frag.get("text") or "").strip()
    if not text:
        return ""
    heat = fragment_heat(frag.get("heat"))
    headline = " ".join(str(frag.get("headline") or "").split())
    scope = str(frag.get("scope") or "").strip().lower()
    label = kind if heat < 1 else f"{kind} {heat}"
    block = f"### {label}\n"
    wrote_meta = False
    if headline:
        block += f"headline: {headline}\n"
        wrote_meta = True
    if with_scope and scope in {"position", "strong"}:
        block += f"scope: {scope}\n"
        wrote_meta = True
    if wrote_meta:
        block += "\n"
    block += f"{text}\n"
    return block


def write_note(path: Path, verse: str, index: int | None, strong: str, surface: str, fragments: list[dict], weak: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    kind = "line" if index is None else "word"
    head = [
        "---",
        f"kind: {kind}",
        f"verse: {verse}",
        "pen: reading",
    ]
    if index is not None:
        head.append(f"index: {index}")
    if strong:
        head.append(f"strong: {strong}")
    if weak:
        head.append(f"weak: {weak}")
    if surface:
        head.append(f"surface: {json.dumps(surface, ensure_ascii=False)}")
    blocks = [block for frag in fragments if (block := fragment_block(frag, index is not None))]
    head += ["---", "", "\n".join(blocks)]
    path.write_text("\n".join(head), encoding="utf-8")


def strong_note_path(strong: str) -> Path:
    return NOTES / "strong" / f"{strong.upper()}.md"


def apply_scope(frag: dict, strong: str, home: str) -> dict:
    item = dict(frag)
    raw = str(item.get("scope") or "").strip().lower()
    if raw == "position":
        item["scope"] = "position"
    elif raw == "strong" and strong:
        item["scope"] = "strong"
    elif home == "strong" and strong:
        item["scope"] = "strong"
    elif home == "word" and strong:
        item["scope"] = "strong"
    else:
        item["scope"] = "position"
    return item


def gather_following(strong: str) -> list[dict]:
    strong = strong.upper()
    found: list[dict] = []
    seen: set[tuple] = set()

    def add(frag: dict) -> None:
        item = dict(frag)
        item["scope"] = "strong"
        text = str(item.get("text") or "").strip()
        if not text:
            return
        sig = (item.get("kind"), item.get("headline") or "", text, fragment_heat(item.get("heat")))
        if sig in seen:
            return
        seen.add(sig)
        item["text"] = text
        found.append(item)

    path = strong_note_path(strong)
    for frag in read_fragments(path):
        add(frag)
    word_dir = NOTES / "word"
    if word_dir.is_dir():
        for path in sorted(word_dir.glob("Genesis-*.md")):
            meta, _body = read_body_text(path)
            if (meta.get("strong") or "").upper() != strong:
                continue
            for frag in read_fragments(path):
                if apply_scope(frag, strong, "word")["scope"] == "strong":
                    add(frag)
    return found


def word_fragments(verse: str, index: int, strong_hint: str = "") -> dict:
    path = note_path(verse, index)
    meta, _body = read_body_text(path)
    strong = (strong_hint or meta.get("strong") or "").upper()
    position: list[dict] = []
    for frag in read_fragments(path):
        scoped = apply_scope(frag, strong, "word")
        if scoped["scope"] == "position" or not strong:
            scoped["scope"] = "position"
            position.append(scoped)
    following = gather_following(strong) if strong else []
    return {"fragments": following + position, "weak": meta.get("weak", ""), "strong": strong}


def write_strong_note(strong: str, fragments: list[dict]) -> None:
    strong = strong.upper()
    path = strong_note_path(strong)
    blocks = []
    for frag in fragments:
        frag = dict(frag)
        frag["scope"] = "strong"
        block = fragment_block(frag, True)
        if block:
            blocks.append(block)
    if not blocks:
        if path.is_file():
            path.unlink()
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "\n".join(["---", "kind: strong", f"strong: {strong}", "pen: reading", "---", "", "\n".join(blocks)])
    path.write_text(text, encoding="utf-8")


def strip_following_from_words(strong: str) -> None:
    strong = strong.upper()
    word_dir = NOTES / "word"
    if not word_dir.is_dir():
        return
    for path in word_dir.glob("Genesis-*.md"):
        meta, _body = read_body_text(path)
        if (meta.get("strong") or "").upper() != strong:
            continue
        parts = path.stem.split("-")
        if len(parts) < 4:
            continue
        kept = []
        for frag in read_fragments(path):
            if apply_scope(frag, strong, "word")["scope"] == "position":
                frag = dict(frag)
                frag["scope"] = "position"
                kept.append(frag)
        write_note(
            path,
            meta.get("verse") or f"Genesis {parts[1]}:{parts[2]}",
            int(parts[3]),
            strong,
            meta.get("surface", ""),
            kept,
            meta.get("weak", ""),
        )


def chapter_marks(chapter: int) -> dict[str, dict[str, list]]:
    marks: dict[str, dict[str, list]] = {}
    seen: set[tuple] = set()

    def add(key: str, frag: dict) -> None:
        text = str(frag.get("text") or "").strip()
        if not text:
            return
        kind = frag.get("kind") or "reading"
        sig = (key, kind, text, frag.get("headline") or "", fragment_heat(frag.get("heat")))
        if sig in seen:
            return
        seen.add(sig)
        marks.setdefault(key, {}).setdefault(kind, []).append(
            {"text": text, "heat": fragment_heat(frag.get("heat")), "headline": frag.get("headline") or ""}
        )

    word_dir = NOTES / "word"
    if word_dir.is_dir():
        for path in word_dir.glob("Genesis-*.md"):
            parts = path.stem.split("-")
            if len(parts) < 4:
                continue
            meta, _body = read_body_text(path)
            strong = (meta.get("strong") or "").upper()
            for frag in read_fragments(path):
                scoped = apply_scope(frag, strong, "word")
                if scoped["scope"] == "position" and parts[1] == str(chapter):
                    add(f"w:{parts[2]}:{parts[3]}", scoped)
                elif scoped["scope"] == "strong" and strong:
                    add(f"s:{strong}", scoped)
    strong_dir = NOTES / "strong"
    if strong_dir.is_dir():
        for path in strong_dir.glob("*.md"):
            for frag in read_fragments(path):
                add(f"s:{path.stem.upper()}", frag)
    line_dir = NOTES / "line"
    prefix = f"Genesis-{chapter}-"
    if line_dir.is_dir():
        for path in line_dir.glob(prefix + "*.md"):
            parts = path.stem.split("-")
            if len(parts) < 3:
                continue
            for frag in read_fragments(path):
                add(f"l:{parts[-1]}", frag)
    return marks


def journal_dir() -> Path:
    path = NOTES / "journal"
    path.mkdir(parents=True, exist_ok=True)
    return path


def cabinet_folder(raw: str) -> str:
    folder = (raw or "_root").strip().replace("\\", "/").strip("/")
    parts = [part for part in folder.split("/") if part and part != "."]
    if not parts or any(part == ".." for part in parts):
        return "_root"
    return "/".join(parts)


def cabinet_stem(raw: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", (raw or "").strip()).strip(".-")
    return stem[:80]


def find_cabinet(stem: str) -> Path | None:
    stem = cabinet_stem(stem)
    if not stem:
        return None
    root = journal_dir()
    direct = list(root.rglob(stem + ".md"))
    return direct[0] if direct else None


def cabinet_entry(path: Path, with_body: bool = False) -> dict:
    meta, body = read_body_text(path)
    text = body.replace("\r\n", "\n")
    rel = path.relative_to(journal_dir())
    folder = cabinet_folder(meta.get("folder") or str(rel.parent))
    try:
        rev = int(meta.get("rev") or 1)
    except ValueError:
        rev = 1
    item = {
        "stem": meta.get("stem") or path.stem,
        "title": meta.get("title") or path.stem,
        "folder": folder,
        "tags": meta.get("tags", ""),
        "rev": rev,
        "verse": meta.get("verse", ""),
        "chapter": meta.get("chapter", ""),
        "index": meta.get("index", ""),
        "preview": text.strip()[:160],
        "mtime": path.stat().st_mtime,
    }
    if with_body:
        item["body"] = text
    return item


def import_jx_cabinet() -> None:
    if not JX_PAPER.is_dir():
        return
    have = {path.stem for path in journal_dir().rglob("*.md")}
    for path in JX_PAPER.rglob("*.fk.json"):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        head = doc.get("head") or {}
        stem = cabinet_stem(str(doc.get("stem") or path.name[: -len(".fk.json")]))
        if not stem or stem in have:
            continue
        have.add(stem)
        save_cabinet(
            stem=stem,
            title=str(head.get("title") or stem),
            body=str(head.get("body") or "").replace("\r\n", "\n"),
            folder=str(doc.get("folder") or "_root"),
            tags=str(head.get("tags_raw") or ""),
            verse="",
            chapter="",
            index="",
            rev=int(head.get("rev") or 1),
            bump=False,
        )


def list_journal() -> list[dict]:
    import_jx_cabinet()
    items = [cabinet_entry(path) for path in journal_dir().rglob("*.md")]
    items.sort(key=lambda row: (-(row.get("mtime") or 0), row.get("title") or ""))
    return items


def read_cabinet(stem: str) -> dict | None:
    import_jx_cabinet()
    path = find_cabinet(stem)
    if path is None:
        return None
    return cabinet_entry(path, with_body=True)


def save_cabinet(
    stem: str | None,
    title: str,
    body: str,
    folder: str,
    tags: str,
    verse: str,
    chapter: str,
    index: str,
    rev: int | None = None,
    bump: bool = True,
) -> dict:
    title = (title or "").strip() or "untitled"
    body = (body or "").replace("\r\n", "\n")
    folder = cabinet_folder(folder)
    tags = (tags or "").strip()
    existing = find_cabinet(stem) if stem else None
    if existing is not None:
        meta, _old = read_body_text(existing)
        stem = cabinet_stem(meta.get("stem") or existing.stem)
        try:
            current = int(meta.get("rev") or 1)
        except ValueError:
            current = 1
        rev = current + 1 if bump else (rev or current)
        if not verse:
            verse = meta.get("verse", "")
        if not chapter:
            chapter = meta.get("chapter", "")
        if not index:
            index = meta.get("index", "")
        if not tags:
            tags = meta.get("tags", "")
    else:
        if not stem:
            slug = "-".join(re.findall(r"[A-Za-z0-9]+", title.lower())[:6]) or "brief"
            stem = cabinet_stem(f"JX-{slug}-{secrets.token_hex(3)}")
        else:
            stem = cabinet_stem(stem)
        rev = rev or 1
    dest = journal_dir() / folder / f"{stem}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "---",
        "kind: journal",
        f"stem: {stem}",
        f"title: {json.dumps(title, ensure_ascii=False)}",
        f"folder: {folder}",
        f"tags: {json.dumps(tags, ensure_ascii=False)}",
        f"rev: {rev}",
        f"chapter: {chapter}",
        f"verse: {verse}",
        f"index: {index}",
        "---",
        "",
        body.rstrip() + "\n",
    ]
    dest.write_text("\n".join(lines), encoding="utf-8")
    if existing is not None and existing.resolve() != dest.resolve() and existing.is_file():
        existing.unlink()
    return cabinet_entry(dest, with_body=True)


def mint_dir() -> Path:
    path = NOTES / "mint"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_weaks() -> list[dict]:
    items: list[dict] = []
    word_dir = NOTES / "word"
    if word_dir.is_dir():
        for path in word_dir.glob("Genesis-*.md"):
            meta, _body = read_body_text(path)
            weak = meta.get("weak", "").strip()
            if not weak:
                continue
            parts = path.stem.split("-")
            if len(parts) < 4:
                continue
            items.append(
                {
                    "weak": weak,
                    "surface": meta.get("surface", ""),
                    "verse": meta.get("verse", ""),
                    "chapter": parts[1],
                    "verse_n": parts[2],
                    "index": parts[3],
                    "where": "verse",
                }
            )
    for path in mint_dir().glob("*.md"):
        meta, _body = read_body_text(path)
        items.append(
            {
                "weak": meta.get("weak", ""),
                "surface": meta.get("surface", ""),
                "title": meta.get("title", ""),
                "id": path.stem,
                "where": "mint",
            }
        )
    items.sort(key=lambda row: row.get("weak", ""))
    return items


def write_mint(weak: str, surface: str, title: str) -> dict:
    from datetime import datetime

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = mint_dir() / f"{stamp}.md"
    lines = [
        "---",
        "kind: mint",
        f"weak: {weak.strip()}",
        f"surface: {json.dumps(surface.strip(), ensure_ascii=False)}",
        f"title: {json.dumps(title.strip(), ensure_ascii=False)}",
        "---",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
    return {"id": path.stem, "weak": weak.strip(), "surface": surface.strip(), "title": title.strip(), "where": "mint"}


def verse_english(words: list[dict]) -> str:
    ordered = sorted(words, key=lambda word: (word.get("bsb_sort") or 0, word.get("i") or 0))
    parts = []
    for word in ordered:
        english = (word.get("english") or "").strip()
        if not english or english in SKIP_ENGLISH:
            continue
        parts.append(english)
    return " ".join(parts)


def chapter_payload(chapter: int) -> dict:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    verses = []
    current = None
    rows = conn.execute(
        """
        SELECT t.verse, t.surface, t.translit, t.strong, t.english, t.language,
               t.parsing, t.parsing_full, t.bsb_sort, s.lemma
        FROM tokens t
        LEFT JOIN strongs s ON s.id = t.strong
        WHERE t.chapter = ?
        ORDER BY t.verse, t.heb_sort
        """,
        (chapter,),
    )
    for row in rows:
        if current is None or current["verse"] != row["verse"]:
            current = {"verse": row["verse"], "words": []}
            verses.append(current)
        current["words"].append(
            {
                "i": len(current["words"]),
                "surface": row["surface"],
                "translit": row["translit"] or "",
                "strong": row["strong"] or "",
                "english": row["english"] or "",
                "lemma": row["lemma"] or "",
                "language": row["language"] or "",
                "parsing": row["parsing"] or "",
                "parsing_full": row["parsing_full"] or "",
                "bsb_sort": row["bsb_sort"] or 0,
            }
        )
    for verse in verses:
        verse["english"] = verse_english(verse["words"])
        for word in verse["words"]:
            word.pop("bsb_sort", None)
    conn.close()
    return {"book": "Genesis", "chapter": chapter, "verses": verses}


def connect():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def strong_payload(strong_id: str) -> dict | None:
    conn = connect()
    row = conn.execute("SELECT * FROM strongs WHERE id = ?", (strong_id,)).fetchone()
    if row is None:
        conn.close()
        return None
    payload = {key: row[key] or "" for key in row.keys()}
    payload["uses"] = [
        {
            "chapter": u["chapter"],
            "verse": u["verse"],
            "surface": u["surface"],
            "english": u["english"] or "",
        }
        for u in conn.execute(
            """
            SELECT chapter, verse, surface, english, translit, parsing_full
            FROM tokens WHERE strong = ?
            ORDER BY chapter, verse, heb_sort
            """,
            (strong_id,),
        )
    ]
    conn.close()
    return payload


LEX_COLS = """id, lemma, xlit, (SELECT COUNT(*) FROM tokens t WHERE t.strong = strongs.id) AS uses"""


def lex_entry(row) -> dict:
    item = {}
    for key in row.keys():
        value = row[key]
        item[key] = "" if value is None else value
    return item


def lexicon_payload(order: str, around: str, query: str, span: int, direction: str = "center", used: bool = False) -> dict:
    conn = connect()
    span = max(5, min(40, span))
    gate = " AND EXISTS (SELECT 1 FROM tokens t WHERE t.strong = strongs.id)" if used else ""
    if query:
        like = f"%{query}%"
        rows = conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE (id LIKE ? OR lemma LIKE ? OR xlit LIKE ? OR meaning LIKE ? OR usage LIKE ?){gate}
            ORDER BY CAST(substr(id, 2) AS INTEGER)
            LIMIT 60
            """,
            (like, like, like, like, like),
        ).fetchall()
        conn.close()
        return {"order": order, "entries": [lex_entry(r) for r in rows]}
    if direction == "next" and order != "alpha":
        number = int(around[1:]) if len(around) > 1 and around[1:].isdigit() else 0
        rows = conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE CAST(substr(id, 2) AS INTEGER) > ?{gate}
            ORDER BY CAST(substr(id, 2) AS INTEGER) LIMIT ?
            """,
            (number, span),
        ).fetchall()
        conn.close()
        return {"order": order, "entries": [lex_entry(r) for r in rows]}
    if direction == "prev" and order != "alpha":
        number = int(around[1:]) if len(around) > 1 and around[1:].isdigit() else 1
        rows = list(reversed(conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE CAST(substr(id, 2) AS INTEGER) < ?{gate}
            ORDER BY CAST(substr(id, 2) AS INTEGER) DESC LIMIT ?
            """,
            (number, span),
        ).fetchall()))
        conn.close()
        return {"order": order, "entries": [lex_entry(r) for r in rows]}
    if order == "alpha" and direction in {"next", "prev"}:
        center = conn.execute("SELECT lemma FROM strongs WHERE id = ?", (around,)).fetchone()
        lemma = center["lemma"] if center else ""
        if direction == "next":
            rows = conn.execute(
                f"""
                SELECT {LEX_COLS} FROM strongs
                WHERE (lemma > ? OR (lemma = ? AND id > ?)){gate}
                ORDER BY lemma, id LIMIT ?
                """,
                (lemma, lemma, around, span),
            ).fetchall()
        else:
            rows = list(reversed(conn.execute(
                f"""
                SELECT {LEX_COLS} FROM strongs
                WHERE (lemma < ? OR (lemma = ? AND id < ?)){gate}
                ORDER BY lemma DESC, id DESC LIMIT ?
                """,
                (lemma, lemma, around, span),
            ).fetchall()))
        conn.close()
        return {"order": order, "entries": [lex_entry(r) for r in rows]}
    if order == "alpha":
        center = conn.execute("SELECT lemma FROM strongs WHERE id = ?", (around,)).fetchone()
        lemma = center["lemma"] if center else ""
        before = conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE (lemma < ? OR (lemma = ? AND id < ?)){gate}
            ORDER BY lemma DESC, id DESC LIMIT ?
            """,
            (lemma, lemma, around, span),
        ).fetchall()
        after = conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE (lemma > ? OR (lemma = ? AND id >= ?)){gate}
            ORDER BY lemma, id LIMIT ?
            """,
            (lemma, lemma, around, span + 1),
        ).fetchall()
        rows = list(reversed(before)) + list(after)
    else:
        number = int(around[1:]) if len(around) > 1 and around[1:].isdigit() else 1
        before = conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE CAST(substr(id, 2) AS INTEGER) < ?{gate}
            ORDER BY CAST(substr(id, 2) AS INTEGER) DESC LIMIT ?
            """,
            (number, span),
        ).fetchall()
        after = conn.execute(
            f"""
            SELECT {LEX_COLS} FROM strongs
            WHERE CAST(substr(id, 2) AS INTEGER) >= ?{gate}
            ORDER BY CAST(substr(id, 2) AS INTEGER) LIMIT ?
            """,
            (number, span + 1),
        ).fetchall()
        rows = list(reversed(before)) + list(after)
    conn.close()
    return {"order": order, "entries": [lex_entry(r) for r in rows]}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def send_json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def file(self, path: Path, ctype: str) -> None:
        if not path.is_file():
            self.send_error(404)
            return
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path == "/api/health":
            self.send_json(200, {"ok": True, "sku": "CO.LEA-004-EMB", "db": DB.is_file(), "rev": 2})
            return
        if url.path == "/api/chapter":
            qs = parse_qs(url.query)
            chapter = int((qs.get("n") or ["1"])[0])
            chapter = max(1, min(50, chapter))
            self.send_json(200, chapter_payload(chapter))
            return
        if url.path == "/api/lexicon":
            qs = parse_qs(url.query)
            order = (qs.get("order") or ["num"])[0]
            if order not in {"num", "alpha"}:
                order = "num"
            around = (qs.get("around") or ["H1"])[0].upper()
            query = (qs.get("q") or [""])[0].strip()
            span = int((qs.get("span") or ["40"])[0])
            direction = (qs.get("dir") or ["center"])[0]
            if direction not in {"center", "next", "prev"}:
                direction = "center"
            used = (qs.get("used") or ["0"])[0] == "1"
            self.send_json(200, lexicon_payload(order, around, query, span, direction, used))
            return
        if url.path.startswith("/api/strong/"):
            strong_id = url.path.rsplit("/", 1)[-1].upper()
            found = strong_payload(strong_id)
            if found is None:
                self.send_json(404, {"error": "no such entry"})
                return
            self.send_json(200, found)
            return
        if url.path == "/api/note":
            qs = parse_qs(url.query)
            verse = (qs.get("verse") or [""])[0]
            index = (qs.get("index") or [""])[0]
            try:
                path = note_path(verse, int(index) if index != "" else None)
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            strong_hint = (qs.get("strong") or [""])[0]
            if index == "":
                meta, _body = read_body_text(path)
                self.send_json(200, {"fragments": read_fragments(path), "weak": meta.get("weak", "")})
                return
            self.send_json(200, word_fragments(verse, int(index), strong_hint))
            return
        if url.path == "/api/marks":
            qs = parse_qs(url.query)
            chapter = int((qs.get("chapter") or ["1"])[0])
            self.send_json(200, {"marks": chapter_marks(chapter)})
            return
        if url.path == "/api/weaks":
            self.send_json(200, {"items": list_weaks()})
            return
        if url.path == "/api/journal":
            qs = parse_qs(url.query)
            stem = (qs.get("stem") or [""])[0]
            if stem:
                doc = read_cabinet(stem)
                if doc is None:
                    self.send_json(404, {"error": "no such paper"})
                    return
                self.send_json(200, doc)
                return
            self.send_json(200, {"entries": list_journal()})
            return
        if url.path in {"/", "/index.html"}:
            self.file(SYS / "index.html", "text/html; charset=utf-8")
            return
        if url.path == "/app.js":
            self.file(SYS / "app.js", "text/javascript; charset=utf-8")
            return
        if url.path == "/app.css":
            self.file(SYS / "app.css", "text/css; charset=utf-8")
            return
        self.send_error(404)

    def do_PUT(self) -> None:
        url = urlparse(self.path)
        body = self.read_body()
        if url.path == "/api/mint":
            weak = str(body.get("weak") or "").strip()
            surface = str(body.get("surface") or "").strip()
            if not weak or not surface:
                self.send_json(400, {"error": "need a weak number and the letters"})
                return
            with LOCK:
                item = write_mint(weak, surface, str(body.get("title") or ""))
            self.send_json(200, {"item": item})
            return
        if url.path == "/api/journal":
            stem = str(body.get("stem") or "").strip() or None
            with LOCK:
                entry = save_cabinet(
                    stem,
                    str(body.get("title") or ""),
                    str(body.get("body") if body.get("body") is not None else body.get("text") or ""),
                    str(body.get("folder") or "_root"),
                    str(body.get("tags") or ""),
                    str(body.get("verse") or ""),
                    str(body.get("chapter") or ""),
                    "" if body.get("index") is None else str(body.get("index")),
                )
            self.send_json(200, {"entry": entry})
            return
        if url.path != "/api/note":
            self.send_error(404)
            return
        verse = str(body.get("verse") or "")
        raw_index = body.get("index")
        index = None if raw_index is None or raw_index == "" else int(raw_index)
        fragments = body.get("fragments")
        if not isinstance(fragments, list):
            fragments = [{"kind": "reading", "text": str(body.get("text") or "")}]
        try:
            path = note_path(verse, index)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return
        strong = str(body.get("strong") or "").upper()
        weak = str(body.get("weak") or "")
        surface = str(body.get("surface") or "")
        with LOCK:
            if index is None or not strong:
                write_note(path, verse, index, strong, surface, fragments, weak)
            else:
                position = []
                following = []
                for frag in fragments:
                    if not isinstance(frag, dict):
                        continue
                    scoped = apply_scope(frag, strong, "word")
                    if str(frag.get("scope") or "").strip().lower() == "position":
                        scoped["scope"] = "position"
                        position.append(scoped)
                    else:
                        scoped["scope"] = "strong"
                        following.append(scoped)
                write_note(path, verse, index, strong, surface, position, weak)
                write_strong_note(strong, following)
                strip_following_from_words(strong)
        self.send_json(200, {"ok": True})


def main() -> None:
    if not DB.is_file():
        raise SystemExit(f"missing {DB} — run build_base.py")
    NOTES.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"EM Translation Bench · CO.LEA-004-EMB · http://127.0.0.1:{PORT}/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
