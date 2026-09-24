"""One-shot: wire house.txt + shared dress store into the three desk cores."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # el-desks-for-her/
DESKS = ["sophia-desk", "cassandra-desk", "ava-desk", "key-desk"]

HOUSE_IMPORT = '''from pathlib import Path
from typing import Any

_EL_DESKS = Path(__file__).resolve().parents[3]
if str(_EL_DESKS) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(_EL_DESKS))
from desk_core.house import load_house
from desk_core import dress_store as _dress_store

_DESK_ROOT = Path(__file__).resolve().parents[2]
HOUSE = load_house(_DESK_ROOT)
'''

CONST_BLOCK_NEW = '''LOCAL_DIRNAME = "~local"
SURFACES_DIRNAME = "surfaces"
DEFAULT_USERNAME = HOUSE.auth
LEGACY_USERNAMES = ("abl",)  # prior path segments to migrate
DEFAULT_SURFACE_FOLDER = HOUSE.surface_folder
DEFAULT_SURFACE_ID = HOUSE.surface_id
DEFAULT_SURFACE_NAME = HOUSE.surface_name
DEFAULT_SURFACE_CONFIG_ID = HOUSE.surface_config_id
DEFAULT_SURFACE_SUBTYPE = HOUSE.surface_subtype
'''

DRESS_FUNCS_NEW = '''def leaf_dressups_root(safe: Path) -> Path:
    """General store leaf dressups (shared ~store, island overlay as fallback)."""
    return _dress_store.dress_dirs(_DESK_ROOT, "leaf")[0]


def list_leaf_dressups(safe: Path) -> list[dict[str, Any]]:
    """Catalog of .dsc files (id = stem). Shared store wins on name collision."""
    return _dress_store.list_dressups(_DESK_ROOT, "leaf")


def read_leaf_dressup(
    safe: Path, dress_id: str
) -> tuple[Path | None, str | None, str | None]:
    """Returns (path, css text, path_display)."""
    return _dress_store.read_dressup(_DESK_ROOT, "leaf", dress_id)


def write_leaf_dressup(safe: Path, dress_id: str, css_text: str) -> Path:
    """Save costume sheet (.dsc) into the general store."""
    return _dress_store.write_dressup(_DESK_ROOT, "leaf", dress_id, css_text)


def list_kind_dressups(kind: str) -> list[dict[str, Any]]:
    return _dress_store.list_dressups(_DESK_ROOT, kind)


def read_kind_dressup(
    kind: str, dress_id: str
) -> tuple[Path | None, str | None, str | None]:
    return _dress_store.read_dressup(_DESK_ROOT, kind, dress_id)
'''

NORM_NEW = '''def normalize_leaf_dressup(du: dict[str, Any] | None) -> dict[str, Any]:
    """
    Hands law: shell = form (paper) · style = last costume · sheets = stacked .dsc
    names over _base. Fix inverted legacy {style: paper, shell: lined}.
    """
    du = dict(du or {})
    shell = str(du.get("shell") or "").strip()
    style = str(du.get("style") or "").strip()
    costumes = {"lined", "plain", "dotted", "letter"}
    forms = {"paper", "card", "ticket", "fragment"}
    if shell in costumes:
        if not style or style in forms or style == shell:
            style = shell if shell in costumes else (style or "lined")
        shell = "paper"
    if style in forms:
        style = "lined"
    if not shell or shell in costumes:
        shell = "paper"
    raw_sheets = du.get("sheets")
    sheet_list: list[str] = []
    if isinstance(raw_sheets, str):
        sheet_list = [s.strip() for s in re.split(r"[,\s]+", raw_sheets) if s.strip()]
    elif isinstance(raw_sheets, list):
        sheet_list = [str(s).strip() for s in raw_sheets if str(s).strip()]
    sheet_list = [
        s
        for s in sheet_list
        if s and s.lower() not in ("_base", "base")
    ]
    if not sheet_list:
        if not style or style in forms:
            style = "lined"
        sheet_list = [style]
    else:
        style = sheet_list[-1]
    out: dict[str, Any] = {
        "shell": shell,
        "style": style,
        "sheets": ", ".join(sheet_list),
    }
    if du.get("id"):
        out["id"] = du["id"]
    return out
'''


def patch_store(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    old_imp = "from pathlib import Path\nfrom typing import Any\n"
    if "from desk_core.house import load_house" not in t:
        if old_imp not in t:
            raise SystemExit(f"import block not found in {path}")
        t = t.replace(old_imp, HOUSE_IMPORT, 1)

    # replace identity constants (values differ per desk)
    start = t.find('LOCAL_DIRNAME = "~local"')
    end = t.find('SURFACE_PAPER_NAME = "surface.cfg"')
    if start < 0 or end < 0:
        raise SystemExit(f"const block not found in {path}")
    t = t[:start] + CONST_BLOCK_NEW + t[end:]

    if '"sheets"' not in t.split('"dressup":')[1][:800]:
        t = t.replace(
            '''        "style",
        "color",
        "cloth",  # bookbox cloth set (oxblood/forest/navy/sand)''',
            '''        "style",
        "sheets",  # stacked .dsc names over _base (comma list)
        "color",
        "cloth",  # bookbox cloth set (oxblood/forest/navy/sand)''',
            1,
        )

    # replace dressup file helpers
    a = t.find("def leaf_dressups_root(")
    b = t.find("def discover_username(")
    if a < 0 or b < 0:
        raise SystemExit(f"dress funcs not found in {path}")
    t = t[:a] + DRESS_FUNCS_NEW + "\n\n" + t[b:]

    a = t.find("def normalize_leaf_dressup(")
    b = t.find("def ensure_primary_leaf(")
    if a < 0 or b < 0:
        raise SystemExit(f"normalize_leaf_dressup not found in {path}")
    t = t[:a] + NORM_NEW + "\n\n" + t[b:]

    path.write_text(t, encoding="utf-8")
    print("store", path)


SERVER_IMPORT_OLD = """from store import (
    DEFAULT_SURFACE_FOLDER,
    DEFAULT_USERNAME,
    PRIMARY_CHIP_ID,"""

SERVER_IMPORT_NEW = """from store import (
    DEFAULT_SURFACE_FOLDER,
    DEFAULT_USERNAME,
    HOUSE,
    PRIMARY_CHIP_ID,
    list_kind_dressups,
    read_kind_dressup,"""


def patch_server(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    if "HOUSE," not in t:
        if SERVER_IMPORT_OLD not in t:
            raise SystemExit(f"store import not found in {path}")
        t = t.replace(SERVER_IMPORT_OLD, SERVER_IMPORT_NEW, 1)

    # PORT from house, env still wins
    import re

    t2, n = re.subn(
        r'^PORT = int\(__import__\("os"\)\.environ\.get\("POCKET_DESKTOP_PORT".*$',
        'PORT = int(__import__("os").environ.get("POCKET_DESKTOP_PORT", str(HOUSE.port)))',
        t,
        count=1,
        flags=re.M,
    )
    if n != 1:
        raise SystemExit(f"PORT line not patched in {path}")
    t = t2

    if 'if path == "/api/house":' not in t:
        needle = "        if path == \"/api/health\":"
        insert = '''        if path == "/api/house":
            return jsend(
                self,
                200,
                {
                    "ok": True,
                    "house": HOUSE.as_dict(),
                    "felt": HOUSE.felt,
                    "mira": HOUSE.mira,
                    "auth": HOUSE.auth,
                    "title": HOUSE.title,
                    "port": PORT,
                },
            )

        if path in (
            "/api/marketplace/desk/dressups",
            "/api/store/desk/dressups",
        ):
            return jsend(
                self,
                200,
                {"ok": True, "kind": "desk", "dressups": list_kind_dressups("desk")},
            )

        if path in (
            "/api/marketplace/mira/dressups",
            "/api/store/mira/dressups",
        ):
            return jsend(
                self,
                200,
                {"ok": True, "kind": "mira", "dressups": list_kind_dressups("mira")},
            )

        for kind in ("desk", "mira"):
            prefix = f"/api/marketplace/{kind}/dressups/"
            alt = f"/api/store/{kind}/dressups/"
            if path.startswith(prefix) or path.startswith(alt):
                rest = path[len(prefix if path.startswith(prefix) else alt) :].strip("/")
                if rest.endswith(".dsc"):
                    rest = rest[: -len(".dsc")]
                if rest.endswith("/raw"):
                    rest = rest[: -len("/raw")].rstrip("/")
                pth, text, disp = read_kind_dressup(kind, rest)
                if not pth:
                    return jsend(self, 404, {"ok": False, "error": "dressup not found"})
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "id": rest,
                        "kind": kind,
                        "css": text,
                        "file": pth.name if pth else rest + ".dsc",
                        "path_display": disp,
                    },
                )

'''
        if needle not in t:
            raise SystemExit(f"health route not found in {path}")
        t = t.replace(needle, insert + needle, 1)

    t = t.replace(
        '''                if du.get("style"):
                    leaf["style"] = du["style"]
                    leaf["paper"] = du["style"]''',
        '''                if du.get("style"):
                    leaf["style"] = du["style"]
                    leaf["paper"] = du["style"]
                if du.get("sheets"):
                    leaf["sheets"] = du["sheets"]
                    leaf["dressup"] = du''',
    )
    t = t.replace(
        '''                        if du.get("style"):
                            full["style"] = du["style"]
                            full["paper"] = du["style"]''',
        '''                        if du.get("style"):
                            full["style"] = du["style"]
                            full["paper"] = du["style"]
                        if du.get("sheets"):
                            full["sheets"] = du["sheets"]
                            full["dressup"] = du''',
    )

    path.write_text(t, encoding="utf-8")
    print("server", path)


RUNNER_SNIPPET = '''
_EL_DESKS = PROD.parent.parent
if str(_EL_DESKS) not in sys.path:
    sys.path.insert(0, str(_EL_DESKS))
from desk_core.house import load_house

_HOUSE = load_house(PROD.parent)
'''


def patch_runner(path: Path) -> None:
    import re

    t = path.read_text(encoding="utf-8")
    if "load_house(" in t:
        print("runner already", path)
        return
    needle = 'SYS = PROD / "desk_sys"'
    if needle not in t:
        raise SystemExit(f"SYS line not found in {path}")
    t = t.replace(needle, needle + "\n" + RUNNER_SNIPPET, 1)

    t, n = re.subn(
        r'^PORT = os\.environ\.get\("POCKET_DESKTOP_PORT".*$',
        'PORT = os.environ.get("POCKET_DESKTOP_PORT", str(_HOUSE.port))',
        t,
        count=1,
        flags=re.M,
    )
    if n != 1:
        raise SystemExit(f"PORT not patched in runner {path}")

    t = t.replace('"SophiaDesk"', "_HOUSE.title")
    t = t.replace('"CassandraDesk"', "_HOUSE.title")
    t = t.replace('"AvaDesk"', "_HOUSE.title")
    t = t.replace('"_HOUSE.title"', "_HOUSE.title")

    path.write_text(t, encoding="utf-8")
    print("runner", path)


def main() -> None:
    for d in DESKS:
        desk = ROOT / d
        patch_store(desk / "prod" / "desk_sys" / "store.py")
        patch_server(desk / "prod" / "desk_sys" / "server.py")
        patch_runner(desk / "prod" / "run-in-deck-host.py")


if __name__ == "__main__":
    main()
