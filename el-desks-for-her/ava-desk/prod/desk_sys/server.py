#!/usr/bin/env python3
"""
Pocket Desktop · consider desk (Deck Host ROM; Receiver fork lineage).

NOT a notepad / notes app. NOT a permanent "one-paper strip." That phrase was a
damage-control slice so agents would stop thrashing an opaque backend — see
papers, redline them, keep custody. Now: multi-leaf desk + bins + tools where
you write about the pocket OS so the project can declare itself.

APIs: leaves, bins, spawn, save/raw, surface, dressups, pose, membership.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from store import (
    DEFAULT_SURFACE_FOLDER,
    DEFAULT_USERNAME,
    PRIMARY_CHIP_ID,
    bin_api_from_file,
    bin_path,
    chip_path,
    configs_root,
    delete_leaf_chip,
    delete_tool_config,
    discover_username,
    ensure_primary_leaf,
    ensure_user_tree,
    install_tool_package,
    is_bin_id,
    leaf_api_from_chip_file,
    leaf_owner_bin,
    member_owner_index,
    library_root,
    list_bin_rows,
    list_card_chips,
    list_leaf_chips,
    list_tool_configs,
    merge_leaf_prop_mark,
    primary_leaf,
    read_bin_config,
    read_bin_config_raw,
    read_card_config,
    read_config_raw,
    read_leaf_config,
    read_surface_layout,
    read_surface_paper,
    read_surface_raw,
    read_tool_config,
    read_tool_manifest,
    rel_from_bay,
    set_bin_membership,
    spawn_bin,
    despawn_bin,
    spawn_card,
    spawn_leaf,
    spawn_tool,
    place_rom_cart,
    to_bin_id,
    to_card_id,
    to_leaf_chip_id,
    to_tool_member_id,
    is_card_id,
    is_tool_member_id,
    tool_package_file,
    write_bin_config,
    write_bin_file,
    write_card_chip,
    write_card_config,
    write_leaf_chip,
    write_leaf_config,
    write_tool_config,
    write_surface_paper,
    card_path,
    card_api_from_file,
    list_leaf_dressups,
    read_leaf_dressup,
    write_leaf_dressup,
    leaf_dressups_root,
    deliver_mail,
    find_inbox_by_address,
    list_inbox_instances,
    take_mail_from_inbox,
    take_item_from_inbox,
    file_leaf_to_inbox,
    file_item_to_inbox,
    leaf_is_inbox_held,
    reconcile_inbox_mail,
    list_mailable_catalog,
    mail_item_summary,
    classify_mail_item_id,
    recover_orphaned_mail_parcels,
    list_fax_destinations,
    get_fax_destination,
    fax_item_to_destination,
    export_mail_parcel,
    accept_mail_parcel,
    scar_item_sent,
    is_remote_girl_address,
    girl_mail_home_url,
    GIRL_MAIL_NETWORK,
)

SYS = Path(__file__).resolve().parent
PROD = SYS.parent
SAFE = PROD / "safe_box"
HOST = "127.0.0.1"
PORT = int(__import__("os").environ.get("POCKET_DESKTOP_PORT", __import__("os").environ.get("AVA_DESK_PORT", "43171")))
SKU = "CO.LEA-BLUE-HER"
APP = "AvaDesk"


def ensure() -> None:
    """
    Cheap path guard only: ~local tree exists.

    Not a migration hammer. Early desk called this on every GET so "the paper
    would always be there" — that rewrote surface.cfg under concurrent CSS/API
    loads (WinError 32 → black screen / empty desk). Migrations are one-shot
    tools in store.py; run them explicitly when needed, not per bill.
    """
    SAFE.mkdir(parents=True, exist_ok=True)
    ensure_user_tree(SAFE)


def find_leaf(lid: str):
    cid = to_leaf_chip_id(lid)
    for try_id in (cid, lid):
        p = chip_path(SAFE, try_id)
        if p:
            leaf = leaf_api_from_chip_file(p)
            if leaf:
                return p, leaf
    return None, None


def jsend(handler: SimpleHTTPRequestHandler, code: int, payload: Any) -> None:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def _find_alice_box() -> Path:
    """Walk up until the-deck-host exists (works under el-desks-for-her/…)."""
    here = Path(__file__).resolve().parent
    for p in [here, *here.parents]:
        if (p / "the-deck-host" / "shell" / "deck_host.py").is_file():
            return p
    # fallback: old depth assumptions
    return here.parents[min(5, len(here.parents) - 1)]


# ALICE_BOX root (depth-safe; was parents[4] before el-desks-for-her/)
_ALICE_BOX = _find_alice_box()

# Desk-forever ROMs: launch into window on desk or fill the felt (not hardcoded citizens)
# Face dress from ROM Cat catalog (case_shell · julie_tint · plate_css · name)
# Launch ids stay short; catalog id is the ROM Cat shelf id.
ROM_CATALOG: dict[str, dict[str, Any]] = {
    "kde-001": {
        "id": "kde-001",
        "catalog_id": "kde-notes-chords",
        "sku": "CO.KDE-001-INSTR",
        "title": "DETECTIVE K: Notes & Chords",
        "url": "http://127.0.0.1:43140/",
        "health": "http://127.0.0.1:43140/api/health",
        "case_shell": "julie",
        "julie_tint": "#a80000",
        "plate_css": (
            "background-color: darkred;\n"
            "font-weight: 700;\n"
            "background-image: radial-gradient(darkred, #051c08 120%);\n"
            "color: red;\n"
            "border: 1px dashed darkred;"
        ),
        # host window strip (SophiaDesk · not the ROM's own header)
        "chrome": {
            "bg": "linear-gradient(180deg, #2a0808 0%, #120404 100%)",
            "fg": "#ff9090",
            "dim": "rgba(255, 140, 140, 0.45)",
            "border": "rgba(160, 40, 40, 0.55)",
            "btn": "rgba(255, 160, 160, 0.75)",
        },
        "run": str(
            _ALICE_BOX
            / "charlies-toys"
            / "kde-notes-chords"
            / "prod"
            / "kde_sys"
            / "server.py"
        ),
        "cwd": str(
            _ALICE_BOX / "charlies-toys" / "kde-notes-chords" / "prod" / "kde_sys"
        ),
    },
    "jx-nim": {
        "id": "jx-nim",
        "catalog_id": "nim-yard",
        "sku": "CO.JX-002-NIM",
        "title": "Nim Yard (v1 archive)",
        "url": "http://127.0.0.1:43180/",
        "health": "http://127.0.0.1:43180/api/health",
        "case_shell": "classicboi",
        "julie_tint": "clear",
        "plate_css": (
            "background: linear-gradient(160deg, #2a2218 0%, #16130f 55%, #1a1410 100%);\n"
            "color: #e0a050;\n"
            "font-family: IBM Plex Mono, monospace;\n"
            "font-weight: 600;\n"
            "border: 1px solid #c46b3a;\n"
            "box-shadow: inset 0 0 8px #00000044;"
        ),
        "run": str(
            _ALICE_BOX
            / "jacks-cross"
            / "nim-data-forestry"
            / "prod"
            / "yard_sys"
            / "server.py"
        ),
        "cwd": str(
            _ALICE_BOX
            / "jacks-cross"
            / "nim-data-forestry"
            / "prod"
            / "yard_sys"
        ),
    },
    # L.E. AWN · was nim-bench / jx-nim-bench
    "glass-compost": {
        "id": "glass-compost",
        "catalog_id": "glass-compost",
        "sku": "CO.LEA-003-GLASS",
        "title": "The Glass Compost",
        "url": "http://127.0.0.1:43182/",
        "health": "http://127.0.0.1:43182/api/health",
        "case_shell": "classicboi",
        "julie_tint": "clear",
        "plate_css": (
            "background: linear-gradient(160deg, #2a2218 0%, #16130f 55%, #1a1410 100%);\n"
            "color: #e0a050;\n"
            "font-family: IBM Plex Mono, monospace;\n"
            "font-weight: 600;\n"
            "border: 1px solid #c46b3a;\n"
            "box-shadow: inset 0 0 8px #00000044;"
        ),
        "chrome": {
            "bg": "linear-gradient(180deg, #2a2218 0%, #12100c 100%)",
            "fg": "#e0a050",
            "dim": "rgba(224, 160, 80, 0.45)",
            "border": "rgba(196, 107, 58, 0.5)",
            "btn": "rgba(224, 180, 100, 0.8)",
        },
        "run": str(
            _ALICE_BOX
            / "le-awn-industries"
            / "glass-compost"
            / "prod"
            / "bench_sys"
            / "server.py"
        ),
        "cwd": str(
            _ALICE_BOX
            / "le-awn-industries"
            / "glass-compost"
            / "prod"
            / "bench_sys"
        ),
    },
    # L.E. AWN · was Jack's Concor / jx-concor
    "emt-bench": {
        "id": "emt-bench",
        "catalog_id": "emt-bench",
        "sku": "CO.LEA-002-EMT",
        "title": "EM Translation Bench",
        "url": "http://127.0.0.1:43150/",
        "health": "http://127.0.0.1:43150/api/health",
        "case_shell": "classicboi",
        "julie_tint": "clear",
        "plate_css": (
            "background: linear-gradient(160deg, #1a2820 0%, #0e1814 55%, #0a1410 100%);\n"
            "color: #8ec8a0;\n"
            "font-family: IBM Plex Mono, monospace;\n"
            "font-weight: 600;\n"
            "border: 1px solid #3a7050;\n"
            "box-shadow: inset 0 0 8px #00000044;"
        ),
        "chrome": {
            "bg": "linear-gradient(180deg, #1a2820 0%, #0a1410 100%)",
            "fg": "#8ec8a0",
            "dim": "rgba(142, 200, 160, 0.45)",
            "border": "rgba(58, 112, 80, 0.55)",
            "btn": "rgba(160, 220, 180, 0.8)",
        },
        "run": str(
            _ALICE_BOX
            / "le-awn-industries"
            / "emt-bench"
            / "prod"
            / "concor_sys"
            / "server.py"
        ),
        "cwd": str(
            _ALICE_BOX
            / "le-awn-industries"
            / "emt-bench"
            / "prod"
            / "concor_sys"
        ),
    },
    # Charlie's Toys · mailer → Pocket inbox
    "hermes": {
        "id": "hermes",
        "catalog_id": "hermes",
        "sku": "CO.TOY-005-HERMES",
        "title": "Hermes",
        "url": "http://127.0.0.1:43169/",
        "health": "http://127.0.0.1:43169/api/health",
        "case_shell": "classicboi",
        "julie_tint": "mint",
        "plate_css": (
            "background: linear-gradient(160deg, #1a2824 0%, #0e1814 55%, #0a1210 100%);\n"
            "color: #7ec8a0;\n"
            "font-family: IBM Plex Mono, monospace;\n"
            "font-weight: 600;\n"
            "border: 1px solid #3a8060;\n"
            "box-shadow: inset 0 0 8px #00000044;"
        ),
        "chrome": {
            "bg": "linear-gradient(180deg, #1a2824 0%, #0a1210 100%)",
            "fg": "#7ec8a0",
            "dim": "rgba(126, 200, 160, 0.45)",
            "border": "rgba(58, 128, 96, 0.5)",
            "btn": "rgba(160, 220, 190, 0.8)",
        },
        "run": str(
            _ALICE_BOX / "charlies-toys" / "hermes" / "prod" / "box_sys" / "server.py"
        ),
        "cwd": str(
            _ALICE_BOX / "charlies-toys" / "hermes" / "prod" / "box_sys"
        ),
    },
    # Charlie's Toys · multi-color found terminals · FileKeeper chips
    # Host chrome stays black — station skins (IOX/DRX/OSX…) live inside the ROM.
    "sdk-import": {
        "id": "sdk-import",
        "catalog_id": "sdk-import",
        "sku": "CO.TOY-001-TERMINAL",
        "title": "TERMINALS",
        "url": "http://127.0.0.1:43101/",
        "health": "http://127.0.0.1:43101/api/health",
        "case_shell": "classicboi",
        "julie_tint": "#0f5c00",
        "plate_css": (
            "background-color: #051c08;\n"
            "font-weight: 700;\n"
            "background-image: radial-gradient(rgba(18, 190, 35, 0.2), #051c08 120%);\n"
            "color: #33ff33;\n"
            "border: 1px solid #1a8020;\n"
            "box-shadow: inset 0 0 10px #00000066;"
        ),
        "chrome": {
            "bg": "linear-gradient(180deg, #0a0a0a 0%, #000000 100%)",
            "fg": "#c8c8c8",
            "dim": "rgba(180, 180, 180, 0.4)",
            "border": "rgba(60, 60, 60, 0.85)",
            "btn": "rgba(200, 200, 200, 0.75)",
        },
        # PHP network via serve_rom.py (not a pure-Python box_sys)
        "run": str(
            _ALICE_BOX
            / "charlies-toys"
            / "sdk-import-station"
            / "serve_rom.py"
        ),
        "cwd": str(
            _ALICE_BOX / "charlies-toys" / "sdk-import-station"
        ),
    },
}


def normalize_rom_key(rom_id: str) -> str:
    """Short launch ids + friendly aliases → ROM_CATALOG key."""
    key = (rom_id or "").strip().lower()
    if key in ("kde", "kde001", "kde-notes", "kde-notes-chords", "co.kde-001-instr"):
        return "kde-001"
    if key in (
        "nim",
        "nim-yard",
        "nimyard",
        "jx-nim",
        "jxnimm",
        "co.jx-002-nim",
        "co.jxnim-001-yard",
        "jack-nim",
        "timbers",
    ):
        return "jx-nim"
    if key in (
        "bench",
        "nim-bench",
        "cut",
        "jx-nim-bench",
        "jx-cut",
        "co.jx-003-cut",
        "glass-compost",
        "glass",
        "compost",
        "the-glass-compost",
        "co.lea-003-glass",
        "co.lea-003",
    ):
        return "glass-compost"
    if key in (
        "concor",
        "concord",
        "concordance",
        "jx-concor",
        "jx-concord",
        "the-concor",
        "co.jx-001-concor",
        "co.jx-001",
        "emt-bench",
        "emt",
        "em-translation",
        "em-translation-bench",
        "co.lea-002-emt",
        "co.lea-002",
    ):
        return "emt-bench"
    if key in (
        "hermes",
        "mail",
        "mailer",
        "toy-hermes",
        "co.toy-005-hermes",
        "co.toy-005",
    ):
        return "hermes"
    if key in (
        "sdk-import",
        "sdk",
        "terminals",
        "terminal",
        "filekeeper",
        "import-station",
        "sdk-import-station",
        "co.toy-001-terminal",
        "co.toy-001",
        "iox",
    ):
        return "sdk-import"
    return key

_rom_procs: dict[str, subprocess.Popen] = {}


def _port_from_rom_meta(meta: dict[str, Any] | None) -> int | None:
    """Pull listen port from url/health (e.g. http://127.0.0.1:43182/)."""
    if not meta:
        return None
    for k in ("url", "health"):
        u = str(meta.get(k) or "")
        m = re.search(r":(\d{2,5})(?:/|$)", u)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                pass
    return None


def _kill_pid_tree(pid: int) -> None:
    if pid <= 0:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                text=True,
                timeout=8,
            )
        else:
            os.kill(pid, 15)
    except Exception:
        pass


def _pids_listening_on_port(port: int) -> list[int]:
    """Best-effort PIDs bound to port (Windows netstat; empty if unknown)."""
    if port <= 0:
        return []
    pids: list[int] = []
    try:
        if os.name == "nt":
            r = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True,
                text=True,
                timeout=6,
            )
            needle = f":{port}"
            for line in (r.stdout or "").splitlines():
                if "LISTENING" not in line.upper() and "LISTEN" not in line.upper():
                    continue
                if needle not in line:
                    continue
                parts = line.split()
                if not parts:
                    continue
                try:
                    pid = int(parts[-1])
                except ValueError:
                    continue
                if pid > 0 and pid not in pids:
                    pids.append(pid)
        else:
            r = subprocess.run(
                ["lsof", "-ti", f"tcp:{port}"],
                capture_output=True,
                text=True,
                timeout=6,
            )
            for bit in (r.stdout or "").split():
                try:
                    pid = int(bit)
                except ValueError:
                    continue
                if pid > 0 and pid not in pids:
                    pids.append(pid)
    except Exception:
        return pids
    return pids


def stop_rom(rom_id: str) -> dict[str, Any]:
    """Stop ROM server: desk-spawned process tree, else kill whoever holds the port.

    Closing the window used to only kill PIDs in _rom_procs. If the server was
    already warm (launcher / prior desk / hard-refresh lost the Popen handle),
    stop no-op'd and the ROM stayed up — so hard-kill-the-desk became the only
    reset. We now fall back to port kill when health is still up.
    """
    key = normalize_rom_key(rom_id)
    meta = ROM_CATALOG.get(key) or {}
    health = str(meta.get("health") or "")
    port = _port_from_rom_meta(meta)
    killed: list[int] = []
    reason = ""

    proc = _rom_procs.get(key)
    if proc is not None:
        pid = proc.pid
        try:
            if proc.poll() is None:
                _kill_pid_tree(pid)
                killed.append(pid)
        except Exception as e:
            _rom_procs.pop(key, None)
            return {"ok": False, "id": key, "error": str(e), "pid": pid}
        _rom_procs.pop(key, None)
        reason = "desk-spawned"
    else:
        reason = "not started by this desk process"

    # Orphan / foreign start: still listening after we lost the handle
    if port and rom_health(health):
        for pid in _pids_listening_on_port(port):
            _kill_pid_tree(pid)
            if pid not in killed:
                killed.append(pid)
        reason = (reason + " · port " + str(port)).strip(" ·")

    # brief wait + recheck
    still = rom_health(health) if health else False
    if still and port:
        import time

        time.sleep(0.25)
        for pid in _pids_listening_on_port(port):
            _kill_pid_tree(pid)
            if pid not in killed:
                killed.append(pid)
        still = rom_health(health)

    return {
        "ok": True,
        "id": key,
        "stopped": bool(killed) and not still,
        "pids": killed,
        "up": still,
        "reason": reason if killed or not still else (reason or "already down"),
    }


def _rom_chrome_payload(meta: dict[str, Any] | None) -> dict[str, str]:
    """Host strip for every SophiaDesk ROM window.

    Global law: SOPHIADESK | THE DECK HOST + SKU, black bar.
    Product costume lives inside the iframe — not on this strip.
    Per-ROM chrome overrides are ignored so the host stays one language.
    """
    # meta kept for call-site compatibility
    _ = meta
    return {
        "bg": "linear-gradient(180deg, #0a0a0a 0%, #000000 100%)",
        "fg": "#c8c8c8",
        "dim": "rgba(180, 180, 180, 0.4)",
        "border": "rgba(60, 60, 60, 0.85)",
        "btn": "rgba(200, 200, 200, 0.75)",
    }


def list_roms() -> list[dict[str, Any]]:
    out = []
    for rid, meta in ROM_CATALOG.items():
        alive = rom_health(str(meta.get("health") or ""))
        out.append(
            {
                "id": rid,
                "sku": meta.get("sku"),
                "title": meta.get("title"),
                "url": meta.get("url"),
                "up": alive,
                "chrome": _rom_chrome_payload(meta),
            }
        )
    return out


def rom_health(url: str) -> bool:
    if not url:
        return False
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return 200 <= int(resp.status) < 500
    except Exception:
        return False


def ensure_rom(rom_id: str) -> dict[str, Any]:
    key = normalize_rom_key(rom_id)
    meta = ROM_CATALOG.get(key)
    if not meta:
        return {"ok": False, "error": "unknown rom · " + (rom_id or "?")}
    health = str(meta.get("health") or "")
    url = str(meta.get("url") or "")
    chrome = _rom_chrome_payload(meta)
    if rom_health(health):
        return {
            "ok": True,
            "id": key,
            "sku": meta.get("sku"),
            "title": meta.get("title"),
            "url": url,
            "up": True,
            "started": False,
            "chrome": chrome,
        }
    run_path = Path(str(meta.get("run") or ""))
    cwd = Path(str(meta.get("cwd") or run_path.parent))
    if not run_path.is_file():
        return {
            "ok": False,
            "error": "rom server missing · " + str(run_path),
            "id": key,
            "url": url,
            "up": False,
            "chrome": chrome,
        }
    # already spawned?
    proc = _rom_procs.get(key)
    if proc is not None and proc.poll() is None:
        # give it a moment
        import time

        for _ in range(20):
            time.sleep(0.15)
            if rom_health(health):
                return {
                    "ok": True,
                    "id": key,
                    "sku": meta.get("sku"),
                    "title": meta.get("title"),
                    "url": url,
                    "up": True,
                    "started": True,
                    "chrome": chrome,
                }
    try:
        creation = 0
        if os.name == "nt":
            creation = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            creation |= getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
        env = os.environ.copy()
        # TERMINALS (PHP FileKeeper) · glass mountain default if unset
        if key == "sdk-import" and not env.get("GLASS_LOGS_ROOT"):
            env["GLASS_LOGS_ROOT"] = str(_ALICE_BOX / ".glass-logs")
        if key == "sdk-import" and not env.get("SDK_IMPORT_PHP"):
            php = Path(r"C:\xampp\php\php.exe")
            if php.is_file():
                env["SDK_IMPORT_PHP"] = str(php)
        proc = subprocess.Popen(
            [sys.executable, str(run_path)],
            cwd=str(cwd),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation if os.name == "nt" else 0,
            start_new_session=(os.name != "nt"),
        )
        _rom_procs[key] = proc
    except Exception as e:
        return {
            "ok": False,
            "error": "spawn failed · " + str(e),
            "id": key,
            "up": False,
            "chrome": chrome,
        }

    import time

    for _ in range(30):
        time.sleep(0.2)
        if rom_health(health):
            return {
                "ok": True,
                "id": key,
                "sku": meta.get("sku"),
                "title": meta.get("title"),
                "url": url,
                "up": True,
                "started": True,
                "chrome": chrome,
            }
    return {
        "ok": False,
        "error": "rom started but health not ready · try again",
        "id": key,
        "url": url,
        "up": False,
        "pid": proc.pid if proc else None,
        "chrome": chrome,
    }


def read_json(handler: SimpleHTTPRequestHandler) -> dict[str, Any]:
    n = int(handler.headers.get("Content-Length") or 0)
    if n <= 0:
        return {}
    raw = handler.rfile.read(n)
    try:
        j = json.loads(raw.decode("utf-8"))
        return j if isinstance(j, dict) else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(SYS), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        # static css/js never need ensure — that was the black-screen path
        if path.startswith("/api/"):
            ensure()

        if path == "/api/rom/list":
            return jsend(self, 200, {"ok": True, "roms": list_roms()})

        if path == "/api/mail/catalog":
            try:
                rows = list_mailable_catalog(SAFE)
            except Exception as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, "items": rows, "count": len(rows)})

        if path == "/api/health":
            leaf = primary_leaf(SAFE)
            user = discover_username(SAFE)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "app": APP,
                    "sku": SKU,
                    "role": "consider-desk",
                    "not": "notepad",
                    "port": PORT,
                    "lineage": "the-deck-host/receiver · fork for paper custody",
                    "library": str(library_root(SAFE)),
                    "library_rel": f"~local/{user}/library",
                    "user_configs": str(configs_root(SAFE)),
                    "configs_rel": (
                        f"~local/{user}/surfaces/{DEFAULT_SURFACE_FOLDER}/configs"
                    ),
                    "surface": DEFAULT_SURFACE_FOLDER,
                    "username": user,
                    "primary_id": (leaf or {}).get("id") or PRIMARY_CHIP_ID,
                },
            )

        if path == "/api/surface":
            data = read_surface_paper(SAFE)
            return jsend(self, 200, {"ok": True, "surface": data})

        # store · leaf dressups (.dsc costumes under ~host/marketplace/…)
        if path in (
            "/api/marketplace/chips/leaf/dressups",
            "/api/store/leaf/dressups",
        ):
            rows = list_leaf_dressups(SAFE)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "kind": "leaf",
                    "dressups": rows,
                    "root": rel_from_bay(SAFE, leaf_dressups_root(SAFE))
                    if leaf_dressups_root(SAFE).exists()
                    else "~host/marketplace/chips/leaf/dressups",
                },
            )

        if path.startswith("/api/marketplace/chips/leaf/dressups/") or path.startswith(
            "/api/store/leaf/dressups/"
        ):
            prefix = (
                "/api/marketplace/chips/leaf/dressups/"
                if path.startswith("/api/marketplace/chips/leaf/dressups/")
                else "/api/store/leaf/dressups/"
            )
            rest = unquote(path[len(prefix) :].strip("/"))
            # id or id.dsc or id/raw
            if rest.endswith("/raw"):
                rest = rest[: -len("/raw")].strip("/")
            if rest.endswith(".dsc"):
                rest = rest[: -len(".dsc")]
            p, text, disp = read_leaf_dressup(SAFE, rest)
            if not p or text is None:
                return jsend(self, 404, {"ok": False, "error": "dressup not found"})
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "kind": "dsc",
                    "id": p.stem,
                    "path": disp,
                    "path_display": disp,
                    "path_abs": str(p.resolve()),
                    "file": p.name,
                    "text": text,
                    "css": text,
                    "chars": len(text),
                },
            )

        if path in ("/api/surface/raw", "/api/config/surface/raw"):
            p, text, disp = read_surface_raw(SAFE)
            if not p or text is None:
                return jsend(self, 404, {"ok": False, "error": "surface paper not found"})
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "kind": "surface",
                    "path": disp,
                    "path_abs": str(p.resolve()),
                    "path_display": disp,
                    "file": p.name,
                    "text": text,
                    "chars": len(text),
                },
            )

        if path == "/api/primary":
            leaf = ensure_primary_leaf(SAFE)
            cfg = read_leaf_config(SAFE, leaf["id"])
            # dressup: shell=form · style=costume (.dsc). UI "paper" = style.
            if cfg and isinstance(cfg.get("dressup"), dict):
                du = cfg["dressup"]
                leaf = dict(leaf)
                if du.get("shell"):
                    leaf["shell"] = du["shell"]
                if du.get("style"):
                    leaf["style"] = du["style"]
                    leaf["paper"] = du["style"]
            if leaf and not leaf.get("_rel"):
                p = chip_path(SAFE, leaf["id"])
                if p:
                    leaf = dict(leaf)
                    leaf["_rel"] = rel_from_bay(SAFE, p)
                    leaf["_path"] = str(p.resolve())
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "leaf": leaf,
                    "config": cfg,
                },
            )

        if path in ("/api/leaves", "/api/scraps"):
            rows = list_leaf_chips(SAFE)
            # one bin scan for all members (was N× list_bin_rows — brutal after many chips)
            owner_idx = member_owner_index(SAFE)
            # surface.cfg layout: is the presence registry — not every library chip
            layout_ids = set(read_surface_layout(SAFE).keys())
            # skip redline chips on surface load
            surface_leaves = []
            for r in rows:
                uid = str(r.get("uid") or r.get("id") or "")
                if "red" in uid.lower():
                    continue
                cfg = read_leaf_config(SAFE, uid)
                # reuse parse from list_leaf_chips (was double full-body read)
                full = r.get("_leaf") if isinstance(r.get("_leaf"), dict) else None
                full_p = None
                pre = r.get("_path")
                if pre:
                    full_p = Path(str(pre))
                    if not full_p.is_file():
                        full_p = None
                if full is None:
                    if full_p is None:
                        full_p = chip_path(SAFE, uid)
                    full = leaf_api_from_chip_file(full_p) if full_p else None
                if full:
                    full = dict(full)
                    if full_p:
                        full["_rel"] = rel_from_bay(SAFE, full_p)
                    elif r.get("_rel"):
                        full["_rel"] = r["_rel"]
                    full["bin"] = owner_idx.get(uid) or owner_idx.get(
                        str(full.get("id") or "")
                    )
                # mail held in inbox — not dumped on the felt
                if leaf_is_inbox_held(full or r):
                    continue
                # shipped away / explicitly off this stage (library may still hold clay)
                prop = (cfg or {}).get("prop") if isinstance((cfg or {}).get("prop"), dict) else {}
                tags = [str(t).lower() for t in ((full or r).get("tags") or [])]
                if prop.get("Mail.off_desk") or "mailed-out" in tags:
                    continue
                # presence: on desk layout OR nested in a bin (board/envelope/book)
                in_layout = uid in layout_ids
                in_bin = bool(owner_idx.get(uid) or owner_idx.get(str((full or {}).get("id") or "")))
                if not in_layout and not in_bin:
                    continue
                if cfg and isinstance(cfg.get("dressup"), dict):
                    du = cfg["dressup"]
                    if full:
                        if du.get("style"):
                            full["style"] = du["style"]
                            full["paper"] = du["style"]
                        if du.get("shell"):
                            full["shell"] = du["shell"]
                surface_leaves.append(
                    {"leaf": full or r, "config": cfg, "meta": r}
                )
            # public leaves list: drop internal boot helpers (bodies live on surface)
            leaves_public = [
                {
                    k: v
                    for k, v in r.items()
                    if not str(k).startswith("_")
                }
                for r in rows
            ]
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "leaves": leaves_public,
                    "surface": surface_leaves,
                    "scraps": [],
                },
            )

        if path == "/api/bins":
            rows = list_bin_rows(SAFE)
            layout_ids = set(read_surface_layout(SAFE).keys())
            surface = []
            for r in rows:
                uid = str(r.get("uid") or r.get("id") or "")
                if not uid:
                    continue
                tags = [str(t).lower() for t in (r.get("tags") or [])]
                # inbox-held / mailed-out envelopes stay off felt
                if "inbox-held" in tags or "mailed-out" in tags:
                    continue
                # presence registry: only bins on this surface (or nested later)
                if layout_ids and uid not in layout_ids:
                    # allow bins that are members of something on-desk? rare — skip for now
                    continue
                cfg = read_bin_config(SAFE, uid)
                full_p = bin_path(SAFE, uid)
                full = bin_api_from_file(full_p) if full_p else r
                if full and full_p:
                    full = dict(full)
                    full["_rel"] = rel_from_bay(SAFE, full_p)
                    full["_path"] = str(full_p.resolve())
                surface.append({"bin": full, "config": cfg})
            return jsend(self, 200, {"ok": True, "surface": surface, "bins": surface})

        if path == "/api/tools":
            rows = list_tool_configs(SAFE)
            # stamp which board toolbox owns each tool (if any)
            for cfg in rows:
                uid = str(cfg.get("uid") or "").replace("tool-", "")
                if uid:
                    cfg["bin"] = leaf_owner_bin(SAFE, uid)
            return jsend(self, 200, {"ok": True, "tools": rows})

        if path == "/api/cards":
            rows = list_card_chips(SAFE)
            layout_ids = set(read_surface_layout(SAFE).keys())
            owner_idx = member_owner_index(SAFE)
            surface = []
            for r in rows:
                uid = str(r.get("uid") or r.get("id") or "")
                cfg = read_card_config(SAFE, uid)
                full = dict(r)
                if cfg and isinstance(cfg.get("dressup"), dict):
                    du = cfg["dressup"]
                    full["face"] = du.get("face") or du.get("style") or "plain"
                    full["paper"] = full["face"]
                    full["style"] = full["face"]
                if cfg and cfg.get("prop"):
                    full["prop"] = cfg["prop"]
                tags = [str(t).lower() for t in (full.get("tags") or [])]
                prop = full.get("prop") if isinstance(full.get("prop"), dict) else {}
                if "inbox-held" in tags or "mailed-out" in tags or prop.get("Mail.off_desk"):
                    continue
                in_layout = uid in layout_ids
                in_bin = bool(owner_idx.get(uid))
                if layout_ids and not in_layout and not in_bin:
                    continue
                surface.append({"card": full, "config": cfg, "meta": r})
            return jsend(
                self, 200, {"ok": True, "cards": rows, "surface": surface}
            )

        # card matter paper (GET) — Hands nested FM, not JSON body
        if path.startswith("/api/card/") and path.endswith("/raw"):
            rest = unquote(path[len("/api/card/") :].strip("/"))
            if rest.endswith("/raw"):
                rest = rest[: -len("/raw")].strip("/")
            cid = to_card_id(rest)
            p = card_path(SAFE, cid)
            if not p or not p.is_file():
                return jsend(self, 404, {"ok": False, "error": "card not found"})
            try:
                text = p.read_text(encoding="utf-8")
            except OSError as e:
                return jsend(self, 500, {"ok": False, "error": str(e)})
            disp = rel_from_bay(SAFE, p)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "id": cid,
                    "kind": "card",
                    "path": disp,
                    "path_abs": str(p.resolve()),
                    "path_display": disp,
                    "file": p.name,
                    "text": text,
                    "chars": len(text),
                },
            )

        if path == "/api/fax/destinations":
            return jsend(
                self,
                200,
                {"ok": True, "destinations": list_fax_destinations()},
            )

        if path == "/api/mail/inboxes":
            try:
                rescued = recover_orphaned_mail_parcels(SAFE)
            except Exception:
                rescued = []
            rows = list_inbox_instances(SAFE)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "rescued": rescued,
                    "inboxes": [
                        {
                            "uid": r.get("uid"),
                            "address": r.get("address"),
                            "hasMail": r.get("hasMail"),
                            "mail": r.get("mail") or [],
                            "count": len(r.get("mail") or []),
                        }
                        for r in rows
                    ],
                },
            )

        if path.startswith("/api/tool/package/"):
            # /api/tool/package/stamper/stamper.set  (folder uid = package)
            rest = unquote(path[len("/api/tool/package/") :].strip("/"))
            parts = rest.split("/", 1)
            if len(parts) < 2:
                return jsend(self, 400, {"ok": False, "error": "package/file required"})
            pkg, fname = parts[0], parts[1]
            # security: no path escape
            if ".." in fname or fname.startswith("/") or "\\" in fname:
                return jsend(self, 400, {"ok": False, "error": "bad path"})
            # resolve_package_id lives inside tool_package_file (stamp→stamper)
            p = tool_package_file(SAFE, pkg, fname)
            if not p or not p.is_file():
                # try nested dressups
                p = tool_package_file(SAFE, pkg, fname.replace("\\", "/"))
            if not p or not p.is_file():
                return jsend(self, 404, {"ok": False, "error": "file not found"})
            try:
                text = p.read_text(encoding="utf-8")
            except OSError as e:
                return jsend(self, 500, {"ok": False, "error": str(e)})
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "package": pkg,
                    "file": fname,
                    "text": text,
                    "path_display": rel_from_bay(SAFE, p),
                },
            )

        if path.startswith("/api/leaf/") or path.startswith("/api/scrap/"):
            prefix = "/api/leaf/" if path.startswith("/api/leaf/") else "/api/scrap/"
            rest = unquote(path[len(prefix) :].strip("/"))
            if rest.endswith("/raw"):
                sid = rest[: -len("/raw")].strip("/")
                p, leaf = find_leaf(sid)
                if not leaf or not p:
                    return jsend(self, 404, {"ok": False, "error": "not found"})
                try:
                    text = Path(p).read_text(encoding="utf-8")
                except OSError as e:
                    return jsend(self, 500, {"ok": False, "error": str(e)})
                abs_p = str(Path(p).resolve())
                display = rel_from_bay(SAFE, Path(p))
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "id": leaf.get("id"),
                        "path": display,
                        "path_abs": abs_p,
                        "path_display": display,
                        "file": Path(p).name,
                        "text": text,
                        "chars": len(text),
                    },
                )
            p, leaf = find_leaf(rest)
            if not leaf:
                return jsend(self, 404, {"ok": False, "error": "not found"})
            # surface scars (stamper / chipper) live on config.prop
            try:
                cfg = read_leaf_config(SAFE, leaf.get("id") or rest)
                if cfg and isinstance(cfg.get("prop"), dict):
                    leaf = dict(leaf)
                    leaf["prop"] = cfg["prop"]
            except Exception:
                pass
            return jsend(self, 200, {"ok": True, "leaf": leaf, "scrap": leaf})

        # bin matter paper (primary .bin)
        if path.startswith("/api/bin/") and (
            path.endswith("/raw") or path.count("/") >= 3
        ):
            rest = unquote(path[len("/api/bin/") :].strip("/"))
            if rest.endswith("/raw"):
                bid = to_bin_id(rest[: -len("/raw")].strip("/"))
                p = bin_path(SAFE, bid)
                if not p or not p.is_file():
                    return jsend(self, 404, {"ok": False, "error": "bin not found"})
                try:
                    text = p.read_text(encoding="utf-8")
                except OSError as e:
                    return jsend(self, 500, {"ok": False, "error": str(e)})
                display = rel_from_bay(SAFE, p)
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "kind": "bin",
                        "id": bid,
                        "path": display,
                        "path_abs": str(p.resolve()),
                        "path_display": display,
                        "file": p.name,
                        "text": text,
                        "chars": len(text),
                    },
                )
            # GET /api/bin/{id} → row
            bid = to_bin_id(rest)
            p = bin_path(SAFE, bid)
            if not p:
                return jsend(self, 404, {"ok": False, "error": "bin not found"})
            row = bin_api_from_file(p)
            if row:
                row["_rel"] = rel_from_bay(SAFE, p)
            return jsend(
                self,
                200,
                {"ok": True, "bin": row, "config": read_bin_config(SAFE, bid)},
            )

        if path.startswith("/api/config/") and path.endswith("/raw"):
            rest = unquote(path[len("/api/config/") :]).strip("/")
            if rest.endswith("/raw"):
                rest = rest[: -len("/raw")].strip("/")
            # bin config: board[0] · envelope[1] · bin-envelope[1] · bin:…
            # (living matter uids are not only board[ — books/shelves/decks/envelopes too)
            is_bin_cfg = (
                rest.startswith("bin:")
                or rest.startswith("bin[")
                or rest.startswith("bin-")
                or rest.startswith("board[")
                or rest.startswith("book[")
                or rest.startswith("shelf[")
                or rest.startswith("deck[")
                or rest.startswith("envelope[")
            )
            if is_bin_cfg:
                raw = rest[4:] if rest.startswith("bin:") else rest
                bid = to_bin_id(raw)
                p, text, path_display = read_bin_config_raw(SAFE, bid)
                if not p or text is None:
                    return jsend(self, 404, {"ok": False, "error": "config not found"})
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "kind": "config",
                        "id": bid,
                        "path": path_display or str(p.resolve()),
                        "path_abs": str(p.resolve()),
                        "path_display": path_display,
                        "file": p.name,
                        "text": text,
                        "chars": len(text),
                    },
                )
            # tool instance cfg: tool-stamper[0] · stamper[0] · tool:stamper[0]
            is_tool_cfg = (
                rest.startswith("tool-")
                or rest.startswith("tool:")
                or rest.startswith("stamper[")
            )
            if is_tool_cfg:
                tid = rest[5:] if rest.startswith("tool:") else rest
                if tid.startswith("tool-"):
                    tid = tid[5:]
                if tid.endswith(".cfg"):
                    tid = tid[: -len(".cfg")]
                cfg = read_tool_config(SAFE, tid)
                if not cfg or not cfg.get("_path"):
                    return jsend(self, 404, {"ok": False, "error": "tool config not found"})
                p = Path(cfg["_path"])
                try:
                    text = p.read_text(encoding="utf-8")
                except OSError as e:
                    return jsend(self, 500, {"ok": False, "error": str(e)})
                disp = cfg.get("path_display") or rel_from_bay(SAFE, p)
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "kind": "config",
                        "id": tid,
                        "path": disp,
                        "path_abs": str(p.resolve()),
                        "path_display": disp,
                        "file": p.name,
                        "text": text,
                        "chars": len(text),
                    },
                )
            # card instance cfg: card[0] · chip-card[0]
            if (
                rest.startswith("card[")
                or rest.startswith("card:")
                or rest.startswith("chip-card")
                or is_card_id(rest)
            ):
                raw_c = rest
                if raw_c.startswith("card:"):
                    raw_c = raw_c[5:]
                if raw_c.startswith("chip-"):
                    raw_c = raw_c[5:]
                if raw_c.endswith(".cfg"):
                    raw_c = raw_c[: -len(".cfg")]
                cid = to_card_id(raw_c)
                cfg = read_card_config(SAFE, cid)
                if not cfg or not cfg.get("_path"):
                    return jsend(
                        self, 404, {"ok": False, "error": "card config not found"}
                    )
                p = Path(cfg["_path"])
                try:
                    text = p.read_text(encoding="utf-8")
                except OSError as e:
                    return jsend(self, 500, {"ok": False, "error": str(e)})
                disp = cfg.get("path_display") or rel_from_bay(SAFE, p)
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "kind": "config",
                        "id": cid,
                        "path": disp,
                        "path_abs": str(p.resolve()),
                        "path_display": disp,
                        "file": p.name,
                        "text": text,
                        "chars": len(text),
                    },
                )
            # accept leaf id or leaf:id
            lid = rest
            if lid.startswith("leaf:"):
                lid = lid[5:]
            elif lid.startswith("leaf_leaf_"):
                lid = lid[len("leaf_") :]
            p, text, path_display = read_config_raw(SAFE, lid)
            if not p or text is None:
                # empty config still "exists" as concept — 404 until pose saved
                return jsend(self, 404, {"ok": False, "error": "config not found"})
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "kind": "config",
                    "id": lid,
                    "path": path_display or str(p.resolve()),
                    "path_abs": str(p.resolve()),
                    "path_display": path_display,
                    "file": p.name,
                    "text": text,
                    "chars": len(text),
                },
            )

        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        ensure()
        path = urlparse(self.path).path
        body = read_json(self)

        if path in ("/api/leaf/save", "/api/scrap/save"):
            sc = body.get("leaf") or body.get("scrap") or body
            if not sc.get("id"):
                return jsend(self, 400, {"ok": False, "error": "id required"})
            sc["id"] = to_leaf_chip_id(str(sc["id"]))
            # style/paper → config dressup only (not on chip)
            style = sc.get("style") or sc.get("paper")
            shell = sc.get("shell") or "paper"
            write_leaf_chip(SAFE, sc)
            if style or shell:
                prev = read_leaf_config(SAFE, sc["id"])
                pose = (prev or {}).get("pose") or (prev or {}).get("pos") or {}
                write_leaf_config(
                    SAFE,
                    sc["id"],
                    pose=pose,
                    dressup={"shell": shell, "style": style or "lined"},
                )
            p = chip_path(SAFE, sc["id"])
            full = leaf_api_from_chip_file(p) if p else sc
            if full and p:
                full["_rel"] = rel_from_bay(SAFE, p)
            if full:
                full["shell"] = shell
                full["style"] = style or "lined"
                full["paper"] = style or "lined"
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "leaf": full,
                    "scrap": full,
                    "chars": len((full or {}).get("body") or ""),
                    "file": (full or {}).get("_file"),
                    "path": (full or {}).get("_rel") or (full or {}).get("_path"),
                    "path_display": (full or {}).get("_rel"),
                    "path_abs": (full or {}).get("_path"),
                },
            )

        if path == "/api/leaf/redline":
            target = to_leaf_chip_id(
                (body.get("target_id") or body.get("leaf_id") or "").strip()
            )
            diff_text = body.get("diff") or body.get("text") or ""
            note = (body.get("note") or "").strip()
            if not target:
                return jsend(self, 400, {"ok": False, "error": "target_id required"})
            if not str(diff_text).strip():
                return jsend(self, 400, {"ok": False, "error": "empty diff"})
            t = int(__import__("time").time())
            rid = f"leaf_red_{t}"
            title = (body.get("title") or f"redline · {target}").strip()
            body_md = (
                f"# redline\n\n"
                f"target: `{target}`\n\n"
                f"{note + chr(10) + chr(10) if note else ''}"
                f"```diff\n{diff_text.rstrip()}\n```\n"
            )
            leaf = {
                "id": rid,
                "title": title,
                "author": (body.get("author") or "red-pen").strip() or "red-pen",
                "paper": "plain",
                "stamps": ["urgent"],
                "body": body_md,
                "created": t,
            }
            write_leaf_chip(SAFE, leaf)
            p = chip_path(SAFE, rid)
            full = leaf_api_from_chip_file(p) if p else leaf
            # redline chip: disk only · do not auto-spawn a second felt object
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "leaf": full,
                    "path": (full or {}).get("_path"),
                    "on_felt": False,
                },
            )

        if path == "/api/pose":
            raw_id = (
                body.get("id")
                or body.get("leaf_id")
                or body.get("card_id")
                or body.get("bin_id")
                or ""
            ).strip()
            if not raw_id:
                return jsend(self, 400, {"ok": False, "error": "id required"})
            pose = body.get("pose") if isinstance(body.get("pose"), dict) else {}
            dress = body.get("dressup") if isinstance(body.get("dressup"), dict) else {}
            if is_card_id(raw_id) or str(raw_id).startswith("card"):
                cid = to_card_id(raw_id)
                prop = body.get("prop") if isinstance(body.get("prop"), dict) else None
                path_out = write_card_config(
                    SAFE, cid, pose=pose, dressup=dress or None, prop=prop
                )
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "path": str(path_out.resolve()),
                        "file": path_out.name,
                        "layout_owner": "surface",
                    },
                )
            if (
                is_bin_id(raw_id)
                or str(raw_id).startswith("bin[")
                or str(raw_id).startswith("board[")
                or str(raw_id).startswith("book[")
                or str(raw_id).startswith("shelf[")
                or str(raw_id).startswith("deck[")
            ):
                bid = to_bin_id(raw_id)
                if str(bid).startswith("book["):
                    st = "book"
                elif str(bid).startswith("shelf["):
                    st = "shelf"
                elif str(bid).startswith("deck["):
                    st = "deck"
                else:
                    st = "board"
                dress = dict(dress) if dress else {}
                if body.get("paper"):
                    dress["style"] = body.get("paper")
                dress.setdefault(
                    "shell",
                    "bookbox"
                    if st == "book"
                    else "bookshelf"
                    if st == "shelf"
                    else "deckbox"
                    if st == "deck"
                    else "boardbox",
                )
                prop = body.get("prop") if isinstance(body.get("prop"), dict) else None
                # pose → surface.layout; dress+prop → object cfg
                path_out = write_bin_config(
                    SAFE,
                    bid,
                    pose=pose,
                    dressup=dress,
                    prop=prop,
                    subtype=st,
                )
            else:
                lid = to_leaf_chip_id(raw_id)
                # paper field from UI = costume style (lined), shell stays paper
                if body.get("paper"):
                    dress = dict(dress)
                    dress["style"] = body.get("paper")
                    dress.setdefault("shell", "paper")
                prop = body.get("prop") if isinstance(body.get("prop"), dict) else None
                path_out = write_leaf_config(
                    SAFE, lid, pose=pose, dressup=dress, prop=prop
                )
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "path": str(path_out.resolve()),
                    "file": path_out.name,
                    "layout_owner": "surface",
                },
            )

        # save costume sheet (.dsc) — live studio edit
        if path.startswith("/api/marketplace/chips/leaf/dressups/") and path.endswith(
            "/save"
        ):
            rest = unquote(
                path[len("/api/marketplace/chips/leaf/dressups/") :].strip("/")
            )
            if rest.endswith("/save"):
                rest = rest[: -len("/save")].strip("/")
            if rest.endswith(".dsc"):
                rest = rest[: -len(".dsc")]
            css = body.get("css") if body.get("css") is not None else body.get("text")
            if css is None:
                return jsend(self, 400, {"ok": False, "error": "css/text required"})
            try:
                path_out = write_leaf_dressup(SAFE, rest, str(css))
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "id": path_out.stem,
                    "file": path_out.name,
                    "path_display": rel_from_bay(SAFE, path_out),
                    "chars": len(str(css)),
                },
            )

        if path == "/api/surface/save":
            # surface paper: id · name · auth — auth renames ~local/<user>/
            surf_in = body.get("surface") if isinstance(body.get("surface"), dict) else body
            try:
                data = write_surface_paper(
                    SAFE,
                    {
                        "id": surf_in.get("id"),
                        "name": surf_in.get("name"),
                        "auth": surf_in.get("auth"),
                    },
                    body=body.get("body") if isinstance(body.get("body"), str) else "",
                )
            except OSError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, "surface": data})

        if path == "/api/leaf/reset":
            # optional: wipe primary body only — not used by default UI
            leaf = ensure_primary_leaf(SAFE)
            return jsend(self, 200, {"ok": True, "leaf": leaf})

        if path in ("/api/leaf/delete", "/api/scrap/delete"):
            # multi-leaf desk: refuse only the primary spine; other papers may go
            lid = to_leaf_chip_id((body.get("id") or "").strip())
            if lid == PRIMARY_CHIP_ID:
                return jsend(
                    self,
                    400,
                    {
                        "ok": False,
                        "error": "will not trash primary leaf · remove other leaves freely",
                    },
                )
            ok = delete_leaf_chip(SAFE, lid)
            return jsend(self, 200 if ok else 404, {"ok": ok})

        if path in ("/api/leaf/spawn", "/api/scrap/spawn"):
            title = (body.get("title") or "untitled").strip() or "untitled"
            author = (body.get("author") or "unknown").strip() or "unknown"
            x = body.get("x")
            y = body.get("y")
            try:
                x = float(x) if x is not None else None
                y = float(y) if y is not None else None
            except (TypeError, ValueError):
                x, y = None, None
            out = spawn_leaf(SAFE, title=title, author=author, x=x, y=y)
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/bin/spawn":
            title = (body.get("title") or "untitled board").strip() or "untitled board"
            author = (body.get("author") or "unknown").strip() or "unknown"
            subtype = (body.get("subtype") or "board").strip() or "board"
            x = body.get("x")
            y = body.get("y")
            try:
                x = float(x) if x is not None else None
                y = float(y) if y is not None else None
            except (TypeError, ValueError):
                x, y = None, None
            out = spawn_bin(
                SAFE, title=title, author=author, subtype=subtype, x=x, y=y
            )
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/bin/despawn" or path == "/api/bin/delete":
            bid = to_bin_id(
                str(body.get("id") or body.get("uid") or body.get("bin_id") or "").strip()
            )
            if not bid:
                return jsend(self, 400, {"ok": False, "error": "id required"})
            out = despawn_bin(SAFE, bid)
            if not out.get("ok"):
                return jsend(self, 400, out)
            return jsend(self, 200, out)

        if path == "/api/bin/save":
            b = body.get("bin") or body
            bid = to_bin_id(str(b.get("uid") or b.get("id") or "").strip())
            if not bid or not bin_path(SAFE, bid):
                return jsend(self, 404, {"ok": False, "error": "bin not found"})
            prev = bin_api_from_file(bin_path(SAFE, bid)) or {}
            row = {
                **prev,
                "uid": bid,
                "id": bid,
                "title": (
                    b.get("title") or b.get("name") or prev.get("title") or "untitled board"
                ).strip()
                or "untitled board",
                "author": (b.get("author") or b.get("auth") or prev.get("author") or "unknown"),
                "chips": b.get("chips") if b.get("chips") is not None else prev.get("chips"),
                "subtype": b.get("subtype") or prev.get("subtype") or "board",
                "created": prev.get("created"),
                "tags": b.get("tags") if b.get("tags") is not None else prev.get("tags"),
            }
            path_out = write_bin_file(SAFE, row)
            full = bin_api_from_file(path_out)
            if full:
                full["_rel"] = rel_from_bay(SAFE, path_out)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "bin": full,
                    "file": path_out.name,
                    "config": read_bin_config(SAFE, bid),
                },
            )

        if path == "/api/bin/member":
            bid = to_bin_id(str(body.get("bin_id") or body.get("bin") or "").strip())
            raw_member = str(
                body.get("leaf_id")
                or body.get("leaf")
                or body.get("member_id")
                or body.get("book_id")
                or ""
            ).strip()
            action = (body.get("action") or body.get("op") or "add").strip().lower()
            if not bid or not raw_member:
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "bin_id and leaf_id/book_id required"},
                )
            if not bin_path(SAFE, bid):
                return jsend(self, 404, {"ok": False, "error": "bin not found"})
            # shelves hold books (bin ids); boards/books hold leaves (chip ids)
            host = None
            try:
                bp = bin_path(SAFE, bid)
                host = bin_api_from_file(bp) if bp else None
            except Exception:
                host = None
            host_type = str(
                (host or {}).get("subtype")
                or (host or {}).get("bin_type")
                or "board"
            )
            host_uid = str((host or {}).get("uid") or (host or {}).get("id") or bid)
            if re.match(r"^deck\[", host_uid):
                host_type = "deck"
            elif re.match(r"^book\[", host_uid):
                host_type = "book"
            elif re.match(r"^shelf\[", host_uid):
                host_type = "shelf"
            elif re.match(r"^board\[", host_uid):
                host_type = "board"
            if host_type == "shelf":
                mid = to_bin_id(raw_member)
                if not (
                    re.match(r"^book\[\d+\]$", mid)
                    or re.match(r"^deck\[\d+\]$", mid)
                ):
                    return jsend(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "shelf holds books or decks · drop a closed volume",
                        },
                    )
                if not bin_path(SAFE, mid):
                    return jsend(
                        self,
                        404,
                        {"ok": False, "error": "volume not found · " + mid},
                    )
            elif host_type == "book":
                # books hold leaf pages only — never cards
                if is_card_id(raw_member) or str(raw_member).startswith("card"):
                    return jsend(
                        self,
                        400,
                        {
                            "ok": False,
                            "error": "cards go in a deck · not book pages",
                        },
                    )
                mid = to_leaf_chip_id(raw_member)
                if not mid or not chip_path(SAFE, mid):
                    return jsend(
                        self, 404, {"ok": False, "error": "leaf not found · " + mid}
                    )
            elif host_type == "deck":
                # envelope · cards OR papers (leaves)
                if (
                    is_card_id(raw_member)
                    or re.match(r"^card[\[_]", str(raw_member))
                    or str(raw_member).startswith("card")
                ):
                    mid = to_card_id(raw_member)
                    if not mid or not card_path(SAFE, mid):
                        return jsend(
                            self,
                            404,
                            {"ok": False, "error": "card not found · " + mid},
                        )
                else:
                    mid = to_leaf_chip_id(raw_member)
                    if not mid or not chip_path(SAFE, mid):
                        return jsend(
                            self,
                            404,
                            {
                                "ok": False,
                                "error": "envelope holds cards or papers · "
                                + (mid or raw_member),
                            },
                        )
            else:
                # board · leaf[n] or card[n] or tool (toolbox thrash)
                # CRITICAL: to_leaf_chip_id("card[0]") returns "" then chip_path("")
                # resolves leaf[0] — drop-card used to yank leaf[0] into the box.
                if is_card_id(raw_member) or re.match(
                    r"^card[\[_]", str(raw_member)
                ) or str(raw_member).startswith("card"):
                    mid = to_card_id(raw_member)
                    if not mid or not card_path(SAFE, mid):
                        return jsend(
                            self,
                            404,
                            {"ok": False, "error": "card not found · " + mid},
                        )
                elif is_tool_member_id(raw_member):
                    mid = to_tool_member_id(raw_member)
                    if not mid or not read_tool_config(SAFE, mid):
                        return jsend(
                            self,
                            404,
                            {"ok": False, "error": "tool not found · " + mid},
                        )
                else:
                    mid = to_leaf_chip_id(raw_member)
                    if not mid or not chip_path(SAFE, mid):
                        return jsend(
                            self,
                            404,
                            {"ok": False, "error": "leaf not found · " + mid},
                        )
            add = action not in ("remove", "out", "pull", "leave")
            try:
                out = set_bin_membership(SAFE, bid, mid, add=add)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(
                self, 200, {"ok": True, **out, "leaf_id": mid, "member_id": mid, "added": add}
            )

        # Hermes mail · deliver chip into inbox by Receive.address
        if path == "/api/mail/send":
            address = str(body.get("address") or body.get("to") or "").strip()
            title = str(body.get("title") or body.get("subject") or "letter").strip()
            mail_body = body.get("body") or body.get("payload") or ""
            if not isinstance(mail_body, str):
                mail_body = str(mail_body)
            from_auth = str(
                body.get("from") or body.get("auth") or body.get("from_auth") or "Hermes"
            ).strip()
            if not address:
                return jsend(self, 400, {"ok": False, "error": "address required"})
            try:
                out = deliver_mail(
                    SAFE,
                    address=address,
                    title=title,
                    body=mail_body,
                    from_auth=from_auth or "Hermes",
                )
            except ValueError as e:
                return jsend(self, 404, {"ok": False, "error": str(e)})
            except Exception as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, out)

        if path == "/api/mail/inboxes":
            try:
                rescued = recover_orphaned_mail_parcels(SAFE)
            except Exception:
                rescued = []
            rows = list_inbox_instances(SAFE)
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "rescued": rescued,
                    "inboxes": [
                        {
                            "uid": r.get("uid"),
                            "address": r.get("address"),
                            "hasMail": r.get("hasMail"),
                            "mail": r.get("mail") or [],
                            "count": len(r.get("mail") or []),
                        }
                        for r in rows
                    ],
                },
            )

        if path == "/api/mail/list":
            address = str(body.get("address") or "").strip()
            inbox_uid = str(body.get("inbox") or body.get("uid") or "").strip()
            box = None
            if address:
                box = find_inbox_by_address(SAFE, address)
            elif inbox_uid:
                for r in list_inbox_instances(SAFE):
                    if r.get("uid") == inbox_uid:
                        box = r
                        break
            if not box:
                return jsend(self, 404, {"ok": False, "error": "inbox not found"})
            # recover list if pose-save emptied Receive.mail
            try:
                fixed = reconcile_inbox_mail(SAFE, str(box.get("uid") or ""))
                box = dict(box)
                box["mail"] = fixed.get("mail") or []
                box["hasMail"] = fixed.get("hasMail")
            except ValueError:
                pass
            items = []
            for lid in box.get("mail") or []:
                items.append(mail_item_summary(SAFE, str(lid)))
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "inbox": box.get("uid"),
                    "address": box.get("address"),
                    "hasMail": box.get("hasMail"),
                    "mail": items,
                },
            )

        if path == "/api/mail/take":
            lid = str(
                body.get("leaf_id")
                or body.get("item_id")
                or body.get("id")
                or body.get("leaf")
                or ""
            ).strip()
            if not lid:
                return jsend(self, 400, {"ok": False, "error": "item_id required"})
            try:
                out = take_item_from_inbox(SAFE, lid)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            # back-compat: leaf path still exposes .leaf
            if out.get("kind") == "leaf" and out.get("leaf"):
                pass
            return jsend(self, 200, out)

        # file existing leaf/card/deck into a mailbox (desk parcels · not TERMINALS)
        # if address homes on another girl desk → ship instance (network), not local park
        if path == "/api/mail/file":
            lid = str(
                body.get("leaf_id")
                or body.get("item_id")
                or body.get("leaf")
                or body.get("id")
                or body.get("deck_id")
                or body.get("card_id")
                or ""
            ).strip()
            address = str(body.get("address") or body.get("to") or "").strip()
            inbox_uid = str(
                body.get("inbox") or body.get("uid") or body.get("inbox_uid") or ""
            ).strip()
            if not lid:
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "item_id required (leaf · card · deck)"},
                )
            from_auth = str(
                body.get("from") or body.get("auth") or body.get("from_auth") or "Hermes"
            ).strip()
            # network hop when To is another girl's home address
            if address and is_remote_girl_address(address):
                try:
                    parcel = export_mail_parcel(SAFE, lid)
                    home = girl_mail_home_url(address)
                    import urllib.error
                    import urllib.request

                    raw = json.dumps(
                        {
                            "parcel": parcel,
                            "address": address,
                            "from": from_auth or "Hermes",
                        }
                    ).encode("utf-8")
                    req = urllib.request.Request(
                        home.rstrip("/") + "/api/mail/accept",
                        data=raw,
                        headers={
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                        },
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        remote = json.loads(resp.read().decode("utf-8"))
                    if not remote.get("ok"):
                        return jsend(
                            self,
                            int(remote.get("http") or 502),
                            remote if isinstance(remote, dict) else {"ok": False},
                        )
                    scar_item_sent(
                        SAFE,
                        lid,
                        to_address=address,
                        dest_item_id=str(remote.get("item_id") or ""),
                    )
                    remote["via"] = "girl-network"
                    remote["source_item"] = lid
                    remote["source_kept"] = True
                    remote["ship"] = "instance"
                    return jsend(self, 200, remote)
                except urllib.error.HTTPError as e:
                    try:
                        err = json.loads(e.read().decode("utf-8"))
                    except Exception:
                        err = {"ok": False, "error": str(e)}
                    err.setdefault("ok", False)
                    return jsend(self, e.code, err)
                except Exception as e:
                    return jsend(
                        self,
                        502,
                        {
                            "ok": False,
                            "error": f"ship failed · is dest desk up? · {e}",
                            "home": girl_mail_home_url(address),
                        },
                    )
            try:
                out = file_item_to_inbox(
                    SAFE,
                    lid,
                    address=address or None,
                    inbox_uid=inbox_uid or None,
                )
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            except Exception as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, out)

        # accept reminted parcel from another girl desk (or Hermes)
        if path == "/api/mail/accept":
            parcel = body.get("parcel") if isinstance(body.get("parcel"), dict) else body
            address = str(
                body.get("address") or body.get("to") or parcel.get("address") or ""
            ).strip()
            from_auth = str(
                body.get("from") or body.get("auth") or body.get("from_auth") or "Hermes"
            ).strip()
            if not address:
                return jsend(self, 400, {"ok": False, "error": "address required"})
            try:
                out = accept_mail_parcel(
                    SAFE,
                    parcel if isinstance(parcel, dict) else {},
                    address=address,
                    from_auth=from_auth or "Hermes",
                )
            except ValueError as e:
                return jsend(self, 404, {"ok": False, "error": str(e)})
            except Exception as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, out)

        # explicit ship (same as network file) · Hermes multi-desk uses this
        if path == "/api/mail/ship":
            lid = str(
                body.get("item_id")
                or body.get("leaf_id")
                or body.get("id")
                or body.get("deck_id")
                or body.get("card_id")
                or ""
            ).strip()
            address = str(body.get("address") or body.get("to") or "").strip()
            from_auth = str(
                body.get("from") or body.get("auth") or body.get("from_auth") or "Hermes"
            ).strip()
            if not lid or not address:
                return jsend(
                    self, 400, {"ok": False, "error": "item_id and address required"}
                )
            # reuse file route logic via internal re-post shape
            body_ship = {
                "item_id": lid,
                "address": address,
                "from": from_auth,
            }
            # local or remote handled by /api/mail/file branch — call same path code
            if is_remote_girl_address(address) or girl_mail_home_url(address):
                # fall through by simulating file
                try:
                    if is_remote_girl_address(address):
                        parcel = export_mail_parcel(SAFE, lid)
                        home = girl_mail_home_url(address)
                        import urllib.error
                        import urllib.request

                        raw = json.dumps(
                            {
                                "parcel": parcel,
                                "address": address,
                                "from": from_auth or "Hermes",
                            }
                        ).encode("utf-8")
                        req = urllib.request.Request(
                            home.rstrip("/") + "/api/mail/accept",
                            data=raw,
                            headers={
                                "Content-Type": "application/json",
                                "Accept": "application/json",
                            },
                            method="POST",
                        )
                        with urllib.request.urlopen(req, timeout=20) as resp:
                            remote = json.loads(resp.read().decode("utf-8"))
                        if remote.get("ok"):
                            scar_item_sent(
                                SAFE,
                                lid,
                                to_address=address,
                                dest_item_id=str(remote.get("item_id") or ""),
                            )
                            remote["via"] = "girl-network"
                            remote["source_item"] = lid
                            remote["source_kept"] = True
                            remote["ship"] = "instance"
                        return jsend(
                            self,
                            200 if remote.get("ok") else int(remote.get("http") or 502),
                            remote,
                        )
                    out = file_item_to_inbox(SAFE, lid, address=address)
                    out["via"] = "local"
                    out["ship"] = "local-hold"
                    return jsend(self, 200, out)
                except Exception as e:
                    return jsend(self, 502, {"ok": False, "error": str(e)})
            try:
                out = file_item_to_inbox(SAFE, lid, address=address)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, out)

        if path == "/api/mail/network":
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "network": dict(GIRL_MAIL_NETWORK),
                    "note": "uid local · address global · ship remints instance",
                },
            )

        # catalog of mailable parcels on this desk (Hermes picker)
        if path == "/api/mail/catalog":
            try:
                rows = list_mailable_catalog(SAFE)
            except Exception as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, "items": rows, "count": len(rows)})

        # ROMs · list / ensure running (desk forever · program on top)
        if path == "/api/rom/list":
            return jsend(self, 200, {"ok": True, "roms": list_roms()})

        if path == "/api/rom/ensure":
            rid = str(body.get("id") or body.get("rom") or "").strip()
            if not rid:
                return jsend(self, 400, {"ok": False, "error": "id required"})
            out = ensure_rom(rid)
            code = 200 if out.get("ok") else 502
            return jsend(self, code, out)

        if path == "/api/rom/stop":
            rid = str(body.get("id") or body.get("rom") or "").strip()
            if not rid:
                return jsend(self, 400, {"ok": False, "error": "id required"})
            out = stop_rom(rid)
            code = 200 if out.get("ok") else 500
            return jsend(self, code, out)

        # place ROM cart on felt (desk object) — does not launch the game
        if path == "/api/rom/place":
            rid = str(body.get("id") or body.get("rom") or "kde-001").strip()
            key = normalize_rom_key(rid)
            meta = ROM_CATALOG.get(key)
            if not meta:
                return jsend(
                    self, 404, {"ok": False, "error": "unknown rom · " + rid}
                )
            x, y = body.get("x"), body.get("y")
            try:
                x = float(x) if x is not None else None
                y = float(y) if y is not None else None
            except (TypeError, ValueError):
                x, y = None, None
            try:
                out = place_rom_cart(
                    SAFE,
                    rom_id=key,
                    title=str(meta.get("title") or key),
                    sku=str(meta.get("sku") or ""),
                    case_shell=str(meta.get("case_shell") or "classicboi"),
                    julie_tint=str(meta.get("julie_tint") or ""),
                    plate_css=str(meta.get("plate_css") or ""),
                    catalog_id=str(meta.get("catalog_id") or ""),
                    x=x,
                    y=y,
                    refresh_face=True,
                )
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, **out})

        # guest tools · install + spawn instance
        if path == "/api/tool/despawn" or path == "/api/tool/delete":
            tid = str(
                body.get("uid") or body.get("id") or body.get("tool") or ""
            ).strip()
            if not tid:
                return jsend(self, 400, {"ok": False, "error": "uid required"})
            ok = delete_tool_config(SAFE, tid)
            if not ok:
                return jsend(self, 404, {"ok": False, "error": "tool not found · " + tid})
            return jsend(self, 200, {"ok": True, "deleted": tid})

        if path == "/api/tool/install":
            pkg = (body.get("package") or body.get("cli") or body.get("id") or "").strip()
            if not pkg:
                return jsend(self, 400, {"ok": False, "error": "package required"})
            try:
                out = install_tool_package(SAFE, pkg)
            except ValueError as e:
                return jsend(self, 404, {"ok": False, "error": str(e)})
            return jsend(self, 200, out)

        if path == "/api/tool/spawn":
            cli = (body.get("cli") or body.get("tool") or "stamper").strip()
            label = body.get("label")
            dress = body.get("dress") or body.get("tool_dress")
            x, y = body.get("x"), body.get("y")
            try:
                x = float(x) if x is not None else None
                y = float(y) if y is not None else None
            except (TypeError, ValueError):
                x, y = None, None
            try:
                out = spawn_tool(
                    SAFE, cli=cli, label=label, tool_dress=dress, x=x, y=y
                )
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, **out})

        # Chester's Imports fax · destinations + send (copy clean MD)
        if path == "/api/fax/destinations":
            return jsend(
                self,
                200,
                {"ok": True, "destinations": list_fax_destinations()},
            )

        if path == "/api/fax/send":
            item_id = str(
                body.get("item_id")
                or body.get("leaf_id")
                or body.get("card_id")
                or body.get("id")
                or ""
            ).strip()
            dest = str(
                body.get("dest")
                or body.get("destination")
                or body.get("Fax.dest")
                or ""
            ).strip()
            if not item_id:
                return jsend(
                    self, 400, {"ok": False, "error": "item_id required"}
                )
            if not dest:
                return jsend(
                    self, 400, {"ok": False, "error": "dest required"}
                )
            try:
                out = fax_item_to_destination(SAFE, item_id, dest)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            except OSError as e:
                return jsend(
                    self, 500, {"ok": False, "error": f"write failed · {e}"}
                )
            return jsend(self, 200, out)

        if path == "/api/tool/mark":
            # stamper use → leaf or card prop
            raw_target = str(
                body.get("leaf_id")
                or body.get("card_id")
                or body.get("leaf")
                or body.get("id")
                or ""
            ).strip()
            mark = body.get("prop") if isinstance(body.get("prop"), dict) else {}
            if not raw_target or not mark:
                return jsend(
                    self,
                    400,
                    {"ok": False, "error": "leaf_id/card_id and prop required"},
                )
            try:
                out = merge_leaf_prop_mark(SAFE, raw_target, mark)
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            except Exception as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            if is_card_id(raw_target) or str(raw_target).startswith("card"):
                cfg = read_card_config(SAFE, to_card_id(raw_target))
            else:
                cfg = read_leaf_config(SAFE, to_leaf_chip_id(raw_target))
            return jsend(self, 200, {"ok": True, **out, "config": cfg})

        if path == "/api/card/spawn":
            title = (body.get("title") or "untitled card").strip() or "untitled card"
            author = (body.get("author") or "unknown").strip() or "unknown"
            subject = (body.get("subject") or "").strip()
            x, y = body.get("x"), body.get("y")
            try:
                x = float(x) if x is not None else None
                y = float(y) if y is not None else None
            except (TypeError, ValueError):
                x, y = None, None
            try:
                out = spawn_card(
                    SAFE, title=title, author=author, subject=subject, x=x, y=y
                )
            except ValueError as e:
                return jsend(self, 400, {"ok": False, "error": str(e)})
            return jsend(self, 200, {"ok": True, **out})

        if path == "/api/card/save":
            sc = body.get("card") or body
            if not sc.get("id") and not sc.get("uid"):
                return jsend(self, 400, {"ok": False, "error": "id required"})
            cid = to_card_id(str(sc.get("uid") or sc.get("id")))
            sc["id"] = cid
            sc["uid"] = cid
            write_card_chip(SAFE, sc)
            if sc.get("face") or sc.get("style") or sc.get("paper"):
                face = sc.get("face") or sc.get("style") or sc.get("paper")
                write_card_config(
                    SAFE,
                    cid,
                    pose=None,
                    dressup={"id": cid, "shell": "card", "face": face, "style": face},
                )
            p = card_path(SAFE, cid)
            full = card_api_from_file(p) if p else sc
            if full and p:
                full["_rel"] = rel_from_bay(SAFE, p)
            cfg = read_card_config(SAFE, cid)
            return jsend(self, 200, {"ok": True, "card": full, "config": cfg})

        if path == "/api/card/pose":
            raw_id = (body.get("id") or body.get("card_id") or "").strip()
            if not raw_id:
                return jsend(self, 400, {"ok": False, "error": "id required"})
            cid = to_card_id(raw_id)
            pose = body.get("pose") if isinstance(body.get("pose"), dict) else {}
            dress = body.get("dressup") if isinstance(body.get("dressup"), dict) else {}
            prop = body.get("prop") if isinstance(body.get("prop"), dict) else None
            path_out = write_card_config(
                SAFE, cid, pose=pose, dressup=dress or None, prop=prop
            )
            owner = leaf_owner_bin(SAFE, cid)
            layout_owner = (
                str(owner)
                if owner and re.match(r"^(board|deck)\[", str(owner))
                else "surface"
            )
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "path": str(path_out.resolve()),
                    "file": path_out.name,
                    "layout_owner": layout_owner,
                },
            )

        if path == "/api/tool/pose":
            tid = (body.get("id") or body.get("tool_id") or "").strip()
            if not tid:
                return jsend(self, 400, {"ok": False, "error": "id required"})
            pose = body.get("pose") if isinstance(body.get("pose"), dict) else {}
            dress = body.get("dressup") if isinstance(body.get("dressup"), dict) else {}
            prop = body.get("prop") if isinstance(body.get("prop"), dict) else None
            path_out = write_tool_config(
                SAFE, tid, pose=pose, dressup=dress or None, prop=prop
            )
            return jsend(
                self,
                200,
                {"ok": True, "path": str(path_out.resolve()), "file": path_out.name},
            )

        return jsend(self, 404, {"ok": False, "error": "no route"})


def main() -> None:
    ensure()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    sys.stderr.write(
        "%s · %s · http://%s:%s/ · chips %s\n"
        % (APP, SKU, HOST, PORT, SAFE / "USER" / "chips")
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
