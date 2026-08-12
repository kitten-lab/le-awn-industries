"""
Terminal IO vault CRATES-OUT (markdown packing slips) → SophiaDesk leaves + envelope.

Thrash path parallel to import_enex.py — hands vault pull, not Hermes mail spam.
Cursor re-runs skip already imported stems.

Usage:
  py -3.12 import_crates.py --dry-run
  py -3.12 import_crates.py
  py -3.12 import_crates.py --dir "C:\\Builds\\_VAULTS\\Terminal IO\\CRATES-OUT" --batch 15
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # noqa: E402
from store import (  # noqa: E402
    bin_api_from_file,
    bin_path,
    discover_username,
    local_root,
    next_leaf_uid,
    now,
    read_bin_config,
    set_bin_membership,
    spawn_bin,
    write_bin_config,
    write_leaf_chip,
    write_leaf_config,
)

DEFAULT_CRATES_DIR = Path(r"C:\Builds\_VAULTS\Terminal IO\CRATES-OUT")


def _parse_simple_fm(raw: str) -> tuple[dict[str, Any], str]:
    """Loose YAML-ish frontmatter (list keys as list[str])."""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    if not text.startswith("---"):
        return {}, text.strip()
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        return {}, text.strip()
    head, body = m.group(1), m.group(2)
    meta: dict[str, Any] = {}
    cur_key: str | None = None
    for line in head.split("\n"):
        if re.match(r"^\s*-\s+", line) and cur_key:
            val = re.sub(r"^\s*-\s+", "", line).strip().strip('"').strip("'")
            if not isinstance(meta.get(cur_key), list):
                meta[cur_key] = []
            meta[cur_key].append(val)
            continue
        km = re.match(r"^([A-Za-z0-9_.\s/-]+):\s*(.*)$", line)
        if not km:
            continue
        key = km.group(1).strip()
        rest = km.group(2).strip()
        cur_key = key
        if rest == "" or rest == "|" or rest == ">":
            meta[key] = [] if key.upper() in (
                "DESTINATION",
                "HANDLER",
            ) else ""
            continue
        # quoted string
        if (rest.startswith('"') and rest.endswith('"')) or (
            rest.startswith("'") and rest.endswith("'")
        ):
            meta[key] = rest[1:-1]
        else:
            meta[key] = rest
    return meta, body.strip()


def _title_from_path(path: Path) -> str:
    stem = path.stem
    # "CRATE - Foo" / "CRATE- Foo" / "CRATE -PROPHECY- Bar"
    t = re.sub(r"^CRATE\s*[-–—]\s*", "", stem, flags=re.I).strip()
    t = re.sub(r"^PROPHECY\s*[-–—]\s*", "PROPHECY · ", t, flags=re.I).strip()
    t = re.sub(r"\s+", " ", t).strip(" .-")
    return t or stem


def _title_from_body(body: str, fallback: str) -> str:
    """Prefer a real content heading; skip packing-slip chrome."""
    bad = re.compile(
        r"(propheslog|uniseleph|packing\s*slip|now-packing|sdk-exports|"
        r"^prophecy-?\s*$|central processing)",
        re.I,
    )
    for pat in (
        r"^###\s+(.+)$",
        r"^#\s+(?!#)(.+)$",
    ):
        for m in re.finditer(pat, body, re.M):
            t = re.sub(r"[#*`=]+", "", m.group(1)).strip()
            t = re.sub(r"\s+", " ", t)
            if not t or len(t) > 100:
                continue
            if bad.search(t):
                continue
            if t.lower() in ("crate", "contents", "type"):
                continue
            return t
    # path fallback is usually "Chester's Imports Prophecy" etc.
    return fallback


def _first_list(meta: dict[str, Any], *keys: str) -> list[str]:
    for k in keys:
        for mk, mv in meta.items():
            if mk.upper() == k.upper():
                if isinstance(mv, list):
                    return [str(x).strip() for x in mv if str(x).strip()]
                if isinstance(mv, str) and mv.strip():
                    return [mv.strip()]
    return []


def _meta_str(meta: dict[str, Any], *keys: str) -> str:
    for k in keys:
        for mk, mv in meta.items():
            if mk.upper() == k.upper():
                if isinstance(mv, list):
                    return ", ".join(str(x) for x in mv if str(x).strip())
                return str(mv or "").strip()
    return ""


def parse_crate_file(path: Path) -> dict[str, Any] | None:
    if path.name.upper() in ("CRATES-OUT.MD", "README.MD"):
        return None
    if path.suffix.lower() != ".md":
        return None
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    if not raw.strip():
        return None

    meta, body = _parse_simple_fm(raw)
    title = _title_from_path(path)
    title = _title_from_body(body, title)

    dests = _first_list(meta, "DESTINATION")
    handlers = _first_list(meta, "HANDLER")
    status = _meta_str(meta, "STATUS", "CRATE STATUS")
    seed = _meta_str(meta, "SEED")
    cid = _meta_str(meta, "CID", "C.ID")
    origin = _meta_str(meta, "ORIGIN")
    crate_date = _meta_str(meta, "CRATE DATE", "CRATED DATE")

    # Body for desk: keep packing slip + seed (full file body after FM).
    # Prefix a one-line work header for Imagine sessions.
    header_bits = []
    if dests:
        header_bits.append("DEST · " + " · ".join(dests))
    if status:
        header_bits.append("STATUS · " + status)
    if cid:
        header_bits.append("CID · " + cid)
    head = " · ".join(header_bits)
    if seed and seed not in body[:400]:
        body_out = (f"{head}\nSEED · {seed}\n\n{body}" if head else f"SEED · {seed}\n\n{body}").strip()
    else:
        body_out = (f"{head}\n\n{body}" if head else body).strip()

    if len(body_out) < 8:
        return None

    tags = ["import", "crate", "prophecy", "terminal-io", "crates-out"]
    for d in dests:
        slug = re.sub(r"[^a-z0-9]+", "-", d.lower()).strip("-")
        if slug:
            tags.append(slug)

    return {
        "stem": path.stem,
        "filename": path.name,
        "path": str(path),
        "title": title[:120],
        "body": body_out,
        "destinations": dests,
        "handlers": handlers,
        "status": status,
        "seed": seed,
        "cid": cid,
        "origin": origin,
        "crate_date": crate_date,
        "tags": tags,
    }


def list_crates(dir_path: Path) -> list[dict[str, Any]]:
    if not dir_path.is_dir():
        return []
    files = sorted(
        [p for p in dir_path.iterdir() if p.is_file() and p.suffix.lower() == ".md"],
        key=lambda p: p.name.lower(),
    )
    out: list[dict[str, Any]] = []
    for p in files:
        c = parse_crate_file(p)
        if c:
            out.append(c)
    return out


def cursor_path(safe: Path, slug: str) -> Path:
    u = discover_username(safe)
    d = local_root(safe) / u / "import_cursors"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{slug}.json"


def load_cursor(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"offset": 0, "batches": [], "done_stems": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        data.setdefault("offset", 0)
        data.setdefault("batches", [])
        data.setdefault("done_stems", [])
        return data
    except Exception:
        return {"offset": 0, "batches": [], "done_stems": []}


def save_cursor(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def import_batch(
    crates_dir: Path,
    *,
    batch_size: int = 30,
    dry_run: bool = False,
    station: str = "io",
    slug: str = "terminal-io-crates-out",
    only_prophecy: bool = False,
) -> dict[str, Any]:
    safe = server.SAFE
    crates = list_crates(crates_dir)
    if only_prophecy:
        # filename or body type mark
        crates = [
            c
            for c in crates
            if "prophecy" in c["filename"].lower()
            or "prophe" in (c["body"][:800].lower())
            or "`prophecy" in c["body"].lower()
        ]

    cpath = cursor_path(safe, slug)
    cur = load_cursor(cpath)
    done = set(str(s) for s in (cur.get("done_stems") or []))
    candidates = [c for c in crates if c["stem"] not in done]
    # also honor legacy offset if someone only used offset before stems
    offset = int(cur.get("offset") or 0)
    if offset and not done:
        candidates = candidates[offset:]

    total = len(candidates)
    batch_num = int(cur.get("batch_num") or 0) + 1
    total_batches = max(1, (total + batch_size - 1) // batch_size) if total else 1
    slice_notes = candidates[:batch_size]

    if not slice_notes:
        return {
            "ok": True,
            "done": True,
            "message": f"no more crates · {slug} ({len(done)} already imported · {len(crates)} on disk)",
            "imported_stems": len(done),
            "on_disk": len(crates),
            "cursor": str(cpath),
        }

    env_title = f"Chester · CRATES-OUT · {batch_num:02d}/{total_batches:02d}"
    plan = {
        "dir": str(crates_dir),
        "slug": slug,
        "batch_num": batch_num,
        "total_batches": total_batches,
        "count": len(slice_notes),
        "remaining_after": max(0, total - len(slice_notes)),
        "on_disk": len(crates),
        "already_imported": len(done),
        "envelope_title": env_title,
        "leaves": [
            {
                "title": n["title"],
                "dest": n["destinations"],
                "status": n["status"],
                "cid": n["cid"],
                "chars": len(n["body"] or ""),
                "file": n["filename"],
            }
            for n in slice_notes
        ],
    }

    if dry_run:
        plan["ok"] = True
        plan["dry_run"] = True
        return plan

    spawned = spawn_bin(
        safe,
        title=env_title,
        author="import·crates",
        subtype="envelope",
        x=96 + (batch_num % 5) * 24,
        y=140 + (batch_num % 4) * 28,
    )
    env = spawned.get("bin") or {}
    env_uid = str(env.get("uid") or env.get("id") or "")
    if not env_uid:
        raise RuntimeError("spawn envelope failed")

    cfg = read_bin_config(safe, env_uid) or {}
    prop = dict(cfg.get("prop") if isinstance(cfg.get("prop"), dict) else {})
    prop["accepts"] = ["card", "leaf"]
    prop["Station.desk"] = station
    prop["Import.source"] = "terminal-io-crates"
    prop["Import.vault"] = "Terminal IO"
    prop["Import.folder"] = "CRATES-OUT"
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
    new_stems: list[str] = []
    t_now = now()
    for n in slice_notes:
        uid = next_leaf_uid(safe)
        title = (n["title"] or "Untitled crate").strip() or "Untitled crate"
        leaf = {
            "id": uid,
            "uid": uid,
            "title": title,
            "author": "import·crates",
            "body": n["body"] or "",
            "created": t_now,
            "updated": t_now,
            "event": t_now,
            "_preserve_updated": True,
            "tags": list(n.get("tags") or []),
            "paper": "lined",
            "shell": "paper",
            "style": "lined",
            "Import.source": "terminal-io-crates",
            "Import.vault": "Terminal IO",
            "Import.folder": "CRATES-OUT",
            "Import.file": n["filename"],
            "Import.stem": n["stem"],
            "Import.cid": n.get("cid") or "",
            "Import.destination": ", ".join(n.get("destinations") or []),
            "Import.status": n.get("status") or "",
            "Import.batch": batch_num,
            "Import.envelope": env_uid,
        }
        write_leaf_chip(safe, leaf)
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
        new_stems.append(n["stem"])

    p = bin_path(safe, env_uid)
    full = bin_api_from_file(p) if p else None

    done.update(new_stems)
    cur["done_stems"] = sorted(done)
    cur["batch_num"] = batch_num
    cur["dir"] = str(crates_dir)
    cur["offset"] = 0  # stem-based; offset retired
    batches = list(cur.get("batches") or [])
    batches.append(
        {
            "batch": batch_num,
            "envelope": env_uid,
            "leaves": leaf_ids,
            "stems": new_stems,
        }
    )
    cur["batches"] = batches
    save_cursor(cpath, cur)

    remaining = [c for c in crates if c["stem"] not in done]
    return {
        "ok": True,
        "dry_run": False,
        "done": len(remaining) == 0,
        "envelope": env_uid,
        "envelope_title": env_title,
        "leaves": leaf_ids,
        "count": len(leaf_ids),
        "batch_num": batch_num,
        "total_batches": total_batches,
        "remaining": len(remaining),
        "imported_total": len(done),
        "cursor": str(cpath),
        "chips_in_env": (full or {}).get("chips") if full else leaf_ids,
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Import Terminal IO CRATES-OUT markdown → SophiaDesk envelope"
    )
    ap.add_argument(
        "--dir",
        default=str(DEFAULT_CRATES_DIR),
        help="Folder of CRATE - *.md packing slips",
    )
    ap.add_argument(
        "--batch",
        type=int,
        default=30,
        help="Crates per envelope (default 30 = whole yard if small)",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--station",
        default="io",
        help="Station.desk scar on envelope (io ab cu dr osx dc)",
    )
    ap.add_argument(
        "--slug",
        default="terminal-io-crates-out",
        help="Cursor id under ~local/ADM/import_cursors/",
    )
    ap.add_argument(
        "--only-prophecy",
        action="store_true",
        help="Only files that look like prophecy crates",
    )
    args = ap.parse_args()
    path = Path(args.dir)
    if not path.is_dir():
        print(json.dumps({"ok": False, "error": f"not a dir · {path}"}))
        sys.exit(1)
    result = import_batch(
        path,
        batch_size=max(1, args.batch),
        dry_run=args.dry_run,
        station=args.station,
        slug=args.slug,
        only_prophecy=args.only_prophecy,
    )
    print(json.dumps(result, indent=2))
    if not result.get("ok"):
        sys.exit(1)


if __name__ == "__main__":
    main()
