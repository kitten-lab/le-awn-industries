"""Fix dress up list: store sheets for the object in hand, not envelope stations."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKS = ["sophia-desk", "cassandra-desk", "ava-desk"]

HELPERS = r'''
  function dressKindOf(w) {
    if (!w) return "leaf";
    if (w.kind === "leaf") return "leaf";
    if (w.kind === "card") return "card";
    if (w.kind === "board" && isDeckBin(w)) return "envelope";
    if (w.kind === "board" && isBookBin(w)) return "book";
    if (w.kind === "board") return "board";
    if (w.kind === "tool") return "tool";
    return "leaf";
  }

  async function fetchKindDressups(kind) {
    kind = kind || "leaf";
    const urls = ["/api/marketplace/" + kind + "/dressups"];
    if (kind === "leaf") urls.push("/api/marketplace/chips/leaf/dressups");
    for (let i = 0; i < urls.length; i++) {
      try {
        const j = await api(urls[i]);
        if (j && j.ok && Array.isArray(j.dressups)) return j;
      } catch (_) {}
    }
    return { ok: false, dressups: [] };
  }

  function dressIdsFrom(j) {
    return (j.dressups || [])
      .map(function (d) {
        return typeof d === "string" ? d : d && d.id;
      })
      .filter(Boolean);
  }

  async function wearFaceSheet(tw, kind, id) {
    id = String(id || "").trim();
    if (!tw || !id) return false;
    let loaded = false;
    try {
      const j = await api(
        "/api/marketplace/" + kind + "/dressups/" + encodeURIComponent(id)
      );
      if (j && j.ok && j.css != null) {
        applyDressCssLive(kind + "-" + id, j.css);
        loaded = true;
      }
    } catch (_) {}
    if (!loaded) {
      const pkg = kind === "envelope" ? "envelope" : kind;
      loaded = await ensureToolCss(
        pkg,
        "dressups/face/" + id + ".dsc",
        pkg + ":face-" + id + ":" + Date.now()
      );
    }
    if (!loaded) return false;
    tw.data.face = id;
    tw.data.style = id;
    tw.data.dressup = Object.assign({}, tw.data.dressup || {}, {
      face: id,
      style: id,
    });
    if (tw.el) tw.el.setAttribute("data-face", id);
    await persistPose({}, tw);
    return true;
  }

'''

LIST_NEW = '''        if (!head || head === "list") {
          const kind = dressKindOf(tw);
          const j = await fetchKindDressups(kind);
          const ids = dressIdsFrom(j);
          if (ids.length) {
            writeln(
              "dress ups · " +
                kind +
                (tw ? " · " + focusLabel(tw) : "")
            );
            ids.forEach(function (name) {
              writeln("  " + name);
            });
            writeln("try: dress up " + ids[0]);
            return;
          }
          if (tw && tw.kind === "board" && isBookBin(tw)) {
            writeln("book cloths · " + BOOK_CLOTHS.join(" · "));
            writeln("in hand · " + focusLabel(tw) + " · try: dress up oxblood");
            return;
          }
          if (
            tw &&
            tw.kind === "board" &&
            !isBookBin(tw) &&
            !isDeckBin(tw)
          ) {
            writeln("board tints · " + BOARD_TINTS.join(" · "));
            writeln(
              "in hand · " +
                focusLabel(tw) +
                " · now " +
                boardTintOf(tw) +
                " · try: dress up slate"
            );
            return;
          }
          writeln("no dress sheets for " + kind + " in the store yet");
          return;
        }
'''

ENV_NEW = '''        // envelope in hand → face sheet from the store (not io/ab stations)
        if (tw && tw.kind === "board" && isDeckBin(tw)) {
          const ok = await wearFaceSheet(tw, "envelope", id);
          if (!ok) {
            writeln(
              "no envelope dress named " + id + " · try: dress up list"
            );
            return;
          }
          writeln("dressed up · envelope " + id + " · " + focusLabel(tw));
          return;
        }
        if (tw && tw.kind === "card") {
          const ok = await wearFaceSheet(tw, "card", id);
          if (!ok) {
            writeln("no card dress named " + id + " · try: dress up list");
            return;
          }
          writeln("dressed up · card " + id + " · " + focusLabel(tw));
          return;
        }
'''

SERVER_OLD = '''        if path in (
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
'''

SERVER_NEW = '''        for kind in ("desk", "mira", "leaf", "card", "envelope"):
            if path in (
                f"/api/marketplace/{kind}/dressups",
                f"/api/store/{kind}/dressups",
            ):
                return jsend(
                    self,
                    200,
                    {
                        "ok": True,
                        "kind": kind,
                        "dressups": list_kind_dressups(kind),
                    },
                )

        for kind in ("desk", "mira", "leaf", "card", "envelope"):
'''


def replace_list_block(t: str) -> str:
    start = t.find('        if (!head || head === "list") {')
    if start < 0:
        raise SystemExit("list block start not found")
    end = t.find("        const id = dressRest.trim().toLowerCase();", start)
    if end < 0:
        raise SystemExit("list block end not found")
    return t[:start] + LIST_NEW + "\n" + t[end:]


def replace_env_block(t: str) -> str:
    start = t.find("        // envelope in hand")
    if start < 0:
        raise SystemExit("envelope comment not found")
    end = t.find("        // book in hand", start)
    if end < 0:
        raise SystemExit("book-in-hand marker not found")
    return t[:start] + ENV_NEW + t[end:]


def patch_app(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    if "function dressKindOf(" not in t:
        mark = "  async function loadKindDressCss(kind, id) {"
        if mark not in t:
            raise SystemExit(f"loadKindDressCss missing in {path}")
        t = t.replace(mark, HELPERS + mark, 1)
    t = replace_list_block(t)
    t = replace_env_block(t)
    path.write_text(t, encoding="utf-8")
    print("app.js", path)


def patch_server(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    if SERVER_OLD not in t:
        if 'for kind in ("desk", "mira", "leaf", "card", "envelope"):' in t:
            print("server already", path)
            return
        raise SystemExit(f"server dress routes missing in {path}")
    t = t.replace(SERVER_OLD, SERVER_NEW, 1)
    path.write_text(t, encoding="utf-8")
    print("server", path)


def main() -> None:
    for d in DESKS:
        desk = ROOT / d
        patch_app(desk / "prod" / "desk_sys" / "app.js")
        patch_server(desk / "prod" / "desk_sys" / "server.py")


if __name__ == "__main__":
    main()
