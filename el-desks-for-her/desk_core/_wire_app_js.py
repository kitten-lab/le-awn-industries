"""Patch app.js on all three desks: stacked dress-up + house felt/mira sheets."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKS = ["sophia-desk", "cassandra-desk", "ava-desk"]

HELPERS = r'''
  function wornSheets(w) {
    if (!w || !w.data) return ["lined"];
    const du = w.data.dressup || {};
    let s = w.data.sheets != null ? w.data.sheets : du.sheets;
    let list = [];
    if (typeof s === "string")
      list = s.split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    else if (Array.isArray(s))
      list = s.map(String).map(function (x) { return x.trim(); }).filter(Boolean);
    list = list.filter(function (x) {
      return x && x !== "_base" && x !== "base";
    });
    if (!list.length) {
      const one = w.data.paper || w.data.style || du.style || "lined";
      list = [one];
    }
    return list;
  }

  function applyLeafDressClasses(w) {
    const sheets = wornSheets(w);
    const paper = w.el && w.el.querySelector(".rx-paper");
    if (!paper) return;
    const last = sheets[sheets.length - 1] || "lined";
    paper.dataset.paper = last;
    const drop = [];
    paper.classList.forEach(function (c) {
      if (c.indexOf("dress-") === 0) drop.push(c);
    });
    drop.forEach(function (c) {
      paper.classList.remove(c);
    });
    for (let i = 0; i < sheets.length; i++)
      paper.classList.add("dress-" + sheets[i]);
  }

  async function wearLeafSheets(w, sheets) {
    await ensureDressupCss("_base");
    const clean = [];
    for (let i = 0; i < (sheets || []).length; i++) {
      const id = String(sheets[i] || "").trim();
      if (!id || id === "_base" || id === "base") continue;
      if (clean.indexOf(id) >= 0) continue;
      const ok = await ensureDressupCss(id);
      if (ok) clean.push(id);
    }
    w.data.paper = clean[clean.length - 1] || "lined";
    w.data.style = w.data.paper;
    w.data.sheets = clean.join(", ");
    w.data.dressup = Object.assign({}, w.data.dressup || {}, {
      shell: "paper",
      style: w.data.paper,
      sheets: w.data.sheets,
    });
    applyLeafDressClasses(w);
    return clean;
  }

  async function loadKindDressCss(kind, id) {
    id = (id || "").trim();
    if (!id) return false;
    const key = kind + ":" + id;
    if (dressupCssCache[key]) return true;
    try {
      const j = await api(
        "/api/marketplace/" + kind + "/dressups/" + encodeURIComponent(id)
      );
      if (!j.ok || j.css == null) return false;
      applyDressCssLive(key.replace(":", "-"), j.css);
      dressupCssCache[key] = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  async function bootHouseDress() {
    try {
      const j = await api("/api/house");
      if (!j || !j.ok) return;
      window.__house = j.house || j;
      const feltName = j.felt || (j.house && j.house.felt) || "green";
      const miraName = j.mira || (j.house && j.house.mira) || "phosphor";
      document.body.setAttribute("data-felt", feltName);
      await loadKindDressCss("desk", feltName);
      await loadKindDressCss("mira", miraName);
    } catch (_) {}
  }

'''

LEAF_DRESS_OLD = '''        const ok = await ensureDressupCss(id);
        if (!ok) {
          writeln("no costume named " + id + " · try: dress up list");
          return;
        }
        tw.data.paper = id;
        tw.data.style = id;
        if (tw.el) {
          const paper = tw.el.querySelector(".rx-paper");
          if (paper) paper.dataset.paper = id;
        }
        await persistPose({ paper: id }, tw);
        writeln("dressed up · " + id + " · " + focusLabel(tw));
        return;
      }
'''

LEAF_DRESS_NEW = '''        const cur = wornSheets(tw);
        if (cur.indexOf(id) < 0) cur.push(id);
        const worn = await wearLeafSheets(tw, cur);
        if (worn.indexOf(id) < 0) {
          writeln("no costume named " + id + " · try: dress up list");
          return;
        }
        await persistPose({ paper: tw.data.paper, dressup: tw.data.dressup }, tw);
        writeln(
          "dressed up · " +
            worn.join(" + ") +
            " over _base · " +
            focusLabel(tw)
        );
        return;
      }

      if (low.startsWith("undress ")) {
        const rid = line.replace(/^undress\\s+/i, "").trim().toLowerCase();
        if (!tw || tw.kind !== "leaf") {
          writeln("undress needs a leaf in hand");
          return;
        }
        const next = wornSheets(tw).filter(function (s) {
          return s !== rid;
        });
        await wearLeafSheets(tw, next);
        await persistPose({ paper: tw.data.paper, dressup: tw.data.dressup }, tw);
        writeln(
          "undressed · " +
            rid +
            " · now " +
            (next.join(" + ") || "_base") +
            " · " +
            focusLabel(tw)
        );
        return;
      }
'''


def patch(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    if "function wornSheets(" in t:
        print("already", path)
        return

    end = t.find("  /**\n   * Edit a costume .dsc live")
    if end < 0:
        raise SystemExit(f"dress edit comment not in {path}")
    t = t[:end] + HELPERS + "\n" + t[end:]

    old_pose = '''    const style = extra.paper || w.data.paper || w.data.style || "lined";
    await api("/api/pose", {
      method: "POST",
      body: JSON.stringify({
        id: w.data.id,
        pose: pose,
        paper: style,
        prop: w.data.prop || null,
        dressup: { shell: "paper", style: style },
      }),
    });'''
    new_pose = '''    const style = extra.paper || w.data.paper || w.data.style || "lined";
    const sheets =
      (extra.dressup && extra.dressup.sheets) ||
      w.data.sheets ||
      (w.data.dressup && w.data.dressup.sheets) ||
      style;
    await api("/api/pose", {
      method: "POST",
      body: JSON.stringify({
        id: w.data.id,
        pose: pose,
        paper: style,
        prop: w.data.prop || null,
        dressup: { shell: "paper", style: style, sheets: sheets },
      }),
    });'''
    if old_pose not in t:
        raise SystemExit(f"persistPose leaf branch not in {path}")
    t = t.replace(old_pose, new_pose, 1)

    old_mount = '''    if (config && config.prop) {
      w.data.prop = Object.assign({}, config.prop);
    }'''
    new_mount = '''    if (config && config.prop) {
      w.data.prop = Object.assign({}, config.prop);
    }
    if (config && config.dressup) {
      w.data.dressup = Object.assign({}, config.dressup);
      if (config.dressup.sheets) w.data.sheets = config.dressup.sheets;
    }'''
    if old_mount not in t:
        raise SystemExit(f"mountLeaf prop attach not in {path}")
    t = t.replace(old_mount, new_mount, 1)

    old_open = '''    const papers = await loadLeafDressupCatalog();
    const paper = leaf.paper || papers[0] || "lined";
    await ensureDressupCss(paper);'''
    new_open = '''    const papers = await loadLeafDressupCatalog();
    const paper = wornSheets(w).slice(-1)[0] || leaf.paper || papers[0] || "lined";
    await ensureDressupCss("_base");
    await ensureDressupCss(paper);'''
    if old_open not in t:
        raise SystemExit(f"renderOpen dress load not in {path}")
    t = t.replace(old_open, new_open, 1)

    if "    paintPaper(el, leaf.body);" not in t:
        raise SystemExit(f"paintPaper not in {path}")
    t = t.replace(
        "    paintPaper(el, leaf.body);",
        "    paintPaper(el, leaf.body);\n    void wearLeafSheets(w, wornSheets(w));",
        1,
    )

    boot = "  async function boot() {\n    await loadLeafDressupCatalog();"
    boot_new = "  async function boot() {\n    await bootHouseDress();\n    await loadLeafDressupCatalog();"
    if boot not in t:
        raise SystemExit(f"boot() catalog load not in {path}")
    t = t.replace(boot, boot_new, 1)

    if LEAF_DRESS_OLD not in t:
        raise SystemExit(f"leaf dress-up branch not in {path}")
    t = t.replace(LEAF_DRESS_OLD, LEAF_DRESS_NEW, 1)

    t = t.replace(
        '            "  dress up <name>         put that costume on the leaf",\n'
        '            "  dress up list           costumes on the shelf",',
        '            "  dress up <name>         layer that sheet over _base (any file in the dress folder)",\n'
        '            "  undress <name>          take that sheet off the leaf",\n'
        '            "  dress up list           sheets in the general store",',
        1,
    )

    path.write_text(t, encoding="utf-8")
    print("app.js", path)


def main() -> None:
    for d in DESKS:
        patch(ROOT / d / "prod" / "desk_sys" / "app.js")


if __name__ == "__main__":
    main()
