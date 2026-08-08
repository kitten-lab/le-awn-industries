#!/usr/bin/env python3
"""
Jack's Concor · CO.JX-001-CONCOR
Desk concordance + Cab (FileKeeper papers on station jx).
"""

from __future__ import annotations

import json
import re
import secrets
import sys
import time
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "store.json"
# concor_sys → prod → the-concor → jacks-cross → ALICE_BOX
ALICE_BOX = ROOT.parents[3]
JX_PAPER = ALICE_BOX / "charlies-toys" / "sdk-import-station" / "paper" / "jx"
HOST = "127.0.0.1"
PORT = 43150


def load_store() -> dict[str, Any]:
    if not DATA.is_file():
        return {
            "schema": "concor.v1",
            "sku": "CO.JX-001-CONCOR",
            "title": "Jack's Concor",
            "letters": [],
            "words": [],
            "lines": [],
            "books": [],
            "papers": [],
            "desk": {"books_on_table": [], "next_z": 10},
        }
    return json.loads(DATA.read_text(encoding="utf-8"))


def save_store(doc: dict[str, Any]) -> None:
    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(
        json.dumps(doc, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def ensure_jx_root() -> Path:
    root = JX_PAPER / "_root"
    root.mkdir(parents=True, exist_ok=True)
    return root


def slug_bits(title: str) -> str:
    words = re.findall(r"[a-zA-Z0-9]+", (title or "brief").lower())
    base = "-".join(words[:6]) if words else "brief"
    return base[:48]


def list_fk_papers() -> list[dict[str, Any]]:
    ensure_jx_root()
    out: list[dict[str, Any]] = []
    if not JX_PAPER.is_dir():
        return out
    for path in sorted(JX_PAPER.rglob("*.fk.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        head = doc.get("head") or {}
        rel = path.relative_to(JX_PAPER)
        folder = str(rel.parent).replace("\\", "/")
        if folder == ".":
            folder = "_root"
        out.append(
            {
                "stem": doc.get("stem") or path.stem,
                "folder": doc.get("folder") or folder,
                "path": str(rel).replace("\\", "/"),
                "title": head.get("title") or path.stem,
                "rev": head.get("rev") or 1,
                "tags_raw": head.get("tags_raw") or "",
                "saved_at": head.get("saved_at") or 0,
                "preview": (head.get("body") or "")[:160],
            }
        )
    out.sort(key=lambda r: (-(r.get("saved_at") or 0), r.get("title") or ""))
    return out


def find_fk_path(stem: str) -> Path | None:
    ensure_jx_root()
    for path in JX_PAPER.rglob("*.fk.json"):
        if path.stem == stem or path.name == stem or path.name == f"{stem}.fk.json":
            return path
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            if doc.get("stem") == stem:
                return path
        except Exception:
            continue
    return None


def load_fk(stem: str) -> dict[str, Any] | None:
    path = find_fk_path(stem)
    if not path:
        return None
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["_path"] = str(path.relative_to(JX_PAPER)).replace("\\", "/")
    return doc


def save_fk(
    *,
    stem: str | None,
    title: str,
    body: str,
    folder: str,
    tags_raw: str,
) -> dict[str, Any]:
    ensure_jx_root()
    folder = (folder or "_root").strip().replace("\\", "/").strip("/")
    if ".." in folder or folder.startswith("/"):
        folder = "_root"
    now = int(time.time())
    event_raw = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    title = (title or "untitled").strip() or "untitled"
    body = body if body is not None else ""
    tags_raw = tags_raw or ""

    existing_path = find_fk_path(stem) if stem else None
    if existing_path and existing_path.is_file():
        doc = json.loads(existing_path.read_text(encoding="utf-8"))
        revs = list(doc.get("revisions") or [])
        old_head = doc.get("head") or {}
        # keep prior head in revisions if not already last
        if old_head and not any(
            r.get("rev") == old_head.get("rev")
            and r.get("saved_at") == old_head.get("saved_at")
            for r in revs
        ):
            revs.append(dict(old_head))
        new_rev = int(old_head.get("rev") or 0) + 1
        stem_s = doc.get("stem") or existing_path.stem
        head = {
            "c_uid": f"{stem_s}-r{new_rev}",
            "title": title,
            "body": body.replace("\r\n", "\n").replace("\n", "\r\n"),
            "tags_raw": tags_raw,
            "event_unix": now,
            "event_raw": event_raw,
            "rev": new_rev,
            "saved_at": now,
            "timezone": "America/New_York",
        }
        revs.append(head)
        doc["head"] = head
        doc["revisions"] = revs
        doc["folder"] = folder
        doc["station"] = "jx"
        # if folder changed, move file
        dest_dir = JX_PAPER / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{stem_s}.fk.json"
        dest.write_text(
            json.dumps(doc, indent=4, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        if existing_path.resolve() != dest.resolve() and existing_path.is_file():
            try:
                existing_path.unlink()
            except OSError:
                pass
        doc["_path"] = str(dest.relative_to(JX_PAPER)).replace("\\", "/")
        return doc

    # create
    base = slug_bits(title)
    hex6 = secrets.token_hex(3)
    stem_s = f"FK-JX-{base}-{hex6}"[:80]
    while find_fk_path(stem_s):
        hex6 = secrets.token_hex(3)
        stem_s = f"FK-JX-{base}-{hex6}"[:80]
    head = {
        "c_uid": f"{stem_s}-r1",
        "title": title,
        "body": body.replace("\r\n", "\n").replace("\n", "\r\n"),
        "tags_raw": tags_raw,
        "event_unix": now,
        "event_raw": event_raw,
        "rev": 1,
        "saved_at": now,
        "timezone": "America/New_York",
    }
    doc = {
        "stem": stem_s,
        "folder": folder,
        "station": "jx",
        "head": head,
        "revisions": [dict(head)],
    }
    dest_dir = JX_PAPER / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{stem_s}.fk.json"
    dest.write_text(
        json.dumps(doc, indent=4, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    doc["_path"] = str(dest.relative_to(JX_PAPER)).replace("\\", "/")
    return doc


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code: int, obj: Any) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        body = self.rfile.read(n)
        return json.loads(body.decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        if path == "/api/health":
            self._json(
                200,
                {
                    "ok": True,
                    "sku": "CO.JX-001-CONCOR",
                    "service": "concor",
                    "jx_paper": str(JX_PAPER),
                },
            )
            return
        if path == "/api/store":
            self._json(200, load_store())
            return
        if path == "/api/cab/list":
            try:
                papers = list_fk_papers()
                self._json(
                    200,
                    {
                        "ok": True,
                        "station": "jx",
                        "root": str(JX_PAPER),
                        "papers": papers,
                    },
                )
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
            return
        if path == "/api/cab/get":
            stem = (qs.get("stem") or [""])[0]
            if not stem:
                self._json(400, {"ok": False, "error": "stem required"})
                return
            doc = load_fk(stem)
            if not doc:
                self._json(404, {"ok": False, "error": "not found"})
                return
            self._json(200, {"ok": True, "doc": doc})
            return
        return super().do_GET()

    def do_PUT(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/store":
            doc = self._read_json()
            if not isinstance(doc, dict):
                self._json(400, {"ok": False, "error": "body must be object"})
                return
            save_store(doc)
            self._json(200, {"ok": True})
            return
        if path == "/api/cab/save":
            payload = self._read_json()
            try:
                doc = save_fk(
                    stem=payload.get("stem") or None,
                    title=str(payload.get("title") or "untitled"),
                    body=str(payload.get("body") or ""),
                    folder=str(payload.get("folder") or "_root"),
                    tags_raw=str(payload.get("tags_raw") or ""),
                )
                self._json(200, {"ok": True, "doc": doc})
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/store":
            return self.do_PUT()
        if path == "/api/cab/save":
            return self.do_PUT()
        self._json(404, {"ok": False, "error": "not found"})


def main() -> int:
    ensure_jx_root()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Jack's Concor · CO.JX-001-CONCOR · http://{HOST}:{PORT}/", flush=True)
    print(f"  Cab/JX papers: {JX_PAPER}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstop", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
