"""
Evernote .enex → SophiaDesk leaves + envelope (batch import).

Usage:
  python import_enex.py --enex "C:\\Builds\\_VAULTS\\evernote\\STORIES.enex" --batch 10
  python import_enex.py --enex "...\\STORIES.enex" --batch 10 --dry-run

Cursor: ~local/ADM/import_cursors/<notebook-slug>.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

# desk_sys on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # noqa: E402
from store import (  # noqa: E402
    bin_api_from_file,
    bin_path,
    chip_path,
    leaf_api_from_chip_file,
    next_leaf_uid,
    read_bin_config,
    set_bin_membership,
    spawn_bin,
    write_bin_config,
    write_leaf_chip,
    write_leaf_config,
    library_root,
    local_root,
    discover_username,
    now,
)


class _TextExtractor(HTMLParser):
    """
    ENML → plain text with paragraph breaks.
    Evernote often stores paragraphs as <div>…</div><div>…</div> with NO
    newlines between tags — handle_data alone smushes into one run-on.
    """

    _BLOCK_ENDS = {
        "div",
        "p",
        "li",
        "tr",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "pre",
        "section",
        "article",
    }

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip_depth = 0  # display:none / en-media noise

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        ad = {k.lower(): (v or "") for k, v in attrs}
        style = ad.get("style", "").replace(" ", "").lower()
        if "display:none" in style or tag in ("en-media", "en-crypt", "script", "style"):
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag in ("br", "hr"):
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("\n- ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in ("en-media", "en-crypt", "script", "style") or self._skip_depth:
            if self._skip_depth:
                self._skip_depth = max(0, self._skip_depth - 1)
            return
        if tag in self._BLOCK_ENDS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        # thin space / nbsp used as en padding
        t = data.replace("\xa0", " ").replace("\u200a", "").replace("\u2009", "")
        if t:
            self.parts.append(t)

    def get(self) -> str:
        raw = "".join(self.parts)
        raw = raw.replace("\r\n", "\n").replace("\r", "\n")
        # space cleanup per line; keep paragraph breaks
        lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in raw.split("\n")]
        out: list[str] = []
        blank = 0
        for ln in lines:
            if not ln:
                blank += 1
                if blank <= 2:
                    out.append("")
            else:
                blank = 0
                out.append(ln)
        text = "\n".join(out).strip()
        # Evernote sometimes leaves mid-sentence div breaks; keep double newlines
        # only between real paragraphs (already one \n per div end)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text


def _enml_to_text(enml: str) -> str:
    te = _TextExtractor()
    try:
        te.feed(enml)
        text = te.get()
        if text:
            return text
    except Exception:
        pass
    # fallback: tag → newline
    t = re.sub(r"<(br|BR)\s*/?>", "\n", enml)
    t = re.sub(r"</(div|p|li|h[1-6]|tr)>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"[ \t]+\n", "\n", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def _evernote_ts_to_unix(s: str) -> int | None:
    """20250814T131808Z → unix seconds."""
    s = (s or "").strip()
    m = re.match(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$", s)
    if not m:
        return None
    try:
        from datetime import datetime, timezone

        dt = datetime(
            int(m.group(1)),
            int(m.group(2)),
            int(m.group(3)),
            int(m.group(4)),
            int(m.group(5)),
            int(m.group(6)),
            tzinfo=timezone.utc,
        )
        return int(dt.timestamp())
    except Exception:
        return None


def parse_enex(path: Path) -> list[dict[str, Any]]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    chunks = re.findall(r"<note>(.*?)</note>", raw, re.S)
    notes: list[dict[str, Any]] = []
    for i, note in enumerate(chunks):
        title_m = re.search(r"<title>([^<]*)</title>", note)
        created_m = re.search(r"<created>([^<]*)</created>", note)
        updated_m = re.search(r"<updated>([^<]*)</updated>", note)
        cdata_m = re.search(r"<!\[CDATA\[(.*?)\]\]>", note, re.S)
        title = (title_m.group(1) if title_m else "Untitled").strip() or "Untitled"
        # basic entities
        title = (
            title.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", '"')
            .replace("&#39;", "'")
        )
        body = _enml_to_text(cdata_m.group(1)) if cdata_m else ""
        notes.append(
            {
                "index": i,  # 0-based in file order
                "title": title,
                "body": body,
                "created_raw": created_m.group(1) if created_m else "",
                "updated_raw": updated_m.group(1) if updated_m else "",
                "created": _evernote_ts_to_unix(
                    created_m.group(1) if created_m else ""
                ),
                "updated": _evernote_ts_to_unix(
                    updated_m.group(1) if updated_m else ""
                ),
            }
        )
    return notes


def notebook_slug(enex_path: Path) -> str:
    s = enex_path.stem.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:48] or "notebook"


def cursor_path(safe: Path, slug: str) -> Path:
    u = discover_username(safe)
    d = local_root(safe) / u / "import_cursors"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{slug}.json"


def load_cursor(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"offset": 0, "batches": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"offset": 0, "batches": []}


def save_cursor(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def import_batch(
    enex: Path,
    *,
    batch_size: int = 10,
    dry_run: bool = False,
    include_empty: bool = False,
    station: str = "io",
) -> dict[str, Any]:
    safe = server.SAFE
    notes = parse_enex(enex)
    if not include_empty:
        # keep original index for provenance
        candidates = [n for n in notes if len((n.get("body") or "").strip()) > 5]
    else:
        candidates = notes

    slug = notebook_slug(enex)
    cpath = cursor_path(safe, slug)
    cur = load_cursor(cpath)
    offset = int(cur.get("offset") or 0)
    total = len(candidates)
    batch_num = int(cur.get("batch_num") or 0) + 1
    total_batches = max(1, (total + batch_size - 1) // batch_size)

    slice_notes = candidates[offset : offset + batch_size]
    if not slice_notes:
        return {
            "ok": True,
            "done": True,
            "message": f"no more notes · {slug} offset {offset}/{total}",
            "offset": offset,
            "total": total,
        }

    env_title = f"Evernote · {enex.stem} · {batch_num:02d}/{total_batches:02d}"
    plan = {
        "enex": str(enex),
        "slug": slug,
        "batch_num": batch_num,
        "total_batches": total_batches,
        "offset": offset,
        "count": len(slice_notes),
        "total_with_body": total,
        "envelope_title": env_title,
        "leaves": [
            {
                "title": n["title"],
                "chars": len(n["body"] or ""),
                "created_raw": n["created_raw"],
            }
            for n in slice_notes
        ],
    }

    if dry_run:
        plan["ok"] = True
        plan["dry_run"] = True
        return plan

    # spawn envelope
    spawned = spawn_bin(
        safe,
        title=env_title,
        author="import·evernote",
        subtype="envelope",
        x=72 + (batch_num % 5) * 24,
        y=120 + (batch_num % 4) * 28,
    )
    env = spawned.get("bin") or {}
    env_uid = str(env.get("uid") or env.get("id") or "")
    if not env_uid:
        raise RuntimeError("spawn envelope failed")

    # station scar on envelope
    cfg = read_bin_config(safe, env_uid) or {}
    prop = dict(cfg.get("prop") if isinstance(cfg.get("prop"), dict) else {})
    prop["accepts"] = ["card", "leaf"]
    prop["Station.desk"] = station
    prop["Import.source"] = "evernote"
    prop["Import.notebook"] = enex.stem
    prop["Import.enex"] = enex.name
    prop["Import.batch"] = batch_num
    prop["Import.batch_of"] = total_batches
    du = dict(cfg.get("dressup") if isinstance(cfg.get("dressup"), dict) else {})
    du["package_id"] = "envelope"
    du["shell"] = du.get("shell") or "envelopebox"
    pose = cfg.get("pose") or cfg.get("pos") or {}
    write_bin_config(
        safe,
        env_uid,
        pose=pose or None,
        dressup=du,
        prop=prop,
        subtype="envelope",
    )

    leaf_ids: list[str] = []
    t_now = now()
    for n in slice_notes:
        uid = next_leaf_uid(safe)
        created = int(n["created"] or t_now)
        updated = int(n["updated"] or created)
        title = (n["title"] or "Untitled").strip() or "Untitled"
        if title.lower() in ("untitled", "untitled note"):
            # first line of body as soft title if generic
            first = (n["body"] or "").strip().split("\n")[0].strip()
            if first and len(first) < 80:
                title = first[:72]

        # PIN law:
        #   tps_created  = Evernote born
        #   tps_updated  = Evernote last touch (until desk body edit)
        #   tps_event    = when this chip entered the desk (import moment)
        #   Import.*     = scars on chip pin (not instance config)
        leaf = {
            "id": uid,
            "uid": uid,
            "title": title,
            "author": "import·evernote",
            "body": n["body"] or "",
            "created": created,
            "updated": updated,
            "event": t_now,
            "_preserve_updated": True,
            "tags": [
                "import",
                "evernote",
                slug,
                f"batch-{batch_num:02d}",
            ],
            "paper": "lined",
            "shell": "paper",
            "style": "lined",
            "Import.source": "evernote",
            "Import.notebook": enex.stem,
            "Import.enex": enex.name,
            "Import.note_index": n["index"],
            "Import.note_created": n["created_raw"],
            "Import.note_updated": n["updated_raw"],
            "Import.batch": batch_num,
            "Import.envelope": env_uid,
        }
        write_leaf_chip(safe, leaf)
        # config = surface instance only (dress + filing) · no Import TPS twin
        write_leaf_config(
            safe,
            uid,
            pose=None,
            dressup={"shell": "paper", "style": "lined", "id": uid},
            prop={
                "isMarkable": True,
                "isMarked": False,
                "homeBin": env_uid,
            },
        )
        set_bin_membership(safe, env_uid, uid, add=True)
        leaf_ids.append(uid)

    # refresh envelope chips list from disk
    p = bin_path(safe, env_uid)
    full = bin_api_from_file(p) if p else None

    new_offset = offset + len(slice_notes)
    cur["offset"] = new_offset
    cur["batch_num"] = batch_num
    cur["enex"] = str(enex)
    cur["total"] = total
    batches = list(cur.get("batches") or [])
    batches.append(
        {
            "batch": batch_num,
            "envelope": env_uid,
            "leaves": leaf_ids,
            "offset_before": offset,
            "offset_after": new_offset,
        }
    )
    cur["batches"] = batches
    save_cursor(cpath, cur)

    return {
        "ok": True,
        "dry_run": False,
        "done": new_offset >= total,
        "envelope": env_uid,
        "envelope_title": env_title,
        "leaves": leaf_ids,
        "count": len(leaf_ids),
        "batch_num": batch_num,
        "total_batches": total_batches,
        "offset": new_offset,
        "total": total,
        "cursor": str(cpath),
        "chips_in_env": (full or {}).get("chips") if full else leaf_ids,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Import Evernote .enex batch → envelope")
    ap.add_argument("--enex", required=True, help="Path to .enex file")
    ap.add_argument("--batch", type=int, default=10, help="Notes per envelope (default 10)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--include-empty", action="store_true")
    ap.add_argument(
        "--station",
        default="io",
        help="Station.desk scar on envelope (io ab cu dr osx dc)",
    )
    args = ap.parse_args()
    path = Path(args.enex)
    if not path.is_file():
        print(json.dumps({"ok": False, "error": f"not found · {path}"}))
        sys.exit(1)
    result = import_batch(
        path,
        batch_size=args.batch,
        dry_run=args.dry_run,
        include_empty=args.include_empty,
        station=args.station,
    )
    print(json.dumps(result, indent=2))
    if not result.get("ok"):
        sys.exit(1)


if __name__ == "__main__":
    main()
