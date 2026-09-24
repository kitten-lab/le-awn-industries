/* Desk World Hands · L.E. AWN · consider desk on Deck Host (fork lineage: Receiver ROM).
 *
 * Shared physics. Edit this file once; every desk serves it.
 * Papers stay in each island ~local. Felt / Mira come from /api/house.
 *
 * NOT a notepad. NOT "one paper product." Early "one paper" was a thrash tourniquet
 * so custody stayed visible. We are past paper-custody-only: the project is
 * writing about the project so thrash cannot invent a new law.
 *
 * Papers · containers · marks · surface layout · Mira · papers please (every
 * sheet that declares the focused object) · redline.
 */
(() => {
  "use strict";

  /**
   * Desk-only mode. The office dollhouse broke place memory / dock physics.
   * Real want later: multiple desks + mail between them — not a second world.
   */
  const DESK_ONLY = true;

  // Hard menu (deep mode · no corner ✕). Host handles hard_refresh / reload / exit.
  window.DECK_ROM_MENU = [
    { label: "Shell", run: function () { openSurfaceShell(); } },
    {
      label: "Desk",
      run: function () {
        if (typeof enterDeskPlace === "function") enterDeskPlace();
      },
    },
    { sep: true },
    { label: "Hard refresh", action: "hard_refresh" },
    { label: "Reload", action: "reload" },
    { sep: true },
    { label: "Exit", action: "exit" },
  ];

  (function preferDeepWhenReady() {
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (typeof window.deckHostDeep === "function") {
        clearInterval(t);
        try {
          window.deckHostDeep(true);
        } catch (e) {}
        return;
      }
      if (n > 50) clearInterval(t);
    }, 80);
  })();

  const $ = (id) => document.getElementById(id);
  const felt = $("felt");
  const roomEl = $("room");
  const btnLeavePlace = $("btnLeavePlace");
  const LAST_AUTHOR_KEY = "pocket-desktop-last-author";
  const TERM_SPELL_KEY = "pocket-desktop-term-spellcheck";
  // localStorage key kept for compat; name is historical, not product law
  const LAYOUT_KEY = "pocket-desktop-one-paper-v1";
  /** place mode: room (office) | desk (felt work) | host (focused container) */
  let placeMode = "desk";
  /** @type {string|null} host uid when placeMode === "host" */
  let placeHostId = null;

  /** @type {object|null} last/primary ref — prefer focusWin / wins */
  let win = null;
  /** @type {Map<string, object>} uid → win */
  const wins = new Map();
  let poseCache = {};
  /** @type {HTMLElement|null} surface command shell (not the md body editor) */
  let shellEl = null;
  /** last pointer on felt — Ctrl+` drops Mira under the hand */
  let lastFeltPtr = { x: 48, y: 72 };
  /** guest tool registry (kits register here) */
  window.PocketTools = window.PocketTools || {
    _reg: {},
    register: function (id, impl) {
      this._reg[id] = impl;
    },
    get: function (id) {
      return this._reg[id] || null;
    },
  };
  /** active marking tool (stamper in hand) */
  let activeToolWin = null;
  /** tool currently chasing the mouse (picked up to stamp) */
  let heldToolWin = null;
  const loadedToolCss = new Set();
  const loadedToolKits = new Set();
  /** @type {HTMLElement|null} */
  let ctxMenu = null;
  let ctxSpawnAt = { x: 48, y: 48 };
  /**
   * Shell / keyboard target when many objects exist.
   * MD terminal is bound to its leaf by title; free shell needs an explicit "here".
   * Indication: soft is-focus on the object + shell chrome names it (no harsh stroke).
   */
  /** @type {object|null} */
  let focusWin = null;

  /** Surface focus — the desk felt itself (not a leaf/board). */
  function makeSurfaceFocus() {
    return {
      kind: "surface",
      open: true,
      el: null,
      data: {
        id: "surface",
        title: "Archivist Desk",
        name: "Archivist Desk",
      },
    };
  }

  /**
   * Living kind for MIRA prompt / focus (not every bin is "board").
   * Cards are cards. Envelopes (legacy uid deck[n]) / books / shelves are not boards.
   */
  function shellObjectKind(w) {
    if (!w) return "";
    if (w.kind === "surface") return "surface";
    if (w.kind === "card") return "card";
    if (w.kind === "key") return "key";
    if (w.kind === "leaf") return "leaf";
    if (w.kind === "rom") return "rom";
    if (w.kind === "tool") {
      const p = (w.data && w.data.prop) || {};
      const pkg = String(
        (w.data && (w.data.package_id || w.subtype)) || ""
      ).toLowerCase();
      if (
        pkg === "inbox" ||
        p.canReceive === true ||
        p.canReceive === "yes" ||
        String(w.data && (w.data.uid || w.data.id) || "").indexOf("inbox") >= 0
      ) {
        return "inbox";
      }
      if (pkg === "karaoke") return "karaoke";
      if (pkg === "chipper") return "chipper";
      if (pkg === "eraser") return "eraser";
      if (pkg === "stamper") return "stamper";
      if (w.subtype === "rom" || p["Rom.id"] || w.data.rom_id) return "rom";
      return "tool";
    }
    if (w.kind === "board") {
      // honest living name · files may still be deck[n] on disk
      if (typeof isDeckBin === "function" && isDeckBin(w)) return "envelope";
      if (typeof isBookBin === "function" && isBookBin(w)) return "book";
      if (typeof isShelfBin === "function" && isShelfBin(w)) return "shelf";
      return "board";
    }
    return String(w.kind || "object");
  }

  function focusLabel(w) {
    if (!w) return "—";
    if (w.kind === "surface") return "surface · desk";
    if (w.kind === "tool") {
      const sk = shellObjectKind(w);
      const lab =
        (w.data &&
          w.data.prop &&
          (w.data.prop["Mark.type"] ||
            w.data.prop["Receive.address"] ||
            w.data.prop["Mark.label"])) ||
        (w.data && (w.data.title || w.data.uid || w.data.id)) ||
        sk;
      return sk + " · " + lab;
    }
    const kind = shellObjectKind(w) || w.kind || "object";
    const name =
      (w.data && (w.data.title || w.data.name || w.data.uid || w.data.id)) ||
      "untitled";
    return kind + " · " + String(name).trim();
  }

  function setFocus(w) {
    focusWin = w || null;
    // clear previous object focus pip
    felt.querySelectorAll(".nb-win.is-focus").forEach((el) => {
      el.classList.remove("is-focus");
    });
    if (focusWin && focusWin.el) {
      focusWin.el.classList.add("is-focus");
      bringFront(focusWin.el);
    }
    // MIRA title stays put; prompt shows what is in hand (split spans = DevTools colors)
    if (shellEl && shellEl.isConnected) {
      const title = shellEl.querySelector(".md-term-title");
      // version mark stays small ʞ · conductor ꓘ lives only on the prompt line
      if (title) title.textContent = "MIRA SHELL ver. ʞ";
      paintShellPs(shellEl.querySelector(".rx-shell-ps"));
    }
  }

  /**
   * Conductor mark: tight >| (Hands classic — Cascadia draws these true)
   * No trailing tip > — two-space breath before the input (lived-in, not DOS)
   * Spans: .rx-shell-k · .rx-shell-kind
   */
  function paintShellPs(psEl) {
    if (!psEl) return;
    const kind = focusWin ? shellObjectKind(focusWin) : "";
    psEl.dataset.kind = kind || "none";
    // >| as two glyphs, kerned tight → little animal / Hand-drawn K
    psEl.innerHTML =
      '<span class="rx-shell-k" data-ps="mark" aria-hidden="true">' +
      '<span class="rx-shell-k-gt">&gt;</span>' +
      '<span class="rx-shell-k-bar">|</span>' +
      "</span>" +
      (kind
        ? '<span class="rx-shell-kind" data-ps="kind" data-kind="' +
          kind +
          '"> ' +
          kind +
          "</span>"
        : "");
  }

  function targetWin() {
    return focusWin || win;
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    const body = el.querySelector("[data-toast-body]");
    if (body) body.textContent = String(msg ?? "");
    else el.textContent = String(msg ?? "");
    el.classList.remove("is-out");
    el.hidden = false;
    clearTimeout(toast._t);
    clearTimeout(toast._t2);
    toast._t = setTimeout(() => {
      el.classList.add("is-out");
      toast._t2 = setTimeout(() => {
        el.hidden = true;
        el.classList.remove("is-out");
      }, 200);
    }, 2400);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(path, opts) {
    opts = opts || {};
    const r = await fetch(path, {
      method: opts.method || "GET",
      headers: opts.body
        ? { "Content-Type": "application/json", Accept: "application/json" }
        : { Accept: "application/json" },
      body: opts.body || undefined,
    });
    try {
      return await r.json();
    } catch (_) {
      return { ok: false, error: "bad json" };
    }
  }

  function getLastAuthor() {
    try {
      return (localStorage.getItem(LAST_AUTHOR_KEY) || "").trim() || "unknown";
    } catch (_) {
      return "unknown";
    }
  }

  function rememberAuthor(name) {
    const a = (name || "").trim() || "unknown";
    try {
      localStorage.setItem(LAST_AUTHOR_KEY, a);
    } catch (_) {}
    return a;
  }

  function normalizeAuthor(name) {
    return (name || "").trim() || "unknown";
  }

  function getTermSpellcheck() {
    try {
      const v = localStorage.getItem(TERM_SPELL_KEY);
      // default ON — right-click spelling needs spellcheck=true on the field
      if (v === null || v === undefined) return true;
      return v === "1";
    } catch (_) {
      return true;
    }
  }

  function setTermSpellcheck(on) {
    try {
      localStorage.setItem(TERM_SPELL_KEY, on ? "1" : "0");
    } catch (_) {}
    return !!on;
  }

  function bringFront(el) {
    if (!el) return;
    // office floor is its own stacking root (not felt) — use the real parent
    const floor = typeof roomFloorEl === "function" ? roomFloorEl() : null;
    const root =
      (floor && el.parentElement === floor) ||
      (el.classList && el.classList.contains("is-office-floor"))
        ? floor || el.parentElement
        : felt;
    const scope = root || felt || document;
    const zs = [
      ...scope.querySelectorAll(".nb-win, .md-term, .rx-paper-check"),
    ].map((n) => parseInt(n.style.zIndex, 10) || 0);
    const base =
      el.classList && el.classList.contains("is-office-floor") ? 20 : 20;
    const z = (zs.length ? Math.max.apply(null, zs) : base) + 1;
    el.style.zIndex = String(z);
  }

  function paintPaper(el, md, followLine) {
    const body = el.querySelector("[data-paper-preview]");
    if (!body) return;
    const fn =
      (window.ReceiverLiveMd && ReceiverLiveMd.renderMarkdown) ||
      ((s) =>
        "<pre style='white-space:pre-wrap;margin:0;font:inherit'>" +
        esc(s) +
        "</pre>");
    const prevScroll = body.scrollTop;
    body.innerHTML = fn(md || "");
    if (
      typeof followLine === "number" &&
      window.ReceiverLiveMd &&
      ReceiverLiveMd.scrollPreviewToLine
    ) {
      ReceiverLiveMd.scrollPreviewToLine(body, followLine);
    } else {
      body.scrollTop = prevScroll;
    }
  }

  /**
   * Face title / author are display only (drag chrome).
   * Rename through MIRA: name … · by …
   */
  function paintFaceMetaEl(el, title, author, uidOpt) {
    if (!el) return;
    const t = el.querySelector("[data-field=title]");
    const a = el.querySelector("[data-field=author]");
    const u = el.querySelector("[data-field=uid]");
    if (t) {
      const v = title || "";
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") t.value = v;
      else t.textContent = v || "untitled";
    }
    if (a) {
      const v = normalizeAuthor(author);
      if (a.tagName === "INPUT" || a.tagName === "TEXTAREA") a.value = v;
      else a.textContent = v && v !== "unknown" ? v : "unknown";
    }
    // envelope / board chrome · living id (envelope[5] not only the long title)
    if (u && uidOpt) {
      u.textContent = String(uidOpt);
      u.title = String(uidOpt);
    }
  }

  /**
   * Body / paper text — allow highlight + copy (drag chrome must not steal it).
   * Face titles stay drag handles; real writing lives in these wells.
   */
  function isSelectableTextTarget(t) {
    if (!t || !t.closest) return false;
    return !!t.closest(
      [
        "[data-paper-preview]",
        ".rx-paper-preview",
        ".pn-page-body-md",
        "[data-card-title]",
        "[data-card-by]",
        "[data-card-body]",
        ".tool-card-title",
        ".tool-card-by",
        ".tool-card-body",
        "[data-check-body]",
        "[data-check-edit]",
        "[data-check-diffview]",
        ".rx-paper-check-body",
        ".rx-paper-check-edit",
        ".rx-paper-check-diffview",
        ".md-term-ta",
        "[data-shell-out]",
        ".rx-shell-out",
        "[data-shell-in]",
        ".rx-shell-in",
        "[data-select-text]",
      ].join(", ")
    );
  }

  /** true if this target should block window drag (active controls / body edit) */
  function isEditableFaceTarget(t) {
    if (!t || !t.closest) return false;
    // reading wells / terminals — never start a window drag from here
    if (isSelectableTextTarget(t)) return true;
    if (t.closest("select, .nb-resize")) return true;
    if (t.closest("button")) {
      // cart / book face / drag chrome are grab handles even when they are <button>
      if (t.closest("[data-drag-chrome], .book-face, .rl-case, .rom-cart-face"))
        return false;
      return true;
    }
    const field = t.closest("input, textarea");
    if (!field) return false;
    // face title/author spans are not inputs; real inputs (shell, forms) block drag
    if (field.disabled || field.readOnly) return false;
    return true;
  }

  /** shell ids from ~host/marketplace/chips/leaf/dressups/*.dsc (store), not hardcoded forever */
  let leafDressupIds = null;
  const dressupCssCache = {};

  async function loadLeafDressupCatalog() {
    if (leafDressupIds && leafDressupIds.length) return leafDressupIds;
    try {
      const j = await api("/api/marketplace/chips/leaf/dressups");
      if (j.ok && Array.isArray(j.dressups) && j.dressups.length) {
        leafDressupIds = j.dressups.map((d) => d.id);
        return leafDressupIds;
      }
    } catch (_) {}
    leafDressupIds = ["lined", "plain", "dotted", "letter"];
    return leafDressupIds;
  }

  function applyDressCssLive(id, cssText) {
    id = (id || "lined").trim() || "lined";
    let tag = document.getElementById("rx-dress-" + id);
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "rx-dress-" + id;
      tag.setAttribute("data-dressup", id);
      document.head.appendChild(tag);
    }
    tag.textContent = cssText != null ? String(cssText) : "";
    dressupCssCache[id] = true;
  }

  async function ensureDressupCss(shellId) {
    const id = (shellId || "lined").trim() || "lined";
    if (dressupCssCache[id]) return true;
    try {
      const j = await api(
        "/api/marketplace/chips/leaf/dressups/" + encodeURIComponent(id)
      );
      if (!j.ok || j.css == null) return false;
      applyDressCssLive(id, j.css);
      return true;
    } catch (_) {
      return false;
    }
  }


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


  function dressKindOf(w) {
    if (!w) return "leaf";
    if (w.kind === "leaf") return "leaf";
    if (w.kind === "card") return "card";
    if (w.kind === "key") return "key";
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
    if (kind === "key") id = normalizeKeyFace(id);
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


  /**
   * Edit a costume .dsc live (like md terminal).
   * Typing updates the felt immediately; ^S writes disk.
   * Later: papers-please form fields — for now raw sheet play.
   */
  let dressEditTerm = null;

  async function openDressEditTerminal(dressId) {
    const id = (dressId || "lined").trim() || "lined";
    const j = await api(
      "/api/marketplace/chips/leaf/dressups/" + encodeURIComponent(id)
    );
    if (!j.ok) {
      toast(j.error || "dress not found · " + id);
      return false;
    }
    const pathLabel = j.path_display || j.file || id + ".dsc";
    const tw = targetWin();
    if (tw && tw.data) {
      tw.data.paper = id;
      tw.data.style = id;
      if (tw.el) {
        const paper = tw.el.querySelector(".rx-paper");
        if (paper) paper.dataset.paper = id;
      }
    }
    applyDressCssLive(id, j.css || "");

    if (dressEditTerm && dressEditTerm.isConnected) dressEditTerm.remove();

    const term = document.createElement("div");
    term.className = "md-term rx-dress-term";
    term.innerHTML =
      '<div class="md-term-bar" data-dress-drag>' +
      '<span class="md-term-dot" aria-hidden="true"></span>' +
      '<span class="md-term-title">' +
      esc("dsc · " + id + " · " + pathLabel) +
      "</span>" +
      '<span class="md-term-hint">live · ^S save · ^Q quit</span>' +
      '<button type="button" class="md-term-x" data-dress-close title="quit">×</button>' +
      "</div>" +
      '<textarea class="md-term-ta" spellcheck="false" autocomplete="off"></textarea>' +
      '<div class="md-term-status" data-dress-status></div>' +
      '<div class="md-term-resize" data-dress-resize></div>';
    felt.appendChild(term);
    dressEditTerm = term;
    term.style.left = "36px";
    term.style.top = "100px";
    term.style.width = "440px";
    term.style.height = "320px";
    bringFront(term);

    const ta = term.querySelector(".md-term-ta");
    const status = term.querySelector("[data-dress-status]");
    let baseline = j.css != null ? String(j.css) : "";
    ta.value = baseline;
    let dirty = false;

    function flash(msg) {
      status.textContent = msg;
      status.classList.add("is-saved");
      setTimeout(() => {
        status.classList.remove("is-saved");
        status.textContent = dirty ? "· unsaved" : "";
      }, 1000);
    }

    ta.addEventListener("input", () => {
      dirty = ta.value !== baseline;
      status.textContent = dirty ? "· unsaved" : "";
      applyDressCssLive(id, ta.value);
    });

    async function saveDress() {
      const jr = await api(
        "/api/marketplace/chips/leaf/dressups/" +
          encodeURIComponent(id) +
          "/save",
        {
          method: "POST",
          body: JSON.stringify({ css: ta.value }),
        }
      );
      if (!jr.ok) {
        flash(jr.error || "save fail");
        return false;
      }
      baseline = ta.value;
      dirty = false;
      flash("· saved · " + (jr.chars || ta.value.length) + "c");
      toast("dress saved · " + (jr.path_display || id + ".dsc"));
      return true;
    }

    ta.addEventListener("keydown", async (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      if (ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        await saveDress();
      }
      if (ev.key === "q" || ev.key === "Q") {
        ev.preventDefault();
        if (dirty && !window.confirm("Dress dirty. Quit without saving?")) return;
        term.remove();
        if (dressEditTerm === term) dressEditTerm = null;
      }
    });
    term.querySelector("[data-dress-close]").onclick = () => {
      if (dirty && !window.confirm("Dress dirty. Quit without saving?")) return;
      term.remove();
      if (dressEditTerm === term) dressEditTerm = null;
    };

    // drag + resize (same pattern as shell)
    const bar = term.querySelector("[data-dress-drag]");
    bar.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      bringFront(term);
      const r = term.getBoundingClientRect();
      const fr = felt.getBoundingClientRect();
      const ox = ev.clientX - r.left;
      const oy = ev.clientY - r.top;
      function move(e) {
        term.style.left =
          Math.max(0, Math.min(e.clientX - fr.left - ox, fr.width - 80)) + "px";
        term.style.top =
          Math.max(0, Math.min(e.clientY - fr.top - oy, fr.height - 40)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
    });
    term.querySelector("[data-dress-resize]").addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const sx = ev.clientX;
      const sy = ev.clientY;
      const sw = term.offsetWidth;
      const sh = term.offsetHeight;
      function move(e) {
        term.style.width = Math.max(240, sw + (e.clientX - sx)) + "px";
        term.style.height = Math.max(160, sh + (e.clientY - sy)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
      ev.stopPropagation();
    });

    ta.focus();
    toast("dsc live · " + pathLabel);
    return true;
  }

  function paperSelectHtml(current, papers) {
    papers = papers || leafDressupIds || ["lined"];
    return (
      '<select data-field="paper" class="rx-paper-paper" title="leaf dress · .dsc from store">' +
      papers
        .map(
          (p) =>
            '<option value="' +
            p +
            '"' +
            (p === current ? " selected" : "") +
            ">" +
            p +
            "</option>"
        )
        .join("") +
      "</select>"
    );
  }

  const PAPER_STAMPS = [
    { id: "outdated", label: "OUTDATED", ink: "rose" },
    { id: "needs-update", label: "NEEDS UPDATE", ink: "warn" },
    { id: "draft", label: "DRAFT", ink: "brass" },
    { id: "urgent", label: "URGENT", ink: "rose" },
    { id: "superseded", label: "SUPERSEDED", ink: "dim" },
    { id: "current", label: "CURRENT", ink: "ok" },
  ];

  function normalizeStamps(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") {
      try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) return j.map(String);
      } catch (_) {}
      return raw ? [raw] : [];
    }
    return [];
  }

  function paperStampsHtml(stamps) {
    const list = normalizeStamps(stamps);
    if (!list.length) return "";
    return (
      '<div class="rx-paper-stamps" aria-hidden="true">' +
      list
        .map((id) => {
          const def = PAPER_STAMPS.find((s) => s.id === id) || {
            id: id,
            label: String(id).toUpperCase(),
            ink: "dim",
          };
          return (
            '<span class="rx-stamp ink-' +
            esc(def.ink) +
            '">' +
            esc(def.label) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function closedStampBadgeHtml(stamps) {
    const list = normalizeStamps(stamps);
    if (!list.length) return "";
    return '<span class="scrap-stamp-dot" title="' + esc(list.join(", ")) + '"></span>';
  }

  function leafTiltDeg(id) {
    const s = String(id || "x");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (Math.abs(h) % 13) - 6;
  }

  function setLeafEditUi(w, on) {
    const btn = w.el && w.el.querySelector("[data-act=edit]");
    if (btn) btn.classList.toggle("is-editing", !!on);
    w.el && w.el.classList.toggle("is-term-open", !!on);
  }

  function closeMdTerminal(w, opts) {
    opts = opts || {};
    if (!w || !w.termEl) return true;
    if (w.termDirty && !opts.force) {
      const leave = window.confirm("Terminal dirty. Quit without saving?");
      if (!leave) return false;
    }
    rememberTermSize(w);
    w.termEl.remove();
    w.termEl = null;
    w.termDirty = false;
    setLeafEditUi(w, false);
    if (opts.onClose) opts.onClose();
    return true;
  }

  function rememberTermSize(w) {
    if (!w || !w.termEl) return;
    w._termW = w.termEl.offsetWidth || w._termW;
    w._termH = w.termEl.offsetHeight || w._termH;
    persistPose({}, w);
  }

  function openMdTerminal(w, opts) {
    opts = opts || {};
    closeMdTerminal(w, { force: true });
    const term = document.createElement("div");
    term.className = "md-term";
    term.innerHTML =
      '<div class="md-term-bar" data-term-drag>' +
      '<span class="md-term-dot" aria-hidden="true"></span>' +
      '<span class="md-term-title">' +
      esc(opts.title || "markdown") +
      "</span>" +
      '<span class="md-term-hint">^S save · ^; spell · ^Q quit</span>' +
      '<button type="button" class="md-term-x" data-term-close title="quit terminal (^Q)">×</button>' +
      "</div>" +
      '<textarea class="md-term-ta" spellcheck="false" autocomplete="off"></textarea>' +
      '<div class="md-term-status" data-term-status></div>' +
      '<div class="md-term-resize" data-term-resize></div>';
    felt.appendChild(term);
    w.termEl = term;
    w.termDirty = false;
    w.termBaseline = opts.value != null ? String(opts.value) : "";

    const paperRect = w.el.getBoundingClientRect();
    const feltRect = felt.getBoundingClientRect();
    const tw = poseCache.termW > 160 ? poseCache.termW : 220;
    const th = poseCache.termH > 100 ? poseCache.termH : 140;
    let tx = paperRect.right - feltRect.left - 40;
    let ty = paperRect.bottom - feltRect.top - 20;
    if (tx + tw > feltRect.width - 8) tx = feltRect.width - tw - 12;
    if (ty + th > feltRect.height - 8) ty = feltRect.height - th - 12;
    if (tx < 8) tx = 8;
    if (ty < 8) ty = 8;
    term.style.left = tx + "px";
    term.style.top = ty + "px";
    term.style.width = tw + "px";
    term.style.height = th + "px";
    bringFront(term);
    setLeafEditUi(w, true);

    const ta = term.querySelector(".md-term-ta");
    const status = term.querySelector("[data-term-status]");
    ta.value = w.termBaseline;
    ta.spellcheck = getTermSpellcheck();

    function flashStatus(msg, ms) {
      if (!status) return;
      status.textContent = msg;
      status.classList.add("is-saved");
      setTimeout(() => {
        status.classList.remove("is-saved");
        status.textContent = w.termDirty ? "· unsaved" : "";
      }, ms || 1200);
    }

    function markDirty() {
      w.termDirty = ta.value !== w.termBaseline;
      if (status && !status.classList.contains("is-saved")) {
        status.textContent = w.termDirty ? "· unsaved" : "";
      }
      if (opts.onChange) opts.onChange(ta.value);
      scrollTextareaCaretIntoView(ta);
    }

    ta.addEventListener("input", markDirty);
    // arrows / click also keep caret in view inside the terminal pane
    ta.addEventListener("keyup", () => scrollTextareaCaretIntoView(ta));
    ta.addEventListener("click", () => scrollTextareaCaretIntoView(ta));
    ta.addEventListener("keydown", async (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      if (ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        if (opts.onChange) opts.onChange(ta.value);
        const ok = opts.onSave ? await opts.onSave() : true;
        if (ok !== false) {
          w.termBaseline = ta.value;
          w.termDirty = false;
          flashStatus("· saved", 1000);
        }
      }
      if (ev.key === "q" || ev.key === "Q") {
        ev.preventDefault();
        closeMdTerminal(w, { onClose: opts.onClose });
      }
      if (ev.key === ";") {
        ev.preventDefault();
        const on = setTermSpellcheck(!ta.spellcheck);
        ta.spellcheck = on;
        flashStatus(on ? "· spell on" : "· spell off", 1200);
      }
    });

    term.querySelector("[data-term-close]").onclick = (ev) => {
      ev.preventDefault();
      closeMdTerminal(w, { onClose: opts.onClose });
    };

    // drag + resize (same ritual as Receiver)
    const bar = term.querySelector("[data-term-drag]");
    bar.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      bringFront(term);
      const r = term.getBoundingClientRect();
      const fr = felt.getBoundingClientRect();
      const ox = ev.clientX - r.left;
      const oy = ev.clientY - r.top;
      function move(e) {
        let nx = e.clientX - fr.left - ox;
        let ny = e.clientY - fr.top - oy;
        nx = Math.max(0, Math.min(nx, fr.width - 80));
        ny = Math.max(0, Math.min(ny, fr.height - 40));
        term.style.left = nx + "px";
        term.style.top = ny + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        rememberTermSize(w);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
    });
    term.querySelector("[data-term-resize]").addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      bringFront(term);
      const sx = ev.clientX;
      const sy = ev.clientY;
      const sw = term.offsetWidth;
      const sh = term.offsetHeight;
      function move(e) {
        term.style.width = Math.max(160, sw + (e.clientX - sx)) + "px";
        term.style.height = Math.max(100, sh + (e.clientY - sy)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        rememberTermSize(w);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
      ev.stopPropagation();
    });

    ta.focus();
  }

  function openLeafTerminal(w, termOpts) {
    termOpts = termOpts || {};
    if (w.termEl) {
      const ta = w.termEl.querySelector(".md-term-ta");
      if (ta) {
        ta.focus();
        if (termOpts.focusTags) focusTagsLine(ta);
      }
      return;
    }
    // title / by / tags are chip matter, not body text
    const seed = paperEditorSeed(w, "untitled leaf");
    openMdTerminal(w, {
      title: "md · " + (w.data.title || "leaf"),
      value: seed,
      onChange: (v) => {
        const ta = w.termEl && w.termEl.querySelector(".md-term-ta");
        const parsed = parseCardTerminalRaw(v, paperParseFallback(w), {
          bodyMax: 0,
        });
        applyParsedPaperFields(w, parsed);
        paintFaceMetaEl(w.el, w.data.title, w.data.author);
        if (typeof w.paintFaceMeta === "function") w.paintFaceMeta();
        const line = ta
          ? bodyLineFromTerminal(ta, parsed.bodyStart)
          : undefined;
        paintPaper(w.el, parsed.body, line);
        scrollTextareaCaretIntoView(ta);
        if (typeof w.refreshStatus === "function") w.refreshStatus();
      },
      onSave: async () => {
        const ta = w.termEl && w.termEl.querySelector(".md-term-ta");
        const raw = ta ? ta.value : seed;
        const parsed = parseCardTerminalRaw(raw, paperParseFallback(w), {
          bodyMax: 0,
        });
        applyParsedPaperFields(w, parsed);
        w.data.author = rememberAuthor(parsed.author);
        paintFaceMetaEl(w.el, w.data.title, w.data.author);
        if (typeof w.paintFaceMeta === "function") w.paintFaceMeta();
        return saveScrap(w, { quiet: true });
      },
      onClose: () => setLeafEditUi(w, false),
    });
    if (termOpts.focusTags) {
      const ta = w.termEl && w.termEl.querySelector(".md-term-ta");
      focusTagsLine(ta);
    }
  }

  function syncScrap(w) {
    // face title/author are display-only — matter is w.data (MIRA: name / by)
    if (!w.open) return w.data;
    const p = w.el && w.el.querySelector("[data-field=paper]");
    if (p && p.value != null) w.data.paper = p.value;
    return w.data;
  }

  function normalizePaperTags(raw) {
    const out = [];
    const seen = {};
    (Array.isArray(raw) ? raw : []).forEach(function (t) {
      const s = String(t || "")
        .trim()
        .replace(/^#/, "");
      if (!s) return;
      const k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(s);
    });
    return out;
  }

  function paperEditorSeed(w, untitled) {
    const tags = normalizePaperTags(w.data && w.data.tags);
    return (
      "# " +
      ((w.data && (w.data.title || w.data.name)) || untitled || "untitled") +
      "\n" +
      "by: " +
      ((w.data && w.data.author) || "unknown") +
      "\n" +
      "tags: " +
      (tags.length ? tags.join(", ") : "") +
      "\n\n" +
      (w.data && w.data.body != null ? String(w.data.body) : "")
    );
  }

  function paperParseFallback(w) {
    return {
      title: w.data && w.data.title,
      author: w.data && w.data.author,
      tags: normalizePaperTags(w.data && w.data.tags),
    };
  }

  function applyParsedPaperFields(w, parsed) {
    w.data.title = parsed.title;
    w.data.author = parsed.author;
    w.data.body = parsed.body;
    if (parsed.tags != null) w.data.tags = normalizePaperTags(parsed.tags);
  }

  function focusTagsLine(ta) {
    if (!ta) return;
    const text = String(ta.value || "");
    const m = text.match(/^tags:/im);
    if (!m || m.index == null) return;
    const nl = text.indexOf("\n", m.index);
    const end = nl >= 0 ? nl : text.length;
    try {
      ta.focus();
      ta.setSelectionRange(end, end);
    } catch (_) {}
  }

  function parseTagArgs(rest) {
    const s = String(rest || "").trim();
    if (!s) return [];
    if (s.indexOf(",") >= 0) {
      return s
        .split(",")
        .map(function (p) {
          return p.trim();
        })
        .filter(Boolean);
    }
    return s.split(/\s+/).filter(Boolean);
  }

  async function saveScrap(w, opts) {
    opts = opts || {};
    syncScrap(w);
    // preserve stamp prop across body save (chip rewrite must not drop scar)
    const keepProp = w.data.prop ? Object.assign({}, w.data.prop) : null;
    const author = rememberAuthor(w.data.author);
    w.data.author = author;
    const payload = {
      id: w.data.id,
      title: w.data.title || "untitled leaf",
      author: author,
      paper: w.data.paper || "lined",
      stamps: normalizeStamps(w.data.stamps),
      tags: normalizePaperTags(w.data.tags),
      body: w.data.body != null ? String(w.data.body) : "",
      created: w.data.created,
    };
    const j = await api("/api/leaf/save", {
      method: "POST",
      body: JSON.stringify({ leaf: payload }),
    });
    if (!j.ok) {
      toast(j.error || "save fail");
      return false;
    }
    w.data = j.leaf || j.scrap;
    if (keepProp) w.data.prop = keepProp;
    if (w.open) {
      if (typeof w.refreshStatus === "function") w.refreshStatus();
      if (typeof w.paintFaceMeta === "function") w.paintFaceMeta();
      paintPaper(w.el, w.data.body);
      paintLeafStampPrint(w);
    } else {
      const t = w.el.querySelector(".scrap-label-text");
      if (t) t.textContent = w.data.title || "leaf";
    }
    // keep form on config (pose writer preserves prop marks)
    await persistPose({ paper: w.data.paper }, w);
    if (!opts.quiet) toast("saved · " + (j.chars || 0) + "c · " + (j.file || ""));
    return true;
  }

  async function persistPose(extra, wOpt) {
    const w = wOpt || targetWin();
    if (!w || !w.data) return;
    extra = extra || {};
    const el = w.el;
    // leaves always open; books store open yes/no (folded cloth)
    const pose = {
      x: parseFloat(el.style.left) || 48,
      y: parseFloat(el.style.top) || 48,
      openW: w._lastOpenW || (w.kind === "board" ? 420 : 360),
      openH: w._lastOpenH || (w.kind === "board" ? 520 : 460),
      termW: w._termW,
      termH: w._termH,
    };
    if (
      w.kind === "board" &&
      (isBookBin(w) || isShelfBin(w) || isDeckBin(w))
    ) {
      pose.open = w.open === false ? false : true;
    }
    if (w === win) {
      poseCache = Object.assign({}, poseCache, pose);
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(poseCache));
      } catch (_) {}
    }
    if (w.kind === "rom") {
      // session-only window · no chip pose yet
      return;
    }
    if (w.kind === "card") {
      const face =
        (w.data.dressup && (w.data.dressup.face || w.data.dressup.style)) ||
        w.data.face ||
        w.data.paper ||
        "plain";
      const j = await api("/api/card/pose", {
        method: "POST",
        body: JSON.stringify({
          id: w.data.id || w.data.uid,
          pose: pose,
          dressup: {
            id: w.data.id || w.data.uid,
            shell: "card",
            face: face,
            style: face,
          },
          prop: w.data.prop || null,
        }),
      });
      if (j && !j.ok) {
        toast(j.error || "card paper write failed");
      }
      return j;
    }
    if (w.kind === "key") {
      const heading = keyHeadingOf(w);
      const face = keyDressFace(w);
      const color = keyColorOf(w);
      pose.heading = heading;
      pose.openW = w._lastOpenW || KEY_SIZE;
      pose.openH = w._lastOpenH || KEY_SIZE;
      const prop = Object.assign({}, w.data.prop || {}, { heading: heading });
      if (color) prop.color = color;
      else delete prop.color;
      w.data.prop = prop;
      w.data.heading = heading;
      w.data.color = color;
      const j = await api("/api/key/pose", {
        method: "POST",
        body: JSON.stringify({
          id: w.data.id || w.data.uid,
          pose: pose,
          dressup: {
            id: w.data.id || w.data.uid,
            shell: "key",
            face: face,
            style: face,
          },
          prop: prop,
        }),
      });
      if (j && !j.ok) {
        toast(j.error || "key paper write failed");
      }
      return j;
    }
    if (w.kind === "board") {
      // matter uid board[n]/deck[n] · config bin-board[n]/bin-deck[n]
      const faceId = w.data.face_id || w.data.uid || w.data.id || "board[0]";
      const book = isBookBin(w);
      const deck = isDeckBin(w);
      await api("/api/pose", {
        method: "POST",
        body: JSON.stringify({
          id: w.data.id,
          pose: pose,
          prop: w.data.prop || null,
          dressup: {
            id: faceId,
            shell:
              w.data.shell ||
              (isTrashBin(w)
                ? "trashcan"
                : book
                  ? "bookbox"
                  : isShelfBin(w)
                    ? "bookshelf"
                    : deck
                      ? "deckbox"
                      : "boardbox"),
            style: isTrashBin(w)
              ? "bin"
              : w.data.style || "plain",
            face: isTrashBin(w)
              ? "bin"
              : deck
                ? w.data.face || w.data.style || "plain"
                : undefined,
            package_id: deck ? "envelope" : undefined,
            color: isTrashBin(w)
              ? undefined
              : !book && !isShelfBin(w)
                ? w.data.cloth || w.data.color || "cork"
                : w.data.color || undefined,
            cloth: isTrashBin(w)
              ? undefined
              : book
                ? w.data.cloth || "oxblood"
                : !isShelfBin(w)
                  ? w.data.cloth || w.data.color || "cork"
                  : undefined,
          },
        }),
      });
      return;
    }
    if (w.kind === "tool") {
      const prop = w.data.prop || {};
      const isInbox =
        w.data.package_id === "inbox" ||
        w.subtype === "inbox" ||
        prop.canReceive === true ||
        prop.canReceive === "yes" ||
        prop["canReceive"] === true;
      const isRom =
        w.subtype === "rom" ||
        w.data.package_id === "rom" ||
        !!prop["Rom.id"] ||
        !!w.data.rom_id;
      const plate =
        prop["Mark.type"] || prop["Mark.label"] || "urgent";
      const toolDress =
        w.data.dress ||
        (w.data.dressup && w.data.dressup.tool) ||
        (isRom ? "cart" : isInbox ? "plain" : "brass");
      const markDress =
        (w.data.dressup && w.data.dressup.mark) ||
        prop["Mark.style"] ||
        "classic";
      // NEVER send stamper-only prop for inbox — that wiped Receive.mail
      // ROM cart keeps Rom.* — not a Mark plate
      const propOut = isInbox
        ? {
            canReceive: true,
            canMark: false,
            "Receive.address": prop["Receive.address"] || prop.address || "",
            "Receive.kinds": prop["Receive.kinds"] || ["chip"],
            "Receive.mail": prop["Receive.mail"] || [],
            "Receive.hasMail":
              prop["Receive.hasMail"] === true ||
              prop["Receive.hasMail"] === "yes" ||
              (Array.isArray(prop["Receive.mail"]) &&
                prop["Receive.mail"].length > 0),
          }
        : isRom
          ? {
              canMark: false,
              "Rom.id": prop["Rom.id"] || w.data.rom_id || "",
              "Rom.title": prop["Rom.title"] || w.data.title || "",
              "Rom.sku": prop["Rom.sku"] || w.data.sku || "",
              "Rom.shell": prop["Rom.shell"] || "classicboi",
              "Rom.tint": prop["Rom.tint"] || "",
              "Rom.plate_css": prop["Rom.plate_css"] || "",
              "Rom.catalog_id": prop["Rom.catalog_id"] || "",
            }
          : (() => {
              // keep plate + cite capacity · put-down used to wipe Mark.* / Cite.*
              const out = {
                canMark:
                  prop.canMark !== false &&
                  prop.canMark !== "no" &&
                  prop.canMark !== "false",
                "Mark.type": plate,
                "Mark.label": prop["Mark.label"] || plate,
                "Mark.style": markDress || prop["Mark.style"] || "classic",
                "Mark.class":
                  prop["Mark.class"] ||
                  (w.data.package_id === "chipper" || w.subtype === "chipper"
                    ? "cite"
                    : "stamp"),
              };
              if (prop.canErase === true || prop.canErase === "yes")
                out.canErase = true;
              if (prop["Mark.labels"] != null)
                out["Mark.labels"] = prop["Mark.labels"];
              if (prop["Mark.types"] != null)
                out["Mark.types"] = prop["Mark.types"];
              if (prop["Cite.code"]) out["Cite.code"] = prop["Cite.code"];
              if (prop["Cite.style"]) out["Cite.style"] = prop["Cite.style"];
              return out;
            })();
      await api("/api/tool/pose", {
        method: "POST",
        body: JSON.stringify({
          id: w.data.uid || w.data.id,
          pose: pose,
          prop: propOut,
          dressup: {
            id: w.data.uid || w.data.id,
            tool: toolDress,
            mark: markDress,
          },
        }),
      });
      // keep live memory in sync with what we just wrote
      w.data.prop = Object.assign({}, prop, propOut);
      return;
    }
    const style = extra.paper || w.data.paper || w.data.style || "lined";
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
    });
  }

  function boardWinById(bid) {
    if (!bid) return null;
    const w = wins.get(String(bid));
    return w && w.kind === "board" ? w : null;
  }

  /** Board pocket leaf scale factor (transform, not css zoom). */
  const BOARD_LEAF_SCALE = 0.55;
  const KEY_HEADINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const KEY_HEADING_DEG = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };
  const KEY_SIZE = 52;
  const KEY_MIN = 32;
  const KEY_MAX = 220;
  const KEY_FACE_ALIAS = {
    octogon: "octagon",
    octogons: "octagon",
    octagons: "octagon",
    hex: "hexagon",
    hexagons: "hexagon",
    square: "plain",
    rounded: "plain",
  };
  const KEY_COLOR_NAMES = {
    cream: "#f4efe4",
    amber: "#d4a04a",
    gold: "#e0c060",
    brass: "#c4a060",
    red: "#c44030",
    rose: "#c07070",
    blue: "#3a6090",
    green: "#3a6040",
    black: "#1a1410",
    white: "#f6f1e8",
    ink: "#2a1c10",
    violet: "#5a3a70",
    slate: "#4a5058",
  };

  function normalizeKeyFace(id) {
    let s = String(id || "plain")
      .trim()
      .toLowerCase();
    s = KEY_FACE_ALIAS[s] || s;
    if (s === "text" || s === "svg" || s === "_base" || !s) return "plain";
    if (s === "plain" || s === "octagon" || s === "hexagon") return s;
    return "plain";
  }

  function keyDressFace(w) {
    const du = (w && w.data && w.data.dressup) || {};
    return normalizeKeyFace(du.face || du.style || (w && w.data && w.data.style) || "plain");
  }

  function normalizeKeyColor(raw) {
    const s = String(raw || "").trim();
    if (!s || /^(none|clear|off|default)$/i.test(s)) return "";
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s.toLowerCase();
    const name = s.toLowerCase().replace(/\s+/g, "");
    if (KEY_COLOR_NAMES[name]) return KEY_COLOR_NAMES[name];
    if (/^(red|blue|green|black|white|gold|orange|purple)$/.test(name)) return name;
    return "";
  }

  function keyColorOf(w) {
    return normalizeKeyColor(
      (w && w.data && (w.data.color || (w.data.prop && w.data.prop.color))) || ""
    );
  }

  function keyInkFor(fill) {
    const raw = String(fill || "");
    const hex = raw.charAt(0) === "#" ? raw.slice(1) : "";
    let r = 200,
      g = 180,
      b = 140;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (
      fill === "black" ||
      fill === "ink" ||
      fill === "blue" ||
      fill === "green" ||
      fill === "red" ||
      fill === "purple"
    ) {
      return "#f4efe4";
    } else if (
      fill === "white" ||
      fill === "cream" ||
      fill === "gold" ||
      fill === "amber"
    ) {
      return "#2a1c10";
    }
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.55 ? "#2a1c10" : "#f4efe4";
  }

  function applyKeyColor(w) {
    if (!w || !w.el) return;
    const cap = w.el.querySelector(".key-cap") || w.el;
    const fill = keyColorOf(w);
    if (fill) {
      cap.style.setProperty("--key-fill", fill);
      cap.style.setProperty("--key-ink", keyInkFor(fill));
    } else {
      cap.style.removeProperty("--key-fill");
      cap.style.removeProperty("--key-ink");
    }
  }

  function keyHeadingOf(w) {
    const raw = String(
      (w && w.data && (w.data.heading || (w.data.prop && w.data.prop.heading))) ||
        "N"
    )
      .trim()
      .toUpperCase()
      .replace(/-/g, "");
    const aliases = {
      NORTH: "N",
      NORTHEAST: "NE",
      EAST: "E",
      SOUTHEAST: "SE",
      SOUTH: "S",
      SOUTHWEST: "SW",
      WEST: "W",
      NORTHWEST: "NW",
    };
    const h = aliases[raw] || raw;
    return KEY_HEADINGS.indexOf(h) >= 0 ? h : "N";
  }

  function applyKeyTransform(w) {
    if (!w || w.kind !== "key" || !w.el) return;
    const deg = KEY_HEADING_DEG[keyHeadingOf(w)] || 0;
    const peek = w.el.classList.contains("is-peek");
    const inBoard = w.el.classList.contains("is-in-board") && !peek;
    const s = inBoard ? BOARD_LEAF_SCALE : 1;
    const rot = "rotate(" + deg + "deg)";
    w.el.style.transform = s !== 1 ? "scale(" + s + ") " + rot : rot;
    w.el.style.transformOrigin = inBoard ? "0 0" : "center center";
    w.el.dataset.heading = keyHeadingOf(w);
    const ww = w._lastOpenW || KEY_SIZE;
    const hh = w._lastOpenH || KEY_SIZE;
    if (inBoard) {
      w.el.style.marginRight = ww * (s - 1) + "px";
      w.el.style.marginBottom = hh * (s - 1) + "px";
    } else {
      w.el.style.marginRight = "";
      w.el.style.marginBottom = "";
    }
  }

  /**
   * Apply tiny visual via transform:scale + negative margins.
   * zoom: was fighting style.left/top (runaway cursor). transform origin 0,0
   * keeps layout left/top == visual left/top so delta drag stays honest.
   */
  function applyBoardLeafVisual(lw) {
    if (!lw || !lw.el) return;
    if (lw.kind === "key") {
      applyKeyTransform(lw);
      return;
    }
    const el = lw.el;
    const s = BOARD_LEAF_SCALE;
    const w = lw._lastOpenW || parseFloat(el.style.width) || 360;
    const h = lw._lastOpenH || parseFloat(el.style.height) || 460;
    lw._lastOpenW = w;
    lw._lastOpenH = h;
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.transform = "scale(" + s + ")";
    el.style.transformOrigin = "0 0";
    // collapse layout footprint to the visual size
    el.style.marginRight = w * (s - 1) + "px";
    el.style.marginBottom = h * (s - 1) + "px";
  }

  function clearBoardLeafVisual(lw) {
    if (!lw || !lw.el) return;
    if (lw.kind === "key") {
      lw.el.classList.remove("is-in-board");
      applyKeyTransform(lw);
      if (lw._lastOpenW) lw.el.style.width = lw._lastOpenW + "px";
      if (lw._lastOpenH) lw.el.style.height = lw._lastOpenH + "px";
      return;
    }
    const el = lw.el;
    el.style.transform = "";
    el.style.transformOrigin = "";
    el.style.marginRight = "";
    el.style.marginBottom = "";
    if (lw._lastOpenW) el.style.width = lw._lastOpenW + "px";
    if (lw._lastOpenH) el.style.height = lw._lastOpenH + "px";
  }

  /**
   * Board leaf scale:
   * - is-in-board → member of a box (default tiny)
   * - is-peek → click without drag: full size in pocket; drag clears peek
   */
  function setLeafInBoardScale(lw, on) {
    if (!lw || !lw.el) return;
    lw.el.classList.toggle("is-in-board", !!on);
    lw.el.classList.remove("is-peek");
    lw._peek = false;
    if (on) applyBoardLeafVisual(lw);
    else clearBoardLeafVisual(lw);
  }

  function setLeafPeek(lw, on) {
    if (!lw || !lw.el) return;
    if (!lw.el.classList.contains("is-in-board") && !lw._inBin) return;
    lw._peek = !!on;
    lw.el.classList.toggle("is-peek", !!on);
    if (on) {
      // full size — no scale transform
      if (lw.kind === "key") applyKeyTransform(lw);
      else lw.el.style.transform = "none";
      lw.el.style.marginRight = "";
      lw.el.style.marginBottom = "";
      if (lw._lastOpenW) lw.el.style.width = lw._lastOpenW + "px";
      if (lw._lastOpenH) lw.el.style.height = lw._lastOpenH + "px";
      bringFront(lw.el);
    } else {
      applyBoardLeafVisual(lw);
    }
  }

  function elIsVisibleDrop(el) {
    if (!el) return false;
    if (el.hidden) return false;
    // hidden ancestors (closed deck's open panel has [hidden] pocket)
    if (el.closest && el.closest("[hidden]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function hitBoardAtClient(clientX, clientY, skipWin) {
    let best = null;
    let bestZ = -1;
    // office floor · slightly fat shelves so scaled books can re-dock
    const shelfPad = placeMode === "room" ? 28 : 0;
    wins.forEach((bw) => {
      if (bw.kind !== "board" || !bw.el) return;
      // don't hit the thing you're dragging (book would always win over shelf)
      if (skipWin && (bw === skipWin || bw.el === skipWin)) return;
      if (skipWin && skipWin.el && bw.el === skipWin.el) return;
      if (bw.el.style.display === "none") return;
      // IMPORTANT: querySelector finds hidden deck open-pocket first — that
      // made closed decks unhittable (0-size rect). Only test visible targets.
      const nodes = [];
      bw.el
        .querySelectorAll(
          "[data-shelf-drop], [data-board-pocket], [data-bin-drop], [data-deck-closed], [data-deck-face]"
        )
        .forEach((n) => nodes.push(n));
      nodes.push(bw.el);
      let hit = false;
      const pad = isShelfBin(bw) ? shelfPad : 0;
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (!elIsVisibleDrop(el)) continue;
        const r = el.getBoundingClientRect();
        if (
          clientX >= r.left - pad &&
          clientX <= r.right + pad &&
          clientY >= r.top - pad &&
          clientY <= r.bottom + pad
        ) {
          hit = true;
          break;
        }
      }
      if (!hit) return;
      const z = parseInt(bw.el.style.zIndex || "0", 10) || 0;
      // prefer shelves when under the pointer so books can land (not desk magnet)
      const boost = isShelfBin(bw) ? 8 : isDeckBin(bw) ? 0.2 : 0;
      const score = z + boost;
      if (score >= bestZ) {
        bestZ = score;
        best = bw;
      }
    });
    return best;
  }

  /**
   * Manila envelope parcel.
   * Law: type/class/package/uid envelope · holds leaf+card.
   * Legacy match: old deck[n] / package deck (pre-rename) still work.
   */
  function isEnvelopeBin(bw) {
    if (!bw || !bw.data) return false;
    const t = String(bw.data.subtype || bw.data.bin_type || "").toLowerCase();
    const c = String(bw.data.class || "").toLowerCase();
    const pkg = String(bw.data.package_id || "").toLowerCase();
    const id = String(bw.data.id || bw.data.uid || "");
    return (
      t === "envelope" ||
      c === "envelope" ||
      pkg === "envelope" ||
      /^envelope\[/i.test(id) ||
      // legacy manila (pre envelope package rename)
      t === "deck" ||
      c === "deck" ||
      pkg === "deck" ||
      /^deck\[/i.test(id)
    );
  }
  /** @deprecated use isEnvelopeBin — name was the manila thrash */
  function isDeckBin(bw) {
    return isEnvelopeBin(bw);
  }

  function isTrashBin(bw) {
    if (!bw || !bw.data) return false;
    const p = (bw.data.prop && bw.data.prop) || {};
    const flag = p.isTrash;
    if (flag === true || flag === "yes" || flag === "true") return true;
    const tags = bw.data.tags || [];
    if (
      tags.some(function (t) {
        return String(t).toLowerCase() === "trash-can";
      })
    )
      return true;
    const title = String(bw.data.title || bw.data.name || "")
      .trim()
      .toLowerCase();
    return title === "trash" || title === "wastebasket";
  }

  const TRASH_FACE_W = 96;
  const TRASH_FACE_H = 112;

  function envelopeFaceSize(bw) {
    if (isTrashBin(bw)) return { w: TRASH_FACE_W, h: TRASH_FACE_H };
    return { w: 168, h: 104 };
  }

  function trashFaceHtml() {
    return (
      '<div class="trash-can" data-tool="trash" data-deck-face data-bin-drop>' +
      '<button type="button" class="trash-closed" data-deck-closed data-drag-chrome data-bin-drop>' +
      '<span class="trash-lid" aria-hidden="true"></span>' +
      '<span class="trash-body">' +
      '<span class="trash-word">TRASH</span>' +
      '<span class="trash-count" data-deck-count></span>' +
      "</span></button>" +
      '<div class="deck-open" data-deck-open hidden aria-hidden="true"></div></div>'
    );
  }

  function cardHomeBin(cw) {
    if (!cw || !cw.data) return null;
    const p = (cw.data.prop && cw.data.prop.homeBin) || cw.data.homeBin;
    return p ? String(p) : null;
  }

  function deckTitleById(did) {
    if (!did) return "";
    const bw = boardWinById(did);
    if (bw && bw.data)
      return bw.data.title || bw.data.name || did;
    return String(did);
  }

  /**
   * Card bottom-rail filing (not a "re:" subject line):
   *  · home envelope (in or checked out) → envelope · <title>
   *  · no home → unfiled (red)
   *  · out but home → quiet "out" mark on the envelope chip
   */
  function stampFiling(cw) {
    if (!cw || !cw.data || (cw.kind !== "card" && cw.kind !== "leaf")) return;
    const home = cardHomeBin(cw);
    const nested = !!(cw.data.bin || cw._inBin);
    let filing = "unfiled";
    let unfiled = true;
    let out = false;
    if (home) {
      const title = deckTitleById(home);
      filing = title ? "envelope · " + title : "envelope";
      unfiled = false;
      out = !nested;
    }
    cw.data.filingRe = filing;
    cw.data.filingUnfiled = unfiled;
    cw.data.filingOut = out;
  }

  /** @deprecated use stampFiling */
  function stampCardFiling(cw) {
    stampFiling(cw);
  }

  function paintCardFace(cw) {
    if (!cw || cw.kind !== "card") return;
    stampFiling(cw);
    const impl = window.PocketTools && window.PocketTools.get("card");
    if (impl && impl.paint) impl.paint(cw);
  }

  /**
   * Leaf bottom foot · match card checkout controls.
   * Only shows when checked out of an envelope (not nested, has home).
   * No red "unfiled" on free papers — that was thrash, not the ask.
   */
  function paintLeafFiling(cw) {
    if (!cw || cw.kind !== "leaf" || !cw.el) return;
    stampFiling(cw);
    const rail = cw.el.querySelector("[data-leaf-filing]");
    if (!rail) return;
    const lab = rail.querySelector("[data-leaf-filing-label]");
    const put = rail.querySelector("[data-leaf-putaway]");
    const unf = rail.querySelector("[data-leaf-unfile]");
    const filing = cw.data.filingRe || "";
    const unfiled = !!cw.data.filingUnfiled;
    const out = !!cw.data.filingOut;
    // same as card: buttons only when out + still has home
    const showCheckout = out && !unfiled;
    rail.hidden = !showCheckout;
    if (!showCheckout) return;
    if (lab) {
      lab.textContent = filing;
      lab.classList.remove("is-unfiled");
      lab.classList.add("is-out");
      lab.title = "checked out · " + filing;
    }
    if (put) put.hidden = false;
    if (unf) unf.hidden = false;
  }

  function wireLeafFiling(cw) {
    if (!cw || !cw.el || cw.el._leafFilingWired) return;
    const rail = cw.el.querySelector("[data-leaf-filing]");
    if (!rail) return;
    cw.el._leafFilingWired = true;
    const put = rail.querySelector("[data-leaf-putaway]");
    const unf = rail.querySelector("[data-leaf-unfile]");
    if (put) {
      put.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      put.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await putAwayMember(cw);
      });
    }
    if (unf) {
      unf.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      unf.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await unfileMember(cw);
        paintLeafFiling(cw);
      });
    }
  }

  async function persistCardHome(cw) {
    if (!cw || cw.kind !== "card") return;
    cw.data.prop = Object.assign({}, cw.data.prop || {});
    const home = cardHomeBin(cw);
    if (home) {
      cw.data.prop.homeBin = home;
      cw.data.homeBin = home;
    } else {
      // MUST send empty string — write_card_config only pops homeBin when the
      // key is present. Omitting the key keeps the old home on paper (reload bug).
      cw.data.prop.homeBin = "";
      cw.data.homeBin = null;
    }
    await persistPose({}, cw);
    // living client prop: no empty string scar after a successful clear
    if (!home && cw.data.prop && cw.data.prop.homeBin === "") {
      delete cw.data.prop.homeBin;
    }
  }

  /** Pull card out of every deck/board membership row (paper write). */
  async function removeCardFromBin(binId, cardId) {
    if (!binId || !cardId) return null;
    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: binId,
        leaf_id: cardId,
        action: "remove",
      }),
    });
    if (j.ok && j.bin) {
      const dw = boardWinById(binId);
      if (dw) {
        dw.data.chips = j.bin.chips || [];
        if (isDeckBin(dw)) refreshDeckList(dw);
        else refreshBoardMeta(dw);
      }
    }
    return j;
  }

  function hideCardInDeck(cw) {
    if (!cw || !cw.el) return;
    setLeafInBoardScale(cw, false);
    cw.el.classList.remove("is-in-board", "is-peek");
    cw.el.style.display = "none";
    if (cw.el.parentElement !== felt) felt.appendChild(cw.el);
  }

  function showCardOnFelt(cw, clientX, clientY, nearWin) {
    if (!cw || !cw.el) return;
    cw.el.style.display = "";
    setLeafInBoardScale(cw, false);
    cw.el.classList.remove("is-in-board", "is-peek");
    const fr = felt.getBoundingClientRect();
    // layout size can be larger than the visible rect (wide desk / scroll)
    const logicW =
      parseFloat(felt.style.width) || felt.scrollWidth || fr.width || 800;
    const logicH =
      parseFloat(felt.style.height) || felt.scrollHeight || fr.height || 600;
    const cardW =
      parseFloat(cw.el.style.width) || cw.el.offsetWidth || 275;
    const cardH =
      parseFloat(cw.el.style.height) || cw.el.offsetHeight || 165;
    let nx = 48;
    let ny = 48;
    // prefer beside the envelope contents pop if this card is from a deck
    const homeId =
      (nearWin &&
        nearWin.data &&
        (nearWin.data.id || nearWin.data.uid)) ||
      cardHomeBin(cw);
    const homeDeck = homeId ? boardWinById(homeId) || nearWin : nearWin;
    const pop =
      homeDeck && isDeckBin(homeDeck)
        ? document.getElementById(deckPopDomId(homeDeck))
        : null;
    if (clientX != null && clientY != null) {
      const ox = cardW / 2;
      const oy = cardH / 2;
      nx = clientX - fr.left + (felt.scrollLeft || 0) - ox;
      ny = clientY - fr.top + (felt.scrollTop || 0) - oy;
    } else if (pop) {
      // land just under / beside the list so it stays on-screen with the pop
      const pr = pop.getBoundingClientRect();
      nx = pr.left - fr.left + (felt.scrollLeft || 0);
      ny = pr.bottom - fr.top + (felt.scrollTop || 0) + 10;
      if (ny + cardH > logicH - 8) {
        ny = Math.max(8, pr.top - fr.top + (felt.scrollTop || 0));
        nx = pr.right - fr.left + (felt.scrollLeft || 0) + 10;
      }
    } else if (nearWin && nearWin.el) {
      const r = nearWin.el.getBoundingClientRect();
      nx = r.left - fr.left + (felt.scrollLeft || 0);
      ny = r.bottom - fr.top + (felt.scrollTop || 0) + 12;
      if (ny + cardH > logicH - 8) {
        ny = Math.max(8, r.top - fr.top + (felt.scrollTop || 0));
        nx = r.right - fr.left + (felt.scrollLeft || 0) + 12;
      }
    }
    nx = Math.max(8, Math.min(nx, Math.max(8, logicW - cardW - 8)));
    ny = Math.max(8, Math.min(ny, Math.max(8, logicH - cardH - 8)));
    felt.appendChild(cw.el);
    cw.el.style.left = nx + "px";
    cw.el.style.top = ny + "px";
    bringFront(cw.el);
  }

  function cardsWithHome(deckId) {
    const did = String(deckId || "");
    const out = [];
    wins.forEach((w) => {
      if (
        (w.kind === "card" || w.kind === "leaf") &&
        cardHomeBin(w) === did
      )
        out.push(w);
    });
    return out;
  }

  function deckPopDomId(bw) {
    const id = (bw && bw.data && (bw.data.id || bw.data.uid)) || "deck";
    return "deck-pop-" + String(id).replace(/[^\w\-[\]]+/g, "_");
  }

  /** Smart place like papers please — beside envelope, flip if off felt. */
  function placeDeckPopNear(bw, pad) {
    if (!bw || !bw.el || !pad || !felt) return;
    const fr = felt.getBoundingClientRect();
    const wr = bw.el.getBoundingClientRect();
    const pw = parseFloat(pad.style.width) || 280;
    const ph = parseFloat(pad.style.height) || 300;
    let x = wr.right - fr.left + 12;
    let y = wr.top - fr.top;
    // prefer right of envelope; else left
    if (x + pw > fr.width - 8) {
      x = Math.max(8, wr.left - fr.left - pw - 12);
    }
    // prefer above if bottom clips
    if (y + ph > fr.height - 8) {
      y = Math.max(8, fr.height - ph - 8);
    }
    // prefer below envelope top if still tight on top
    if (y < 8) y = 8;
    if (x < 8) x = 8;
    // if still overlapping envelope center, try below
    const envBottom = wr.bottom - fr.top + 10;
    if (
      x < wr.right - fr.left &&
      x + pw > wr.left - fr.left &&
      y < wr.bottom - fr.top &&
      y + 40 > wr.top - fr.top
    ) {
      y = Math.min(envBottom, Math.max(8, fr.height - ph - 8));
    }
    pad.style.left = x + "px";
    pad.style.top = y + "px";
  }

  function removeDeckPop(bw) {
    const pad = document.getElementById(deckPopDomId(bw));
    if (pad) pad.remove();
    if (bw) bw._deckPop = null;
  }

  function ensureDeckPop(bw) {
    if (!bw || !isDeckBin(bw) || !felt) return null;
    const pid = deckPopDomId(bw);
    let pad = document.getElementById(pid);
    if (pad) {
      placeDeckPopNear(bw, pad);
      bringFront(pad);
      return pad;
    }
    pad = document.createElement("div");
    pad.id = pid;
    pad.className = "deck-pop";
    pad.setAttribute("role", "dialog");
    pad.setAttribute(
      "aria-label",
      "envelope · " + (bw.data.title || bw.data.id || "cards")
    );
    pad.dataset.deckId = String(bw.data.id || bw.data.uid || "");
    pad.innerHTML =
      '<div class="deck-pop-bar" data-deck-pop-drag>' +
      '<span class="deck-pop-mark" aria-hidden="true">✉</span>' +
      '<span class="deck-pop-title" data-deck-pop-title></span>' +
      '<span class="deck-pop-kind">contents</span>' +
      '<button type="button" class="deck-pop-fold" data-deck-pop-fold title="fold list · envelope stays">fold</button>' +
      "</div>" +
      '<div class="deck-pop-meta" data-deck-pop-meta></div>' +
      '<div class="deck-list" data-deck-list></div>' +
      '<div class="deck-pop-foot">cards + papers · list only · stay put until pull</div>';
    felt.appendChild(pad);
    pad.style.width = "280px";
    pad.style.height = "300px";
    const titleEl = pad.querySelector("[data-deck-pop-title]");
    if (titleEl) {
      const id = bw.data.uid || bw.data.id || "";
      const nm = bw.data.title || "envelope";
      titleEl.textContent = id ? id + " · " + nm : nm;
    }
    pad.querySelector("[data-deck-pop-fold]").onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // fold = close · put checked-out cards/leaves back in
      closeDeck(bw).catch(() => {});
    };
    // drag the pop itself (papers-please style)
    const bar = pad.querySelector("[data-deck-pop-drag]");
    if (bar) {
      bar.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest("button")) return;
        ev.preventDefault();
        const sx = ev.clientX;
        const sy = ev.clientY;
        const x0 = parseFloat(pad.style.left) || 0;
        const y0 = parseFloat(pad.style.top) || 0;
        function move(e) {
          const fr = felt.getBoundingClientRect();
          let nx = x0 + (e.clientX - sx);
          let ny = y0 + (e.clientY - sy);
          const pw = pad.offsetWidth || 280;
          const ph = pad.offsetHeight || 300;
          nx = Math.max(4, Math.min(nx, fr.width - 40));
          ny = Math.max(4, Math.min(ny, fr.height - 40));
          pad.style.left = nx + "px";
          pad.style.top = ny + "px";
        }
        function up() {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }
    placeDeckPopNear(bw, pad);
    bringFront(pad);
    bw._deckPop = pad;
    return pad;
  }

  function refreshDeckList(bw) {
    if (!bw || !isDeckBin(bw)) return;
    // list lives on the pop-out (not inside the envelope face)
    const pad =
      document.getElementById(deckPopDomId(bw)) ||
      (bw.open ? ensureDeckPop(bw) : null);
    const list =
      (pad && pad.querySelector("[data-deck-list]")) ||
      (bw.el && bw.el.querySelector("[data-deck-list]"));
    if (!list) {
      const dimpl0 = window.PocketTools && (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
      if (dimpl0 && dimpl0.paint) dimpl0.paint(bw);
      refreshBoardMeta(bw);
      return;
    }
    if (pad) {
      const titleEl = pad.querySelector("[data-deck-pop-title]");
      if (titleEl) {
        const id = bw.data.uid || bw.data.id || "";
        const nm = bw.data.title || "envelope";
        titleEl.textContent = id ? id + " · " + nm : nm;
      }
      paintEnvStation(bw);
    }
    function cardWin(cid) {
      const k = String(cid || "");
      return wins.get(k) || wins.get(cid) || null;
    }
    // membership ids · also accept chips on data.members if ever aliased
    const rawChips =
      bw.data.chips ||
      bw.data.members ||
      (bw.data.bin && bw.data.bin.chips) ||
      [];
    const chips = rawChips.map(String);
    const nestedSet = new Set(chips);
    // ordered: in-box order, then checked-out home cards not in chips
    const rows = [];
    chips.forEach((cid, i) => {
      const cw = cardWin(cid);
      const nested = !!(cw && (cw.data.bin || cw._inBin));
      rows.push({
        id: cid,
        title:
          (cw && cw.data && (cw.data.title || cw.data.name)) || cid,
        // in envelope chips = "in" (even if win missing); out only via home list
        out: false,
        idx: i + 1,
        missing: !cw,
      });
      if (!nested && cw && cw.el && cw.el.style.display !== "none") {
        // rare: still in chips but already on felt
        rows[rows.length - 1].out = true;
      }
    });
    cardsWithHome(bw.data.id || bw.data.uid).forEach((cw) => {
      const id = String(cw.data.id || cw.data.uid);
      if (nestedSet.has(id)) return;
      rows.push({
        id: id,
        title: cw.data.title || cw.data.name || id,
        out: true,
        idx: rows.length + 1,
      });
    });
    bw.data._outCount = rows.filter((r) => r.out).length;
    if (pad) {
      const meta = pad.querySelector("[data-deck-pop-meta]");
      if (meta) {
        const nIn = rows.filter((r) => !r.out).length;
        const nOut = rows.filter((r) => r.out).length;
        meta.textContent =
          nIn +
          " in" +
          (nOut ? " · " + nOut + " out on desk" : "") +
          " · stay put until you pull";
      }
    }
    if (!rows.length) {
      list.innerHTML =
        '<div class="deck-list-empty">empty · drop a card or paper on the envelope</div>';
    } else {
      list.innerHTML = rows
        .map(function (r) {
          const kind =
            String(r.id).indexOf("leaf") === 0
              ? "paper"
              : String(r.id).indexOf("card") === 0
                ? "card"
                : "";
          return (
            '<div class="deck-list-row' +
            (r.out ? " is-out" : "") +
            '" data-deck-card="' +
            esc(r.id) +
            '">' +
            '<span class="deck-list-idx">' +
            r.idx +
            "</span>" +
            '<button type="button" class="deck-list-title" data-deck-pull title="pull out · still filed">' +
            "</button>" +
            (kind
              ? '<span class="deck-list-kind">' + kind + "</span>"
              : "") +
            (r.out
              ? '<span class="deck-list-out">out</span>'
              : "") +
            '<button type="button" class="deck-list-unfile" data-deck-unfile title="unfile · free forever">unfile</button>' +
            "</div>"
          );
        })
        .join("");
      Array.from(list.querySelectorAll("[data-deck-card]")).forEach((rowEl) => {
        const cid = rowEl.getAttribute("data-deck-card");
        const row = rows.find((x) => x.id === cid);
        const tit = rowEl.querySelector(".deck-list-title");
        if (tit && row) tit.textContent = row.title;
        const pull = rowEl.querySelector("[data-deck-pull]");
        if (pull) {
          pull.addEventListener("click", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await deckListActivate(bw, cid);
          });
        }
        const unf = rowEl.querySelector("[data-deck-unfile]");
        if (unf) {
          unf.addEventListener("click", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await unfileFromEnvelope(bw, cid);
          });
        }
      });
    }
    const dimpl = window.PocketTools && (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
    if (dimpl && dimpl.paint) dimpl.paint(bw);
    refreshBoardMeta(bw);
  }

  async function deckListActivate(bw, memberId) {
    const mid = String(memberId || "");
    let w = wins.get(mid);
    if (!w) {
      // try leaf / card scan
      wins.forEach((ww) => {
        if (
          !w &&
          String((ww.data && (ww.data.id || ww.data.uid)) || "") === mid
        )
          w = ww;
      });
    }
    if (!w || (w.kind !== "card" && w.kind !== "leaf")) {
      toast("not on desk · " + mid);
      return;
    }
    const nested = !!(w.data.bin || w._inBin);
    if (nested) {
      await checkoutFromEnvelope(w, bw);
    } else if (w.kind === "card") {
      showCardOnFelt(w, null, null, bw);
      setFocus(w);
      paintCardFace(w);
    } else {
      // leaf already free
      w.el.style.display = "";
      if (w.el.parentElement !== felt) felt.appendChild(w.el);
      showCardOnFelt(w, null, null, bw);
      setFocus(w);
    }
  }

  async function checkoutFromEnvelope(cw, homeDeck, clientX, clientY) {
    if (!cw || (cw.kind !== "card" && cw.kind !== "leaf")) return;
    const bid =
      cw.data.bin || cw._inBin || (homeDeck && homeDeck.data.id);
    if (bid) {
      const j = await removeCardFromBin(bid, cw.data.id || cw.data.uid);
      if (j && !j.ok) {
        toast(j.error || "checkout · membership write failed");
        return;
      }
    }
    // keep home scar so list still shows "out"
    if (!cardHomeBin(cw) && bid) {
      cw.data.homeBin = bid;
      cw.data.prop = Object.assign({}, cw.data.prop || {}, { homeBin: bid });
    }
    cw.data.bin = null;
    cw._inBin = null;
    showCardOnFelt(cw, clientX, clientY, homeDeck || boardWinById(bid));
    if (cw.kind === "card") {
      await persistCardHome(cw);
      paintCardFace(cw);
    } else {
      await persistPose({}, cw);
      paintLeafFiling(cw);
    }
    const home = cardHomeBin(cw);
    if (home) {
      const dw = boardWinById(home);
      if (dw) refreshDeckList(dw);
    }
    toast(
      "out · " +
        (cw.kind === "leaf" ? "paper" : "card") +
        " · " +
        (cardHomeBin(cw) || "")
    );
  }

  /** @deprecated name · cards + papers from envelope */
  async function checkoutCardFromDeck(cw, homeDeck, clientX, clientY) {
    return checkoutFromEnvelope(cw, homeDeck, clientX, clientY);
  }

  async function unfileFromEnvelope(bw, memberId) {
    const mid = String(memberId || "");
    let w = wins.get(mid);
    if (!w) {
      wins.forEach((ww) => {
        if (
          !w &&
          String((ww.data && (ww.data.id || ww.data.uid)) || "") === mid
        )
          w = ww;
      });
    }
    if (!w) {
      // still strip membership from envelope even if win missing
      if (bw && bw.data) {
        const j = await removeCardFromBin(
          bw.data.id || bw.data.uid,
          mid
        );
        if (j && j.ok) refreshDeckList(bw);
      }
      toast("unfiled · " + mid + " · (no open window)");
      return;
    }
    await unfileMember(w);
  }

  /** Clear envelope/board filing forever (card or paper). */
  async function unfileMember(cw) {
    if (!cw || (cw.kind !== "card" && cw.kind !== "leaf")) return;
    const memberId = cw.data.id || cw.data.uid;
    const bid = cw.data.bin || cw._inBin;
    const prevHome = cardHomeBin(cw);
    const targets = [];
    if (bid) targets.push(String(bid));
    if (prevHome && String(prevHome) !== String(bid || "")) {
      targets.push(String(prevHome));
    }
    for (const tid of targets) {
      const j = await removeCardFromBin(tid, memberId);
      if (j && !j.ok) {
        toast(j.error || "unfile · membership write failed");
        return;
      }
    }
    cw.data.bin = null;
    cw._inBin = null;
    cw.data.homeBin = null;
    if (cw.data.prop) {
      delete cw.data.prop.homeBin;
      // pose write needs empty scar for leaves too
      cw.data.prop.homeBin = "";
    }
    showCardOnFelt(cw, null, null, null);
    if (cw.kind === "card") {
      await persistCardHome(cw);
      paintCardFace(cw);
    } else {
      // leaf · force homeBin clear on paper
      cw.data.prop = Object.assign({}, cw.data.prop || {}, { homeBin: "" });
      await persistPose({}, cw);
      if (cw.data.prop && cw.data.prop.homeBin === "") {
        delete cw.data.prop.homeBin;
      }
      cw.data.homeBin = null;
    }
    for (const tid of targets) {
      const dw = boardWinById(tid);
      if (dw && isDeckBin(dw)) refreshDeckList(dw);
    }
    toast(
      "unfiled · " +
        (cw.kind === "leaf" ? "paper" : "card") +
        " · " +
        (memberId || "")
    );
  }

  async function unfileCard(cw) {
    return unfileMember(cw);
  }

  /** Put away · return checked-out card/leaf to home envelope (keep home scar). */
  async function putAwayMember(cw) {
    if (!cw || (cw.kind !== "card" && cw.kind !== "leaf")) return false;
    const home = cardHomeBin(cw);
    if (!home) {
      toast("no home envelope · drop on an envelope to file");
      return false;
    }
    const dw = boardWinById(home);
    if (!dw || !isDeckBin(dw)) {
      toast("home envelope not on desk · " + home);
      return false;
    }
    const ok = await placeLeafInBoard(cw, dw, null, null);
    if (ok) {
      toast(
        "put away · " +
          (cw.kind === "leaf" ? "paper" : "card") +
          " · " +
          (dw.data.title || home)
      );
      paintLeafFiling(cw);
    }
    return !!ok;
  }

  async function putAwayCard(cw) {
    return putAwayMember(cw);
  }

  /**
   * Close envelope · put every checked-out child back inside, then fold list.
   * Fold without put-away was thrash when leaves were added — law is: close refiles.
   */
  async function closeDeck(bw) {
    if (!bw || !isDeckBin(bw)) return;
    const did = String(bw.data.id || bw.data.uid);
    const homeMembers = cardsWithHome(did);
    // repair: still in chips list but missing home scar
    for (const cid of bw.data.chips || []) {
      const cw = wins.get(String(cid));
      if (
        cw &&
        (cw.kind === "card" || cw.kind === "leaf") &&
        !cardHomeBin(cw)
      ) {
        cw.data.homeBin = did;
        cw.data.prop = Object.assign({}, cw.data.prop || {}, {
          homeBin: did,
        });
        homeMembers.push(cw);
      }
    }
    // also any open win that still lists this env as home (out of chips if thrash)
    wins.forEach((w) => {
      if (
        (w.kind === "card" || w.kind === "leaf") &&
        String(cardHomeBin(w) || "") === did
      ) {
        homeMembers.push(w);
      }
    });
    const seen = new Set();
    let nIn = 0;
    for (const cw of homeMembers) {
      const id = String(cw.data.id || cw.data.uid);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const nested = !!(cw.data.bin || cw._inBin);
      if (!nested) {
        // re-file membership + hide
        const j = await api("/api/bin/member", {
          method: "POST",
          body: JSON.stringify({
            bin_id: did,
            leaf_id: id,
            action: "add",
          }),
        });
        if (j.ok && j.bin) bw.data.chips = j.bin.chips || [];
        nIn++;
      }
      cw.data.homeBin = did;
      cw.data.prop = Object.assign({}, cw.data.prop || {}, { homeBin: did });
      cw.data.bin = did;
      cw._inBin = did;
      hideCardInDeck(cw);
      if (cw.kind === "card") {
        await persistCardHome(cw);
        paintCardFace(cw);
      } else {
        await persistPose({}, cw);
        paintLeafFiling(cw);
      }
    }
    await renderDeckClosed(bw);
    toast(
      "closed · " +
        (bw.data.title || did) +
        (nIn ? " · " + nIn + " put away" : "")
    );
  }

  async function openDeck(bw) {
    if (!bw || !isDeckBin(bw)) return;
    await renderDeckOpen(bw);
  }

  async function renderDeckClosed(bw) {
    if (!bw || !isDeckBin(bw)) return;
    bw.open = false;
    bw.el.classList.add("is-closed");
    bw.el.classList.remove("is-open", "is-envelope-open");
    // envelope face stays manila-size · list is a separate pop
    removeDeckPop(bw);
    const sz = envelopeFaceSize(bw);
    bw.el.style.width = sz.w + "px";
    bw.el.style.height = sz.h + "px";
    const closed = bw.el.querySelector("[data-deck-closed]");
    const openEl = bw.el.querySelector("[data-deck-open]");
    if (closed) closed.hidden = false;
    if (openEl) openEl.hidden = true;
    // hide nested members (still filed in envelope)
    (bw.data.chips || []).forEach((cid) => {
      const cw = wins.get(String(cid));
      if (cw && cw.kind === "card") hideCardInDeck(cw);
    });
    const dimpl = window.PocketTools && (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
    if (!isTrashBin(bw) && dimpl && dimpl.paint) dimpl.paint(bw);
    if (!isTrashBin(bw)) paintEnvStation(bw);
    refreshBoardMeta(bw);
    restoreOfficeFloorPresentation(bw);
    await persistPose({}, bw);
  }

  async function renderDeckOpen(bw) {
    if (!bw || !isDeckBin(bw)) return;
    bw.open = true;
    // envelope STAYS put · same size · pop-out list only (no in-face list)
    if (!Array.isArray(bw.data.chips)) bw.data.chips = bw.data.chips || [];
    bw.el.classList.add("is-closed", "is-envelope-open");
    bw.el.classList.remove("is-open"); // avoid old "open box" css size
    const szOpen = envelopeFaceSize(bw);
    bw.el.style.width = szOpen.w + "px";
    bw.el.style.height = szOpen.h + "px";
    const closed = bw.el.querySelector("[data-deck-closed]");
    const openEl = bw.el.querySelector("[data-deck-open]");
    if (closed) closed.hidden = false;
    if (openEl) openEl.hidden = true;
    (bw.data.chips || []).forEach((cid) => {
      const cw = wins.get(String(cid));
      if (cw && cw.kind === "card") hideCardInDeck(cw);
    });
    // paint first so kit cannot flip face after we open the pop
    const dimpl = window.PocketTools && (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
    if (!isTrashBin(bw) && dimpl && dimpl.paint) dimpl.paint(bw);
    ensureDeckPop(bw);
    refreshDeckList(bw);
    // paint again for counts after list meta
    if (!isTrashBin(bw) && dimpl && dimpl.paint) dimpl.paint(bw);
    if (!isTrashBin(bw)) paintEnvStation(bw);
    restoreOfficeFloorPresentation(bw);
    await persistPose({}, bw);
    toast(
      isTrashBin(bw)
        ? "contents · trash · empty to bury in ~trash"
        : "contents · " + (bw.data.title || "envelope") + " · cards stay put"
    );
  }

  /** config paper id · bin-envelope[1].cfg lives under surfaces/…/configs/ */
  function boardConfigKey(w) {
    if (!w || !w.data) return "";
    const explicit =
      w.data.config_id ||
      (w.data.config && w.data.config.id) ||
      "";
    if (explicit) return String(explicit);
    const living = String(w.data.uid || w.data.id || "").trim();
    if (/^bin-(board|book|shelf|deck|envelope)\[\d+\]$/i.test(living)) {
      return living;
    }
    const m = living.match(/^(board|book|shelf|deck|envelope)\[(\d+)\]$/i);
    if (m) return "bin-" + m[1].toLowerCase() + "[" + m[2] + "]";
    // last resort · subtype + index from face
    const st = String(
      w.data.bin_type || w.data.subtype || w.data.class || "board"
    ).toLowerCase();
    const stNorm =
      st === "envelope" || st === "deck" || st === "book" || st === "shelf"
        ? st
        : "board";
    const n = living.match(/\[(\d+)\]/);
    if (n) return "bin-" + stNorm + "[" + n[1] + "]";
    return living;
  }

  /** terminal station desk on envelope · thin stripe; set via MIRA dress up */
  function envStationOf(bw) {
    if (!bw || !bw.data) return "";
    const dimpl = window.PocketTools && (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
    if (dimpl && typeof dimpl.stationOf === "function") {
      return dimpl.stationOf(bw.data) || "";
    }
    const p = bw.data.prop || {};
    let raw = String(
      p["Station.desk"] || p.station || p.Station || bw.data.station || ""
    )
      .trim()
      .toLowerCase();
    if (raw === "iox") raw = "io";
    if (raw === "abx") raw = "ab";
    if (raw === "drx") raw = "dr";
    if (raw === "dco") raw = "dc";
    if (raw === "none" || raw === "off" || raw === "clear" || raw === "-")
      return "";
    return raw;
  }

  function paintEnvStation(bw) {
    if (!bw || !bw.el || !isDeckBin(bw) || isTrashBin(bw)) return;
    // always stamp data-station on the face (kit may be late / missing)
    const st = envStationOf(bw);
    if (st) bw.el.setAttribute("data-station", st);
    else bw.el.removeAttribute("data-station");
    const dimpl = window.PocketTools && (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
    if (dimpl && dimpl.paint) dimpl.paint(bw);
    const pad = document.getElementById(deckPopDomId(bw));
    if (!pad) return;
    let chip = pad.querySelector("[data-env-station-chip]");
    if (!chip) {
      const bar = pad.querySelector(".deck-pop-bar");
      if (bar) {
        chip = document.createElement("span");
        chip.className = "deck-pop-station";
        chip.setAttribute("data-env-station-chip", "1");
        bar.insertBefore(chip, bar.querySelector(".deck-pop-fold"));
      }
    }
    if (chip) {
      const labels = (dimpl && dimpl.STATION_LABELS) || {};
      chip.textContent = st
        ? String(labels[st] || st)
            .split("·")[0]
            .trim()
            .toUpperCase()
        : "";
      chip.style.display = st ? "" : "none";
      if (st) chip.setAttribute("data-station", st);
      else chip.removeAttribute("data-station");
      chip.title = st
        ? "station " + (labels[st] || st) + " · MIRA: dress up …"
        : "MIRA: dress up io|ab|cu|dr|osx|dc";
    }
  }

  async function setEnvStation(bw, code) {
    if (!bw || !isDeckBin(bw)) return false;
    let next = String(code || "")
      .trim()
      .toLowerCase();
    if (next === "iox") next = "io";
    if (next === "abx") next = "ab";
    if (next === "drx") next = "dr";
    if (next === "dco") next = "dc";
    if (
      next === "none" ||
      next === "off" ||
      next === "clear" ||
      next === "-" ||
      next === "unset"
    )
      next = "";
    const allowed = ["", "io", "ab", "cu", "dr", "osx", "dc", "icu"];
    if (allowed.indexOf(next) < 0) return false;
    bw.data.prop = Object.assign({}, bw.data.prop || {}, {
      "Station.desk": next,
    });
    paintEnvStation(bw);
    try {
      await persistPose({}, bw);
    } catch (_) {}
    return true;
  }

  function wireDeckChrome(bw) {
    if (!bw || !bw.el || !isDeckBin(bw)) return;
    const closed = bw.el.querySelector("[data-deck-closed]");
    if (closed && !closed._deckWired) {
      closed._deckWired = true;
      closed.addEventListener("dblclick", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (bw._onShelf || (bw.data && bw.data.shelf)) {
          toast("drag off the shelf to open");
          return;
        }
        // toggle · open list or close (close puts everything away)
        if (bw.open === true) closeDeck(bw).catch(() => {});
        else openDeck(bw).catch(() => {});
      });
      closed.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        // threshold: click toggles list, drag moves envelope
        startDrag(bw, ev, null, { requireThreshold: true });
      });
    }
    const closeBtn = bw.el.querySelector("[data-deck-close]");
    if (closeBtn && !closeBtn._deckWired) {
      closeBtn._deckWired = true;
      closeBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      closeBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await closeDeck(bw);
      });
    }
    const openHead = bw.el.querySelector(".deck-open-head");
    if (openHead && !openHead._deckWired) {
      openHead._deckWired = true;
      openHead.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest("button")) return;
        if (isEditableFaceTarget(ev.target)) return;
        startDrag(bw, ev);
      });
    }
    const pocket = bw.el.querySelector("[data-board-pocket]");
    if (pocket && !pocket._deckWired) {
      pocket._deckWired = true;
      // pocket is drop well only — no board-style leaf grab
    }
    const rz = bw.el.querySelector("[data-resize]");
    if (rz && !rz._deckWired) {
      rz._deckWired = true;
      rz.addEventListener("pointerdown", (ev) => {
        if (bw.open === false) return;
        startResize(bw, ev);
      });
    }
  }

  function repaintDeckMemberCards(bw) {
    if (!bw || !isDeckBin(bw)) return;
    refreshDeckList(bw);
    cardsWithHome(bw.data.id).forEach((cw) => paintCardFace(cw));
    (bw.data.chips || []).forEach((cid) => {
      const cw = wins.get(String(cid));
      if (cw && cw.kind === "card") paintCardFace(cw);
    });
  }

  async function placeLeafInBoard(lw, bw, clientX, clientY) {
    // leaves → board/book; cards → deck (file/refile) or board (pin, not filed)
    if (
      !lw ||
      !bw ||
      (lw.kind !== "leaf" && lw.kind !== "card" && lw.kind !== "key") ||
      bw.kind !== "board"
    )
      return false;
    if (isBookBin(bw) && (lw.kind === "card" || lw.kind === "key")) {
      toast(
        lw.kind === "key"
          ? "keys go on a board · not book pages"
          : "cards go in an envelope · not book pages"
      );
      return false;
    }
    if (isDeckBin(bw) && lw.kind === "key") {
      toast("keys pin on a board · not envelope");
      return false;
    }
    if (isDeckBin(bw) && lw.kind !== "card" && lw.kind !== "leaf") {
      toast("envelope holds cards or papers");
      return false;
    }
    if (isShelfBin(bw)) {
      return false;
    }

    // —— envelope: file card OR paper (works closed or open) ——
    if (isDeckBin(bw) && (lw.kind === "card" || lw.kind === "leaf")) {
      const j = await api("/api/bin/member", {
        method: "POST",
        body: JSON.stringify({
          bin_id: bw.data.id,
          leaf_id: lw.data.id || lw.data.uid,
          action: "add",
        }),
      });
      if (!j.ok) {
        toast(j.error || "envelope full or join failed");
        return false;
      }
      bw.data.chips = (j.bin && j.bin.chips) || bw.data.chips || [];
      if (j.config && j.config.prop) bw.data.prop = j.config.prop;
      const did = String(bw.data.id || bw.data.uid);
      lw.data.homeBin = did;
      lw.data.prop = Object.assign({}, lw.data.prop || {}, { homeBin: did });
      lw.data.bin = did;
      lw._inBin = did;
      hideCardInDeck(lw); // hide member on desk (card or leaf)
      if (lw.kind === "card") {
        await persistCardHome(lw);
        paintCardFace(lw);
      } else {
        await persistPose({}, lw);
      }
      refreshDeckList(bw);
      toast("in envelope · " + (bw.data.title || did));
      return true;
    }

    // books use data-bin-drop (cloth well); boards use data-board-pocket
    const pocket =
      bw.el.querySelector("[data-board-pocket]") ||
      bw.el.querySelector("[data-bin-drop]") ||
      (isBookBin(bw) ? bw.el : null);
    if (!pocket) return false;
    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: bw.data.id,
        leaf_id: lw.data.id,
        action: "add",
      }),
    });
    if (!j.ok) {
      toast(j.error || "bin full or join failed");
      return false;
    }
    lw.data.bin = bw.data.id;
    bw.data.chips = (j.bin && j.bin.chips) || bw.data.chips || [];
    if (j.config && j.config.prop) bw.data.prop = j.config.prop;
    // Remember WHERE on the card the hand is (not forced center — that felt like a drunk grid)
    const pre = lw.el.getBoundingClientRect();
    const dropX = clientX != null ? clientX : pre.left + pre.width / 2;
    const dropY = clientY != null ? clientY : pre.top + pre.height / 2;
    const fracX =
      pre.width > 1 ? (dropX - pre.left) / pre.width : 0.5;
    const fracY =
      pre.height > 1 ? (dropY - pre.top) / pre.height : 0.5;

    lw._inBin = bw.data.id;
    lw.data.bin = bw.data.id;
    if (isBookBin(bw)) {
      // book membership: leaf stays a desk citizen in chips[]; not shown as pocket card
      if (lw.el.parentElement) lw.el.parentElement.removeChild(lw.el);
      lw.el.style.display = "none";
      felt.appendChild(lw.el);
      setLeafInBoardScale(lw, false);
      if (lw.open) {
        lw.open = false;
      }
      refreshBoardMeta(bw);
      const chipsNow = bw.data.chips || [];
      const ni = chipsNow.indexOf(lw.data.id);
      bw.pageIdx = ni >= 0 ? ni : Math.max(0, chipsNow.length - 1);
      if (bw.open !== false) {
        await renderBookOpen(bw);
      } else {
        await renderBookClosed(bw);
      }
      await persistPose({}, lw);
      toast("in book · " + (bw.data.title || bw.data.id));
      return true;
    }
    // cork board pin — cards here are NOT filed (no home)
    if (lw.kind === "card") {
      // pin on board does not set home; temporary pin only
    }
    pocket.appendChild(lw.el);
    lw.el.style.display = "";
    setLeafInBoardScale(lw, true);
    lw.el.style.left = "0px";
    lw.el.style.top = "0px";
    void lw.el.offsetWidth;
    const pr = pocket.getBoundingClientRect();
    const lr = lw.el.getBoundingClientRect();
    const vw = lr.width || 200;
    const vh = lr.height || 160;
    let nx = dropX - pr.left - fracX * vw;
    let ny = dropY - pr.top - fracY * vh;
    const maxX = Math.max(4, pr.width - vw - 4);
    const maxY = Math.max(4, pr.height - vh - 4);
    nx = Math.max(4, Math.min(nx, maxX));
    ny = Math.max(4, Math.min(ny, maxY));
    lw.el.style.left = nx + "px";
    lw.el.style.top = ny + "px";
    lw._lastOpenW = lw._lastOpenW || 360;
    lw._lastOpenH = lw._lastOpenH || 460;
    refreshBoardMeta(bw);
    await persistPose({}, lw);
    if (lw.kind === "card") paintCardFace(lw);
    if (lw.kind === "key") paintKeyFace(lw);
    toast("in board · " + (bw.data.title || bw.data.id));
    return true;
  }

  async function placeLeafOnFelt(lw, clientX, clientY) {
    // leaves + cards. Card leaving a deck = checkout (keep home), not unfile.
    if (!lw || (lw.kind !== "leaf" && lw.kind !== "card" && lw.kind !== "key"))
      return;
    const bid = lw.data.bin || lw._inBin;
    const wasDeck =
      lw.kind === "card" &&
      bid &&
      boardWinById(bid) &&
      isDeckBin(boardWinById(bid));
    if (lw.kind === "card" && (wasDeck || cardHomeBin(lw))) {
      // checkout: remove membership, keep home
      const home = cardHomeBin(lw) || bid;
      if (bid) {
        const j = await api("/api/bin/member", {
          method: "POST",
          body: JSON.stringify({
            bin_id: bid,
            leaf_id: lw.data.id,
            action: "remove",
          }),
        });
        if (j.ok && j.bin) {
          const dw = boardWinById(bid);
          if (dw) {
            dw.data.chips = j.bin.chips || [];
            if (isDeckBin(dw)) refreshDeckList(dw);
            else refreshBoardMeta(dw);
          }
        }
      }
      if (home) {
        lw.data.homeBin = home;
        lw.data.prop = Object.assign({}, lw.data.prop || {}, {
          homeBin: home,
        });
      }
      lw.data.bin = null;
      lw._inBin = null;
      setLeafInBoardScale(lw, false);
      showCardOnFelt(lw, clientX, clientY, boardWinById(home));
      await persistCardHome(lw);
      paintCardFace(lw);
      const dw = home && boardWinById(home);
      if (dw) refreshDeckList(dw);
      return;
    }
    if (bid) {
      const j = await api("/api/bin/member", {
        method: "POST",
        body: JSON.stringify({
          bin_id: bid,
          leaf_id: lw.data.id,
          action: "remove",
        }),
      });
      if (j.ok && j.bin) {
        const bw = boardWinById(bid);
        if (bw) {
          bw.data.chips = j.bin.chips || [];
          refreshBoardMeta(bw);
        }
      }
    }
    lw.data.bin = null;
    lw._inBin = null;
    setLeafInBoardScale(lw, false);
    if (lw.kind === "card") paintCardFace(lw);
    if (lw.kind === "key") paintKeyFace(lw);
    const fr = felt.getBoundingClientRect();
    const lr = lw.el.getBoundingClientRect();
    const ox = clientX != null ? clientX - lr.left : 20;
    const oy = clientY != null ? clientY - lr.top : 20;
    let nx = (clientX != null ? clientX : lr.left) - fr.left - (clientX != null ? ox : 0);
    let ny = (clientY != null ? clientY : lr.top) - fr.top - (clientY != null ? oy : 0);
    if (clientX == null) {
      const absL = lr.left - fr.left;
      const absT = lr.top - fr.top;
      nx = absL;
      ny = absT;
    }
    nx = Math.max(0, Math.min(nx, fr.width - 40));
    ny = Math.max(0, Math.min(ny, fr.height - 40));
    felt.appendChild(lw.el);
    lw.el.style.display = "";
    lw.el.style.left = nx + "px";
    lw.el.style.top = ny + "px";
    lw.el.classList.remove("is-in-board");
    bringFront(lw.el);
    await persistPose({}, lw);
  }

  function isOfficePlaced(win) {
    if (!win || !win.data) return false;
    if (win._officePlace) return true;
    const p = win.data.prop || {};
    return p.place === "office" || p.place === "room";
  }

  function roomFloorEl() {
    return $("roomFloor") || roomEl;
  }

  /**
   * Open/close rewrites className/innerHTML and used to strip is-office-floor.
   * Floor layer is pointer-events:none except .is-office-floor children —
   * without this, open books become unclickable/unmovable ghosts.
   */
  function restoreOfficeFloorPresentation(win) {
    if (!win || !win.el || !isOfficePlaced(win)) return;
    if (placeMode !== "room") return;
    const el = win.el;
    const floor = roomFloorEl();
    if (!floor) return;
    const sc =
      win._officeScale ||
      (win.data.prop && Number(win.data.prop.officeScale)) ||
      0.42;
    win._officeScale = sc;
    win._officePlace = true;
    el.classList.add("is-office-floor");
    if (el.parentElement !== floor) floor.appendChild(el);
    el.style.display = "";
    el.style.position = "absolute";
    el.style.transformOrigin = "0 0";
    el.style.transform = "scale(" + sc + ")";
    if (win.data.prop) {
      if (win.data.prop.roomX != null) {
        el.style.left = Number(win.data.prop.roomX) + "px";
      }
      if (win.data.prop.roomY != null) {
        el.style.top = Number(win.data.prop.roomY) + "px";
      }
    }
    if (!el.style.zIndex || Number(el.style.zIndex) < 20) {
      el.style.zIndex = "20";
    }
  }

  function pointInClientRect(x, y, r) {
    return (
      r &&
      x >= r.left &&
      x <= r.right &&
      y >= r.top &&
      y <= r.bottom
    );
  }

  function deskHotClientRect() {
    if (!roomEl) return null;
    const hot = roomEl.querySelector(".rx-hot-desk");
    return hot ? hot.getBoundingClientRect() : null;
  }

  /** Put-back only on intentional desk portal — not the whole floating carpet. */
  function deskPutBackClientRect() {
    if (!roomEl) return null;
    const open = roomEl.querySelector(".rx-hot-open");
    if (open) return open.getBoundingClientRect();
    const slot = roomEl.querySelector(".rx-desk-preview-slot");
    if (slot) return slot.getBoundingClientRect();
    return null;
  }

  /** Drag root + scale for current place (pocket desk / office floor / full desk). */
  function getDragContext(win) {
    if (placeMode === "room" && isOfficePlaced(win)) {
      // scale is on the element itself (origin 0,0) · left/top move 1:1 with the mouse
      // (do NOT use officeScale here or the grab runs away)
      return {
        root: roomFloorEl() || roomEl,
        scale: 1,
        kind: "office",
        visualScale:
          win._officeScale ||
          (win.data.prop && Number(win.data.prop.officeScale)) ||
          0.42,
      };
    }
    if (placeMode === "room" && felt && felt.classList.contains("is-desk-preview")) {
      return {
        root: felt,
        scale: getDeskPreviewScale(),
        kind: "pocket",
      };
    }
    return { root: felt, scale: 1, kind: "desk" };
  }

  async function persistOfficeFlags(win) {
    if (!win || !win.data) return;
    win.data.prop = Object.assign({}, win.data.prop || {});
    if (isOfficePlaced(win)) {
      win.data.prop.place = "office";
      win.data.prop.roomX = parseFloat(win.el.style.left) || 0;
      win.data.prop.roomY = parseFloat(win.el.style.top) || 0;
    } else {
      delete win.data.prop.place;
      delete win.data.prop.roomX;
      delete win.data.prop.roomY;
    }
    await persistPose({}, win);
  }

  /**
   * Office floor scale: grow when leaving the pocket (not Alice-wrong tinier).
   * Pocket is heavily minified; floor should read clearly larger than tabletop.
   */
  function officeFloorScaleFromPocket() {
    const p = getDeskPreviewScale();
    // ~2.6× the pocket visual, clamped to a readable room size
    let s = (p > 0 && p < 1 ? p : 0.2) * 2.65;
    s = Math.min(0.58, Math.max(0.36, s));
    return s;
  }

  /**
   * Closed books/decks keep face size · never apply openW/openH from
   * clearBoardLeafVisual (that was the "gigantic rectangle" book bug).
   */
  function restoreClosedVolumeFaceSize(win) {
    if (!win || !win.el) return;
    const el = win.el;
    if (isBookBin(win) && win.open === false) {
      el.style.width = "120px";
      el.style.height = "162px";
      el.classList.add("is-closed");
      return;
    }
    if (isDeckBin(win) && win.open === false) {
      el.style.width = "168px";
      el.style.height = "104px";
      el.classList.add("is-closed");
      return;
    }
    if (isShelfBin(win) && win.open === false) {
      // closed shelf uses its own closed size from last render
      return;
    }
  }

  /** Pull out of desk pocket → office floor (desk-as-bin). */
  function pullOutToOfficeFloor(win, clientX, clientY) {
    if (!win || !win.el || !roomEl) return;
    const el = win.el;
    const r = el.getBoundingClientRect(); // visual size while still in pocket
    const floor = roomFloorEl();
    const rr = roomEl.getBoundingClientRect();
    // grow relative to pocket · capture visual before reparent
    const officeScale = officeFloorScaleFromPocket();
    const visW = r.width;
    const visH = r.height;
    win._officePlace = true;
    win._officeScale = officeScale;
    win.data = win.data || {};
    win.data.prop = Object.assign({}, win.data.prop || {}, {
      place: "office",
      officeScale: officeScale,
    });
    // only leaves/cards use board-pocket scale · books must NOT get openW stamped
    if (win.kind === "leaf" || win.kind === "card") {
      try {
        setLeafInBoardScale(win, false);
      } catch (_) {}
    }
    el.classList.remove("is-in-board", "is-peek");
    el.classList.add("is-office-floor");
    el.style.marginRight = "";
    el.style.marginBottom = "";
    restoreClosedVolumeFaceSize(win);
    el.style.transformOrigin = "0 0";
    el.style.transform = "scale(" + officeScale + ")";
    // place so the grown object stays near the pull point (center under hand)
    // use CURRENT face size (closed book 120×162), not last open size
    const natW = parseFloat(el.style.width) || visW / (getDeskPreviewScale() || 0.2);
    const natH = parseFloat(el.style.height) || visH / (getDeskPreviewScale() || 0.2);
    let nx;
    let ny;
    if (clientX != null && clientY != null) {
      nx = clientX - rr.left - (natW * officeScale) / 2;
      ny = clientY - rr.top - (natH * officeScale) / 2;
    } else {
      nx = r.left - rr.left;
      ny = r.top - rr.top;
    }
    nx = Math.max(4, Math.min(nx, rr.width - 64));
    ny = Math.max(4, Math.min(ny, rr.height - 64));
    floor.appendChild(el);
    el.style.position = "absolute";
    el.style.left = nx + "px";
    el.style.top = ny + "px";
    el.style.display = "";
    el.style.zIndex = "20";
    win.data.prop.roomX = nx;
    win.data.prop.roomY = ny;
    toast("out of pocket · grew on the floor");
  }

  /** Put back into desk pocket from office floor. */
  function putBackInDeskPocket(win, clientX, clientY) {
    if (!win || !win.el || !felt) return;
    const el = win.el;
    win._officePlace = false;
    win._officeScale = null;
    if (win.data && win.data.prop) {
      delete win.data.prop.place;
      delete win.data.prop.roomX;
      delete win.data.prop.roomY;
      delete win.data.prop.officeScale;
    }
    el.classList.remove("is-office-floor");
    el.style.transform = "";
    el.style.transformOrigin = "";
    restoreClosedVolumeFaceSize(win);
    const pScale = getDeskPreviewScale();
    const inv = pScale > 0 ? 1 / pScale : 1;
    felt.appendChild(el);
    const fr = felt.getBoundingClientRect();
    let nx;
    let ny;
    if (clientX != null && clientY != null) {
      nx = (clientX - fr.left) * inv - 30;
      ny = (clientY - fr.top) * inv - 20;
    } else {
      nx = 24;
      ny = 24;
    }
    const logicW = parseFloat(felt.style.width) || 720;
    const logicH = parseFloat(felt.style.height) || 420;
    nx = Math.max(0, Math.min(nx, logicW - 40));
    ny = Math.max(0, Math.min(ny, logicH - 40));
    el.style.left = nx + "px";
    el.style.top = ny + "px";
    el.style.zIndex = "";
    toast("back in pocket · desk");
  }

  function showOfficeFloorItems(show) {
    wins.forEach((win) => {
      if (!isOfficePlaced(win) || !win.el) return;
      if (show) {
        win.el.style.display = "";
        if (roomEl && win.el.parentElement !== roomFloorEl()) {
          const floor = roomFloorEl();
          const nx = (win.data.prop && win.data.prop.roomX) || 40;
          const ny = (win.data.prop && win.data.prop.roomY) || 40;
          const sc =
            win._officeScale ||
            (win.data.prop && Number(win.data.prop.officeScale)) ||
            0.42;
          win._officeScale = sc;
          win.el.classList.add("is-office-floor");
          restoreClosedVolumeFaceSize(win);
          floor.appendChild(win.el);
          win.el.style.position = "absolute";
          win.el.style.left = nx + "px";
          win.el.style.top = ny + "px";
          win.el.style.transform = "scale(" + sc + ")";
          win.el.style.transformOrigin = "0 0";
          // above floor baseline; bringFront bumps further on grab
          if (!win.el.style.zIndex || Number(win.el.style.zIndex) < 20) {
            win.el.style.zIndex = "20";
          }
        }
      } else {
        win.el.style.display = "none";
      }
    });
  }

  function startDrag(w, ev, onMove, opts) {
    opts = opts || {};
    // closed book / rom cart: wait for drag threshold so click can open
    // (immediate beginDrag + preventDefault was killing open after fold)
    const requireThreshold = !!opts.requireThreshold;
    const el = w.el;
    bringFront(el);
    setFocus(w);
    const wasInBin =
      ((w.kind === "leaf" || w.kind === "card" || w.kind === "key" || w.kind === "tool") &&
        !!(w.data.bin || w._inBin));
    const startedOffice = isOfficePlaced(w) && placeMode === "room";
    const sx = ev.clientX;
    const sy = ev.clientY;
    let moved = false;
    let dragging = false;
    let lastX = ev.clientX;
    let lastY = ev.clientY;
    const DRAG_PX = 5;
    // selection lock only after real drag begins — otherwise body text
    // (and threshold-wait clicks) can never highlight for copy/paste
    let selectLockOn = false;
    function endDeskDragChrome() {
      document.body.classList.remove("is-desk-dragging");
      el.classList.remove("is-dragging");
      if (w.kind === "rom") {
        const fr0 = el.querySelector("iframe");
        if (fr0) fr0.style.pointerEvents = "";
      }
    }
    function onSelectStart(e) {
      e.preventDefault();
    }
    function armSelectLock() {
      if (selectLockOn) return;
      selectLockOn = true;
      document.body.classList.add("is-desk-dragging");
      document.addEventListener("selectstart", onSelectStart, true);
    }

    /**
     * Delta drag only.
     * Dollhouse / office floor: visual scale ≠ style coords — use inv scale.
     */
    function beginDrag(e) {
      if (dragging) return;
      dragging = true;
      try {
        e.preventDefault();
      } catch (_) {}
      // clear any partial highlight so the window doesn't "stick" to selected text
      try {
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      } catch (_) {}
      armSelectLock();
      el.classList.add("is-dragging");
      // ROM iframe steals pointer — mute it while dragging chrome
      if (w.kind === "rom") {
        const fr0 = el.querySelector("iframe");
        if (fr0) fr0.style.pointerEvents = "none";
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      bringFront(el);
      const ctx = getDragContext(w);
      const inv = ctx.scale > 0 ? 1 / ctx.scale : 1;
      const root = ctx.root || felt;
      const fr = root.getBoundingClientRect();
      if (wasInBin && ctx.kind !== "office") {
        // tiny for the whole drag (no peek blow-up)
        setLeafPeek(w, false);
        if (!el.classList.contains("is-in-board")) {
          el.classList.add("is-in-board");
          applyBoardLeafVisual(w);
        }
      }
      const rBefore = el.getBoundingClientRect();
      // reparent into drag root (felt pocket or office floor — not forced felt when office)
      if (ctx.kind === "office") {
        const floor = roomFloorEl();
        if (el.parentElement !== floor) floor.appendChild(el);
      } else if (el.parentElement !== felt) {
        felt.appendChild(el);
      }
      // unscaled root coords from visual offset under CSS scale
      el.style.left = (rBefore.left - fr.left) * inv + "px";
      el.style.top = (rBefore.top - fr.top) * inv + "px";
      void el.offsetWidth;
      const rAfter = el.getBoundingClientRect();
      el.style.left =
        parseFloat(el.style.left || "0") +
        (rBefore.left - rAfter.left) * inv +
        "px";
      el.style.top =
        parseFloat(el.style.top || "0") +
        (rBefore.top - rAfter.top) * inv +
        "px";
      lastX = e.clientX;
      lastY = e.clientY;
      bringFront(el);
    }

    // free leaf / open chrome: start delta drag immediately
    // closed book / cart (requireThreshold) + in-bin leaf: wait for movement
    if (!wasInBin && !requireThreshold) {
      beginDrag(ev);
    }

    function move(e) {
      const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
      if (!moved && dist > DRAG_PX) {
        moved = true;
        if (wasInBin || requireThreshold) beginDrag(e);
        if (onMove) onMove();
      }
      if (!moved) return;
      if (!dragging) beginDrag(e);
      try {
        e.preventDefault();
      } catch (_) {}
      const ctx = getDragContext(w);
      const pScale = ctx.scale > 0 ? ctx.scale : 1;
      const root = ctx.root || felt;
      const fr = root.getBoundingClientRect();
      const logicW =
        ctx.kind === "pocket"
          ? parseFloat(felt.style.width) || fr.width / pScale || 640
          : ctx.kind === "office"
            ? (roomEl && roomEl.clientWidth) || fr.width / pScale || 800
            : fr.width || 640;
      const logicH =
        ctx.kind === "pocket"
          ? parseFloat(felt.style.height) || fr.height / pScale || 400
          : ctx.kind === "office"
            ? (roomEl && roomEl.clientHeight) || fr.height / pScale || 500
            : fr.height || 400;
      const dx = (e.clientX - lastX) / pScale;
      const dy = (e.clientY - lastY) / pScale;
      lastX = e.clientX;
      lastY = e.clientY;
      let nx = (parseFloat(el.style.left) || 0) + dx;
      let ny = (parseFloat(el.style.top) || 0) + dy;
      // pocket drag: allow past edges so you can pull out of the desk-bin
      if (ctx.kind === "pocket") {
        nx = Math.max(-80, Math.min(nx, logicW + 80));
        ny = Math.max(-80, Math.min(ny, logicH + 80));
      } else {
        nx = Math.max(0, Math.min(nx, logicW - 40));
        ny = Math.max(0, Math.min(ny, logicH - 40));
      }
      el.style.left = nx + "px";
      el.style.top = ny + "px";
      if (onMove) onMove();
    }
    async function up(e) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (selectLockOn) {
        document.removeEventListener("selectstart", onSelectStart, true);
      }
      endDeskDragChrome();
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {}

      // room: pull out of desk pocket / put back / move on floor
      if (placeMode === "room" && moved && dragging) {
        const hotR = deskHotClientRect();
        const overDesk = pointInClientRect(e.clientX, e.clientY, hotR);
        if (isOfficePlaced(w) || startedOffice) {
          // 1) re-dock book/deck on a shelf BEFORE desk magnet (early return
          //    used to skip shelf forever — "can't put the book back")
          if (
            w.kind === "board" &&
            (isBookBin(w) || isDeckBin(w))
          ) {
            const shelfHit = hitBoardAtClient(e.clientX, e.clientY, w);
            if (shelfHit && isShelfBin(shelfHit)) {
              if (w.open !== false) {
                try {
                  if (isBookBin(w)) await renderBookClosed(w);
                  else if (isDeckBin(w)) await renderDeckClosed(w);
                } catch (_) {}
              }
              const ok = await placeVolumeOnShelf(w, shelfHit);
              if (ok) {
                if (placeMode === "room") {
                  requestAnimationFrame(function () {
                    layoutDeskPreview();
                  });
                }
                return;
              }
            }
          }
          // 2) back into desk pocket — full desk hotspot (open-label-only
          //    was too tiny; users lost books behind the carpet)
          if (overDesk) {
            putBackInDeskPocket(w, e.clientX, e.clientY);
            await persistOfficeFlags(w);
          } else {
            // stay / move on floor
            w.data.prop = Object.assign({}, w.data.prop || {}, {
              place: "office",
              roomX: parseFloat(el.style.left) || 0,
              roomY: parseFloat(el.style.top) || 0,
            });
            w._officePlace = true;
            restoreOfficeFloorPresentation(w);
            await persistOfficeFlags(w);
          }
          if (placeMode === "room") {
            requestAnimationFrame(function () {
              layoutDeskPreview();
            });
          }
          bringFront(el);
          return;
        }
        // was on desk pocket · dropped outside tabletop → office floor
        if (!overDesk) {
          pullOutToOfficeFloor(w, e.clientX, e.clientY);
          await persistOfficeFlags(w);
          if (placeMode === "room") {
            requestAnimationFrame(function () {
              layoutDeskPreview();
            });
          }
          bringFront(el);
          return;
        }
        // still on desk pocket · normal persist below
      }

      // closed book: click (no drag) opens
      if (
        !moved &&
        requireThreshold &&
        isBookBin(w) &&
        w.open === false
      ) {
        try {
          await renderBookOpen(w);
        } catch (err) {
          toast("book open failed · " + (err && err.message ? err.message : err));
        }
        return;
      }
      // closed shelf: click (no drag) opens catalog
      if (
        !moved &&
        requireThreshold &&
        isShelfBin(w) &&
        w.open === false
      ) {
        try {
          await renderShelfOpen(w);
        } catch (err) {
          toast(
            "shelf open failed · " + (err && err.message ? err.message : err)
          );
        }
        return;
      }
      // envelope: click toggles contents · close puts checked-out children away
      if (
        !moved &&
        requireThreshold &&
        isDeckBin(w) &&
        !(w._onShelf || (w.data && w.data.shelf))
      ) {
        try {
          if (w.open === true) await closeDeck(w);
          else await openDeck(w);
        } catch (err) {
          toast(
            "envelope · " + (err && err.message ? err.message : err)
          );
        }
        return;
      }
      if ((w.kind === "leaf" || w.kind === "card" || w.kind === "key") && wasInBin && !moved) {
        // click without drag: peek full size in the pocket (or un-peek)
        setLeafPeek(w, !el.classList.contains("is-peek"));
        return;
      }
      if (w.kind === "leaf" || w.kind === "card" || w.kind === "key") {
        if (w.kind !== "key") {
          // drop on Chester's fax → copy clean MD to docks (original stays)
          const faxHit = hitFaxAtClient(e.clientX, e.clientY, w);
          if (faxHit) {
            const ok = await faxItemToDestination(w, faxHit);
            if (ok) return;
          }
          // drop leaf/card on HERMES MAIL box → file into that box (desk shipping)
          const inboxHit = hitInboxAtClient(e.clientX, e.clientY, w);
          if (inboxHit) {
            const ok = await fileItemToInbox(w, inboxHit);
            if (ok) return;
          }
        }
        const hit = hitBoardAtClient(e.clientX, e.clientY, w);
        if (hit && !isShelfBin(hit)) {
          await placeLeafInBoard(w, hit, e.clientX, e.clientY);
        } else if (wasInBin || w.data.bin) {
          await placeLeafOnFelt(w, e.clientX, e.clientY);
        } else {
          await persistPose({}, w);
        }
        bringFront(el);
        return;
      }
      // guest tool → board (toolbox thrash · stampers / eraser in a box)
      if (w.kind === "tool" && moved) {
        const hit = hitBoardAtClient(e.clientX, e.clientY, w);
        if (
          hit &&
          !isShelfBin(hit) &&
          !isBookBin(hit) &&
          !isDeckBin(hit)
        ) {
          const ok = await placeToolInBoard(w, hit, e.clientX, e.clientY);
          if (ok) return;
        } else if (wasInBin || w._inBin || (w.data && w.data.bin)) {
          // dragged out of board pocket
          const fromId = w._inBin || (w.data && w.data.bin);
          const from = boardWinById(fromId);
          if (from) {
            await takeToolFromBoard(
              w.data.uid || w.data.id,
              from,
              e.clientX,
              e.clientY
            );
            return;
          }
          setLeafInBoardScale(w, false);
          w._inBin = null;
          if (w.data) w.data.bin = null;
        }
      }
      // envelope → HERMES MAIL box (ship whole deck as one parcel)
      if (w.kind === "board" && moved && isDeckBin(w)) {
        const inboxHit = hitInboxAtClient(e.clientX, e.clientY, w);
        if (inboxHit) {
          const ok = await fileItemToInbox(w, inboxHit);
          if (ok) return;
        }
      }
      // book or closed deck dropped on shelf (legacy rail membership)
      if (
        w.kind === "board" &&
        moved &&
        (isBookBin(w) || isDeckBin(w))
      ) {
        const hit = hitBoardAtClient(e.clientX, e.clientY, w);
        if (hit && isShelfBin(hit)) {
          if (w.open !== false) {
            try {
              if (isBookBin(w)) await renderBookClosed(w);
              else if (isDeckBin(w)) await renderDeckClosed(w);
            } catch (_) {}
          }
          const ok = await placeVolumeOnShelf(w, hit);
          if (ok) return;
        }
      }
      if (dragging) await persistPose({}, w);
      bringFront(el);
      // envelope moved · keep contents list beside it
      if (isDeckBin(w) && w.open) {
        const pop = document.getElementById(deckPopDomId(w));
        if (pop) {
          placeDeckPopNear(w, pop);
          bringFront(pop);
        }
      }
      // dollhouse: refresh mini bounds after a fiddle
      if (placeMode === "room") {
        requestAnimationFrame(function () {
          layoutDeskPreview();
        });
      }
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
  }

  function startResize(w, ev) {
    const el = w.el;
    if (!el) return;
    bringFront(el);
    const sx = ev.clientX;
    const sy = ev.clientY;
    const sw = el.offsetWidth;
    const sh = el.offsetHeight;
    // leaves need room; tools (karaoke) / cards can stay small
    const pkg = resolvePackageId(
      (w.data && (w.data.package_id || w.data.subtype)) || ""
    );
    const isKaraoke = w.kind === "tool" && pkg === "karaoke";
    const isCard = w.kind === "card";
    const isKey = w.kind === "key";
    const isTool = w.kind === "tool";
    const isRom = w.kind === "rom";
    // index card ≈ 5×3 (w/h = 5/3) — stay in that proportion when resizing
    const CARD_ASPECT = 5 / 3;
    const minW = isKey
      ? KEY_MIN
      : isKaraoke
        ? 148
        : isRom
          ? 320
          : isCard
            ? 130
            : isTool
              ? 96
              : 220;
    const minH = isKey
      ? KEY_MIN
      : isKaraoke
        ? 100
        : isRom
          ? 240
          : isCard
            ? 78
            : isTool
              ? 90
              : 180;
    const lockAspect =
      (isKaraoke || isCard || isKey) && sw > 0 && sh > 0;
    const aspect = isCard ? CARD_ASPECT : lockAspect ? sw / sh : 0;
    // iframe eats pointermove/up when the cursor crosses into it — mute for the gesture
    const frames = el.querySelectorAll("iframe");
    frames.forEach((fr) => {
      fr.style.pointerEvents = "none";
    });
    el.classList.add("is-resizing");
    document.body.classList.add("is-desk-resizing");
    try {
      if (ev.currentTarget && ev.currentTarget.setPointerCapture) {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } else if (el.setPointerCapture) {
        el.setPointerCapture(ev.pointerId);
      }
    } catch (_) {}
    let finished = false;
    function move(e) {
      if (finished) return;
      let nw = Math.max(minW, sw + (e.clientX - sx));
      let nh = Math.max(minH, sh + (e.clientY - sy));
      if (lockAspect) {
        // dominant axis from the larger delta
        const dw = Math.abs(e.clientX - sx);
        const dh = Math.abs(e.clientY - sy);
        if (dw >= dh) {
          nh = Math.max(minH, Math.round(nw / aspect));
          nw = Math.max(minW, Math.round(nh * aspect));
        } else {
          nw = Math.max(minW, Math.round(nh * aspect));
          nh = Math.max(minH, Math.round(nw / aspect));
        }
      }
      if (isKey) {
        nw = Math.max(KEY_MIN, Math.min(KEY_MAX, nw));
        nh = nw;
      }
      el.style.width = nw + "px";
      el.style.height = nh + "px";
      w._lastOpenW = nw;
      w._lastOpenH = nh;
      if (isKey) paintKeyFace(w);
    }
    function up() {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      el.classList.remove("is-resizing");
      document.body.classList.remove("is-desk-resizing");
      frames.forEach((fr) => {
        fr.style.pointerEvents = "";
      });
      try {
        if (ev.currentTarget && ev.currentTarget.releasePointerCapture) {
          ev.currentTarget.releasePointerCapture(ev.pointerId);
        }
      } catch (_) {}
      persistPose({}, w);
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // capture phase — still hear release if something else swallows bubble
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    ev.preventDefault();
    ev.stopPropagation();
  }

  /** Save leaf body/meta. Leaves do not fold — always open paper. */
  async function sealLeaf(w) {
    if (!w) return;
    if (w.termEl && w.termDirty) {
      const ta = w.termEl.querySelector(".md-term-ta");
      if (ta) w.data.body = ta.value;
    }
    if (w.el) {
      w._lastOpenW = w.el.offsetWidth;
      w._lastOpenH = w.el.offsetHeight;
    }
    closeMdTerminal(w, { force: true });
    await saveScrap(w, { quiet: false });
    // no renderClosed — leaf stays open
  }

  async function renderOpen(w, layoutSize) {
    closeMdTerminal(w, { force: true });
    w.open = true;
    const el = w.el;
    const leaf = w.data;
    const papers = await loadLeafDressupCatalog();
    const paper = wornSheets(w).slice(-1)[0] || leaf.paper || papers[0] || "lined";
    await ensureDressupCss("_base");
    await ensureDressupCss(paper);
    el.className =
      "nb-win is-open kind-leaf paper-sheet" +
      (w._inBin || (w.data && w.data.bin) ? " is-in-board" : "") +
      (w._peek ? " is-peek" : "");
    el.innerHTML =
      // drag chrome = tape + rail only · body text stays selectable for copy
      '<article class="rx-paper rx-notecard-open" data-paper="' +
      esc(paper) +
      '">' +
      '<span class="rx-paper-tape" data-drag-chrome aria-hidden="true"></span>' +
      '<div class="rx-paper-inner rx-notecard-inner">' +
      '<div class="rx-paper-rail" data-drag-chrome title="drag paper from here">' +
      // face labels only — rename via MIRA: name … · by …
      '<span class="rx-paper-title rx-notecard-title" data-field="title" title="MIRA: edit name …"></span>' +
      '<span class="rx-paper-byline">' +
      '<span class="rx-paper-by">by</span>' +
      '<span class="rx-paper-author" data-field="author" title="MIRA: edit by …"></span>' +
      "</span>" +
      '<span class="rx-paper-kind">leaf</span>' +
      "</div>" +
      '<div class="rx-paper-preview pn-page-body-md" data-paper-preview data-select-text></div>' +
      // quiet status only — full toolbar still commented below (restore if needed)
      '<div class="rx-paper-status" data-paper-status></div>' +
      // bottom foot · same job as card foot (put away / unfile when checked out)
      // hidden when unfiled or still nested — no red "unfiled" on every page
      '<div class="rx-leaf-filing" data-leaf-filing hidden>' +
      '<span class="rx-leaf-filing-label" data-leaf-filing-label></span>' +
      '<button type="button" class="rx-leaf-filing-btn" data-leaf-putaway title="put back in home envelope">put away</button>' +
      '<button type="button" class="rx-leaf-filing-btn" data-leaf-unfile title="unfile · free forever">unfile</button>' +
      "</div>" +
      // TOOLBAR COMMENTED — live in the shell (Ctrl+` / rail shell). Uncomment to restore buttons.
      // '<div class="rx-paper-tools">' +
      // paperSelectHtml(paper, papers) +
      // '<span data-meta class="rx-paper-meta"></span>' +
      // '<button type="button" class="rx-paper-btn" data-act="edit">edit <span class="edit-caret">▌</span></button>' +
      // '<button type="button" class="rx-paper-btn" data-act="check" title="check paper">check</button>' +
      // '<button type="button" class="rx-paper-btn" data-act="checkcfg" title="check config">cfg</button>' +
      // '<button type="button" class="rx-paper-btn" data-act="checksurf" title="check surface">surf</button>' +
      // '<button type="button" class="rx-paper-btn" data-act="red" title="red mark">red</button>' +
      // '<button type="button" class="rx-paper-btn" data-act="stamp" title="stamp">stamp</button>' +
      // '<button type="button" class="rx-paper-btn" data-act="copypath" title="path">path</button>' +
      // '<button type="button" class="rx-paper-btn" data-act="close">fold</button>' +
      // "</div>" +
      "</div>" +
      // paperStampsHtml(leaf.stamps) +
      '<div class="nb-resize" data-resize></div></article>';
    function paintFaceMeta() {
      paintFaceMetaEl(el, w.data.title, w.data.author);
    }
    paintFaceMeta();
    w.paintFaceMeta = paintFaceMeta;
    function formatEdited(ts) {
      return formatLeafWhen(ts) || "—";
    }
    function refreshStatus() {
      const st = el.querySelector("[data-paper-status]");
      if (!st) return;
      st.textContent = leafStatusLine(w.data);
    }
    w.refreshStatus = refreshStatus;
    refreshStatus();
    // paperSel tools — restored with toolbar block above
    paintPaper(el, leaf.body);
    void wearLeafSheets(w, wornSheets(w));
    // stamp scar from cfg prop (surface stamp auto-saved; not title/auth)
    paintLeafStampPrint(w);
    const ow =
      (layoutSize && layoutSize.openW) ||
      w._lastOpenW ||
      poseCache.openW ||
      360;
    const oh =
      (layoutSize && layoutSize.openH) ||
      w._lastOpenH ||
      poseCache.openH ||
      460;
    el.style.width = ow + "px";
    el.style.height = oh + "px";
    w._lastOpenW = ow;
    w._lastOpenH = oh;
    wirePaper(w);
    // envelope filing rail · home / put away / unfile
    w.el._leafFilingWired = false;
    wireLeafFiling(w);
    paintLeafFiling(w);
    // re-assert board tiny/peek after className wipe in renderOpen
    if (w._inBin || (w.data && w.data.bin)) {
      el.classList.add("is-in-board");
      if (w._peek) setLeafPeek(w, true);
      else applyBoardLeafVisual(w);
    }
    // do not persistPose on every paint — drag/resize/save write pos
    if (layoutSize && layoutSize.persistPose) {
      persistPose({}, w);
    }
  }

  function hideStampPicker() {
    const p = document.getElementById("rxStampPicker");
    if (p) p.remove();
  }

  function showStampPicker(w, anchorEl) {
    hideStampPicker();
    const pop = document.createElement("div");
    pop.id = "rxStampPicker";
    pop.className = "rx-stamp-picker";
    pop.innerHTML =
      PAPER_STAMPS.map(
        (s) =>
          '<button type="button" class="rx-stamp-pick" data-stamp="' +
          esc(s.id) +
          '">' +
          esc(s.label) +
          "</button>"
      ).join("") +
      '<button type="button" class="rx-stamp-pick is-clear" data-stamp="__clear__">clear all</button>';
    felt.appendChild(pop);
    const ar = (anchorEl && anchorEl.getBoundingClientRect()) || w.el.getBoundingClientRect();
    const fr = felt.getBoundingClientRect();
    pop.style.left = Math.max(8, ar.left - fr.left) + "px";
    pop.style.top = Math.max(8, ar.bottom - fr.top + 4) + "px";
    bringFront(pop);
    pop.querySelectorAll("[data-stamp]").forEach((btn) => {
      btn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = btn.getAttribute("data-stamp");
        if (id === "__clear__") w.data.stamps = [];
        else {
          const cur = normalizeStamps(w.data.stamps);
          if (cur.indexOf(id) >= 0) w.data.stamps = cur.filter((x) => x !== id);
          else w.data.stamps = cur.concat([id]);
        }
        hideStampPicker();
        await saveScrap(w, { quiet: true });
        renderOpen(w, { openW: w._lastOpenW, openH: w._lastOpenH });
      };
    });
    setTimeout(() => {
      const closer = (ev) => {
        if (pop.contains(ev.target)) return;
        hideStampPicker();
        document.removeEventListener("pointerdown", closer, true);
      };
      document.addEventListener("pointerdown", closer, true);
    }, 0);
  }

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (e) {
        return false;
      }
    }
  }

  function unifiedDiff(name, a, b) {
    const al = String(a).split("\n");
    const bl = String(b).split("\n");
    if (a === b) return "--- " + name + "\n+++ " + name + "\n@@ no changes @@\n";
    let out = "--- " + name + " (disk)\n+++ " + name + " (red)\n";
    const n = Math.max(al.length, bl.length);
    let hunk = [];
    for (let i = 0; i < n; i++) {
      const L = al[i];
      const R = bl[i];
      if (L === R) {
        if (L !== undefined) hunk.push(" " + L);
      } else {
        if (L !== undefined) hunk.push("-" + L);
        if (R !== undefined) hunk.push("+" + R);
      }
    }
    out += "@@\n" + hunk.join("\n") + "\n";
    return out;
  }

  /** Parse surface: id/name/auth from red-edited surface.cfg and save (may rename ~local/user). */
  async function applySurfaceRedEdit(text) {
    const meta = {};
    let section = null;
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "---") continue;
      const sec = line.match(/^([a-zA-Z_][\w]*):\s*$/);
      if (sec) {
        section = sec[1];
        meta[section] = meta[section] || {};
        continue;
      }
      const kv = line.match(/^  ([a-zA-Z_][\w]*)\s*:\s*(.*)$/);
      if (kv && section) {
        meta[section][kv[1]] = kv[2].trim();
      }
    }
    const surf = meta.surface || {};
    if (!surf.auth && !surf.name && !surf.id) {
      toast("no surface: block to apply");
      return null;
    }
    const j = await api("/api/surface/save", {
      method: "POST",
      body: JSON.stringify({
        surface: {
          id: surf.id,
          name: surf.name,
          auth: surf.auth,
        },
      }),
    });
    if (!j.ok) {
      toast(j.error || "surface save failed");
      return null;
    }
    const a = (j.surface && j.surface.surface && j.surface.surface.auth) || surf.auth;
    const rel =
      (j.surface && j.surface.path_display) ||
      "~local/" + a + "/surfaces/…";
    return "surface saved · owner " + a + " · " + rel;
  }

  async function openPaperCheck(w, opts) {
    opts = opts || {};
    const startRed = !!opts.red;
    const wantCfg = !!opts.config;
    const wantSurf = !!opts.surface || (w && w.kind === "surface");
    const wantPkg = !!opts.package; // package paper only when asked
    if (!w) {
      toast("no paper");
      return { ok: false, error: "no paper" };
    }
    if (!wantSurf && !w.data) {
      toast("no paper");
      return { ok: false, error: "no paper" };
    }
    const isBoard = w.kind === "board";
    const isTool = w.kind === "tool";
    const isCard = w.kind === "card";
    const isKey = w.kind === "key";
    if (w.termEl && w.termDirty && !wantSurf && !isBoard && !isTool) {
      const ta = w.termEl.querySelector(".md-term-ta");
      if (ta) w.data.body = ta.value;
      if (w.kind === "leaf") await saveScrap(w, { quiet: true });
    }
    let j;
    if (wantSurf) {
      j = await api("/api/surface/raw");
    } else if (wantPkg && isTool) {
      // package paper lives under editors/<subtype>/ — same uid as tool kind
      const pkgName = resolvePackageId(
        (w.data && w.data.subtype) ||
          (w.data && w.data.package_id) ||
          "stamper"
      );
      const manName = pkgName + ".manifest";
      j = await api(
        "/api/tool/package/" +
          encodeURIComponent(pkgName) +
          "/" +
          encodeURIComponent(manName)
      );
      if (j.ok) {
        j.file = j.file || manName;
        j.path_display = j.path_display || j.path;
      } else {
        j = {
          ok: false,
          error:
            (j && j.error) ||
            "package not found · editors/" + pkgName + "/" + manName,
        };
      }
    } else if (wantCfg || (isTool && !wantPkg)) {
      // instance config paper — leaf/board/tool/card on this surface
      // boards: config file is bin-envelope[n].cfg (not envelope[n] alone)
      let cfgKey;
      if (isTool) {
        const tid = String(w.data.uid || w.data.id || "").replace(/^tool-/, "");
        cfgKey = encodeURIComponent("tool-" + tid);
      } else if (isCard) {
        cfgKey = encodeURIComponent(w.data.uid || w.data.id);
      } else if (isKey) {
        cfgKey = encodeURIComponent(w.data.uid || w.data.id);
      } else if (isBoard) {
        cfgKey = encodeURIComponent(boardConfigKey(w));
      } else {
        cfgKey = encodeURIComponent(w.data.id);
      }
      j = await api("/api/config/" + cfgKey + "/raw");
      if (!j.ok && !isTool) {
        await persistPose({}, w);
        j = await api("/api/config/" + cfgKey + "/raw");
      }
    } else if (isBoard) {
      // bin matter paper (.bin — membership)
      j = await api("/api/bin/" + encodeURIComponent(w.data.id) + "/raw");
    } else if (isCard) {
      j = await api(
        "/api/card/" + encodeURIComponent(w.data.uid || w.data.id) + "/raw"
      );
    } else if (isKey) {
      j = await api(
        "/api/key/" + encodeURIComponent(w.data.uid || w.data.id) + "/raw"
      );
    } else {
      j = await api("/api/leaf/" + encodeURIComponent(w.data.id) + "/raw");
    }
    if (!j.ok) {
      toast(j.error || "could not read file");
      return { ok: false, error: j.error || "could not read file" };
    }
    const cid = (w.data && (w.data.uid || w.data.id)) || "surface";
    // config only when asked, or default tool view is instance cfg
    const isCfg = wantCfg || (isTool && !wantPkg);
    const isSurf = wantSurf;
    const isPkg = wantPkg && isTool;
    const padKey =
      "rxCheck-" +
      (isSurf
        ? "surf"
        : isPkg
          ? "pkg-"
          : isCfg
            ? "cfg-"
            : isBoard
              ? "bin-"
              : "chip-") +
      String(isSurf ? "surface" : cid).replace(/[^\w.-]+/g, "_");
    const existingPad = document.getElementById(padKey);
    if (existingPad) existingPad.remove();

    const baseline = j.text != null ? String(j.text) : "";
    const livingTool =
      isTool && String(cid).replace(/^tool-/, "");
    const pathLabel =
      j.file ||
      (isSurf
        ? "surface.cfg"
        : isPkg
          ? resolvePackageId(
              (w.data && w.data.package_id) || "stamper"
            ) + ".manifest"
          : isCfg && isTool
            ? "tool-" + livingTool + ".cfg"
            : isCfg && isBoard
              ? boardConfigKey(w) + ".cfg"
              : isCfg
                ? "chip-" + cid + ".cfg"
                : isBoard
                  ? cid + ".bin"
                  : isCard
                    ? cid + ".chip"
                    : cid + ".chip");
    // short location for viewing (Hands: hide long install root)
    const displayPath =
      j.path_display || j.path || pathLabel;
    const absPath = j.path_abs || j.path || pathLabel;

    const pad = document.createElement("div");
    pad.className =
      "rx-paper-check" +
      (startRed ? " is-red" : "") +
      (isCfg ? " is-cfg" : "") +
      (isSurf ? " is-surf" : "") +
      (isBoard && !isCfg ? " is-bin" : "") +
      (isTool && isCfg ? " is-tool" : "") +
      (isPkg ? " is-pkg" : "");
    pad.id = padKey;
    const checkLabel = isSurf
      ? "check surface"
      : isPkg
        ? "check package"
        : isCfg
          ? "check config"
          : isBoard
            ? "check bin"
            : "check paper";
    // quiet foot: no id spray — file + chars, short mode line
    const checkHint = isSurf
      ? "read only surface"
      : isPkg
        ? "read only package paper · store definition"
        : isCfg
          ? "read only instance config · this surface"
          : isBoard
            ? "read only bin paper · membership"
            : "read only full chip";
    pad.innerHTML =
      '<div class="rx-paper-check-bar" data-check-drag>' +
      '<span class="rx-paper-check-mark" aria-hidden="true">' +
      (isSurf ? "◉" : isCfg ? "◈" : "▣") +
      "</span>" +
      '<span class="rx-paper-check-title" data-check-title>' +
      checkLabel +
      "</span>" +
      '<button type="button" class="rx-paper-check-btn" data-check-red title="red mark">red</button>' +
      '<button type="button" class="rx-paper-check-btn" data-check-diff title="diff vs disk" hidden>diff</button>' +
      '<button type="button" class="rx-paper-check-btn" data-check-send title="copy diff + redline chip on disk" hidden>send</button>' +
      '<button type="button" class="rx-paper-check-btn" data-check-copy title="copy path">path</button>' +
      '<button type="button" class="rx-paper-check-x" data-check-close>×</button>' +
      "</div>" +
      '<div class="rx-paper-check-path" data-check-path></div>' +
      '<pre class="rx-paper-check-body" data-check-body spellcheck="false"></pre>' +
      '<textarea class="rx-paper-check-edit" data-check-edit spellcheck="false" hidden></textarea>' +
      '<pre class="rx-paper-check-diffview" data-check-diffview hidden></pre>' +
      '<div class="rx-paper-check-foot">' +
      '<span data-check-meta></span>' +
      '<span class="rx-paper-check-hint" data-check-hint>' +
      checkHint +
      "</span></div>" +
      '<div class="rx-paper-check-resize" data-check-resize></div>';
    felt.appendChild(pad);

    const pathEl = pad.querySelector("[data-check-path]");
    const bodyEl = pad.querySelector("[data-check-body]");
    const editEl = pad.querySelector("[data-check-edit]");
    const diffEl = pad.querySelector("[data-check-diffview]");
    const metaEl = pad.querySelector("[data-check-meta]");
    const titleEl = pad.querySelector("[data-check-title]");
    const hintEl = pad.querySelector("[data-check-hint]");
    const btnRed = pad.querySelector("[data-check-red]");
    const btnDiff = pad.querySelector("[data-check-diff]");
    const btnSend = pad.querySelector("[data-check-send]");

    pathEl.textContent = displayPath;
    pathEl.title = absPath; // full path on hover only
    bodyEl.textContent = baseline;
    editEl.value = baseline;
    // file name + char count only (id lives in the paper body / path)
    const nChars = j.chars != null ? j.chars : baseline.length;
    metaEl.textContent = (j.file || pathLabel) + " · " + nChars + "c";

    let mode = "check";
    function setMode(next) {
      mode = next;
      pad.classList.toggle("is-red", mode === "red");
      pad.classList.toggle("is-diff", mode === "diff");
      bodyEl.hidden = mode !== "check";
      editEl.hidden = mode !== "red";
      diffEl.hidden = mode !== "diff";
      btnDiff.hidden = mode === "check";
      btnSend.hidden = mode === "check";
      if (mode === "check") {
        titleEl.textContent = checkLabel;
        hintEl.textContent = checkHint;
        btnRed.textContent = "red";
      } else if (mode === "red") {
        titleEl.textContent = "red mark";
        hintEl.textContent = isSurf
          ? "edit owner · send applies + renames folder"
          : "read only copy";
        btnRed.textContent = "check";
        editEl.focus();
      } else {
        titleEl.textContent = "diff";
        hintEl.textContent = "diff vs disk";
        btnRed.textContent = "red";
      }
    }

    function currentDiff() {
      const marked = mode === "red" || mode === "diff" ? editEl.value : baseline;
      return unifiedDiff(pathLabel, baseline, marked);
    }

    function showDiff() {
      const d = currentDiff();
      diffEl.textContent = d;
      setMode("diff");
    }

    const fr = felt.getBoundingClientRect();
    // stack offset so multiple papers (papers please) show both blue bars
    const stackN =
      typeof opts.stack === "number"
        ? opts.stack
        : felt.querySelectorAll(".rx-paper-check").length;
    const ox = stackN * 28;
    const oy = stackN * 32;
    let x;
    let y;
    if (w && w.el && w.el.getBoundingClientRect) {
      const wr = w.el.getBoundingClientRect();
      x = wr.right - fr.left + 10 + ox;
      y = wr.top - fr.top + oy;
      if (x + 360 > fr.width - 8) x = Math.max(8, wr.left - fr.left - 370 + ox);
    } else {
      // surface / no host window — stack from a calm desk corner
      x = 48 + ox;
      y = 56 + oy;
    }
    if (y + 80 > fr.height - 8) y = Math.max(8, fr.height - 200 - oy);
    pad.style.left = x + "px";
    pad.style.top = y + "px";
    pad.style.width = "360px";
    pad.style.height = "440px";
    bringFront(pad);

    pad.querySelector("[data-check-close]").onclick = (ev) => {
      ev.stopPropagation();
      pad.remove();
    };
    pad.querySelector("[data-check-copy]").onclick = async (ev) => {
      ev.stopPropagation();
      // copy short display path (what you see); full abs stays in title
      toast(
        (await copyTextToClipboard(displayPath))
          ? "path copied · " + displayPath
          : "copy failed"
      );
    };
    btnRed.onclick = (ev) => {
      ev.stopPropagation();
      if (mode === "red") {
        bodyEl.textContent = baseline;
        setMode("check");
      } else {
        if (mode !== "diff") editEl.value = baseline;
        setMode("red");
      }
    };
    btnDiff.onclick = (ev) => {
      ev.stopPropagation();
      showDiff();
    };
    btnSend.onclick = async (ev) => {
      ev.stopPropagation();
      const d = currentDiff();
      if (d.indexOf("no changes") >= 0) {
        toast("no changes");
        return;
      }
      // surface: apply auth/name from red edit by parsing simple surface: block
      if (isSurf && mode === "red") {
        const applied = await applySurfaceRedEdit(editEl.value);
        if (applied) {
          toast(applied);
          pad.remove();
          return;
        }
      }
      const ok = await copyTextToClipboard(d);
      const jr = await api("/api/leaf/redline", {
        method: "POST",
        body: JSON.stringify({
          target_id: isSurf ? "surface" : cid,
          diff: d,
          title: "redline · " + pathLabel,
          author: getLastAuthor() || "red-pen",
        }),
      });
      if (!jr.ok) {
        toast(jr.error || "redline failed");
        return;
      }
      showDiff();
      toast(
        ok
          ? "diff copied · redline chip on disk (not on felt) · " + (jr.path || "")
          : "redline on disk · copy failed"
      );
    };

    const bar = pad.querySelector("[data-check-drag]");
    bar.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      bringFront(pad);
      const r = pad.getBoundingClientRect();
      const fr2 = felt.getBoundingClientRect();
      const ox = ev.clientX - r.left;
      const oy = ev.clientY - r.top;
      function move(e) {
        pad.style.left =
          Math.max(0, Math.min(e.clientX - fr2.left - ox, fr2.width - 80)) + "px";
        pad.style.top =
          Math.max(0, Math.min(e.clientY - fr2.top - oy, fr2.height - 40)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
    });
    pad.querySelector("[data-check-resize]").addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const sx = ev.clientX;
      const sy = ev.clientY;
      const sw = pad.offsetWidth;
      const sh = pad.offsetHeight;
      function move(e) {
        pad.style.width = Math.max(220, sw + (e.clientX - sx)) + "px";
        pad.style.height = Math.max(180, sh + (e.clientY - sy)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
      ev.stopPropagation();
    });

    if (startRed) setMode("red");
    else setMode("check");
    toast(
      startRed
        ? "red mark"
        : isPkg
          ? "check package · " + pathLabel
          : isCfg
            ? "check config · " + pathLabel
            : isSurf
              ? "check surface"
              : "check paper · full chip"
    );
    return {
      ok: true,
      kind: isPkg ? "package" : isCfg ? "config" : isSurf ? "surface" : isBoard ? "bin" : "chip",
      file: pathLabel,
      path_display: displayPath,
    };
  }

  function wirePaper(w) {
    const el = w.el;
    let paperMoved = false;
    el.onmousedown = () => {
      bringFront(el);
      setFocus(w);
    };
    // stamp while stamper is *held* (chasing mouse) — ink under the plate
    el.addEventListener("click", async (ev) => {
      if (paperMoved) return;
      if (!heldToolWin || heldToolWin.kind !== "tool") return;
      if (ev.target.closest("input, textarea, button")) return;
      ev.preventDefault();
      ev.stopPropagation();
      await applyStampToLeaf(heldToolWin, w, ev.clientX, ev.clientY);
      // stay held — stamp more papers
    });
    const face = el.querySelector("[data-drag-face]");
    if (face) {
      let moved = false;
      face.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        moved = false;
        paperMoved = false;
        startDrag(w, ev, () => {
          moved = true;
          paperMoved = true;
        });
      });
      face.addEventListener("click", (ev) => {
        if (moved) return;
        ev.preventDefault();
        renderOpen(w, {
          openW: w._lastOpenW || poseCache.openW,
          openH: w._lastOpenH || poseCache.openH,
        });
      });
    }
    el.querySelectorAll("[data-drag-chrome]").forEach((chrome) => {
      chrome.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        // body text: highlight + copy — drag from rail / tape / margins instead
        if (isSelectableTextTarget(ev.target)) return;
        // readonly face fields are drag handles; only block active edits / buttons
        if (isEditableFaceTarget(ev.target)) return;
        if (ev.target.closest(".nb-resize")) return;
        if (ev.target.closest(".rx-leaf-filing, [data-leaf-filing]")) return;
        paperMoved = false;
        startDrag(w, ev, () => {
          paperMoved = true;
        });
      });
    });
    const rz = el.querySelector("[data-resize]:not([hidden])");
    if (rz) {
      rz.addEventListener("pointerdown", (ev) => startResize(w, ev));
    }
    // TOOLBAR handlers — only if tools are uncommented in renderOpen
    el.querySelectorAll("[data-act]").forEach((btn) => {
      btn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const act = btn.getAttribute("data-act");
        if (act === "edit") openLeafTerminal(w);
        else if (act === "check") openPaperCheck(w);
        else if (act === "checkcfg") openPaperCheck(w, { config: true });
        else if (act === "checksurf") openPaperCheck(w, { surface: true });
        else if (act === "red") openPaperCheck(w, { red: true });
        else if (act === "stamp") showStampPicker(w, btn);
        else if (act === "copypath") {
          let path = w.data._rel || w.data._path || "";
          if (!path && w.data.id) {
            const j = await api("/api/leaf/" + encodeURIComponent(w.data.id));
            if (j.ok && j.leaf) {
              path = j.leaf._rel || j.leaf._path || "";
              if (j.leaf._rel) w.data._rel = j.leaf._rel;
            }
          }
          toast(
            path
              ? (await copyTextToClipboard(path))
                ? "path copied · " + path
                : "copy failed"
              : "no path"
          );
        } else if (act === "close") sealLeaf(w);
      };
    });
  }

  function mountLeaf(leaf, config, opts) {
    opts = opts || {};
    if (opts.clear) {
      // keep shell if open
      const keepShell = shellEl;
      felt.querySelectorAll(".nb-win").forEach((el) => el.remove());
      wins.clear();
      win = null;
      if (keepShell && !keepShell.isConnected) shellEl = null;
    }
    const uid = String(leaf.uid || leaf.id);
    if (wins.has(uid)) {
      const existing = wins.get(uid);
      existing.data = leaf;
      setFocus(existing);
      return existing;
    }
    const w = {
      kind: "leaf",
      data: Object.assign({}, leaf),
      el: document.createElement("div"),
      open: true, // runtime only — never folded; not written to cfg
      termEl: null,
      termDirty: false,
    };
    // instance scar (stamp) lives on config.prop — attach before first paint
    if (config && config.prop) {
      w.data.prop = Object.assign({}, config.prop);
    }
    if (config && config.dressup) {
      w.data.dressup = Object.assign({}, config.dressup);
      if (config.dressup.sheets) w.data.sheets = config.dressup.sheets;
    }
    wins.set(uid, w);
    win = w;
    felt.appendChild(w.el);
    w.el.className = "nb-win kind-leaf";
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;

    const pose = (config && (config.pose || config.pos)) || {};
    w._lastOpenW = pose.openW || 360;
    w._lastOpenH = pose.openH || 460;
    w._termW = pose.termW;
    w._termH = pose.termH;
    // free-felt: clamp onto desk. nested pins get pocket coords after reparent.
    let lx = pose.x != null ? Number(pose.x) : 48;
    let ly = pose.y != null ? Number(pose.y) : 48;
    if (!leaf.bin) {
      const frL = felt.getBoundingClientRect();
      if (frL.width > 0) {
        const lw = w._lastOpenW;
        const lh = w._lastOpenH;
        lx = Math.max(8, Math.min(lx, Math.max(8, frL.width - Math.min(lw, frL.width) - 8)));
        ly = Math.max(8, Math.min(ly, Math.max(8, frL.height - Math.min(lh, frL.height) - 8)));
      }
    }
    w.el.style.left = lx + "px";
    w.el.style.top = ly + "px";

    // leaves do not fold — always open
    renderOpen(w, {
      openW: w._lastOpenW,
      openH: w._lastOpenH,
      persistPose: !!opts.persistPose,
    });
    bringFront(w.el);
    setFocus(w);
    return w;
  }

  function hideCtxMenu() {
    if (ctxMenu) {
      ctxMenu.remove();
      ctxMenu = null;
    }
  }

  function showSpawnMenu(clientX, clientY, feltX, feltY) {
    hideCtxMenu();
    ctxSpawnAt = { x: feltX, y: feltY };
    const menu = document.createElement("div");
    menu.className = "rx-ctx-menu";
    menu.innerHTML =
      '<div class="rx-ctx-item has-sub" data-ctx="spawn">' +
      "<span>Spawn</span><span class=\"rx-ctx-caret\">▸</span>" +
      '<div class="rx-ctx-sub">' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="leaf">leaf</button>' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="card">card</button>' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="key">key</button>' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="board">board</button>' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="deck">envelope</button>' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="book">book</button>' +
      '<button type="button" class="rx-ctx-subitem" data-spawn="shelf">bookshelf</button>' +
      "</div></div>";
    felt.appendChild(menu);
    ctxMenu = menu;
    const fr = felt.getBoundingClientRect();
    let mx = clientX - fr.left;
    let my = clientY - fr.top;
    menu.style.left = Math.max(4, Math.min(mx, fr.width - 140)) + "px";
    menu.style.top = Math.max(4, Math.min(my, fr.height - 100)) + "px";
    bringFront(menu);

    menu.querySelector('[data-spawn="leaf"]').onclick = async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideCtxMenu();
      await spawnLeafAt(ctxSpawnAt.x, ctxSpawnAt.y);
    };
    const cardBtn = menu.querySelector('[data-spawn="card"]');
    if (cardBtn) {
      cardBtn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideCtxMenu();
        await spawnCardAt(ctxSpawnAt.x, ctxSpawnAt.y);
      };
    }
    const keyBtn = menu.querySelector('[data-spawn="key"]');
    if (keyBtn) {
      keyBtn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideCtxMenu();
        await spawnKeyAt(ctxSpawnAt.x, ctxSpawnAt.y);
      };
    }
    menu.querySelector('[data-spawn="board"]').onclick = async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideCtxMenu();
      await spawnBoardAt(ctxSpawnAt.x, ctxSpawnAt.y);
    };
    const deckBtn = menu.querySelector('[data-spawn="deck"]');
    if (deckBtn) {
      deckBtn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideCtxMenu();
        await spawnDeckAt(ctxSpawnAt.x, ctxSpawnAt.y);
      };
    }
    const bookBtn = menu.querySelector('[data-spawn="book"]');
    if (bookBtn) {
      bookBtn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideCtxMenu();
        await spawnBookAt(ctxSpawnAt.x, ctxSpawnAt.y);
      };
    }
    const shelfBtn = menu.querySelector('[data-spawn="shelf"]');
    if (shelfBtn) {
      shelfBtn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideCtxMenu();
        await spawnShelfAt(ctxSpawnAt.x, ctxSpawnAt.y);
      };
    }
  }

  /**
   * ROM cart on the felt — desk citizen. Double-click launches the package.
   * Not the running window; not a console spell.
   */
  async function placeRomCartAt(romId, x, y) {
    const j = await api("/api/rom/place", {
      method: "POST",
      body: JSON.stringify({ id: romId || "kde-001", x: x, y: y }),
    });
    if (!j.ok) {
      toast(j.error || "rom cart place failed");
      return null;
    }
    const w = mountRomCart(j.tool, j.config);
    setFocus(w);
    toast(
      (j.reused ? "cart already here · " : "cart · ") +
        ((j.tool && j.tool.title) || romId)
    );
    return w;
  }

  function mountRomCart(tool, config) {
    const prop =
      (config && config.prop) || (tool && tool.prop) || {};
    const romId = String(prop["Rom.id"] || prop.rom_id || "kde-001");
    const title = String(
      prop["Rom.title"] || (tool && tool.title) || romId
    );
    const sku = String(prop["Rom.sku"] || (tool && tool.sku) || "");
    const uid = String(
      (tool && (tool.uid || tool.id)) ||
        (config && config.uid) ||
        "rom[0]"
    ).replace(/^tool-/, "");
    if (wins.has(uid)) {
      const ex = wins.get(uid);
      ex.data = Object.assign({}, ex.data, tool || {}, {
        prop: prop,
        rom_id: romId,
        title: title,
        sku: sku,
      });
      paintRomCart(ex);
      setFocus(ex);
      return ex;
    }
    const w = {
      kind: "tool",
      subtype: "rom",
      data: {
        id: uid,
        uid: uid,
        title: title,
        package_id: "rom",
        subtype: "rom",
        rom_id: romId,
        sku: sku,
        prop: prop,
      },
      el: document.createElement("div"),
      open: true,
    };
    wins.set(uid, w);
    felt.appendChild(w.el);
    w.el.className = "nb-win is-open kind-tool kind-rom-cart";
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;
    const pose = (config && (config.pose || config.pos)) || {};
    const px = pose.x != null ? pose.x : 180;
    const py = pose.y != null ? pose.y : 160;
    w.el.style.left = px + "px";
    w.el.style.top = py + "px";
    w._lastOpenW = pose.openW || 100;
    w._lastOpenH = pose.openH || 132;
    w.el.style.width = w._lastOpenW + "px";
    w.el.style.height = w._lastOpenH + "px";
    if (config && config.config && config.config.id) {
      w.data.config_id = config.config.id;
    }
    paintRomCart(w);
    setFocus(w);
    bringFront(w.el);
    return w;
  }

  function shortRomPlate(sku, name) {
    const s = String(sku || "").trim();
    if (s) {
      const parts = s.split("-").filter(Boolean);
      if (parts.length >= 2) return parts.slice(-2).join("-").slice(0, 12);
      return s.slice(0, 12);
    }
    return String(name || "ROM")
      .split(/\s+/)
      .slice(0, 2)
      .join(" ")
      .slice(0, 12);
  }

  function paintRomCart(w) {
    if (!w || !w.el) return;
    const prop = (w.data && w.data.prop) || {};
    const title =
      prop["Rom.title"] || (w.data && w.data.title) || "ROM";
    const sku = prop["Rom.sku"] || (w.data && w.data.sku) || "";
    const rid = prop["Rom.id"] || (w.data && w.data.rom_id) || "";
    const shell =
      String(prop["Rom.shell"] || "classicboi").toLowerCase() === "julie"
        ? "julie"
        : "classicboi";
    const tint = String(prop["Rom.tint"] || "").trim();
    const plateCss = String(prop["Rom.plate_css"] || "").trim();
    const hex = /^#?[0-9a-f]{3,8}$/i.test(tint);
    const warm = !!(w.data && w.data.rom_warm);
    const shellCls =
      "rl-case shell-" +
      shell +
      (warm ? " is-warm" : "") +
      (shell === "julie"
        ? hex
          ? " tint-custom"
          : tint
            ? " tint-" + tint.replace(/[^a-z0-9_-]/gi, "")
            : " tint-red"
        : "");
    w.data.title = title;
    w.data.sku = sku;
    w.data.rom_id = rid;
    w.el.className = "nb-win is-open kind-tool kind-rom-cart";
    // ROM Cat cart face (rom-cart-face.css) — not a brown box
    w.el.innerHTML =
      '<button type="button" class="' +
      shellCls +
      '" data-drag-chrome title="double-click to open' +
      (warm ? " · server WARM" : " · server cold") +
      '">' +
      '<span class="rl-case-shell"></span>' +
      '<span class="rl-case-notch" aria-hidden="true"></span>' +
      '<span class="rl-case-badge"></span>' +
      '<span class="rl-case-label"></span>' +
      '<span class="rl-case-sku"></span>' +
      '<span class="rl-case-pins" aria-hidden="true"></span>' +
      '<span class="rl-case-warm"' +
      (warm ? "" : " hidden") +
      ' title="server running">●</span>' +
      "</button>";
    const face = w.el.querySelector("[data-drag-chrome]");
    if (hex && shell === "julie") {
      face.style.setProperty("--julie", tint.charAt(0) === "#" ? tint : "#" + tint);
    }
    face.style.setProperty("--cart-w", "5.8rem");
    face.style.setProperty("--cart-h", "6.6rem");
    w.el.querySelector(".rl-case-badge").textContent = shortRomPlate(sku, title);
    const plate = w.el.querySelector(".rl-case-label");
    plate.textContent = title;
    if (plateCss) {
      plate.setAttribute("style", plateCss);
      plate.classList.add("has-custom-plate");
    }
    w.el.querySelector(".rl-case-sku").textContent = (sku || rid).slice(0, 20);
    // fit window to cart footprint
    w.el.style.width = "6.2rem";
    w.el.style.height = "7rem";
    w._lastOpenW = w.el.offsetWidth || 100;
    w._lastOpenH = w.el.offsetHeight || 112;
    w.el.onmousedown = () => {
      bringFront(w.el);
      setFocus(w);
    };
    face.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      startDrag(w, ev, null, { requireThreshold: true });
    });
    face.addEventListener("dblclick", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const r = w.el.getBoundingClientRect();
      const fr = felt.getBoundingClientRect();
      await openRomWindow(w.data.rom_id || "kde-001", {
        x: r.right - fr.left + 12,
        y: r.top - fr.top,
      });
      pollRomWarmFlags();
    });
    face.addEventListener("click", (ev) => {
      if (ev.detail > 1) return;
      setFocus(w);
    });
  }

  /** Green pin / warm flag — like ROM launcher (server listening). */
  async function pollRomWarmFlags() {
    try {
      const j = await api("/api/rom/list");
      if (!j.ok || !j.roms) return;
      const byId = {};
      (j.roms || []).forEach((r) => {
        if (r && r.id) byId[String(r.id).toLowerCase()] = !!r.up;
      });
      wins.forEach((w) => {
        if (!w || w.kind !== "tool") return;
        const rid = String(
          (w.data && (w.data.rom_id || (w.data.prop && w.data.prop["Rom.id"]))) ||
            ""
        ).toLowerCase();
        if (!rid) return;
        const warm = !!byId[rid];
        if (w.data) w.data.rom_warm = warm;
        const face = w.el && w.el.querySelector(".rl-case");
        const pin = w.el && w.el.querySelector(".rl-case-warm");
        if (face) {
          face.classList.toggle("is-warm", warm);
          face.title =
            (face.getAttribute("title") || "").replace(
              / · server (WARM|cold)/i,
              ""
            ) + (warm ? " · server WARM" : " · server cold");
        }
        if (pin) {
          if (warm) pin.removeAttribute("hidden");
          else pin.setAttribute("hidden", "");
        }
      });
    } catch (_) {
      /* quiet */
    }
  }

  /**
   * ROM on the forever-desk: small window or fill the felt (not a hardcoded citizen).
   * Test ROM: KDE-001 Notes & Chords · CO.KDE-001-INSTR
   */
  async function openRomWindow(romId, opts) {
    opts = opts || {};
    toast("rom · starting…");
    const ens = await api("/api/rom/ensure", {
      method: "POST",
      body: JSON.stringify({ id: romId }),
    });
    if (!ens.ok) {
      toast(ens.error || "rom failed");
      return null;
    }
    const uid = "rom:" + (ens.id || romId);
    if (wins.has(uid)) {
      const existing = wins.get(uid);
      if (existing.el) {
        if (ens.chrome) existing.data.chrome = ens.chrome;
        if (ens.sku) existing.data.sku = ens.sku;
        if (ens.url) existing.data.url = ens.url;
        existing.el.style.display = "";
        bringFront(existing.el);
        setFocus(existing);
        const frame = existing.el.querySelector("iframe");
        if (frame && ens.url) {
          frame.src = ens.url;
          frame.setAttribute("data-rom-url", ens.url);
        }
      }
      toast("rom · " + (ens.title || romId));
      return existing;
    }
    const w = {
      kind: "rom",
      data: {
        id: uid,
        rom_id: ens.id || romId,
        title: ens.title || romId,
        sku: ens.sku || "",
        url: ens.url || "",
        chrome: ens.chrome || null,
      },
      el: document.createElement("div"),
      open: true,
      deskFill: false,
    };
    wins.set(uid, w);
    felt.appendChild(w.el);
    w.el.className = "nb-win is-open kind-rom";
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;
    const x = opts.x != null ? opts.x : 48;
    const y = opts.y != null ? opts.y : 48;
    w.el.style.left = x + "px";
    w.el.style.top = y + "px";
    // default launch size · desk window, not full felt (use fill for that)
    w._lastOpenW = 800;
    w._lastOpenH = 600;
    w.el.style.width = "800px";
    w.el.style.height = "600px";
    paintRomWindow(w);
    setFocus(w);
    bringFront(w.el);
    toast("rom · " + (ens.title || romId) + (ens.started ? " · booted" : " · up"));
    return w;
  }

  function paintRomWindow(w) {
    if (!w || !w.el) return;
    const fill = !!w.deskFill;
    w.el.classList.toggle("is-desk-fill", fill);
    if (fill) {
      w.el.style.left = "0px";
      w.el.style.top = "0px";
      w.el.style.width = "100%";
      w.el.style.height = "100%";
      w.el.style.right = "0";
      w.el.style.bottom = "0";
    } else {
      w.el.style.right = "";
      w.el.style.bottom = "";
      w.el.style.width = (w._lastOpenW || 800) + "px";
      w.el.style.height = (w._lastOpenH || 600) + "px";
    }
    const url = (w.data && w.data.url) || "about:blank";
    const sku = (w.data && w.data.sku) || "";
    const chrome = (w.data && w.data.chrome) || {};
    const own = String(chrome.mode || "").toLowerCase() === "own";
    w.el.classList.toggle("is-own-chrome", own);
    const frame =
      '<iframe class="rom-frame" title="rom" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" allow="clipboard-read; clipboard-write"></iframe>';
    if (own) {
      w.el.innerHTML =
        '<div class="rom-stage">' +
        frame +
        (fill
          ? ""
          : '<div class="rom-grip" data-drag-chrome title="drag"></div>') +
        '<div class="rom-acts rom-acts-host dh-cap-btns">' +
        '<button type="button" class="dh-cap-btn mag-btn" data-rom-act="step" title="Window · step size">⤢</button>' +
        '<button type="button" class="dh-cap-btn" data-rom-act="min" title="Minimize">─</button>' +
        '<button type="button" class="dh-cap-btn max-btn" data-rom-act="max" title="Maximize">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.2"/></svg>' +
        "</button>" +
        '<button type="button" class="dh-cap-btn close" data-rom-act="close" title="Close">✕</button>' +
        "</div></div>" +
        (fill ? "" : '<div class="nb-resize" data-resize></div>');
    } else {
      w.el.innerHTML =
        '<div class="rom-chrome" data-drag-chrome>' +
        '<span class="rom-host"></span>' +
        '<span class="rom-sku"></span>' +
        '<div class="rom-acts">' +
        '<button type="button" class="rom-btn" data-rom-act="window" title="window on desk">win</button>' +
        '<button type="button" class="rom-btn" data-rom-act="fill" title="overtake desk">fill</button>' +
        '<button type="button" class="rom-btn" data-rom-act="reload" title="reload">↻</button>' +
        '<button type="button" class="rom-btn rom-btn-x" data-rom-act="close" title="close">×</button>' +
        "</div></div>" +
        frame +
        (fill ? "" : '<div class="nb-resize" data-resize></div>');
      const hostEl = w.el.querySelector(".rom-host");
      if (hostEl) hostEl.textContent = "SOPHIADESK | THE DECK HOST";
      const skuEl = w.el.querySelector(".rom-sku");
      if (skuEl) skuEl.textContent = sku;
    }
    const iframe = w.el.querySelector(".rom-frame");
    // only set src when empty or host paint with new url (avoid full reload on win/fill)
    if (
      iframe &&
      (!iframe.src ||
        iframe.src === "about:blank" ||
        iframe.getAttribute("data-rom-url") !== url)
    ) {
      iframe.src = url;
      iframe.setAttribute("data-rom-url", url);
    }
    w.el.onmousedown = () => {
      bringFront(w.el);
      setFocus(w);
    };
    const dragChrome = w.el.querySelector("[data-drag-chrome]");
    if (dragChrome && !fill) {
      dragChrome.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest("button")) return;
        startDrag(w, ev);
      });
    }
    const bindAct = (name, fn) => {
      const btn = w.el.querySelector('[data-rom-act="' + name + '"]');
      if (btn) btn.onclick = fn;
    };
    bindAct("window", (ev) => {
      ev.stopPropagation();
      w.deskFill = false;
      paintRomWindow(w);
    });
    bindAct("fill", (ev) => {
      ev.stopPropagation();
      if (!w.deskFill) {
        w._lastOpenW = w.el.offsetWidth || w._lastOpenW;
        w._lastOpenH = w.el.offsetHeight || w._lastOpenH;
      }
      w.deskFill = true;
      paintRomWindow(w);
      bringFront(w.el);
    });
    bindAct("step", (ev) => {
      ev.stopPropagation();
      w.deskFill = false;
      const wide = (w._lastOpenW || 800) >= 1000;
      w._lastOpenW = wide ? 800 : 1024;
      w._lastOpenH = wide ? 600 : 768;
      paintRomWindow(w);
    });
    bindAct("min", (ev) => {
      ev.stopPropagation();
      w.el.style.display = "none";
      toast("rom minimized · cart still on the desk");
    });
    bindAct("max", (ev) => {
      ev.stopPropagation();
      if (w.deskFill) {
        w.deskFill = false;
      } else {
        w._lastOpenW = w.el.offsetWidth || w._lastOpenW;
        w._lastOpenH = w.el.offsetHeight || w._lastOpenH;
        w.deskFill = true;
      }
      paintRomWindow(w);
      bringFront(w.el);
    });
    bindAct("reload", (ev) => {
      ev.stopPropagation();
      const f = w.el.querySelector("iframe");
      if (f) f.src = f.src;
    });
    bindAct("close", async (ev) => {
      ev.stopPropagation();
      const rid = (w.data && w.data.rom_id) || "";
      if (w.el && w.el.parentElement) w.el.parentElement.removeChild(w.el);
      wins.delete(w.data.id);
      if (focusWin === w) setFocus(null);
      // stop backend (desk-spawned OR orphan still listening on port)
      if (rid) {
        try {
          const st = await api("/api/rom/stop", {
            method: "POST",
            body: JSON.stringify({ id: rid }),
          });
          toast(
            st.stopped || !st.up
              ? "rom closed · server stopped"
              : "rom closed · server may still be warm · " +
                  (st.reason || "try again")
          );
        } catch (_) {
          toast("rom closed");
        }
        pollRomWarmFlags();
      } else {
        toast("rom closed");
      }
    });
    const rz = w.el.querySelector("[data-resize]");
    if (rz) {
      rz.addEventListener("pointerdown", (ev) => startResize(w, ev));
    }
  }

  async function spawnLeafAt(x, y) {
    const j = await api("/api/leaf/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: "untitled",
        author: getLastAuthor() || "unknown",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.leaf) {
      toast(j.error || "spawn failed");
      return;
    }
    await ensureDressupCss(j.leaf.paper || "lined");
    const w = mountLeaf(j.leaf, j.config);
    setFocus(w);
    toast("spawn · " + (j.leaf.id || "") + " · " + (j.leaf._file || ""));
  }

  /** Chip card · store package face (not a leaf) */
  async function spawnCardAt(x, y) {
    const j = await api("/api/card/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: "untitled card",
        author: getLastAuthor() || "unknown",
        subject: "",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.card) {
      toast(j.error || "spawn card failed");
      return;
    }
    const w = await mountCard(j.card, j.config);
    if (w) setFocus(w);
    toast("spawn · card · " + (j.card.id || "") + " · " + (j.card._file || ""));
  }

  async function mountCard(card, config, opts) {
    opts = opts || {};
    const uid = String((card && (card.uid || card.id)) || "");
    if (!uid) return null;
    if (wins.has(uid)) {
      const ex = wins.get(uid);
      ex.data = Object.assign({}, ex.data, card || {});
      if (config && config.prop) ex.data.prop = config.prop;
      const cimpl = window.PocketTools && window.PocketTools.get("card");
      if (cimpl && cimpl.paint) cimpl.paint(ex);
      setFocus(ex);
      return ex;
    }
    const packageId = "card";
    await ensureToolKit(packageId, "card.kit");
    const dressCache = Date.now();
    await ensureToolCss(
      packageId,
      "dressups/face/_base.dsc",
      packageId + ":face-base:" + dressCache
    );
    const face =
      (config &&
        config.dressup &&
        (config.dressup.face || config.dressup.style)) ||
      (card && (card.face || card.paper || card.style)) ||
      "plain";
    await ensureToolCss(
      packageId,
      "dressups/face/" + face + ".dsc",
      packageId + ":face-" + face + ":" + dressCache
    );
    let setHtml = (await fetchToolFile(packageId, "card.set")) || "";
    if (!setHtml) {
      toast("package missing · card/card.set");
    }
    const w = {
      kind: "card",
      data: Object.assign(
        {
          id: uid,
          uid: uid,
          title: (card && card.title) || "untitled card",
          author: (card && card.author) || "unknown",
          subject: (card && card.subject) || "",
          body: (card && card.body) || "",
          package_id: "card",
          prop: (config && config.prop) || (card && card.prop) || {},
          face: face,
          paper: face,
          style: face,
        },
        card || {}
      ),
      el: document.createElement("div"),
      open: true,
    };
    if (config && config.prop) w.data.prop = config.prop;
    if (w.data.prop && w.data.prop.homeBin)
      w.data.homeBin = w.data.prop.homeBin;
    if (config && config.dressup) w.data.dressup = config.dressup;
    else w.data.dressup = { id: uid, shell: "card", face: face, style: face };
    wins.set(uid, w);
    felt.appendChild(w.el);
    w.el.className = "nb-win is-open kind-card kind-tool";
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;
    const pose = (config && (config.pose || config.pos)) || {};
    const fr = felt.getBoundingClientRect();
    // index card ~5×3 — default matches roomy card[3] size (275×165)
    const CARD_ASPECT = 5 / 3;
    const CARD_DEFAULT_W = 275;
    const CARD_DEFAULT_H = 165;
    let ww = pose.openW != null ? Number(pose.openW) : CARD_DEFAULT_W;
    let hh = pose.openH != null ? Number(pose.openH) : CARD_DEFAULT_H;
    if (!(ww > 0)) ww = CARD_DEFAULT_W;
    if (!(hh > 0)) hh = CARD_DEFAULT_H;
    // snap stored size back to index proportions if someone stretched it
    hh = Math.max(99, Math.round(ww / CARD_ASPECT));
    ww = Math.max(165, Math.round(hh * CARD_ASPECT));
    let px = pose.x != null ? Number(pose.x) : 80;
    let py = pose.y != null ? Number(pose.y) : 80;
    if (fr.width > 0) {
      px = Math.max(8, Math.min(px, Math.max(8, fr.width - ww - 8)));
      py = Math.max(8, Math.min(py, Math.max(8, fr.height - hh - 8)));
    }
    w.el.style.left = px + "px";
    w.el.style.top = py + "px";
    w._lastOpenW = ww;
    w._lastOpenH = hh;
    w.el.style.width = ww + "px";
    w.el.style.height = hh + "px";
    const wrap = document.createElement("div");
    wrap.className = "tool-face";
    wrap.innerHTML =
      setHtml ||
      '<div class="tool-card" data-tool="card">' +
        '<div class="tool-card-rail" data-drag-chrome title="drag card from here">' +
        '<span class="tool-card-kind">card</span></div>' +
        '<div class="tool-card-title" data-card-title data-select-text></div>' +
        '<div class="tool-card-by" data-card-by data-select-text></div>' +
        '<div class="tool-card-body" data-card-body data-select-text></div>' +
        '<div class="tool-card-foot" data-drag-chrome>' +
        '<span class="tool-card-uid" data-card-uid></span></div></div>';
    w.el.appendChild(wrap);
    const rz = document.createElement("div");
    rz.className = "nb-resize";
    rz.setAttribute("data-resize", "");
    rz.title = "zoom · keeps index-card shape";
    w.el.appendChild(rz);
    rz.addEventListener("pointerdown", (ev) => startResize(w, ev));
    const cimpl = window.PocketTools && window.PocketTools.get("card");
    if (cimpl && cimpl.mount) cimpl.mount(w);
    else if (cimpl && cimpl.paint) cimpl.paint(w);
    w.el.onmousedown = () => {
      bringFront(w.el);
      setFocus(w);
    };
    // stamp while held
    let cardMoved = false;
    w.el.addEventListener("click", async (ev) => {
      if (cardMoved) return;
      if (!heldToolWin || heldToolWin.kind !== "tool") return;
      if (ev.target.closest("input, textarea, button")) return;
      // don't stamp when highlighting card text for copy
      if (isSelectableTextTarget(ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      await applyStampToLeaf(heldToolWin, w, ev.clientX, ev.clientY);
    });
    // drag from rail / foot only · title + body stay highlightable
    const cardChromes = w.el.querySelectorAll("[data-drag-chrome]");
    const chromeList = cardChromes.length
      ? cardChromes
      : [w.el];
    chromeList.forEach((chrome) => {
      chrome.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (isSelectableTextTarget(ev.target)) return;
        if (
          ev.target.closest(
            "button, input, .nb-resize, [data-card-unfile], [data-card-putaway]"
          )
        )
          return;
        // stop board pocket chrome from also startDrag'ing the box
        ev.stopPropagation();
        cardMoved = false;
        startDrag(w, ev, () => {
          cardMoved = true;
        });
      });
    });
    const putAwayBtn = w.el.querySelector("[data-card-putaway]");
    if (putAwayBtn) {
      putAwayBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      putAwayBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await putAwayCard(w);
      });
    }
    const unfileBtn = w.el.querySelector("[data-card-unfile]");
    if (unfileBtn) {
      unfileBtn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      unfileBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await unfileCard(w);
      });
    }
    // dblclick → short edit (title/body · RE is deck-derived)
    w.el.addEventListener("dblclick", (ev) => {
      if (ev.target.closest("button")) return;
      ev.preventDefault();
      ev.stopPropagation();
      openCardTerminal(w);
    });
    paintCardFace(w);
    bringFront(w.el);
    if (!opts.skipFocus) setFocus(w);
    return w;
  }

  function keyFaceSafeSvg(raw) {
    const text = String(raw || "");
    if (!text || /<(script|foreignObject|iframe|object|embed)\b/i.test(text))
      return "";
    const m = text.match(/<svg[\s\S]*?<\/svg>/i);
    return m ? m[0] : "";
  }

  function paintKeyFace(w) {
    if (!w || w.kind !== "key" || !w.el) return;
    const size = Math.max(
      KEY_MIN,
      Number(w._lastOpenW || w.el.offsetWidth || KEY_SIZE)
    );
    w.el.style.fontSize = size + "px";
    const glyphEl = w.el.querySelector(".key-glyph");
    const svgEl = w.el.querySelector(".key-svg");
    const svg = keyFaceSafeSvg(w.data.svg || "");
    const glyph = String(w.data.glyph || w.data.title || "").trim();
    if (svgEl) {
      if (svg) {
        svgEl.innerHTML = svg;
        svgEl.hidden = false;
        if (glyphEl) glyphEl.hidden = true;
      } else {
        svgEl.innerHTML = "";
        svgEl.hidden = true;
        if (glyphEl) glyphEl.hidden = false;
      }
    }
    if (glyphEl && !svg) glyphEl.textContent = glyph;
    applyKeyColor(w);
    applyKeyTransform(w);
  }

  async function spawnKeyAt(x, y, extra) {
    extra = extra || {};
    const j = await api("/api/key/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: extra.title || extra.glyph || "key",
        author: getLastAuthor() || "unknown",
        glyph: extra.glyph || "",
        svg: extra.svg || "",
        heading: extra.heading || "N",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.key) {
      toast(j.error || "spawn key failed");
      return;
    }
    const w = await mountKey(j.key, j.config);
    if (w) setFocus(w);
    toast("spawn · key · " + (j.key.id || "") + " · " + (j.key._file || ""));
    return w;
  }

  async function mountKey(key, config, opts) {
    opts = opts || {};
    const uid = String((key && (key.uid || key.id)) || "");
    if (!uid) return null;
    if (wins.has(uid)) {
      const ex = wins.get(uid);
      ex.data = Object.assign({}, ex.data, key || {});
      if (config && config.prop) ex.data.prop = config.prop;
      if (config && config.pose && config.pose.heading)
        ex.data.heading = config.pose.heading;
      const face = normalizeKeyFace(
        (config &&
          config.dressup &&
          (config.dressup.face || config.dressup.style)) ||
          (ex.data.dressup && (ex.data.dressup.face || ex.data.dressup.style)) ||
          ex.data.style ||
          "plain"
      );
      if (face && face !== "_base") loadKindDressCss("key", face);
      ex.data.style = face;
      if (ex.data.dressup) {
        ex.data.dressup.face = face;
        ex.data.dressup.style = face;
      }
      if (config && config.prop && config.prop.color)
        ex.data.color = config.prop.color;
      if (ex.el) ex.el.setAttribute("data-face", face);
      paintKeyFace(ex);
      if (!opts.skipFocus) setFocus(ex);
      return ex;
    }
    await loadKindDressCss("key", "_base");
    const heading = String(
      (config && config.pose && config.pose.heading) ||
        (config && config.prop && config.prop.heading) ||
        (key && key.heading) ||
        "N"
    );
    const face = normalizeKeyFace(
      (config &&
        config.dressup &&
        (config.dressup.face || config.dressup.style)) ||
        (key && key.style) ||
        "plain"
    );
    if (face && face !== "_base") await loadKindDressCss("key", face);
    const w = {
      kind: "key",
      data: Object.assign(
        {
          id: uid,
          uid: uid,
          title: (key && (key.title || key.glyph)) || "key",
          author: (key && key.author) || "unknown",
          glyph: (key && key.glyph) || "",
          svg: (key && key.svg) || "",
          heading: heading,
          package_id: "key",
          prop: (config && config.prop) || (key && key.prop) || {},
          style: face,
          color:
            (key && key.color) ||
            (config && config.prop && config.prop.color) ||
            "",
        },
        key || {}
      ),
      el: document.createElement("div"),
      open: true,
    };
    w.data.heading = heading;
    w.data.style = face;
    if (config && config.prop) w.data.prop = config.prop;
    if (w.data.prop && w.data.prop.color) w.data.color = w.data.prop.color;
    if (config && config.dressup) w.data.dressup = config.dressup;
    else w.data.dressup = { id: uid, shell: "key", face: face, style: face };
    wins.set(uid, w);
    felt.appendChild(w.el);
    w.el.className = "nb-win is-open kind-key";
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;
    w.el.setAttribute("data-face", face);
    const pose = (config && (config.pose || config.pos)) || {};
    const fr = felt.getBoundingClientRect();
    let ww = pose.openW != null ? Number(pose.openW) : KEY_SIZE;
    let hh = pose.openH != null ? Number(pose.openH) : KEY_SIZE;
    if (!(ww > 0)) ww = KEY_SIZE;
    if (!(hh > 0)) hh = KEY_SIZE;
    ww = Math.max(KEY_MIN, Math.min(KEY_MAX, Math.round(ww)));
    hh = ww;
    let px = pose.x != null ? Number(pose.x) : 80;
    let py = pose.y != null ? Number(pose.y) : 80;
    if (fr.width > 0) {
      px = Math.max(8, Math.min(px, Math.max(8, fr.width - ww - 8)));
      py = Math.max(8, Math.min(py, Math.max(8, fr.height - hh - 8)));
    }
    w.el.style.left = px + "px";
    w.el.style.top = py + "px";
    w._lastOpenW = ww;
    w._lastOpenH = hh;
    w.el.style.width = ww + "px";
    w.el.style.height = hh + "px";
    w.el.style.fontSize = ww + "px";
    const wrap = document.createElement("div");
    wrap.className = "key-cap";
    wrap.setAttribute("data-drag-chrome", "");
    wrap.title = "key · " + uid;
    wrap.innerHTML =
      '<span class="key-pip" aria-hidden="true"></span>' +
      '<div class="key-face">' +
      '<div class="key-glyph"></div>' +
      '<div class="key-svg" hidden></div>' +
      "</div>";
    w.el.appendChild(wrap);
    const rz = document.createElement("div");
    rz.className = "nb-resize";
    rz.setAttribute("data-resize", "");
    rz.title = "scale · keeps square";
    w.el.appendChild(rz);
    rz.addEventListener("pointerdown", (ev) => startResize(w, ev));
    w.el.onmousedown = () => {
      bringFront(w.el);
      setFocus(w);
    };
    wrap.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      startDrag(w, ev);
    });
    w.el.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openKeyTerminal(w);
    });
    paintKeyFace(w);
    bringFront(w.el);
    if (!opts.skipFocus) setFocus(w);
    return w;
  }

  function keyTerminalSeed(w) {
    const svg = String((w && w.data && w.data.svg) || "").trim();
    const color = keyColorOf(w);
    const colorLine = color ? "\ncolor: " + color : "";
    if (svg) return "svg:\n" + svg + colorLine;
    return String((w && w.data && w.data.glyph) || "") + colorLine;
  }

  function applyKeyTerminalLive(w, raw) {
    const parsed = parseKeyTerminalRaw(raw);
    w.data.glyph = parsed.glyph;
    w.data.svg = parsed.svg;
    w.data.face_mode = parsed.mode;
    w.data.color = parsed.color;
    w.data.prop = Object.assign({}, w.data.prop || {}, {
      color: parsed.color || undefined,
    });
    if (!parsed.color && w.data.prop) delete w.data.prop.color;
    w.data.title = parsed.glyph || w.data.title || "key";
    paintKeyFace(w);
  }

  function parseKeyTerminalRaw(raw) {
    const lines = String(raw || "").split(/\r?\n/);
    let color = "";
    const kept = [];
    for (let i = 0; i < lines.length; i++) {
      const m = String(lines[i] || "").match(/^\s*color\s*:\s*(.*)$/i);
      if (m) {
        color = normalizeKeyColor(m[1]);
        continue;
      }
      kept.push(lines[i]);
    }
    const text = kept.join("\n").trim();
    if (/^svg\s*:/i.test(text)) {
      const body = text.replace(/^svg\s*:/i, "").trim();
      const svg = keyFaceSafeSvg(body);
      return { glyph: "", svg: svg, mode: svg ? "svg" : "text", color: color };
    }
    const glyph = (text.split(/\r?\n/)[0] || "").slice(0, 12);
    return { glyph: glyph, svg: "", mode: "text", color: color };
  }

  function openKeyTerminal(w, termOpts) {
    termOpts = termOpts || {};
    if (!w || w.kind !== "key") return;
    if (w.termEl) {
      const ta0 = w.termEl.querySelector(".md-term-ta");
      if (ta0) ta0.focus();
      return;
    }
    const seed = keyTerminalSeed(w);
    openMdTerminal(w, {
      title: "key · " + (w.data.uid || w.data.id || ""),
      value: seed,
      onChange: function (v) {
        applyKeyTerminalLive(w, v);
      },
      onSave: async function () {
        const ta = w.termEl && w.termEl.querySelector(".md-term-ta");
        const raw = ta ? ta.value : seed;
        const parsed = parseKeyTerminalRaw(raw);
        w.data.glyph = parsed.glyph;
        w.data.svg = parsed.svg;
        w.data.face_mode = parsed.mode;
        w.data.color = parsed.color;
        w.data.prop = Object.assign({}, w.data.prop || {});
        if (parsed.color) w.data.prop.color = parsed.color;
        else delete w.data.prop.color;
        if (parsed.glyph) w.data.title = parsed.glyph;
        const j = await api("/api/key/save", {
          method: "POST",
          body: JSON.stringify({ key: w.data }),
        });
        if (!j.ok) {
          toast(j.error || "key save failed");
          return false;
        }
        if (j.key) {
          const dress = w.data.dressup;
          Object.assign(w.data, j.key);
          if (dress) w.data.dressup = dress;
        }
        paintKeyFace(w);
        await persistPose({}, w);
        toast(
          "key saved · " +
            (w.data.uid || "") +
            " · " +
            (parsed.glyph || "svg") +
            (parsed.color ? " · " + parsed.color : "")
        );
        return true;
      },
    });
  }

  async function turnKey(w, steps) {
    if (!w || w.kind !== "key") return null;
    const cur = keyHeadingOf(w);
    const i = KEY_HEADINGS.indexOf(cur);
    const next = KEY_HEADINGS[(i + (Number(steps) || 1) + 8 * 8) % 8];
    return setKeyHeading(w, next);
  }

  async function setKeyHeading(w, heading) {
    if (!w || w.kind !== "key") return null;
    const h = keyHeadingOf({ data: { heading: heading } });
    w.data.heading = h;
    w.data.prop = Object.assign({}, w.data.prop || {}, { heading: h });
    paintKeyFace(w);
    await persistPose({}, w);
    return h;
  }

  async function setKeyColor(w, raw) {
    if (!w || w.kind !== "key") return null;
    const c = normalizeKeyColor(raw);
    w.data.color = c;
    w.data.prop = Object.assign({}, w.data.prop || {});
    if (c) w.data.prop.color = c;
    else delete w.data.prop.color;
    paintKeyFace(w);
    const j = await api("/api/key/save", {
      method: "POST",
      body: JSON.stringify({ key: w.data }),
    });
    if (j && j.key) {
      const dress = w.data.dressup;
      Object.assign(w.data, j.key);
      if (dress) w.data.dressup = dress;
      w.data.color = c;
    }
    await persistPose({}, w);
    return c;
  }

  /**
   * Parse chip terminal text (# title / by: / body) into fields.
   * Cards: bodyMax 520. Leaves: no body cap (full paper).
   */
  function parseCardTerminalRaw(raw, fallback, opts) {
    fallback = fallback || {};
    opts = opts || {};
    const bodyMax =
      opts.bodyMax != null ? Number(opts.bodyMax) : 520; // card default
    const lines = String(raw || "").split(/\r?\n/);
    let title = fallback.title || "untitled";
    let author = fallback.author || "unknown";
    let tags = Array.isArray(fallback.tags) ? fallback.tags.slice() : [];
    let tagsLine = false;
    let bodyStart = 0;
    if (lines[0] && lines[0].indexOf("#") === 0) {
      title = lines[0].replace(/^#\s*/, "").trim() || title;
      bodyStart = 1;
    }
    for (let i = bodyStart; i < Math.min(lines.length, bodyStart + 8); i++) {
      const ln = lines[i] || "";
      const mBy = ln.match(/^by:\s*(.*)$/i);
      // ignore legacy subject: lines — filing is deck-only
      const mSub = ln.match(/^subject:\s*(.*)$/i);
      const mTags = ln.match(/^tags:\s*(.*)$/i);
      if (mBy) {
        author = mBy[1].trim() || author;
        bodyStart = i + 1;
        continue;
      }
      if (mSub) {
        bodyStart = i + 1;
        continue;
      }
      if (mTags) {
        tagsLine = true;
        tags = parseTagArgs(mTags[1]);
        bodyStart = i + 1;
        continue;
      }
      if (ln.trim() === "") {
        bodyStart = i + 1;
        break;
      }
      break;
    }
    while (
      bodyStart < lines.length &&
      !String(lines[bodyStart] || "").trim()
    ) {
      bodyStart++;
    }
    let body = lines.slice(bodyStart).join("\n");
    // 0 / negative / NaN = no limit (leaves). Cards keep 520.
    if (bodyMax > 0 && body.length > bodyMax) body = body.slice(0, bodyMax);
    return {
      title: title,
      author: author,
      body: body,
      bodyStart: bodyStart, // terminal line index where body begins (for paper scroll)
      tags: normalizePaperTags(tagsLine ? tags : fallback.tags || tags),
    };
  }

  /** Keep textarea caret in view while typing past the fold. */
  function scrollTextareaCaretIntoView(ta) {
    if (!ta) return;
    try {
      const pos = ta.selectionStart || 0;
      const line = ta.value.slice(0, pos).split("\n").length - 1;
      const style = window.getComputedStyle(ta);
      let lh = parseFloat(style.lineHeight);
      if (!lh || Number.isNaN(lh)) {
        lh = (parseFloat(style.fontSize) || 12) * 1.4;
      }
      const pad = parseFloat(style.paddingTop) || 0;
      const caretTop = line * lh + pad;
      const caretBot = caretTop + lh;
      if (caretTop < ta.scrollTop) {
        ta.scrollTop = Math.max(0, caretTop - lh);
      } else if (caretBot > ta.scrollTop + ta.clientHeight) {
        ta.scrollTop = caretBot - ta.clientHeight + lh;
      }
    } catch (_) {}
  }

  /**
   * Terminal caret line → body-relative line for paper preview
   * (terminal has # title / by: header; paper is body only).
   */
  function bodyLineFromTerminal(ta, bodyStart) {
    if (!ta || !window.ReceiverLiveMd) return 0;
    const rawLine = ReceiverLiveMd.caretLine(ta);
    const start = Math.max(0, Number(bodyStart) || 0);
    return Math.max(0, rawLine - start);
  }

  function applyCardTerminalLive(w, raw) {
    if (!w || w.kind !== "card") return;
    const parsed = parseCardTerminalRaw(raw, paperParseFallback(w), {
      bodyMax: 520,
    });
    // live view only — do not rememberAuthor / save until ^S
    applyParsedPaperFields(w, parsed);
    paintCardFace(w);
  }

  function openCardTerminal(w, termOpts) {
    termOpts = termOpts || {};
    if (!w || w.kind !== "card") return;
    if (w.termEl) {
      const ta0 = w.termEl.querySelector(".md-term-ta");
      if (ta0) {
        ta0.focus();
        if (termOpts.focusTags) focusTagsLine(ta0);
      }
      return;
    }
    // RE/filing is deck-derived — not a handwritten subject field
    const seed = paperEditorSeed(w, "untitled card");
    openMdTerminal(w, {
      title: "card · " + (w.data.uid || w.data.id || ""),
      value: seed,
      // leaf-style live edit: face follows console as you type
      onChange: function (v) {
        applyCardTerminalLive(w, v);
      },
      onSave: async function () {
        const ta = w.termEl && w.termEl.querySelector(".md-term-ta");
        const raw = ta ? ta.value : seed;
        const parsed = parseCardTerminalRaw(raw, paperParseFallback(w));
        applyParsedPaperFields(w, parsed);
        w.data.author = rememberAuthor(parsed.author);
        const j = await api("/api/card/save", {
          method: "POST",
          body: JSON.stringify({ card: w.data }),
        });
        if (!j.ok) {
          toast(j.error || "card save failed");
          return false;
        }
        if (j.card) Object.assign(w.data, j.card);
        paintCardFace(w);
        toast("card saved · " + (w.data.uid || "") + " · " + parsed.body.length + "c");
        return true;
      },
    });
    if (termOpts.focusTags) {
      const ta = w.termEl && w.termEl.querySelector(".md-term-ta");
      focusTagsLine(ta);
    }
  }

  async function spawnBoardAt(x, y) {
    const j = await api("/api/bin/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: "untitled board",
        author: getLastAuthor() || "unknown",
        subtype: "board",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.bin) {
      toast(j.error || "spawn board failed");
      return;
    }
    const w = await mountBoard(j.bin, j.config);
    setFocus(w);
    toast("spawn · board · " + (j.bin.id || "") + " · " + (j.bin._file || ""));
  }

  async function spawnDeckAt(x, y) {
    // manila parcel · leaves + cards (not a card-only deck)
    const j = await api("/api/bin/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: "untitled envelope",
        author: getLastAuthor() || "unknown",
        subtype: "envelope",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.bin) {
      toast(j.error || "spawn envelope failed");
      return;
    }
    const w = await mountBoard(j.bin, j.config);
    setFocus(w);
    toast(
      "spawn · envelope · " + (j.bin.id || "") + " · " + (j.bin._file || "")
    );
  }

  async function ensureTrashCanWin() {
    const existing = firstWin(function (w) {
      return w.kind === "board" && isTrashBin(w);
    });
    if (existing) return existing;
    const j = await api("/api/trash/ensure", {
      method: "POST",
      body: JSON.stringify({
        x: lastFeltPtr.x,
        y: lastFeltPtr.y,
      }),
    });
    if (!j.ok || !j.bin) {
      toast((j && j.error) || "no trash can");
      return null;
    }
    let w = firstWin(function (ww) {
      return (
        ww.kind === "board" &&
        String(ww.data.uid || ww.data.id) === String(j.bin.uid || j.bin.id)
      );
    });
    if (!w) w = await mountBoard(j.bin, j.config);
    return w || null;
  }

  async function emptyTrashCan() {
    const can = await ensureTrashCanWin();
    const j = await api("/api/trash/empty", {
      method: "POST",
      body: JSON.stringify({
        id: can && can.data ? can.data.uid || can.data.id : "",
      }),
    });
    if (!j.ok) {
      toast(j.error || "empty failed");
      return j;
    }
    (j.ids || []).forEach(function (id) {
      const key = String(id);
      let w = wins.get(key);
      if (!w) {
        wins.forEach(function (ww) {
          if (
            !w &&
            String((ww.data && (ww.data.uid || ww.data.id)) || "") === key
          )
            w = ww;
        });
      }
      if (w && w.el) w.el.remove();
      if (w) wins.delete(w.data && (w.data.uid || w.data.id));
      wins.delete(key);
    });
    if (can) {
      can.data.chips = [];
      refreshDeckList(can);
    }
    toast(
      "emptied · " +
        (j.count || 0) +
        " into ~trash" +
        (j.folder ? " · " + j.folder : "")
    );
    return j;
  }

  async function spawnBookAt(x, y) {
    const j = await api("/api/bin/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: "untitled book",
        author: getLastAuthor() || "unknown",
        subtype: "book",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.bin) {
      toast(j.error || "spawn book failed");
      return;
    }
    const w = await mountBoard(j.bin, j.config);
    setFocus(w);
    toast("spawn · book · " + (j.bin.id || "") + " · " + (j.bin._file || ""));
  }

  async function spawnShelfAt(x, y) {
    const j = await api("/api/bin/spawn", {
      method: "POST",
      body: JSON.stringify({
        title: "bookshelf",
        author: getLastAuthor() || "unknown",
        subtype: "shelf",
        x: x,
        y: y,
      }),
    });
    if (!j.ok || !j.bin) {
      toast(j.error || "spawn shelf failed");
      return;
    }
    const w = await mountBoard(j.bin, j.config);
    setFocus(w);
    toast("spawn · shelf · " + (j.bin.id || ""));
  }

  function isBookBin(bw) {
    if (!bw || !bw.data) return false;
    const t = bw.data.subtype || bw.data.bin_type || "";
    return String(t).toLowerCase() === "book" || String(bw.data.class || "") === "book";
  }

  function isShelfBin(bw) {
    if (!bw || !bw.data) return false;
    const t = bw.data.subtype || bw.data.bin_type || "";
    return (
      String(t).toLowerCase() === "shelf" ||
      String(bw.data.class || "") === "shelf"
    );
  }

  function isToolMemberId(id) {
    const s = String(id || "").replace(/^tool-/, "");
    if (!s || /^(leaf|card|board|book|shelf|deck)[\[_]/i.test(s)) return false;
    return /^[a-zA-Z][\w]*\[\d+\]$/.test(s);
  }

  function boardToolIds(bw) {
    return ((bw && bw.data && bw.data.chips) || []).filter(isToolMemberId);
  }

  function boardLeafCardIds(bw) {
    return ((bw && bw.data && bw.data.chips) || []).filter(
      (id) => !isToolMemberId(id)
    );
  }

  function refreshBoardMeta(bw) {
    if (!bw || !bw.el) return;
    const meta = bw.el.querySelector("[data-board-meta]");
    const chips = (bw.data.chips && bw.data.chips.length) || 0;
    const countEl = bw.el.querySelector("[data-deck-count]");
    if (countEl) {
      countEl.textContent = isTrashBin(bw)
        ? chips
          ? String(chips)
          : ""
        : chips
          ? chips + " in"
          : "";
    }
    if (!meta) return;
    const tools = boardToolIds(bw);
    const nTools = tools.length;
    const nPaper = chips - nTools;
    const prop = bw.data.prop || {};
    // envelopes/books hold deep shelves; boards stay modest if prop silent
    const maxDefault = isDeckBin(bw) ? 40 : isBookBin(bw) ? 40 : 10;
    const maxL = prop.maxLoad != null ? prop.maxLoad : maxDefault;
    const book = isBookBin(bw);
    if (book) {
      meta.textContent =
        chips +
        " page" +
        (chips === 1 ? "" : "s") +
        " · " +
        (bw.data.id || "");
      return;
    }
    if (isShelfBin(bw)) {
      meta.textContent =
        chips +
        " volume" +
        (chips === 1 ? "" : "s") +
        " · " +
        (bw.data.id || "");
      return;
    }
    if (isDeckBin(bw)) {
      const outN = bw.data._outCount || 0;
      meta.textContent =
        chips +
        (maxL ? "/" + maxL : "") +
        " in" +
        (outN ? " · " + outN + " out" : "") +
        " · " +
        (bw.data.id || "");
      return;
    }
    // cork board · papers + tools (same pocket)
    const tardis = !!prop.isTardis;
    let line =
      nPaper +
      (maxL ? "/" + maxL : "") +
      " paper" +
      (nPaper === 1 ? "" : "s");
    if (nTools)
      line +=
        " · " + nTools + " tool" + (nTools === 1 ? "" : "s");
    line +=
      (tardis ? " · tardis" : " · surface") + " · " + (bw.data.id || "");
    meta.textContent = line;
    // strip old chip-tray thrash if any
    const tray = bw.el.querySelector("[data-board-tools]");
    if (tray) tray.remove();
  }

  /** Tool into board pocket — same bin + shrink path as papers. */
  async function placeToolInBoard(tw, bw, clientX, clientY) {
    if (!tw || tw.kind !== "tool" || !bw || bw.kind !== "board") return false;
    if (isBookBin(bw) || isShelfBin(bw) || isDeckBin(bw)) {
      toast("tools go in a board · not that host");
      return false;
    }
    const pkg = toolPackageId(tw);
    if (pkg === "inbox" || pkg === "rom") {
      toast("inbox / rom stay on the desk · not in a toolbox");
      return false;
    }
    const tid = tw.data.uid || tw.data.id;
    if (!tid) return false;
    const pocket = bw.el.querySelector("[data-board-pocket]");
    if (!pocket) return false;

    if (heldToolWin === tw) {
      clearHeldToolChrome(tw);
      heldToolWin = null;
    }

    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: bw.data.id,
        leaf_id: tid,
        action: "add",
      }),
    });
    if (!j.ok) {
      toast(j.error || "board full or join failed");
      return false;
    }
    bw.data.chips = (j.bin && j.bin.chips) || bw.data.chips || [];
    tw._inBin = bw.data.id;
    tw.data.bin = bw.data.id;
    tw.el.style.display = "";
    tw.el.removeAttribute("aria-hidden");

    const pre = tw.el.getBoundingClientRect();
    const dropX = clientX != null ? clientX : pre.left + pre.width / 2;
    const dropY = clientY != null ? clientY : pre.top + pre.height / 2;
    const fracX = pre.width > 1 ? (dropX - pre.left) / pre.width : 0.5;
    const fracY = pre.height > 1 ? (dropY - pre.top) / pre.height : 0.5;

    pocket.appendChild(tw.el);
    setLeafInBoardScale(tw, true);
    tw.el.style.left = "0px";
    tw.el.style.top = "0px";
    void tw.el.offsetWidth;
    const pr = pocket.getBoundingClientRect();
    const lr = tw.el.getBoundingClientRect();
    const vw = lr.width || 60;
    const vh = lr.height || 60;
    let nx = dropX - pr.left - fracX * vw;
    let ny = dropY - pr.top - fracY * vh;
    const maxX = Math.max(4, pr.width - vw - 4);
    const maxY = Math.max(4, pr.height - vh - 4);
    nx = Math.max(4, Math.min(nx, maxX));
    ny = Math.max(4, Math.min(ny, maxY));
    tw.el.style.left = nx + "px";
    tw.el.style.top = ny + "px";
    refreshBoardMeta(bw);
    await persistPose({}, tw);
    toast("in board · " + tid);
    return true;
  }

  async function takeToolFromBoard(toolId, bw, clientX, clientY) {
    if (!bw || !toolId) return null;
    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: bw.data.id,
        leaf_id: toolId,
        action: "remove",
      }),
    });
    if (!j.ok) {
      toast(j.error || "could not take tool");
      return null;
    }
    bw.data.chips = (j.bin && j.bin.chips) || [];
    const tw = wins.get(String(toolId));
    if (tw && tw.kind === "tool" && tw.el) {
      tw._inBin = null;
      tw.data.bin = null;
      setLeafInBoardScale(tw, false);
      if (tw.el.parentElement !== felt) felt.appendChild(tw.el);
      tw.el.style.display = "";
      tw.el.removeAttribute("aria-hidden");
      const fr = felt.getBoundingClientRect();
      if (clientX != null) {
        tw.el.style.left = Math.max(4, clientX - fr.left - 40) + "px";
        tw.el.style.top = Math.max(4, clientY - fr.top - 40) + "px";
      } else if (bw.el) {
        const r = bw.el.getBoundingClientRect();
        tw.el.style.left = Math.max(4, r.right - fr.left + 10) + "px";
        tw.el.style.top = Math.max(4, r.top - fr.top) + "px";
      }
      bringFront(tw.el);
      setFocus(tw);
      await persistPose({}, tw);
    }
    refreshBoardMeta(bw);
    toast("out · " + toolId);
    return tw;
  }

  /** Nest tool win into board pocket at scale (boot / rejoin). */
  function nestToolInBoardPocket(tw, bw, pose) {
    if (!tw || !tw.el || !bw || !bw.el) return;
    const pocket = bw.el.querySelector("[data-board-pocket]");
    if (!pocket) return;
    const bid = bw.data.id || bw.data.uid;
    tw._inBin = bid;
    tw.data.bin = bid;
    tw.el.style.display = "";
    tw.el.removeAttribute("aria-hidden");
    pocket.appendChild(tw.el);
    setLeafInBoardScale(tw, true);
    let lx = pose && pose.x != null ? Number(pose.x) : 10;
    let ly = pose && pose.y != null ? Number(pose.y) : 10;
    const pr = pocket.getBoundingClientRect();
    const maxX = Math.max(4, (pr.width || 200) - 50);
    const maxY = Math.max(4, (pr.height || 120) - 50);
    if (lx > maxX || ly > maxY || lx < 0 || ly < 0) {
      lx = 8 + Math.random() * 40;
      ly = 8 + Math.random() * 30;
    }
    tw.el.style.left = lx + "px";
    tw.el.style.top = ly + "px";
  }

  const BOOK_CLOTHS = ["oxblood", "forest", "navy", "sand"];
  /** pinboard face tints — glance variety (not full dressup zoo) */
  const BOARD_TINTS = ["cork", "slate", "moss", "wine", "dusk", "sand"];

  function boardTintOf(bw) {
    const t = String(
      (bw && bw.data && (bw.data.cloth || bw.data.color || bw.data.tint)) ||
        "cork"
    )
      .toLowerCase()
      .trim();
    return BOARD_TINTS.indexOf(t) >= 0 ? t : "cork";
  }

  function applyBoardTint(bw) {
    if (!bw || !bw.el || isBookBin(bw) || isShelfBin(bw) || isTrashBin(bw))
      return;
    const box = bw.el.querySelector(".board-box, .deck-box");
    if (!box) return;
    const tint = boardTintOf(bw);
    BOARD_TINTS.forEach((c) => box.classList.remove("tint-" + c));
    box.classList.add("tint-" + tint);
    const sel = bw.el.querySelector("[data-field=cloth]");
    if (sel && sel.value !== tint) sel.value = tint;
  }

  async function renderBookClosed(bw) {
    if (!bw || !isBookBin(bw)) return;
    bw.open = false;
    const el = bw.el;
    const book = bw.data;
    const cloth = book.cloth || "oxblood";
    const n = (book.chips && book.chips.length) || 0;
    el.className = "nb-win is-closed kind-book kind-board";
    el.style.width = "120px";
    el.style.height = "162px";
    el.innerHTML =
      '<button type="button" class="book-face cloth-' +
      esc(cloth) +
      '" data-drag-chrome data-bin-drop>' +
      '<div class="book-face-spine"></div>' +
      '<div class="book-face-pages"></div>' +
      '<div class="book-face-plate"><span class="book-face-id"></span>' +
      '<span class="book-face-title"></span>' +
      '<span class="book-face-by"></span>' +
      '<span class="book-face-count"></span></div></button>';
    // papers please · living uid on the cloth (book[3] not just a title)
    el.querySelector(".book-face-id").textContent =
      book.uid || book.id || book.face_id || "";
    el.querySelector(".book-face-title").textContent =
      book.title || "untitled book";
    const by = normalizeAuthor(book.author);
    el.querySelector(".book-face-by").textContent = by ? "by " + by : "";
    el.querySelector(".book-face-count").textContent =
      n + " page" + (n === 1 ? "" : "s");
    const face = el.querySelector(".book-face");
    // click (no drag) opens · drag past threshold moves · dblclick still opens
    face.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // on a shelf: take off first — don't open nested
      if (bw._onShelf || (bw.data && bw.data.shelf)) {
        toast("drag off the shelf to open");
        return;
      }
      renderBookOpen(bw).catch(function (err) {
        toast(
          "book open failed · " + (err && err.message ? err.message : err)
        );
      });
    });
    face.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      // requireThreshold: do not capture until moved — otherwise open dies after fold
      startDrag(bw, ev, null, { requireThreshold: true });
    });
    el.onmousedown = () => {
      bringFront(el);
      setFocus(bw);
    };
    restoreOfficeFloorPresentation(bw);
    bringFront(el);
    setFocus(bw);
    // keep last open size; pose records open: no
    await persistPose({}, bw);
  }

  function bookMetaById(bid) {
    const bw = boardWinById(bid);
    const id = String(bid || "");
    const isEnv =
      /^envelope\[/i.test(id) ||
      /^deck\[/i.test(id) ||
      (bw && isDeckBin(bw));
    if (bw && bw.data) {
      return {
        id: bw.data.id || bid,
        title:
          bw.data.title ||
          bw.data.name ||
          (isEnv ? "untitled envelope" : "untitled book"),
        cloth: isEnv
          ? bw.data.cloth || bw.data.color || "cork"
          : bw.data.cloth || "oxblood",
        pages: (bw.data.chips && bw.data.chips.length) || 0,
        // shelf chrome still keys "deck" for manila env strip
        kind: isEnv ? "deck" : "book",
      };
    }
    return {
      id: bid,
      title: bid,
      cloth: isEnv ? "cork" : "oxblood",
      pages: 0,
      kind: isEnv ? "deck" : "book",
    };
  }

  /**
   * LEGACY shelf chrome (core) — temporary.
   * Next bookshelf belongs in the store as a package (spine dress on volumes,
   * rail host that *calls* spine). Do not grow more shelf UI in app.js.
   */
  function clearShelfVolumeVisual(bw) {
    if (!bw || !bw.el) return;
    bw.el.classList.remove("is-on-shelf");
    bw.el.style.transform = "";
    bw.el.style.transformOrigin = "";
    bw.el.style.marginRight = "";
    bw.el.style.marginBottom = "";
    bw.el.style.position = "";
  }

  /** Hide real volume wins while on a shelf; rail shows spine stubs only (legacy). */
  function hideShelvedVolumes(sw) {
    const chips = (sw && sw.data && sw.data.chips) || [];
    const sid = sw && sw.data && (sw.data.id || sw.data.uid);
    chips.forEach((bid) => {
      const bw = boardWinById(bid);
      if (!bw || !bw.el) return;
      clearShelfVolumeVisual(bw);
      if (bw.el.parentElement !== felt) felt.appendChild(bw.el);
      bw.el.style.display = "none";
      bw.el.setAttribute("aria-hidden", "true");
      bw._onShelf = sid;
      bw.data.shelf = sid;
    });
  }

  function hideShelvedBooks(sw) {
    hideShelvedVolumes(sw);
  }

  /** @deprecated alias — boot still calls layout name after bad rework */
  function layoutShelvedVolumes(sw) {
    hideShelvedVolumes(sw);
  }

  async function placeVolumeOnShelf(volWin, shelfWin) {
    if (
      !volWin ||
      !shelfWin ||
      !isShelfBin(shelfWin) ||
      (!isBookBin(volWin) && !isDeckBin(volWin))
    )
      return false;
    if (volWin.open !== false) {
      try {
        if (isDeckBin(volWin)) await renderDeckClosed(volWin);
        else if (isBookBin(volWin)) await renderBookClosed(volWin);
      } catch (_) {}
    }
    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: shelfWin.data.id,
        book_id: volWin.data.id,
        leaf_id: volWin.data.id,
        action: "add",
      }),
    });
    if (!j.ok) {
      toast(j.error || "shelf full or join failed");
      return false;
    }
    shelfWin.data.chips = (j.bin && j.bin.chips) || shelfWin.data.chips || [];
    volWin.data.shelf = shelfWin.data.id;
    volWin._onShelf = shelfWin.data.id;
    volWin.open = false;
    // leave office floor · membership is shelf now
    volWin._officePlace = false;
    volWin._officeScale = null;
    if (volWin.data.prop) {
      delete volWin.data.prop.place;
      delete volWin.data.prop.roomX;
      delete volWin.data.prop.roomY;
      delete volWin.data.prop.officeScale;
    }
    if (volWin.el) {
      volWin.el.classList.remove("is-office-floor");
      volWin.el.style.transform = "";
      volWin.el.style.transformOrigin = "";
      volWin.el.style.zIndex = "";
    }
    if (shelfWin.open === false) await renderShelfClosed(shelfWin);
    else await renderShelfOpen(shelfWin);
    await persistPose({}, volWin);
    await persistPose({}, shelfWin);
    const kind = isDeckBin(volWin) ? "box" : "book";
    toast(
      "on shelf · " + kind + " · " + (volWin.data.title || volWin.data.id)
    );
    return true;
  }

  async function placeBookOnShelf(bookWin, shelfWin) {
    return placeVolumeOnShelf(bookWin, shelfWin);
  }

  async function takeBookOffShelf(bookId, shelfWin, clientX, clientY) {
    if (!shelfWin || !isShelfBin(shelfWin)) return null;
    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: shelfWin.data.id,
        book_id: bookId,
        leaf_id: bookId,
        action: "remove",
      }),
    });
    if (!j.ok) {
      toast(j.error || "could not take volume");
      return null;
    }
    shelfWin.data.chips = (j.bin && j.bin.chips) || [];
    let bw = boardWinById(bookId);
    if (!bw) {
      const bj = await api("/api/bins");
      const row = ((bj && bj.surface) || []).find(
        (r) => r.bin && (r.bin.id === bookId || r.bin.uid === bookId)
      );
      if (row) bw = await mountBoard(row.bin, row.config);
    }
    if (bw && bw.el) {
      bw.data.shelf = null;
      bw._onShelf = null;
      clearShelfVolumeVisual(bw);
      bw.el.style.display = "";
      bw.el.removeAttribute("aria-hidden");
      bw.open = false;
      if (isDeckBin(bw)) await renderDeckClosed(bw);
      else if (isBookBin(bw)) await renderBookClosed(bw);
      // office mode: land on the floor, not into the desk pocket
      if (placeMode === "room" && roomEl) {
        pullOutToOfficeFloor(
          bw,
          clientX != null ? clientX : null,
          clientY != null ? clientY : null
        );
        await persistOfficeFlags(bw);
      } else {
        if (bw.el.parentElement !== felt) felt.appendChild(bw.el);
        const fr = felt.getBoundingClientRect();
        if (clientX != null) {
          bw.el.style.left = Math.max(8, clientX - fr.left - 40) + "px";
          bw.el.style.top = Math.max(8, clientY - fr.top - 40) + "px";
        } else {
          const sr = shelfWin.el.getBoundingClientRect();
          bw.el.style.left = Math.max(8, sr.right - fr.left + 12) + "px";
          bw.el.style.top = Math.max(8, sr.top - fr.top) + "px";
        }
        await persistPose({}, bw);
      }
      bringFront(bw.el);
      setFocus(bw);
    }
    if (shelfWin.open === false) await renderShelfClosed(shelfWin);
    else await renderShelfOpen(shelfWin);
    await persistPose({}, shelfWin);
    toast("off shelf · " + ((bw && bw.data && bw.data.title) || bookId));
    return bw;
  }

  /** Spine stub take (legacy rail) — pull closed volume onto felt. */
  function wireShelfSpineTake(sp, sw) {
    if (!sp || !sw) return;
    sp.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      try {
        ev.preventDefault();
      } catch (_) {}
      const bid = sp.getAttribute("data-shelf-book");
      if (!bid) return;
      const sx = ev.clientX;
      const sy = ev.clientY;
      let armed = true;
      let busy = false;
      function cleanup() {
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("pointercancel", onUp, true);
      }
      async function pull(e, dragAfter) {
        if (!armed || busy) return;
        busy = true;
        armed = false;
        cleanup();
        const bw = await takeBookOffShelf(bid, sw, e.clientX, e.clientY);
        if (bw && dragAfter) {
          try {
            startDrag(bw, e, null, { requireThreshold: false });
          } catch (_) {}
        }
      }
      function onMove(e) {
        if (!armed || busy) return;
        if (Math.hypot(e.clientX - sx, e.clientY - sy) >= 6) pull(e, true);
      }
      function onUp(e) {
        if (!armed || busy) {
          cleanup();
          return;
        }
        pull(e, false);
      }
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
    });
  }

  function wireShelfMoveHandles(sw) {
    if (!sw || !sw.el) return;
    sw.el.querySelectorAll("[data-shelf-drag]").forEach((handle) => {
      handle.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest("[data-shelf-book], button, input")) return;
        ev.stopPropagation();
        // wood/caption: drag immediately (no threshold) so shelf always moves
        startDrag(sw, ev, null, { requireThreshold: false });
      });
    });
  }

  async function renderShelfClosed(sw) {
    if (!sw || !isShelfBin(sw)) return;
    sw.open = false;
    const el = sw.el;
    const shelf = sw.data;
    const chips = shelf.chips || [];
    el.className = "nb-win is-closed kind-shelf kind-board";
    el.style.width = (sw._lastClosedW || 300) + "px";
    el.style.height = (sw._lastClosedH || 148) + "px";
    // Legacy rail: spine stubs only (membership real; face is temporary)
    let spines = "";
    chips.forEach((bid, i) => {
      const m = bookMetaById(bid);
      const deckCls = m.kind === "deck" ? " is-deck" : "";
      spines +=
        '<span class="shelf-spine cloth-' +
        esc(m.cloth || (m.kind === "deck" ? "cork" : "oxblood")) +
        deckCls +
        '" data-shelf-book="' +
        esc(bid) +
        '" data-spine-i="' +
        i +
        '" title="' +
        esc(m.title) +
        (m.kind === "deck" ? " · env" : " · book") +
        ' · drag off · stays closed" role="button" tabindex="0"></span>';
    });
    if (!chips.length) {
      spines =
        '<span class="shelf-empty-spines">empty · drop books or boxes</span>';
    }
    el.innerHTML =
      '<div class="shelf-face" data-bin-drop data-shelf-drop>' +
      '<div class="shelf-ledge">' +
      '<div class="shelf-plank">' +
      spines +
      "</div>" +
      '<div class="shelf-wood" data-shelf-drag title="drag shelf"></div>' +
      "</div>" +
      '<div class="shelf-caption" data-shelf-drag title="drag shelf · dblclick open">' +
      '<span class="shelf-face-title"></span>' +
      '<span class="shelf-face-meta"></span>' +
      "</div></div>";
    el.querySelector(".shelf-face-title").textContent =
      shelf.title || "bookshelf";
    el.querySelector(".shelf-face-meta").textContent =
      chips.length +
      " volume" +
      (chips.length === 1 ? "" : "s") +
      " · drag wood to move";
    wireShelfMoveHandles(sw);
    el.querySelectorAll("[data-shelf-drag]").forEach((handle) => {
      handle.addEventListener("dblclick", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        renderShelfOpen(sw);
      });
    });
    el.querySelectorAll("[data-shelf-book]").forEach((sp) => {
      wireShelfSpineTake(sp, sw);
    });
    el.addEventListener("mousedown", () => {
      bringFront(el);
      setFocus(sw);
    });
    hideShelvedVolumes(sw);
    await persistPose({}, sw);
  }

  async function renderShelfOpen(sw) {
    if (!sw || !isShelfBin(sw)) return;
    sw.open = true;
    const el = sw.el;
    const shelf = sw.data;
    const chips = shelf.chips || [];
    const ow = sw._lastOpenW || 340;
    const oh = sw._lastOpenH || 280;
    el.className = "nb-win is-open kind-shelf kind-board";
    el.style.width = ow + "px";
    el.style.height = oh + "px";
    let spineRow = "";
    chips.forEach((bid) => {
      const m = bookMetaById(bid);
      const deckCls = m.kind === "deck" ? " is-deck" : "";
      spineRow +=
        '<span class="shelf-spine cloth-' +
        esc(m.cloth || (m.kind === "deck" ? "cork" : "oxblood")) +
        deckCls +
        '" data-shelf-book="' +
        esc(bid) +
        '" title="' +
        esc(m.title) +
        '" role="button" tabindex="0"></span>';
    });
    if (!spineRow) {
      spineRow =
        '<span class="shelf-empty-spines">no volumes · drop on the ledge</span>';
    }
    let rows = "";
    chips.forEach((bid) => {
      const m = bookMetaById(bid);
      const unit = m.kind === "deck" ? " cards" : "p";
      rows +=
        '<div class="shelf-book-row">' +
        '<span class="shelf-book-spine cloth-' +
        esc(m.cloth || (m.kind === "deck" ? "cork" : "oxblood")) +
        (m.kind === "deck" ? " is-deck" : "") +
        '"></span>' +
        '<div class="shelf-book-body">' +
        '<div class="shelf-book-t">' +
        esc(m.title) +
        "</div>" +
        '<div class="shelf-face-meta">' +
        esc(m.id) +
        " · " +
        m.pages +
        unit +
        (m.kind === "deck" ? " · env" : "") +
        "</div></div>" +
        '<button type="button" class="folder-sheet-out" data-shelf-out="' +
        esc(bid) +
        '">take</button></div>';
    });
    el.innerHTML =
      '<div class="shelf-open" data-bin-drop data-shelf-drop>' +
      '<div class="shelf-head" data-shelf-drag>' +
      '<span class="shelf-title-in" data-field="title" title="MIRA: edit name …"></span>' +
      '<button type="button" class="j-band-btn" data-act="fold" title="close shelf">fold</button>' +
      "</div>" +
      '<div class="shelf-ledge shelf-ledge-open">' +
      '<div class="shelf-plank">' +
      spineRow +
      "</div>" +
      '<div class="shelf-wood" data-shelf-drag title="drag shelf"></div>' +
      "</div>" +
      '<div class="shelf-plank-open">' +
      (rows ||
        '<div class="folder-empty">drop books or boxes on the closed shelf</div>') +
      "</div>" +
      '<div class="folder-hint">legacy rail · drag wood to move · take or drag spine off</div>' +
      '<div class="nb-resize" data-resize></div></div>';
    paintFaceMetaEl(el, shelf.title, shelf.author);
    sw.paintFaceMeta = function () {
      paintFaceMetaEl(sw.el, sw.data.title, sw.data.author);
    };
    const fold = el.querySelector('[data-act="fold"]');
    if (fold) {
      fold.onclick = (ev) => {
        ev.stopPropagation();
        renderShelfClosed(sw);
      };
    }
    el.querySelectorAll("[data-shelf-out]").forEach((btn) => {
      btn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const bid = btn.getAttribute("data-shelf-out");
        await takeBookOffShelf(bid, sw, ev.clientX, ev.clientY);
      };
    });
    el.querySelectorAll("[data-shelf-book]").forEach((sp) => {
      wireShelfSpineTake(sp, sw);
    });
    wireShelfMoveHandles(sw);
    const rz = el.querySelector("[data-resize]");
    if (rz) {
      rz.addEventListener("pointerdown", (ev) => startResize(sw, ev));
    }
    el.addEventListener("mousedown", () => {
      bringFront(el);
      setFocus(sw);
    });
    hideShelvedVolumes(sw);
    await persistPose({}, sw);
  }

  /**
   * Leaf face date · always includes year (2013 vs 2025 matter for imports / life).
   * Locales often hide year for "this year" — we force it on purpose.
   */
  function formatLeafWhen(ts) {
    const n = parseInt(ts, 10);
    if (!n) return "";
    try {
      const d = new Date(n * 1000);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  }

  /** Quiet footer/rail: id · chars · DRAFT · OT-001.T01.B000 · date with year */
  function leafStatusLine(leaf) {
    if (!leaf) return "";
    const prop = leaf.prop || {};
    const body = leaf.body != null ? leaf.body : leaf.text || "";
    const bits = [];
    const id = leaf.id || leaf.uid || "";
    if (id) bits.push(id);
    bits.push(String(body).length + "c");
    const mark = String(
      prop["Mark.type"] || prop["Mark.label"] || ""
    ).trim();
    const markKlass = String(prop["Mark.class"] || "stamp").toLowerCase();
    if (
      (prop.isMarked === true ||
        prop.isMarked === "yes" ||
        prop.isMarked === "true") &&
      mark &&
      markKlass !== "cite" &&
      markKlass !== "chip" &&
      !/\.[TB]\d/i.test(mark)
    ) {
      bits.push(mark.toUpperCase());
    }
    let cite = String(prop["Cite.code"] || "").trim();
    if (!cite && Array.isArray(leaf.cites) && leaf.cites.length) {
      cite = String(leaf.cites[leaf.cites.length - 1]);
    }
    if (cite) bits.push(cite);
    else if (Array.isArray(leaf.cites) && leaf.cites.length > 1) {
      bits.push(leaf.cites.length + " cites");
    }
    (Array.isArray(leaf.tags) ? leaf.tags : [])
      .map(function (t) {
        return String(t || "").trim();
      })
      .filter(function (t) {
        return (
          t &&
          !/^(mail|hermes|inbox-held|mailed-out|shipped-instance|casestreet|import)$/i.test(
            t
          )
        );
      })
      .forEach(function (t) {
        bits.push(t);
      });
    // mail letters: show when *sent* (created), not when taken out of the box
    // imports: born (tps_created) on face; event = desk import moment (pin)
    const tags = Array.isArray(leaf.tags) ? leaf.tags : [];
    const isMail = tags.some((t) => /^(mail|hermes|inbox-held)$/i.test(String(t)));
    const isImport =
      tags.some((t) => /^import$/i.test(String(t))) ||
      !!(leaf["Import.source"] || (leaf.prop && leaf.prop["Import.source"]));
    const faceTs = isMail || isImport
      ? leaf.created || leaf.updated
      : leaf.updated || leaf.created;
    const when = formatLeafWhen(faceTs);
    if (when) bits.push(when);
    if (isImport && leaf.event && Number(leaf.event) !== Number(leaf.created)) {
      const ev = formatLeafWhen(leaf.event);
      if (ev) bits.push("in " + ev);
    }
    return bits.join(" · ");
  }

  async function loadBookPageLeaf(lid) {
    try {
      const j = await api("/api/leaf/" + encodeURIComponent(lid));
      if (j.ok && j.leaf) return j.leaf;
    } catch (_) {}
    return null;
  }

  async function renderBookOpen(bw) {
    if (!bw || !isBookBin(bw)) return;
    bw.open = true;
    const el = bw.el;
    const book = bw.data;
    const chips = book.chips || [];
    const cloth = book.cloth || "oxblood";
    if (bw.pageIdx == null) bw.pageIdx = 0;
    if (chips.length === 0) bw.pageIdx = 0;
    else {
      if (bw.pageIdx < 0) bw.pageIdx = 0;
      if (bw.pageIdx >= chips.length) bw.pageIdx = chips.length - 1;
    }
    const i = chips.length ? bw.pageIdx : -1;
    const lid = i >= 0 ? chips[i] : null;
    const pageLeaf = lid ? await loadBookPageLeaf(lid) : null;
    const pageTitle = pageLeaf
      ? pageLeaf.title || pageLeaf.name || lid
      : "";
    const pageBody = pageLeaf ? pageLeaf.body || pageLeaf.text || "" : "";
    const pagePaper = (pageLeaf && (pageLeaf.paper || pageLeaf.style)) || "lined";
    await ensureDressupCss(pagePaper);

    // restore open size if we were closed small
    const ow = bw._lastOpenW || 520;
    const oh = bw._lastOpenH || 400;
    if (parseInt(el.style.width, 10) < 200) {
      el.style.width = ow + "px";
      el.style.height = oh + "px";
    }
    bw._lastOpenW = parseInt(el.style.width, 10) || ow;
    bw._lastOpenH = parseInt(el.style.height, 10) || oh;

    el.className = "nb-win is-open kind-book kind-board";
    el.innerHTML =
      '<div class="j-cover cloth-' +
      esc(cloth) +
      '" data-drag-chrome data-bin-drop>' +
      '<div class="j-cover-band">' +
      '<div class="j-band-row j-band-row-title">' +
      '<span class="j-cover-id" data-book-uid title="living uid"></span>' +
      '<span class="j-cover-title" data-field="title" title="MIRA: edit name …"></span>' +
      '<button type="button" class="j-band-btn j-band-fold" data-act="fold" title="close book">fold</button>' +
      "</div>" +
      '<div class="j-band-row j-band-row-tools">' +
      '<div class="j-band-group" title="pages">' +
      '<button type="button" class="j-band-btn" data-act="prev" title="previous">‹</button>' +
      '<span class="j-page-ind" data-page-ind></span>' +
      '<button type="button" class="j-band-btn" data-act="next" title="next">›</button>' +
      "</div>" +
      '<div class="j-band-group j-band-group-book" title="cloth dress">' +
      '<select class="j-band-select" data-field="cloth" title="cloth · also: Mira dress up oxblood">' +
      BOOK_CLOTHS.map(function (c) {
        return (
          '<option value="' +
          c +
          '"' +
          (c === cloth ? " selected" : "") +
          ">" +
          c +
          "</option>"
        );
      }).join("") +
      "</select>" +
      '<span class="j-page-ind" style="min-width:auto;padding:0 0.25rem">drag leaves in</span>' +
      "</div></div></div>" +
      '<div class="j-cover-well">' +
      '<aside class="j-toc" aria-label="Contents">' +
      '<div class="j-toc-h">Contents</div>' +
      '<div class="j-toc-list" data-book-toc></div>' +
      '<div class="j-toc-byline">' +
      '<span class="j-toc-by-lab">by</span>' +
      '<span class="j-toc-author" data-field="author" title="MIRA: edit by …"></span>' +
      "</div></aside>" +
      '<article class="rx-paper j-leaf" data-paper="' +
      esc(pagePaper) +
      '">' +
      '<div class="rx-paper-inner">' +
      '<div class="rx-paper-rail">' +
      '<span class="rx-paper-title" data-page-title></span>' +
      '<span class="rx-paper-kind" data-page-kind></span>' +
      "</div>" +
      '<div class="rx-paper-preview pn-page-body-md" data-paper-preview></div>' +
      '<div class="rx-paper-status" data-book-page-status></div>' +
      "</div></article></div>" +
      '<div class="nb-resize" data-resize></div></div>';

    paintFaceMetaEl(el, book.title, book.author);
    const uidEl = el.querySelector("[data-book-uid]");
    if (uidEl) {
      uidEl.textContent = book.uid || book.id || book.face_id || "";
    }
    bw.paintFaceMeta = function () {
      paintFaceMetaEl(bw.el, bw.data.title, bw.data.author);
      const u = bw.el.querySelector("[data-book-uid]");
      if (u) {
        u.textContent =
          (bw.data && (bw.data.uid || bw.data.id || bw.data.face_id)) || "";
      }
    };

    const ind = el.querySelector("[data-page-ind]");
    if (ind) {
      ind.textContent = chips.length
        ? i + 1 + "/" + chips.length
        : "0/0";
    }
    const pt = el.querySelector("[data-page-title]");
    const pk = el.querySelector("[data-page-kind]");
    if (pt) pt.textContent = pageTitle || (chips.length ? "…" : "empty book");
    if (pk) {
      pk.textContent = chips.length
        ? "PAGE " + (i + 1) + " / " + chips.length
        : "no pages";
    }
    paintPaper(el, pageBody);
    // book pages: scars live on the status rail (positioning in the well is fussy)
    const st = el.querySelector("[data-book-page-status]");
    if (st) {
      if (pageLeaf) {
        st.textContent = leafStatusLine(
          Object.assign({}, pageLeaf, { body: pageBody, id: lid || pageLeaf.id })
        );
      } else {
        st.textContent = "drop leaves onto the book · they become pages";
      }
    }
    // still paint ticket/stamp if the page paper can hold them (bonus, not required)
    if (pageLeaf && lid) {
      const fake = {
        kind: "leaf",
        el: el,
        data: Object.assign({}, pageLeaf, {
          id: lid,
          body: pageBody,
          prop: pageLeaf.prop || {},
        }),
      };
      try {
        paintLeafStampPrint(fake);
      } catch (_) {}
    }

    await fillBookTocList(bw);

    const foldBtn = el.querySelector('[data-act="fold"]');
    if (foldBtn) {
      foldBtn.onclick = (ev) => {
        ev.stopPropagation();
        renderBookClosed(bw).catch(function (err) {
          toast(
            "book fold failed · " + (err && err.message ? err.message : err)
          );
        });
      };
    }
    const prevBtn = el.querySelector('[data-act="prev"]');
    if (prevBtn) {
      prevBtn.onclick = async (ev) => {
        ev.stopPropagation();
        if (!chips.length) return;
        bw.pageIdx = (bw.pageIdx - 1 + chips.length) % chips.length;
        await renderBookOpen(bw);
      };
    }
    const nextBtn = el.querySelector('[data-act="next"]');
    if (nextBtn) {
      nextBtn.onclick = async (ev) => {
        ev.stopPropagation();
        if (!chips.length) return;
        bw.pageIdx = (bw.pageIdx + 1) % chips.length;
        await renderBookOpen(bw);
      };
    }
    const clothSel = el.querySelector("[data-field=cloth]");
    if (clothSel) {
      clothSel.addEventListener("change", async () => {
        bw.data.cloth = clothSel.value || "oxblood";
        bw.data.shell = "bookbox";
        const cover = el.querySelector(".j-cover");
        if (cover) {
          cover.className = "j-cover cloth-" + bw.data.cloth;
        }
        // auto-save dressup (was only toast before store kept cloth)
        await persistPose({}, bw);
        toast("cloth · " + bw.data.cloth);
      });
      clothSel.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    }

    el.onmousedown = () => {
      bringFront(el);
      setFocus(bw);
    };
    // drag from cover band / plate — not from page body or toc list
    function wireBookDragHandle(node) {
      if (!node || node._bookDragWired) return;
      node._bookDragWired = true;
      node.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (
          ev.target.closest(
            "button, select, .nb-resize, .j-toc-item, .j-toc-list, .j-leaf, .rx-paper-preview"
          )
        )
          return;
        if (isEditableFaceTarget(ev.target)) return;
        startDrag(bw, ev);
      });
    }
    wireBookDragHandle(el.querySelector("[data-drag-chrome]"));
    wireBookDragHandle(el.querySelector(".j-cover-band"));
    wireBookDragHandle(el.querySelector(".j-band-row-title"));
    const rz = el.querySelector("[data-resize]");
    if (rz) {
      rz.addEventListener("pointerdown", (ev) => startResize(bw, ev));
    }
    // open rewrite wipes is-office-floor · restore so floor pointer-events work
    restoreOfficeFloorPresentation(bw);
    bringFront(el);
    setFocus(bw);
    await persistPose({}, bw);
  }

  async function fillBookTocList(bw) {
    const toc = bw.el && bw.el.querySelector("[data-book-toc]");
    if (!toc) return;
    const chips = bw.data.chips || [];
    toc.innerHTML = "";
    if (!chips.length) {
      toc.innerHTML =
        '<div class="book-toc-empty" style="color:rgba(200,180,150,0.55);padding:0.5rem;font-size:0.75rem">drag leaves in</div>';
      return;
    }
    for (let i = 0; i < chips.length; i++) {
      const lid = chips[i];
      const row = document.createElement("div");
      row.className =
        "j-toc-item" + (i === bw.pageIdx ? " is-on" : "");
      row.draggable = true;
      row.dataset.leafId = lid;
      row.dataset.idx = String(i);
      const title = await leafTitleForId(lid);
      row.innerHTML =
        '<span class="j-toc-n">' +
        (i + 1) +
        "</span>" +
        '<span class="j-toc-t"></span>' +
        '<button type="button" class="j-band-btn" data-act="out" title="pull out to desk">↗</button>';
      row.querySelector(".j-toc-t").textContent = title;
      row.addEventListener("click", async (ev) => {
        if (ev.target.closest("[data-act=out]")) return;
        ev.stopPropagation();
        bw.pageIdx = i;
        await renderBookOpen(bw);
      });
      row.querySelector("[data-act=out]").onclick = async (ev) => {
        ev.stopPropagation();
        await pullLeafFromBook(bw, lid);
      };
      row.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", String(i));
        ev.dataTransfer.effectAllowed = "move";
        row.classList.add("is-dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("is-dragging"));
      row.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        row.classList.add("is-drag-over");
      });
      row.addEventListener("dragleave", () =>
        row.classList.remove("is-drag-over")
      );
      row.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        row.classList.remove("is-drag-over");
        const from = parseInt(ev.dataTransfer.getData("text/plain"), 10);
        const to = i;
        if (!isNaN(from) && from !== to) await reorderBookChip(bw, from, to);
      });
      toc.appendChild(row);
    }
  }

  /** Apply config.prop to board face (isTardis → pocket scroll vs clip). */
  function applyBoardProp(bw) {
    if (!bw || !bw.el) return;
    const prop = bw.data.prop || {};
    const pocket = bw.el.querySelector("[data-board-pocket]");
    if (!pocket) return;
    const tardis = !!prop.isTardis;
    pocket.classList.toggle("is-tardis", tardis);
    pocket.classList.toggle("is-surface-fit", !tardis);
  }

  async function saveBoard(w, opts) {
    opts = opts || {};
    if (!w || w.kind !== "board") return false;
    // face labels are display-only — title/author live on w.data (MIRA: name / by)
    const st =
      w.data.subtype ||
      w.data.bin_type ||
      (isBookBin(w)
        ? "book"
        : isShelfBin(w)
          ? "shelf"
          : isDeckBin(w)
            ? "deck"
            : "board");
    const j = await api("/api/bin/save", {
      method: "POST",
      body: JSON.stringify({
        bin: {
          id: w.data.id,
          uid: w.data.id,
          title:
            w.data.title ||
            (isBookBin(w)
              ? "untitled book"
              : isDeckBin(w)
                ? "untitled deck"
                : "untitled board"),
          author: w.data.author || "unknown",
          chips: w.data.chips || [],
          subtype: st,
          class: isBookBin(w)
            ? "book"
            : isShelfBin(w)
              ? "shelf"
              : isDeckBin(w)
                ? "deck"
                : w.data.class || "box",
        },
      }),
    });
    if (!j.ok) {
      toast(j.error || "bin save fail");
      return false;
    }
    w.data = Object.assign({}, w.data, j.bin || {});
    if (typeof w.paintFaceMeta === "function") w.paintFaceMeta();
    else paintFaceMetaEl(w.el, w.data.title, w.data.author);
    refreshBoardMeta(w);
    if (isDeckBin(w)) repaintDeckMemberCards(w);
    if (isBookBin(w) && w.open !== false) await renderBookOpen(w);
    await persistPose({}, w);
    if (!opts.quiet)
      toast(
        "saved · " +
          (isBookBin(w)
            ? "book"
            : isDeckBin(w)
              ? "deck"
              : isShelfBin(w)
                ? "shelf"
                : "board") +
          " · " +
          (j.file || w.data.id)
      );
    return true;
  }

  async function leafTitleForId(lid) {
    try {
      const j = await api("/api/leaf/" + encodeURIComponent(lid));
      if (j.ok && j.leaf)
        return j.leaf.title || j.leaf.name || lid;
    } catch (e) {
      /* quiet */
    }
    return lid;
  }

  /** keep name for callers; open book refreshes TOC + page pane */
  async function renderBookToc(bw) {
    if (!bw || !isBookBin(bw)) return;
    if (bw.open === false) await renderBookClosed(bw);
    else await renderBookOpen(bw);
  }

  async function reorderBookChip(bw, fromIdx, toIdx) {
    if (!bw || !isBookBin(bw)) return;
    const chips = (bw.data.chips || []).slice();
    if (fromIdx < 0 || fromIdx >= chips.length) return;
    if (toIdx < 0 || toIdx >= chips.length) return;
    const [item] = chips.splice(fromIdx, 1);
    chips.splice(toIdx, 0, item);
    bw.data.chips = chips;
    if (bw.pageIdx === fromIdx) bw.pageIdx = toIdx;
    else if (fromIdx < bw.pageIdx && toIdx >= bw.pageIdx) bw.pageIdx--;
    else if (fromIdx > bw.pageIdx && toIdx <= bw.pageIdx) bw.pageIdx++;
    await saveBoard(bw, { quiet: true });
    toast("TOC · reordered");
  }

  async function openBookPage(bw, lid) {
    if (!bw || !isBookBin(bw)) return;
    const chips = bw.data.chips || [];
    const idx = chips.indexOf(lid);
    if (idx < 0) {
      toast("page not in book");
      return;
    }
    bw.pageIdx = idx;
    if (bw.open === false) await renderBookOpen(bw);
    else await renderBookOpen(bw);
  }

  async function pullLeafFromBook(bw, lid) {
    const j = await api("/api/bin/member", {
      method: "POST",
      body: JSON.stringify({
        bin_id: bw.data.id,
        leaf_id: lid,
        action: "remove",
      }),
    });
    if (j.ok && j.bin) {
      bw.data.chips = j.bin.chips || [];
    } else if (!j.ok) {
      toast(j.error || "pull failed");
      return;
    }
    let lw = wins.get(String(lid));
    if (!lw) {
      const lj = await api("/api/leaf/" + encodeURIComponent(lid));
      if (lj.ok && lj.leaf) {
        await ensureDressupCss(lj.leaf.paper || lj.leaf.style || "lined");
        lw = mountLeaf(lj.leaf, lj.config, { skipPosePersist: true });
      }
    }
    if (lw && lw.el) {
      lw.data.bin = null;
      lw._inBin = null;
      lw.el.style.display = "";
      felt.appendChild(lw.el);
      setLeafInBoardScale(lw, false);
      const fr = felt.getBoundingClientRect();
      const br = bw.el.getBoundingClientRect();
      lw.el.style.left = Math.max(8, br.right - fr.left + 12) + "px";
      lw.el.style.top = Math.max(8, br.top - fr.top + 24) + "px";
      if (!lw.open) await renderOpen(lw, {});
      setFocus(lw);
      bringFront(lw.el);
      await persistPose({}, lw);
    }
    if (bw.pageIdx >= (bw.data.chips || []).length) {
      bw.pageIdx = Math.max(0, (bw.data.chips || []).length - 1);
    }
    if (bw.open === false) await renderBookClosed(bw);
    else await renderBookOpen(bw);
    toast("pulled out · " + lid);
  }

  async function mountBoard(bin, config, opts) {
    opts = opts || {};
    const uid = String(bin.uid || bin.id);
    if (wins.has(uid)) {
      const existing = wins.get(uid);
      // re-home if we filed it (DOM removed) or mail take left an orphan win
      if (
        !existing.el ||
        !existing.el.parentElement ||
        (felt && existing.el.parentElement !== felt)
      ) {
        try {
          if (existing.el && existing.el.parentElement) {
            existing.el.parentElement.removeChild(existing.el);
          }
        } catch (_) {}
        wins.delete(uid);
        // fall through to full mount
      } else {
        existing.data = Object.assign({}, existing.data, bin);
        // re-apply instance prop (Station.desk etc) — bin matter has no prop
        if (config && config.prop) {
          existing.data.prop = Object.assign(
            {},
            existing.data.prop || {},
            config.prop
          );
        }
        if (config && config.config && config.config.id) {
          existing.data.config_id = config.config.id;
        }
        if (isBookBin(existing)) {
          if (existing.open === false) await renderBookClosed(existing);
          else await renderBookOpen(existing);
        } else if (isShelfBin(existing)) {
          if (existing.open === false) await renderShelfClosed(existing);
          else await renderShelfOpen(existing);
        } else if (isDeckBin(existing)) {
          if (existing.open === false) await renderDeckClosed(existing);
          else await renderDeckOpen(existing);
          repaintDeckMemberCards(existing);
          paintEnvStation(existing);
        } else {
          refreshBoardMeta(existing);
          applyBoardTint(existing);
        }
        // apply pose from mail take / config if provided
        const pose0 = (config && (config.pose || config.pos)) || {};
        if (pose0.x != null) existing.el.style.left = Number(pose0.x) + "px";
        if (pose0.y != null) existing.el.style.top = Number(pose0.y) + "px";
        bringFront(existing.el);
        setFocus(existing);
        if (opts.persistPose !== false) {
          try {
            await persistPose({}, existing);
          } catch (_) {}
        }
        return existing;
      }
    }
    const st0 = String(bin.subtype || bin.bin_type || bin.class || "").toLowerCase();
    const book =
      st0 === "book" ||
      String(bin.class || "").toLowerCase() === "book" ||
      /^book\[/i.test(uid);
    const shelf =
      st0 === "shelf" ||
      String(bin.class || "").toLowerCase() === "shelf" ||
      /^shelf\[/i.test(uid);
    // manila parcel (envelope) OR true card deck — same face kit for now
    // CRITICAL: envelope[n] + type envelope must not fall through as cork board
    const deck =
      st0 === "deck" ||
      st0 === "envelope" ||
      String(bin.class || "").toLowerCase() === "deck" ||
      String(bin.class || "").toLowerCase() === "envelope" ||
      /^deck\[/i.test(uid) ||
      /^envelope\[/i.test(uid);
    const isCardDeckOnly =
      deck &&
      st0 === "deck" &&
      /^deck\[/i.test(uid) &&
      !/^envelope\[/i.test(uid);
    const w = {
      kind: "board", // all bins share drop/membership path
      data: bin,
      el: document.createElement("div"),
      open: true,
      pageIdx: 0,
      termEl: null,
    };
    if (book) {
      w.data.subtype = "book";
      w.data.bin_type = "book";
      w.data.class = "book";
      w.data.cloth = w.data.cloth || "oxblood";
    }
    if (shelf) {
      w.data.subtype = "shelf";
      w.data.bin_type = "shelf";
      w.data.class = "shelf";
    }
    if (deck) {
      // living type · envelope holds leaf+card · deck holds cards only
      const living = isCardDeckOnly ? "deck" : "envelope";
      w.data.subtype = living;
      w.data.bin_type = living;
      w.data.class = living;
      w.data.package_id = "envelope"; // face kit · marketplace/chips/envelope/
    }
    const trash = isTrashBin({
      data: {
        tags: bin.tags,
        title: bin.title || bin.name,
        name: bin.name,
        prop: (config && config.prop) || bin.prop || {},
      },
    });
    if (deck && !trash) {
      w.data.cloth = w.data.cloth || w.data.color || "cork";
      w.data.shell = w.data.shell || "envelopebox";
    }
    if (trash) {
      w.data.shell = "trashcan";
      w.data.face = "bin";
      w.data.style = "bin";
      w.data.dressup = Object.assign({}, w.data.dressup || {}, {
        face: "bin",
        style: "bin",
        shell: "trashcan",
      });
    }
    wins.set(uid, w);
    win = w;
    felt.appendChild(w.el);
    w.el.className =
      "nb-win is-open kind-board" +
      (book ? " kind-book" : "") +
      (shelf ? " kind-shelf" : "") +
      (deck ? " kind-deck" : "") +
      (trash ? " kind-trash" : "");
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;

    const pose = (config && (config.pose || config.pos)) || {};
    const ow =
      pose.openW || (book ? 520 : shelf ? 320 : trash ? TRASH_FACE_W : deck ? 280 : 420);
    const oh =
      pose.openH || (book ? 400 : shelf ? 168 : trash ? TRASH_FACE_H : deck ? 340 : 520);
    w._lastOpenW = ow;
    w._lastOpenH = oh;
    // decks start closed unless pose.open
    let deckStartOpen = false;
    if (deck) {
      if (pose.open === true || pose.open === "yes" || pose.open === 1)
        deckStartOpen = true;
      w.open = deckStartOpen;
      const closedW = trash ? TRASH_FACE_W : 148;
      const closedH = trash ? TRASH_FACE_H : 108;
      w.el.style.width = (deckStartOpen ? ow : closedW) + "px";
      w.el.style.height = (deckStartOpen ? oh : closedH) + "px";
    } else {
      w.el.style.width = ow + "px";
      w.el.style.height = oh + "px";
    }
    // clamp onto felt — layout migration / wide desks can park boards at x:2000+
    const frB = felt.getBoundingClientRect();
    let bx = pose.x != null ? Number(pose.x) : 80;
    let by = pose.y != null ? Number(pose.y) : 80;
    const clampClosedW = trash ? TRASH_FACE_W : 148;
    const clampClosedH = trash ? TRASH_FACE_H : 108;
    const clampW =
      deck && !deckStartOpen ? clampClosedW : Math.min(ow, frB.width || ow);
    const clampH =
      deck && !deckStartOpen ? clampClosedH : Math.min(oh, frB.height || oh);
    if (frB.width > 0) {
      bx = Math.max(8, Math.min(bx, Math.max(8, frB.width - clampW - 8)));
      by = Math.max(8, Math.min(by, Math.max(8, frB.height - clampH - 8)));
    }
    w.el.style.left = bx + "px";
    w.el.style.top = by + "px";
    if (config && config.dressup) {
      w.data.shell =
        config.dressup.shell ||
        (book
          ? "bookbox"
          : shelf
            ? "bookshelf"
            : trash
              ? "trashcan"
              : deck
                ? "deckbox"
                : "boardbox");
      w.data.style = trash ? "bin" : config.dressup.style || "plain";
      w.data.face = trash
        ? "bin"
        : config.dressup.face || config.dressup.style || "plain";
      w.data.color = trash ? "" : config.dressup.color || "";
      w.data.face_id = config.dressup.id || "";
      if (!trash && config.dressup.cloth) w.data.cloth = config.dressup.cloth;
      else if (!trash && !book && !shelf && config.dressup.color)
        w.data.cloth = config.dressup.color;
    }
    if (!book && !shelf && !trash && !w.data.cloth)
      w.data.cloth = w.data.color || "cork";
    if (trash) {
      w.data.shell = "trashcan";
      w.data.face = "bin";
      w.data.style = "bin";
      w.data.dressup = Object.assign({}, w.data.dressup || {}, {
        face: "bin",
        style: "bin",
        shell: "trashcan",
      });
    }
    if (config && config.config && config.config.id) {
      w.data.config_id = config.config.id;
    }
    if (config && config.prop) {
      w.data.prop = config.prop;
      // cork default 10 leaked onto old manila parcels (bible bits)
      if (
        isEnvelopeBin(w) &&
        Number(w.data.prop.maxLoad) <= 10 &&
        !w.data.prop.isTrash
      ) {
        w.data.prop.maxLoad = 80;
      }
      if (isTrashBin(w)) w.data.prop.maxLoad = 0;
    } else {
      // envelope (manila) · leaf+card · true card deck · cards only
      const stRaw = String(
        (bin && (bin.bin_type || bin.subtype)) ||
          (w.data && (w.data.bin_type || w.data.subtype)) ||
          ""
      ).toLowerCase();
      // legacy deck[n] without type, or explicit envelope → manila accepts
      const manila = deck && stRaw !== "deck";
      w.data.prop = {
        isTardis: false,
        // manila parcels · room for refiling (bible bits etc); not the old 10-chip thrash
        maxLoad: book ? 40 : shelf ? 24 : deck ? 80 : 10,
        ...(deck
          ? {
              accepts:
                manila || stRaw === "envelope" || !stRaw
                  ? ["card", "leaf"]
                  : ["card"],
            }
          : {}),
      };
    }
    if (book) {
      // restore folded state from pos.open (yes/no)
      let startOpen = true;
      if (pose.open === false || pose.open === "no" || pose.open === 0) {
        startOpen = false;
      } else if (pose.open === true || pose.open === "yes" || pose.open === 1) {
        startOpen = true;
      }
      w.open = startOpen;
      if (startOpen) renderBookOpen(w);
      else renderBookClosed(w);
      return w;
    }
    if (shelf) {
      let startOpen = false;
      if (pose.open === true || pose.open === "yes" || pose.open === 1) {
        startOpen = true;
      }
      w.open = startOpen;
      if (startOpen) renderShelfOpen(w);
      else renderShelfClosed(w);
      return w;
    }

    // —— envelope: store face · closed manila / open list pop ——
    if (deck) {
      if (trash) {
        w.el.innerHTML = trashFaceHtml();
        try {
          await wearFaceSheet(w, "envelope", "bin");
        } catch (_) {}
      } else {
      try {
        await ensureToolKit("envelope", "envelope.kit");
        const dressCache = Date.now();
        await ensureToolCss(
          "envelope",
          "dressups/face/_base.dsc",
          "envelope:face-base:" + dressCache
        );
        const face =
          (config &&
            config.dressup &&
            (config.dressup.face || config.dressup.style)) ||
          "plain";
        await ensureToolCss(
          "envelope",
          "dressups/face/" + face + ".dsc",
          "envelope:face-" + face + ":" + dressCache
        );
        const setHtml = await fetchToolFile("envelope", "envelope.set");
        if (setHtml) w.el.innerHTML = setHtml;
      } catch (_) {}
      // always use face shell that has closed envelope only (legacy open chrome stays hidden)
      if (!w.el.querySelector("[data-deck-face]") || !w.el.querySelector(".env-flap")) {
        w.el.innerHTML =
          '<div class="deck-face" data-tool="envelope" data-deck-face data-bin-drop>' +
          '<div class="deck-closed" data-deck-closed data-drag-chrome data-bin-drop role="button" tabindex="0">' +
          '<span class="env-flap" aria-hidden="true"></span>' +
          '<span class="env-body">' +
          '<span class="env-station-band" data-env-station-band aria-hidden="true"></span>' +
          '<span class="env-label">' +
          '<span class="deck-closed-kind" data-field="uid">envelope</span>' +
          '<span class="deck-closed-title" data-field="title"></span>' +
          '<span class="deck-closed-count" data-deck-count></span></span>' +
          '<span class="deck-closed-hint">open</span></span></div>' +
          '<div class="deck-open" data-deck-open hidden aria-hidden="true"></div></div>';
      }
      }
      // ensure uid chrome even on older cached envelope.set
      if (
        !trash &&
        w.el.querySelector(".env-label") &&
        !w.el.querySelector("[data-field=uid]")
      ) {
        const kind = w.el.querySelector(".deck-closed-kind");
        if (kind) kind.setAttribute("data-field", "uid");
      }
      // station stripe band must exist even when package set is partial
      if (
        w.el.querySelector(".env-body") &&
        !w.el.querySelector(".env-station-band")
      ) {
        const body = w.el.querySelector(".env-body");
        const band = document.createElement("span");
        band.className = "env-station-band";
        band.setAttribute("data-env-station-band", "1");
        band.setAttribute("aria-hidden", "true");
        body.insertBefore(band, body.firstChild);
      }
      // legacy in-face list must never show
      const legacyOpen = w.el.querySelector("[data-deck-open]");
      if (legacyOpen) {
        legacyOpen.hidden = true;
        legacyOpen.setAttribute("aria-hidden", "true");
        legacyOpen.innerHTML = "";
      }
      w.data.title = bin.title || bin.name || "";
      w.data.author = normalizeAuthor(bin.author || bin.auth);
      w.paintFaceMeta = function () {
        if (isTrashBin(w)) {
          refreshBoardMeta(w);
          return;
        }
        const id = w.data.uid || w.data.id || "";
        paintFaceMetaEl(w.el, w.data.title, w.data.author, id);
        const tEls = w.el.querySelectorAll("[data-field=title]");
        tEls.forEach((el) => {
          el.textContent = w.data.title || "";
        });
        const uEls = w.el.querySelectorAll("[data-field=uid]");
        uEls.forEach((el) => {
          el.textContent = id || "envelope";
        });
      };
      w.paintFaceMeta();
      wireDeckChrome(w);
      w.el.onmousedown = () => {
        bringFront(w.el);
        setFocus(w);
      };
      if (deckStartOpen) await renderDeckOpen(w);
      else await renderDeckClosed(w);
      const dimpl =
        window.PocketTools &&
        (window.PocketTools.get("envelope") || window.PocketTools.get("deck"));
      if (!trash && dimpl && dimpl.mount) dimpl.mount(w);
      else if (!trash && dimpl && dimpl.paint) dimpl.paint(w);
      // Station.desk from config must paint after mount (kit alone is not enough)
      if (!trash) paintEnvStation(w);
      bringFront(w.el);
      setFocus(w);
      if (opts.persistPose !== false) {
        try {
          await persistPose({}, w);
        } catch (_) {}
      }
      return w;
    }

    // —— cork board (default) ——
    const tint0 = boardTintOf(w);
    w.el.innerHTML =
      '<div class="board-box tint-' +
      esc(tint0) +
      '" data-drag-chrome data-bin-drop>' +
      '<div class="board-head">' +
      '<span class="board-title" data-field="title" title="MIRA: edit name …"></span>' +
      '<select class="board-tint-sel" data-field="cloth" title="board tint · also: Mira dress up slate">' +
      BOARD_TINTS.map(function (c) {
        return (
          '<option value="' +
          c +
          '"' +
          (c === tint0 ? " selected" : "") +
          ">" +
          c +
          "</option>"
        );
      }).join("") +
      "</select>" +
      '<span class="board-kind">board</span>' +
      "</div>" +
      '<div class="board-byline">' +
      '<span class="rx-paper-by">by</span>' +
      '<span class="board-author" data-field="author" title="MIRA: edit by …"></span>' +
      "</div>" +
      '<div class="board-meta" data-board-meta></div>' +
      '<div class="board-pocket" data-board-pocket></div>' +
      '<div class="nb-resize" data-resize></div>' +
      "</div>";

    w.data.title = bin.title || bin.name || "";
    w.data.author = normalizeAuthor(bin.author || bin.auth);
    w.paintFaceMeta = function () {
      paintFaceMetaEl(w.el, w.data.title, w.data.author);
    };
    w.paintFaceMeta();
    refreshBoardMeta(w);
    applyBoardProp(w);
    applyBoardTint(w);
    const tintSel = w.el.querySelector("[data-field=cloth]");
    if (tintSel) {
      tintSel.addEventListener("change", async (ev) => {
        ev.stopPropagation();
        const v = String(tintSel.value || "cork").toLowerCase();
        w.data.cloth = BOARD_TINTS.indexOf(v) >= 0 ? v : "cork";
        w.data.color = w.data.cloth;
        applyBoardTint(w);
        await persistPose({}, w);
        toast("board · " + w.data.cloth);
      });
      tintSel.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      tintSel.addEventListener("mousedown", (ev) => ev.stopPropagation());
    }

    w.el.onmousedown = () => {
      bringFront(w.el);
      setFocus(w);
    };
    const chrome = w.el.querySelector("[data-drag-chrome]");
    if (chrome) {
      chrome.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        if (
          ev.target.closest(
            "button, .nb-resize, .nb-win.kind-leaf, .nb-win.kind-card, .nb-win.kind-key, .nb-win.kind-tool, .kind-leaf, .kind-card, .kind-key, .kind-tool"
          )
        )
          return;
        if (isEditableFaceTarget(ev.target)) return;
        // held tool dropped onto board → into pocket (same as papers)
        if (
          heldToolWin &&
          heldToolWin.kind === "tool" &&
          heldToolWin !== w
        ) {
          ev.preventDefault();
          ev.stopPropagation();
          placeToolInBoard(heldToolWin, w, ev.clientX, ev.clientY);
          return;
        }
        startDrag(w, ev);
      });
    }
    const rz = w.el.querySelector("[data-resize]");
    if (rz) {
      rz.addEventListener("pointerdown", (ev) => {
        if (
          ev.target.closest(
            ".kind-leaf, .kind-card, .kind-key, .kind-tool, .nb-win.kind-leaf, .nb-win.kind-card, .nb-win.kind-key, .nb-win.kind-tool"
          )
        )
          return;
        startResize(w, ev);
      });
    }
    bringFront(w.el);
    setFocus(w);
    return w;
  }

  /** package folder uid — exact name, no alias strip */
  function resolvePackageId(name) {
    const n = String(name || "")
      .trim()
      .toLowerCase();
    return n || "stamper";
  }

  async function fetchToolFile(packageId, relPath) {
    const pid = resolvePackageId(packageId);
    const j = await api(
      "/api/tool/package/" +
        encodeURIComponent(pid) +
        "/" +
        relPath
          .split("/")
          .map(encodeURIComponent)
          .join("/")
    );
    if (!j.ok) return null;
    return j.text;
  }

  async function ensureToolCss(packageId, relPath, cacheKey) {
    const key = cacheKey || packageId + ":" + relPath;
    if (loadedToolCss.has(key)) return true;
    const text = await fetchToolFile(packageId, relPath);
    if (text == null) return false;
    const style = document.createElement("style");
    style.setAttribute("data-tool-css", key);
    style.textContent = text;
    document.head.appendChild(style);
    loadedToolCss.add(key);
    return true;
  }

  async function ensureToolKit(packageId, kitName) {
    const kit = kitName || packageId + ".kit" || "stamper.kit";
    const key = packageId + ":" + kit;
    if (loadedToolKits.has(key)) return true;
    const text = await fetchToolFile(packageId, kit);
    if (text == null) return false;
    try {
      // eslint-disable-next-line no-new-func
      new Function(text)();
    } catch (e) {
      console.warn("tool kit load", e);
      return false;
    }
    loadedToolKits.add(key);
    return true;
  }

  /** kits (karaoke) may persist prop without a full pose rewrite */
  window.pocketPersistToolProp = async function (w, propPatch) {
    if (!w || !w.data) return;
    w.data.prop = Object.assign({}, w.data.prop || {}, propPatch || {});
    try {
      await api("/api/tool/pose", {
        method: "POST",
        body: JSON.stringify({
          id: w.data.uid || w.data.id,
          pose: {
            x: parseFloat(w.el.style.left) || 48,
            y: parseFloat(w.el.style.top) || 48,
            openW: w._lastOpenW,
            openH: w._lastOpenH,
          },
          dressup: w.data.dressup,
          prop: w.data.prop,
        }),
      });
    } catch (e) {
      console.warn("tool prop persist", e);
    }
  };
  // kits call toast() if present
  window.toast = toast;

  /**
   * Two independent scars on a leaf:
   *   · rubber stamp  → Mark.*  (.leaf-stamp-print)
   *   · tree cite     → Cite.*  (.leaf-cite-print)
   * They must not overwrite each other.
   */
  function paintLeafStampPrint(lw) {
    if (!lw || !lw.el || lw.kind !== "leaf") return;
    const paper = lw.el.querySelector(".rx-paper");
    if (!paper) return;
    const prop = (lw.data && lw.data.prop) || {};

    // --- rubber stamp (DRAFT / URGENT / …) ---
    let stampEl = paper.querySelector(".leaf-stamp-print");
    const stamped =
      prop.isMarked === true ||
      prop.isMarked === "yes" ||
      prop.isMarked === "true";
    // Ignore cite-class pollution left by older chipper versions
    const markKlass = String(prop["Mark.class"] || "stamp").toLowerCase();
    const markWord = String(
      prop["Mark.type"] || prop["Mark.label"] || prop.Mark_label || ""
    ).trim();
    const looksLikeCite =
      markKlass === "cite" ||
      markKlass === "chip" ||
      /\.[TB]\d/i.test(markWord);
    if (stamped && markWord && !looksLikeCite) {
      if (!stampEl) {
        stampEl = document.createElement("div");
        stampEl.className = "leaf-stamp-print";
        paper.appendChild(stampEl);
      }
      const style = prop["Mark.style"] || prop.Mark_style || "classic";
      stampEl.dataset.markStyle = style;
      stampEl.textContent = markWord.toUpperCase();
      const px = prop["Mark.pos.x"];
      const py = prop["Mark.pos.y"];
      if (px != null && py != null && px !== "" && py !== "") {
        stampEl.style.left = Number(px) + "%";
        stampEl.style.top = Number(py) + "%";
        stampEl.style.right = "auto";
        stampEl.classList.add("is-placed");
      } else {
        stampEl.style.left = "";
        stampEl.style.top = "";
        stampEl.style.right = "";
        stampEl.classList.remove("is-placed");
      }
    } else if (stampEl) {
      stampEl.remove();
    }

    // --- cite ticket · trunk face (OT-001.T01 · ×n); pin.cites holds every B-line ---
    let citeEl = paper.querySelector(".leaf-cite-print");
    // migrate older chipper scars that wrote the code into Mark.type
    let citeCode = String(prop["Cite.code"] || "").trim();
    if (!citeCode && looksLikeCite && markWord) citeCode = markWord;
    // multi-cite: trunk face from pin.cites (not a second Glass.face field)
    const citesArr = Array.isArray(lw.data && lw.data.cites)
      ? lw.data.cites
      : [];
    if (citesArr.length) {
      const trunks = [];
      const seenT = {};
      citesArr.forEach((c) => {
        const raw = String(c || "").trim();
        if (!raw) return;
        const tr = raw
          .replace(/\.L\d+.*$/i, "")
          .replace(/\.B\d+.*$/i, "");
        // bare OT-001 → OT-001.T01
        const trunk = /\.T\d/i.test(tr)
          ? tr
          : /^[A-Za-z]{1,6}-\d+/i.test(tr)
            ? tr.replace(/^([A-Za-z]{1,6}-\d+)/i, (_, a) => a.toUpperCase()) +
              (/T\d/i.test(tr) ? "" : ".T01")
            : tr;
        const norm = trunk.match(/^([A-Za-z]+)-(\d+)/i)
          ? trunk.replace(
              /^([A-Za-z]+)-(\d+)(\.T(\d+))?/i,
              (_, t, n, _tt, tn) =>
                t.toUpperCase() +
                "-" +
                String(n).padStart(3, "0") +
                ".T" +
                String(tn != null ? tn : 1).padStart(2, "0")
            )
          : trunk;
        if (!seenT[norm.toLowerCase()]) {
          seenT[norm.toLowerCase()] = true;
          trunks.push(norm);
        }
      });
      if (trunks.length === 1) {
        citeCode =
          citesArr.length === 1
            ? trunks[0]
            : trunks[0] + " · ×" + citesArr.length;
      } else if (trunks.length === 2) {
        citeCode = trunks[0] + " · " + trunks[1];
      } else if (trunks.length > 2) {
        citeCode = trunks[0] + " · +" + (trunks.length - 1);
      }
    }
    const cited =
      prop.isCited === true ||
      prop.isCited === "yes" ||
      prop.isCited === "true" ||
      !!citeCode ||
      citesArr.length > 0;
    if (cited && citeCode) {
      if (!citeEl) {
        citeEl = document.createElement("div");
        citeEl.className = "leaf-stamp-print leaf-cite-print";
        paper.appendChild(citeEl);
      }
      const cstyle = prop["Cite.style"] || "ticket";
      citeEl.dataset.markStyle = cstyle;
      citeEl.textContent = citeCode; // trunk face · keep case
      const nCite = citesArr.length;
      citeEl.title =
        nCite > 1
          ? nCite + " cites · " + citesArr.join(" · ")
          : prop["Cite.branch"] || citesArr[0] || citeCode;
      const cx = prop["Cite.pos.x"];
      const cy = prop["Cite.pos.y"];
      if (cx != null && cy != null && cx !== "" && cy !== "") {
        citeEl.style.left = Number(cx) + "%";
        citeEl.style.top = Number(cy) + "%";
        citeEl.style.right = "auto";
        citeEl.classList.add("is-placed");
      } else {
        // default opposite corner from classic stamp so both show
        citeEl.style.left = "";
        citeEl.style.top = "";
        citeEl.style.right = "";
        citeEl.classList.remove("is-placed");
        citeEl.classList.add("is-cite-default");
      }
    } else if (citeEl) {
      citeEl.remove();
    }
  }

  function toolPackageId(w) {
    return resolvePackageId(
      (w && w.data && (w.data.package_id || w.data.subtype)) || "stamper"
    );
  }

  function extractCiteFromText(raw) {
    const impl = window.PocketTools && window.PocketTools.get("chipper");
    if (impl && impl.extractCite) return impl.extractCite(raw) || "";
    const s = String(raw || "").trim();
    const re =
      /\b([A-Za-z]{1,6}-\d{1,4}(?:\.T\d{1,3})?(?:\.B\d{1,5})?(?:\.L\d{1,3})?)\b/g;
    let best = "";
    let m;
    while ((m = re.exec(s))) {
      const cand = m[1];
      if (cand.includes(".B") || cand.includes(".T") || cand.length > best.length)
        best = cand;
    }
    return best;
  }

  /** Load clipboard into chipper plate (clipboard → Mark.type). */
  async function loadChipperFromClipboard(w) {
    if (!w || !w.data) return null;
    let text = "";
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (e) {
      text = "";
    }
    const cite = extractCiteFromText(text);
    if (!cite) {
      toast("chipper empty · copy OT-001.T01.B000 from Nim first");
      return null;
    }
    w.data.prop = Object.assign({}, w.data.prop || {}, {
      canMark: true,
      "Mark.class": "cite",
      "Mark.type": cite,
      "Mark.label": cite,
      "Cite.code": cite,
      "Mark.style":
        (w.data.dressup && w.data.dressup.mark) ||
        (w.data.prop && w.data.prop["Mark.style"]) ||
        "ticket",
    });
    const lab =
      w.el &&
      (w.el.querySelector("[data-stamp-label]") ||
        w.el.querySelector(".tool-chipper-label"));
    if (lab) lab.textContent = cite;
    const meta = w.el && w.el.querySelector("[data-stamp-meta]");
    if (meta) meta.textContent = "chipper · loaded";
    try {
      await api("/api/tool/pose", {
        method: "POST",
        body: JSON.stringify({
          id: w.data.uid || w.data.id,
          prop: {
            canMark: true,
            "Mark.class": "cite",
            "Mark.type": cite,
            "Cite.code": cite,
          },
          dressup: {
            id: w.data.uid || w.data.id,
            tool: (w.data.dressup && w.data.dressup.tool) || "ink",
            mark: (w.data.dressup && w.data.dressup.mark) || "ticket",
          },
          pose: {
            x: parseFloat(w.el.style.left) || 0,
            y: parseFloat(w.el.style.top) || 0,
            openW: w._lastOpenW,
            openH: w._lastOpenH,
          },
        }),
      });
    } catch (e) {
      /* pose optional */
    }
    return cite;
  }

  /** Clear held-chase chrome (rotate/scale) so tools never stick mid-air */
  function clearHeldToolChrome(w) {
    if (!w || !w.el) return;
    w._held = false;
    w.el.classList.remove("is-held");
    w.el.style.pointerEvents = "";
    w.el.style.filter = "";
    w.el.style.opacity = "";
    // kill any leftover transform on face (held dress rotates body)
    w.el.querySelectorAll(".tool-stamper-body, .tool-chipper-body, .tool-face").forEach(
      (node) => {
        if (node && node.style) node.style.transform = "";
      }
    );
  }

  /** Pick up tool — chases pointer until put down on felt */
  async function pickUpTool(w) {
    if (!w || w.kind !== "tool" || !w.el) return;
    // release any other stuck stamp first
    if (heldToolWin && heldToolWin !== w) {
      clearHeldToolChrome(heldToolWin);
      heldToolWin = null;
    }
    // also free any tool DOM still wearing is-held without a handle
    wins.forEach((other) => {
      if (
        other &&
        other.kind === "tool" &&
        other !== w &&
        other.el &&
        other.el.classList.contains("is-held")
      ) {
        clearHeldToolChrome(other);
      }
    });
    heldToolWin = w;
    activeToolWin = w;
    w._held = true;
    w._heldAt = Date.now();
    w.el.classList.add("is-held");
    bringFront(w.el);
    setFocus(w);
    // snap under hand now
    chaseToolToPointer(w, lastFeltPtr.x, lastFeltPtr.y);
    const pkg = toolPackageId(w);
    if (pkg === "chipper") {
      const cite = await loadChipperFromClipboard(w);
      toast(
        cite
          ? "chipper · " + cite + " · click paper · Esc/desk to set down"
          : "chipper empty · copy a ZIP · Esc to set down"
      );
    } else if (pkg === "eraser") {
      toast("eraser · click paper to wipe · Esc/desk to set down");
    } else {
      toast("stamper · click paper to mark · Esc/desk to set down");
    }
  }

  async function putDownTool(w, feltX, feltY) {
    if (!w || !w.el) return;
    clearHeldToolChrome(w);
    if (heldToolWin === w) heldToolWin = null;
    const fr = felt.getBoundingClientRect();
    // if released over a cork board → toolbox
    if (feltX != null && feltY != null) {
      const cx = fr.left + feltX;
      const cy = fr.top + feltY;
      const hit = hitBoardAtClient(cx, cy, w);
      if (
        hit &&
        !isShelfBin(hit) &&
        !isBookBin(hit) &&
        !isDeckBin(hit)
      ) {
        await placeToolInBoard(
          w,
          hit,
          fr.left + feltX,
          fr.top + feltY
        );
        return;
      }
    }
    const ww = w.el.offsetWidth || w._lastOpenW || 110;
    const hh = w.el.offsetHeight || w._lastOpenH || 120;
    let x = feltX != null ? feltX - ww / 2 : parseFloat(w.el.style.left) || 48;
    let y = feltY != null ? feltY - hh / 2 : parseFloat(w.el.style.top) || 48;
    x = Math.max(4, Math.min(x, fr.width - ww - 4));
    y = Math.max(4, Math.min(y, fr.height - hh - 4));
    w.el.style.left = x + "px";
    w.el.style.top = y + "px";
    try {
      await persistPose({}, w);
    } catch (_) {}
    const pkg = toolPackageId(w);
    toast(
      pkg === "chipper"
        ? "chipper down"
        : pkg === "eraser"
          ? "eraser down"
          : "stamper down"
    );
  }

  /** Center of the ink plate (where eyes aim) — falls back to tool center */
  function toolPlateClientCenter(w) {
    if (!w || !w.el) return null;
    const plate = w.el.querySelector(".tool-stamper-plate");
    if (plate) {
      const r = plate.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    const r = w.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
  }

  function chaseToolToPointer(w, feltX, feltY) {
    if (!w || !w.el) return;
    const fr = felt.getBoundingClientRect();
    const ww = w.el.offsetWidth || w._lastOpenW || 110;
    const hh = w.el.offsetHeight || w._lastOpenH || 120;
    // park tool so plate center sits under the hand (not geometric center)
    const plate = w.el.querySelector(".tool-stamper-plate");
    let ox = ww / 2;
    let oy = hh * 0.55;
    if (plate) {
      const er = w.el.getBoundingClientRect();
      const pr = plate.getBoundingClientRect();
      ox = pr.left + pr.width / 2 - er.left;
      oy = pr.top + pr.height / 2 - er.top;
    }
    let x = feltX - ox;
    let y = feltY - oy;
    x = Math.max(-ww / 3, Math.min(x, fr.width - ww / 2));
    y = Math.max(-hh / 3, Math.min(y, fr.height - hh / 2));
    w.el.style.left = x + "px";
    w.el.style.top = y + "px";
  }

  /** Stamp from plate center (or pointer) → percent coords inside leaf paper */
  function markPosFromPointer(leafWin, clientX, clientY) {
    const paper =
      (leafWin.el && leafWin.el.querySelector(".rx-paper")) || leafWin.el;
    if (!paper) return { x: 50, y: 40 };
    // prefer plate aim point when stamper is held
    let cx = clientX;
    let cy = clientY;
    if (heldToolWin) {
      const pc = toolPlateClientCenter(heldToolWin);
      if (pc) {
        cx = pc.x;
        cy = pc.y;
      }
    }
    const r = paper.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { x: 50, y: 40 };
    let x = ((cx - r.left) / r.width) * 100;
    let y = ((cy - r.top) / r.height) * 100;
    x = Math.max(4, Math.min(96, Math.round(x * 10) / 10));
    y = Math.max(4, Math.min(96, Math.round(y * 10) / 10));
    return { x: x, y: y };
  }

  function paintInboxFace(w) {
    if (!w || !w.el) return;
    const prop = w.data.prop || {};
    const addrEl = w.el.querySelector("[data-inbox-address]");
    const addr = prop["Receive.address"] || prop.address || "—";
    if (addrEl) addrEl.textContent = String(addr);
    const flag = w.el.querySelector("[data-inbox-mail]");
    if (flag) {
      const mail = prop["Receive.mail"];
      const n = Array.isArray(mail) ? mail.length : 0;
      const got =
        prop["Receive.hasMail"] === true ||
        prop["Receive.hasMail"] === "yes" ||
        n > 0;
      if (got) {
        flag.removeAttribute("hidden");
        flag.textContent = n > 0 ? "MAIL · " + n : "MAIL";
      } else {
        flag.setAttribute("hidden", "");
        flag.textContent = "MAIL";
      }
    }
    const countEl = w.el.querySelector("[data-inbox-count]");
    if (countEl) {
      const mail = prop["Receive.mail"];
      const n = Array.isArray(mail) ? mail.length : 0;
      countEl.textContent = n ? String(n) : "0";
    }
  }

  function isFaxTool(tw) {
    if (!tw || tw.kind !== "tool" || !tw.data) return false;
    const prop = tw.data.prop || {};
    const uid = String(tw.data.uid || tw.data.id || "").toLowerCase();
    return (
      tw.data.package_id === "fax" ||
      tw.subtype === "fax" ||
      uid.indexOf("fax") >= 0 ||
      prop.canFax === true ||
      prop.canFax === "yes" ||
      prop["canFax"] === true
    );
  }

  /** Hit-test Chester's Imports fax under the pointer. */
  function hitFaxAtClient(clientX, clientY, skipWin) {
    let best = null;
    let bestZ = -1;
    wins.forEach((tw) => {
      if (!tw || !tw.el || !isFaxTool(tw)) return;
      if (skipWin && (tw === skipWin || tw.el === skipWin.el)) return;
      if (tw.el.style.display === "none") return;
      const r = tw.el.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        const z = parseInt(tw.el.style.zIndex || "0", 10) || 0;
        if (z >= bestZ) {
          bestZ = z;
          best = tw;
        }
      }
    });
    return best;
  }

  function paintFaxFace(w) {
    if (!w || !w.el) return;
    const prop = w.data && w.data.prop ? w.data.prop : {};
    const label =
      prop["Fax.destLabel"] || prop["Fax.dest"] || "Port QXA";
    const el = w.el.querySelector("[data-fax-dest]");
    if (el) el.textContent = String(label);
    const impl = window.PocketTools && window.PocketTools.get("fax");
    if (impl && impl.paint) impl.paint(w);
  }

  async function cycleFaxDestination(w) {
    if (!w || !isFaxTool(w)) return;
    let dests = [];
    try {
      const j = await api("/api/fax/destinations");
      if (j.ok && Array.isArray(j.destinations)) dests = j.destinations;
    } catch (_) {}
    if (!dests.length) {
      dests = [
        {
          id: "port-qxa",
          label: "Port QXA",
          path: "C:\\ALICE_REBORN\\PORT-QXA\\docks",
        },
      ];
    }
    const prop = Object.assign({}, w.data.prop || {});
    const cur = String(prop["Fax.dest"] || dests[0].id).toLowerCase();
    let i = dests.findIndex((d) => String(d.id).toLowerCase() === cur);
    if (i < 0) i = 0;
    const next = dests[(i + 1) % dests.length];
    prop["Fax.dest"] = next.id;
    prop["Fax.destLabel"] = next.label;
    prop["Fax.destPath"] = next.path;
    prop.canFax = true;
    w.data.prop = prop;
    paintFaxFace(w);
    try {
      await api("/api/tool/pose", {
        method: "POST",
        body: JSON.stringify({
          uid: w.data.uid || w.data.id,
          prop: prop,
        }),
      });
    } catch (_) {}
    toast("fax → " + next.label);
  }
  window.cycleFaxDestination = cycleFaxDestination;

  /** Copy leaf/card as clean MD to fax destination docks (desk original stays). */
  async function faxItemToDestination(itemWin, faxWin) {
    if (!itemWin || !itemWin.data || !faxWin || !faxWin.data) return false;
    if (itemWin.kind !== "leaf" && itemWin.kind !== "card") return false;
    const lid = itemWin.data.id || itemWin.data.uid;
    const prop = faxWin.data.prop || {};
    const dest = prop["Fax.dest"] || "port-qxa";
    const j = await api("/api/fax/send", {
      method: "POST",
      body: JSON.stringify({
        item_id: lid,
        leaf_id: lid,
        dest: dest,
      }),
    });
    if (!j.ok) {
      toast(j.error || "fax failed");
      return false;
    }
    toast(
      "faxed · " +
        (j.title || lid) +
        " → " +
        (j.dest_label || dest) +
        " · " +
        (j.file || "ok")
    );
    // flash hint
    const hint = faxWin.el && faxWin.el.querySelector("[data-fax-hint]");
    if (hint) {
      const prev = hint.textContent;
      hint.textContent = "sent";
      setTimeout(function () {
        if (hint) hint.textContent = prev || "drop paper";
      }, 900);
    }
    return true;
  }

  /** Hit-test inbox tools (mail bank / tray) under the pointer. */
  function hitInboxAtClient(clientX, clientY, skipWin) {
    let best = null;
    let bestZ = -1;
    wins.forEach((tw) => {
      if (!tw || tw.kind !== "tool" || !tw.el) return;
      if (skipWin && (tw === skipWin || tw.el === skipWin.el)) return;
      const prop = tw.data && tw.data.prop;
      const isInb =
        tw.data.package_id === "inbox" ||
        tw.subtype === "inbox" ||
        (prop &&
          (prop.canReceive === true ||
            prop.canReceive === "yes" ||
            prop["canReceive"] === true));
      if (!isInb) return;
      if (tw.el.style.display === "none") return;
      const r = tw.el.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ) {
        const z = parseInt(tw.el.style.zIndex || "0", 10) || 0;
        if (z >= bestZ) {
          bestZ = z;
          best = tw;
        }
      }
    });
    return best;
  }

  async function refreshInboxToolFromApi(w) {
    if (!w || !w.data) return;
    const uid = String(w.data.uid || w.data.id || "").replace(/^tool-/, "");
    try {
      const j = await api("/api/mail/inboxes");
      if (!j.ok || !j.inboxes) return;
      const row = j.inboxes.find(
        (r) => String(r.uid || "").replace(/^tool-/, "") === uid
      );
      if (!row) return;
      w.data.prop = Object.assign({}, w.data.prop || {}, {
        "Receive.address": row.address,
        "Receive.hasMail": row.hasMail || (row.count || 0) > 0,
        "Receive.mail": row.mail || [],
      });
      paintInboxFace(w);
    } catch (_) {}
  }

  /** File leaf / card / envelope into the mailbox (held · off felt). */
  async function fileItemToInbox(itemWin, inboxWin) {
    if (!itemWin || !itemWin.data || !inboxWin || !inboxWin.data) return false;
    const kind = itemWin.kind;
    if (kind !== "leaf" && kind !== "card" && !isDeckBin(itemWin)) return false;
    const lid = itemWin.data.id || itemWin.data.uid;
    const iuid = inboxWin.data.uid || inboxWin.data.id;
    const j = await api("/api/mail/file", {
      method: "POST",
      body: JSON.stringify({
        item_id: lid,
        leaf_id: lid,
        uid: iuid,
        address:
          (inboxWin.data.prop && inboxWin.data.prop["Receive.address"]) || "",
      }),
    });
    if (!j.ok) {
      toast(j.error || "could not file mail");
      return false;
    }
    // remove from desk DOM — held in the box now (close envelope list if open)
    try {
      if (isDeckBin(itemWin)) removeDeckPop(itemWin);
    } catch (_) {}
    if (itemWin.el && itemWin.el.parentElement) {
      itemWin.el.parentElement.removeChild(itemWin.el);
    }
    wins.delete(String(lid));
    // also clear any alt key forms
    if (itemWin.data) {
      wins.delete(String(itemWin.data.uid || ""));
      wins.delete(String(itemWin.data.id || ""));
    }
    if (focusWin === itemWin) setFocus(null);
    await refreshInboxToolFromApi(inboxWin);
    const what =
      j.kind === "deck"
        ? "envelope · " +
          (j.title || lid) +
          (j.member_count != null ? " (" + j.member_count + " inside)" : "")
        : j.kind === "card"
          ? "card · " + (j.title || lid)
          : j.title || lid;
    const net = j.via === "girl-network" || j.ship === "instance";
    toast(
      (net ? "sent · off this desk · " : "shipped to box · ") +
        what +
        " → " +
        (j.address || "mail") +
        (net
          ? " · instance on their desk (yours kept in library)"
          : " · " + (j.mail_count || "?") + " waiting")
    );
    return true;
  }
  /** @deprecated use fileItemToInbox */
  async function fileLeafToInbox(lw, inboxWin) {
    return fileItemToInbox(lw, inboxWin);
  }

  let mailTrayEl = null;
  let mailTrayInboxUid = null;
  let mailTrayOpenSeq = 0;
  let lastMailOpenAt = 0;

  function closeMailTray() {
    // invalidate any in-flight open so a late /api/mail/list cannot re-append
    mailTrayOpenSeq += 1;
    // always nuke every tray node — async open races used to stack 5–7 shadows
    try {
      document.querySelectorAll(".rx-mail-tray").forEach((el) => {
        try {
          if (el.parentElement) el.parentElement.removeChild(el);
        } catch (_) {}
      });
    } catch (_) {}
    if (mailTrayEl && mailTrayEl.parentElement) {
      try {
        mailTrayEl.parentElement.removeChild(mailTrayEl);
      } catch (_) {}
    }
    mailTrayEl = null;
    mailTrayInboxUid = null;
  }

  async function takeMailLetter(inboxWin, leafId) {
    const t = await api("/api/mail/take", {
      method: "POST",
      body: JSON.stringify({ item_id: leafId, leaf_id: leafId }),
    });
    if (!t.ok) {
      toast(t.error || "could not take mail");
      return null;
    }
    await refreshInboxToolFromApi(inboxWin);
    const kind =
      t.kind || (t.leaf ? "leaf" : t.card ? "card" : t.bin ? "deck" : "leaf");
    if (kind === "leaf" && t.leaf) {
      await ensureDressupCss(t.leaf.paper || t.leaf.style || "lined");
      const lw = mountLeaf(t.leaf, t.config, { persistPose: true });
      if (lw) {
        setFocus(lw);
        toast("out of the box · " + (t.leaf.title || leafId));
      }
      return lw;
    }
    if (kind === "card" && t.card) {
      const cw = await mountCard(t.card, t.config, { persistPose: true });
      if (cw) {
        setFocus(cw);
        toast("out of the box · card · " + (t.card.title || leafId));
      }
      return cw;
    }
    if (kind === "deck" && t.bin) {
      // always remount envelope after mail — never trust a filed orphan win
      const duid = String(t.bin.uid || t.bin.id || leafId);
      if (wins.has(duid)) {
        const stale = wins.get(duid);
        try {
          if (stale.el && stale.el.parentElement) {
            stale.el.parentElement.removeChild(stale.el);
          }
        } catch (_) {}
        wins.delete(duid);
      }
      // park near the mailbox, not at old off-screen rail coords
      let placePose = { x: 72, y: 72, openW: 148, openH: 108, open: "no" };
      if (inboxWin && inboxWin.el) {
        try {
          const ir = inboxWin.el.getBoundingClientRect();
          const fr = felt.getBoundingClientRect();
          placePose.x = Math.max(8, ir.right - fr.left + 12);
          placePose.y = Math.max(8, ir.top - fr.top);
        } catch (_) {}
      }
      const cfg = Object.assign({}, t.config || {}, {
        pose: placePose,
        pos: placePose,
      });
      const bw = await mountBoard(t.bin, cfg, { persistPose: true });
      if (bw && bw.el) {
        if (!bw.el.parentElement && felt) felt.appendChild(bw.el);
        bw.el.style.left = placePose.x + "px";
        bw.el.style.top = placePose.y + "px";
        bw.el.style.width = "148px";
        bw.el.style.height = "108px";
        bringFront(bw.el);
        setFocus(bw);
        try {
          await persistPose({}, bw);
        } catch (_) {}
        const n =
          (t.members && t.members.length) ||
          (t.bin.chips && t.bin.chips.length) ||
          0;
        toast(
          "out of the box · envelope · " +
            (t.bin.title || leafId) +
            " · " +
            n +
            " inside"
        );
      } else {
        toast("envelope taken · refresh if you do not see it");
      }
      return bw;
    }
    toast("out of the box · " + leafId);
    return null;
  }

  /**
   * CASE STREET MAIL tray — look inside the banker box, pull one out, close.
   * Drop a leaf/card/envelope on the inbox face to file (see drag up).
   * One tray only; click again toggles closed; double-click does not stack.
   */
  async function openInboxMail(w) {
    if (!w || !w.data) return;
    const uid = String(w.data.uid || w.data.id || "");
    if (!uid) return;

    // swallow the second click of a double-click (would stack / toggle-close)
    const now = Date.now();
    if (now - lastMailOpenAt < 380) return;
    lastMailOpenAt = now;

    // already open for this box → close (intentional second click)
    if (mailTrayEl && mailTrayInboxUid === uid) {
      closeMailTray();
      return;
    }

    // clear any leftover trays without invalidating the seq we are about to claim
    try {
      document.querySelectorAll(".rx-mail-tray").forEach((el) => {
        try {
          if (el.parentElement) el.parentElement.removeChild(el);
        } catch (_) {}
      });
    } catch (_) {}
    mailTrayEl = null;
    mailTrayInboxUid = null;
    const seq = ++mailTrayOpenSeq;

    const j = await api("/api/mail/list", {
      method: "POST",
      body: JSON.stringify({ uid: uid }),
    });
    // a newer open/close won the race
    if (seq !== mailTrayOpenSeq) return;
    if (!j.ok) {
      toast(j.error || "mail list failed");
      return;
    }
    const items = j.mail || [];
    const addr = j.address || "mail";

    // refresh inbox face flag from list (hasMail can lag after file)
    try {
      w.data.prop = Object.assign({}, w.data.prop || {}, {
        "Receive.hasMail": !!(j.hasMail || items.length),
        "Receive.mail": (items || []).map((m) => m.id).filter(Boolean),
        "Receive.address": addr,
      });
      if (typeof paintInboxFace === "function") paintInboxFace(w);
    } catch (_) {}

    if (seq !== mailTrayOpenSeq) return;

    const tray = document.createElement("div");
    tray.className = "rx-mail-tray";
    tray.setAttribute("role", "dialog");
    tray.setAttribute("aria-label", "mail tray · " + addr);
    tray.dataset.inboxUid = uid;
    tray.innerHTML =
      '<div class="rx-mail-tray-chrome" data-drag-chrome>' +
      '<span class="rx-mail-tray-title">HERMES MAIL</span>' +
      '<span class="rx-mail-tray-addr">' +
      esc(addr) +
      "</span>" +
      '<button type="button" class="rx-mail-tray-x" data-mail-close title="close">×</button>' +
      "</div>" +
      '<p class="rx-mail-tray-hint">drop paper/card/envelope on the box · or ship via Hermes PARCEL · take out below</p>' +
      '<ul class="rx-mail-tray-list" data-mail-list></ul>' +
      (items.length
        ? ""
        : '<p class="rx-mail-tray-empty">empty box · nothing held yet</p>');

    const list = tray.querySelector("[data-mail-list]");
    items.forEach((m) => {
      const li = document.createElement("li");
      li.className = "rx-mail-tray-row";
      if (m.missing) li.classList.add("is-missing");
      li.innerHTML =
        '<span class="rx-mail-tray-row-title">' +
        esc(m.title || m.id || "?") +
        "</span>" +
        '<span class="rx-mail-tray-row-meta">' +
        esc(
          (m.kind ? m.kind + " · " : "") +
            (m.author || "") +
            (m.held === false ? " · out" : "") +
            (m.chars != null ? " · " + m.chars + "c" : "") +
            (m.members != null ? " · " + m.members + " inside" : "")
        ) +
        "</span>" +
        '<button type="button" class="rx-mail-tray-take" data-take="' +
        esc(m.id || "") +
        '">take</button>';
      list.appendChild(li);
    });

    // park near the inbox on the felt — only if still the latest open
    if (seq !== mailTrayOpenSeq) return;
    // remove any straggler nodes (do not bump seq — that would cancel us)
    try {
      document.querySelectorAll(".rx-mail-tray").forEach((el) => {
        try {
          if (el.parentElement) el.parentElement.removeChild(el);
        } catch (_) {}
      });
    } catch (_) {}
    const root = felt || document.body;
    root.appendChild(tray);
    mailTrayEl = tray;
    mailTrayInboxUid = uid;
    const ir = w.el.getBoundingClientRect();
    const fr = root.getBoundingClientRect();
    const scale =
      placeMode === "room" && felt && felt.classList.contains("is-desk-preview")
        ? getDeskPreviewScale() || 1
        : 1;
    let left = (ir.right - fr.left) / scale + 8;
    let top = (ir.top - fr.top) / scale;
    tray.style.left = Math.max(8, left) + "px";
    tray.style.top = Math.max(8, top) + "px";
    tray.style.zIndex = "80";

    tray.querySelector("[data-mail-close]").onclick = (ev) => {
      ev.stopPropagation();
      closeMailTray();
    };
    tray.querySelectorAll("[data-take]").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute("data-take");
        if (!id) return;
        const lw = await takeMailLetter(w, id);
        if (lw) closeMailTray();
      });
    });
    tray.addEventListener("pointerdown", (ev) => ev.stopPropagation());

    if (!items.length) {
      toast("empty · " + addr + " · drop a leaf on the box");
    } else {
      toast(addr + " · " + items.length + " held");
    }
  }

  async function pollInboxMailFlags() {
    try {
      const j = await api("/api/mail/inboxes");
      if (!j.ok || !j.inboxes) return;
      // limbo envelopes rescued on server — remount so they appear without full refresh
      if (Array.isArray(j.rescued) && j.rescued.length) {
        for (const id of j.rescued) {
          try {
            const bj = await api("/api/bin/" + encodeURIComponent(id));
            if (bj && bj.ok && bj.bin) {
              await mountBoard(bj.bin, bj.config || {}, { persistPose: true });
              toast("recovered envelope · " + (bj.bin.title || id));
            }
          } catch (_) {}
        }
      }
      j.inboxes.forEach((row) => {
        const uid = String(row.uid || "");
        let w = wins.get(uid);
        if (!w) {
          for (const [, win] of wins) {
            if (win.kind === "tool" && (win.data.uid === uid || win.data.id === uid)) {
              w = win;
              break;
            }
          }
        }
        if (!w || !w.data) return;
        w.data.prop = Object.assign({}, w.data.prop || {}, {
          "Receive.address": row.address,
          "Receive.hasMail": row.hasMail || (row.count || 0) > 0,
          "Receive.mail": row.mail || [],
        });
        paintInboxFace(w);
      });
    } catch (e) {
      /* quiet */
    }
  }

  async function mountTool(tool, config, opts) {
    opts = opts || {};
    const uid = String((tool && (tool.uid || tool.id)) || (config && config.uid) || "");
    if (!uid) return null;
    if (wins.has(uid)) {
      const ex = wins.get(uid);
      ex.data = Object.assign({}, ex.data, tool || {});
      if (config && config.prop) ex.data.prop = config.prop;
      setFocus(ex);
      return ex;
    }
    // package folder = marketplace/{editors|receivers}/<uid>
    // Prefer config.subtype (tool kind) over a stale dressup.package string.
    // Never default package to stamper when this is clearly an inbox/receiver
    const propHint =
      (config && config.prop) || (tool && tool.prop) || {};
    const looksInbox =
      String(uid).toLowerCase().indexOf("inbox") >= 0 ||
      propHint.canReceive === true ||
      propHint.canReceive === "yes" ||
      propHint["canReceive"] === true;
    // living uid prefix is law: chipper[0] → chipper (never trust stale subtype: stamper)
    const uidPkgMatch = String(uid).match(/^([a-zA-Z][\w]*)\[/);
    const uidPkg = uidPkgMatch ? resolvePackageId(uidPkgMatch[1]) : "";
    const subtype = resolvePackageId(
      uidPkg ||
        (tool && tool.subtype) ||
        (config && config.config && config.config.subtype) ||
        (config && config.package_id) ||
        (looksInbox ? "inbox" : "stamper")
    );
    let packageId = resolvePackageId(
      uidPkg ||
        (tool && tool.package_id) ||
        (config && config.package_id) ||
        (config && config.dressup && config.dressup.package) ||
        subtype
    );
    if (looksInbox) packageId = "inbox";
    if (uidPkg) packageId = uidPkg;
    // probe face file; if missing, fall back to subtype package
    let setHtml = (await fetchToolFile(packageId, packageId + ".set")) || "";
    if (!setHtml && packageId !== subtype) {
      packageId = subtype;
      setHtml = (await fetchToolFile(packageId, packageId + ".set")) || "";
    }
    // never wear a stamper face on an inbox
    if (
      packageId === "inbox" &&
      setHtml &&
      setHtml.indexOf("tool-stamper") >= 0
    ) {
      console.warn("inbox.set looked like stamper — refusing stamp face");
      setHtml = "";
    }
    if (!setHtml) {
      toast("package missing · " + packageId + "/" + packageId + ".set");
      console.warn("mountTool: no .set for", packageId);
    }
    await ensureToolKit(packageId, packageId + ".kit");
    // bust CSS cache keys so dress refresh after package edit is seen
    const dressCache = Date.now();
    await ensureToolCss(
      packageId,
      "dressups/tool/_base.dsc",
      packageId + ":tool-base:" + dressCache
    );
    const isReceiver =
      packageId === "inbox" ||
      looksInbox ||
      (config &&
        config.prop &&
        (config.prop.canReceive === true ||
          config.prop.canReceive === "yes" ||
          config.prop["canReceive"] === true));
    const isKaraoke =
      packageId === "karaoke" ||
      String(uid).toLowerCase().indexOf("karaoke") >= 0;
    const isFax =
      packageId === "fax" ||
      String(uid).toLowerCase().indexOf("fax") >= 0 ||
      (config &&
        config.prop &&
        (config.prop.canFax === true ||
          config.prop.canFax === "yes" ||
          config.prop["canFax"] === true));
    const dress =
      (config && config.dressup && (config.dressup.tool || config.dressup.style)) ||
      (tool && tool.dress) ||
      (isReceiver ? "plain" : isKaraoke ? "karaoke" : isFax ? "brass" : "brass");
    await ensureToolCss(
      packageId,
      "dressups/tool/" + dress + ".dsc",
      packageId + ":tool-" + dress + ":" + dressCache
    );
    const markStyle =
      (config && config.dressup && config.dressup.mark) ||
      (config && config.prop && config.prop["Mark.style"]) ||
      "classic";
    // mark dress only for rubber stamp / chipper — karaoke/fax have no mark plates
    if (!isReceiver && !isKaraoke && !isFax) {
      await ensureToolCss(
        packageId,
        "dressups/mark/" + markStyle + ".dsc",
        packageId + ":mark-" + markStyle
      );
    }

    const w = {
      kind: "tool",
      subtype: subtype,
      data: Object.assign(
        {
          id: uid,
          uid: uid,
          title: (tool && tool.title) || subtype,
          package_id: packageId,
          prop: (config && config.prop) || (tool && tool.prop) || {},
        },
        tool || {},
        {
          package_id: packageId,
          subtype: isReceiver ? "inbox" : isFax ? "fax" : subtype,
        }
      ),
      el: document.createElement("div"),
      open: true,
    };
    if (config && config.prop) w.data.prop = config.prop;
    wins.set(uid, w);
    felt.appendChild(w.el);
    w.el.className =
      "nb-win is-open kind-tool" +
      (isReceiver ? " kind-inbox" : "") +
      (isKaraoke ? " kind-karaoke" : "") +
      (isFax ? " kind-fax" : "");
    w.el.style.position = "absolute";
    w.el.dataset.uid = uid;
    const pose = (config && (config.pose || config.pos)) || {};
    const fr = felt.getBoundingClientRect();
    // stamp / tray / karaoke machine footprints (karaoke is wide, short)
    const ww =
      pose.openW != null
        ? Number(pose.openW)
        : isReceiver
          ? 148
          : isFax
            ? 128
            : isKaraoke
              ? 200
              : 110;
    const hh =
      pose.openH != null
        ? Number(pose.openH)
        : isReceiver
          ? 100
          : isFax
            ? 148
            : isKaraoke
              ? 118
              : 120;
    let px = pose.x != null ? Number(pose.x) : 120;
    let py = pose.y != null ? Number(pose.y) : 120;
    // clamp onto desk — stale pose can park the tool off-screen (e.g. x:2000+)
    if (fr.width > 0) {
      px = Math.max(8, Math.min(px, Math.max(8, fr.width - ww - 8)));
      py = Math.max(8, Math.min(py, Math.max(8, fr.height - hh - 8)));
    }
    w.el.style.left = px + "px";
    w.el.style.top = py + "px";
    w._lastOpenW = ww;
    w._lastOpenH = hh;
    w.el.style.width = ww + "px";
    w.el.style.height = hh + "px";

    const wrap = document.createElement("div");
    wrap.className = "tool-face";
    wrap.innerHTML = setHtml;
    w.el.appendChild(wrap);
    // karaoke (and future fidgets): corner resize to zoom
    if (isKaraoke) {
      const rz = document.createElement("div");
      rz.className = "nb-resize";
      rz.setAttribute("data-resize", "");
      rz.title = "drag to zoom";
      w.el.appendChild(rz);
      rz.addEventListener("pointerdown", (ev) => startResize(w, ev));
    }
    const st =
      wrap.querySelector("[data-tool=inbox]") ||
      wrap.querySelector("[data-tool=fax]") ||
      wrap.querySelector("[data-tool=karaoke]") ||
      wrap.querySelector("[data-tool=stamper]") ||
      wrap.firstElementChild;
    w.data.dress = dress;
    w.data.dressup = { id: uid, tool: dress, mark: markStyle };
    if (st) {
      st.setAttribute("data-tool-dress", dress);
      const lab = st.querySelector("[data-stamp-label]");
      const label =
        (w.data.prop &&
          (w.data.prop["Mark.type"] || w.data.prop["Mark.label"])) ||
        "urgent";
      if (lab) lab.textContent = String(label).toUpperCase();
      // inbox address face
      if (isReceiver || st.getAttribute("data-tool") === "inbox") {
        paintInboxFace(w);
        const impl0 = window.PocketTools && window.PocketTools.get("inbox");
        if (impl0 && impl0.paintAddress) impl0.paintAddress(w);
      }
      // Chester's fax · dest plate + drop target
      if (isFax || st.getAttribute("data-tool") === "fax") {
        paintFaxFace(w);
        const fimpl = window.PocketTools && window.PocketTools.get("fax");
        if (fimpl && fimpl.mount) fimpl.mount(w);
      }
      // karaoke pull machine · kit wires PULL / COPY
      if (isKaraoke || st.getAttribute("data-tool") === "karaoke") {
        const kimpl =
          window.PocketTools && window.PocketTools.get("karaoke");
        if (kimpl && kimpl.mount) kimpl.mount(w);
      }
    } else if (!setHtml) {
      // visible placeholder so a broken package is still grabbable + papers please
      wrap.innerHTML =
        '<div class="tool-missing" data-drag-chrome data-tool="' +
        packageId +
        '">' +
        "<div>missing</div><div>" +
        packageId +
        ".set</div></div>";
    }

    w.el.onmousedown = () => {
      bringFront(w.el);
      setFocus(w);
      activeToolWin = w;
    };
    const chrome = w.el.querySelector("[data-drag-chrome]") || w.el;
    // Stamper: click = pick up/put down. Inbox/karaoke: drag body; buttons own clicks.
    let toolMoved = false;
    chrome.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      if (ev.target.closest("input, button")) return;
      if (!isReceiver && !isKaraoke && heldToolWin === w) {
        // already holding stamper — release on click
        return;
      }
      toolMoved = false;
      startDrag(w, ev, () => {
        toolMoved = true;
      });
    });
    w.el.addEventListener("click", async (ev) => {
      if (toolMoved) return;
      if (ev.target.closest("button, input")) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (isReceiver) {
        // open / take mail — do not pick up like stamper
        await openInboxMail(w);
        return;
      }
      if (isKaraoke) {
        // fidget stays on desk · PULL/COPY on face; no chase-stamp pick up
        setFocus(w);
        activeToolWin = w;
        return;
      }
      if (heldToolWin === w) {
        putDownTool(w, lastFeltPtr.x, lastFeltPtr.y);
      } else {
        await pickUpTool(w);
      }
    });
    // double-click: stamper cycles plate; chipper reloads clipboard; karaoke toggles dress
    // inbox: do NOT open again — click already opened; dblclick was stacking trays
    w.el.addEventListener("dblclick", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (heldToolWin === w) return;
      if (isReceiver) {
        return;
      }
      const pkg = resolvePackageId(
        (w.data && (w.data.package_id || w.data.subtype)) || "stamper"
      );
      if (pkg === "karaoke") {
        // toggle karaoke ↔ angry costume
        const cur =
          (w.data.dressup && w.data.dressup.tool) || w.data.dress || "karaoke";
        const next = cur === "angry" ? "karaoke" : "angry";
        w.data.dress = next;
        w.data.dressup = Object.assign({}, w.data.dressup || {}, {
          tool: next,
        });
        const face = w.el.querySelector("[data-tool=karaoke]");
        if (face) face.setAttribute("data-tool-dress", next);
        await ensureToolCss(
          "karaoke",
          "dressups/tool/" + next + ".dsc",
          "karaoke:tool-" + next + ":" + Date.now()
        );
        try {
          await api("/api/tool/pose", {
            method: "POST",
            body: JSON.stringify({
              id: w.data.uid || w.data.id,
              pose: {
                x: parseFloat(w.el.style.left) || 48,
                y: parseFloat(w.el.style.top) || 48,
                openW: w._lastOpenW,
                openH: w._lastOpenH,
              },
              dressup: w.data.dressup,
              prop: w.data.prop,
            }),
          });
        } catch (_) {}
        toast("karaoke · " + next);
        return;
      }
      if (pkg === "chipper") {
        const cite = await loadChipperFromClipboard(w);
        if (cite) toast("chipper plate · " + cite);
        return;
      }
      const impl = window.PocketTools.get(pkg) || window.PocketTools.get("stamper");
      if (impl && impl.cycleLabel) {
        const next = impl.cycleLabel(w);
        if (next) {
          const lab = w.el.querySelector("[data-stamp-label]");
          if (lab) lab.textContent = String(next).toUpperCase();
          const plate =
            (w.data.prop &&
              (w.data.prop["Mark.type"] || w.data.prop["Mark.label"])) ||
            next;
          await api("/api/tool/pose", {
            method: "POST",
            body: JSON.stringify({
              id: uid,
              prop: {
                canMark: true,
                "Mark.type": plate,
              },
              dressup: {
                id: uid,
                tool: (w.data.dressup && w.data.dressup.tool) || w.data.dress || "brass",
                mark: (w.data.dressup && w.data.dressup.mark) || "classic",
              },
              pose: {
                x: parseFloat(w.el.style.left) || 0,
                y: parseFloat(w.el.style.top) || 0,
                openW: w._lastOpenW,
                openH: w._lastOpenH,
              },
            }),
          });
          toast("plate · " + next);
        }
      }
    });
    bringFront(w.el);
    setFocus(w);
    activeToolWin = w;
    return w;
  }

  async function applyStampToLeaf(toolWin, leafWin, clientX, clientY) {
    // leaf or card (index chip)
    if (!leafWin || (leafWin.kind !== "leaf" && leafWin.kind !== "card")) {
      return false;
    }
    const pos =
      clientX != null && clientY != null
        ? markPosFromPointer(leafWin, clientX, clientY)
        : null;
    const pkg = resolvePackageId(
      (toolWin && toolWin.data && (toolWin.data.package_id || toolWin.data.subtype)) ||
        "stamper"
    );
    // chipper only: refresh from clipboard (stamper never reads paste)
    if (pkg === "chipper") {
      await loadChipperFromClipboard(toolWin);
    }
    const impl =
      (window.PocketTools && window.PocketTools.get(pkg)) ||
      (pkg === "chipper" || pkg === "eraser"
        ? null
        : window.PocketTools && window.PocketTools.get("stamper"));
    let leafProp = null;
    let isErase = pkg === "eraser";
    if (impl && impl.applyToLeaf) {
      const r = impl.applyToLeaf(toolWin, leafWin, pos);
      if (!r || !r.ok) {
        toast((r && r.error) || "cannot mark");
        return false;
      }
      leafProp = r.leafProp;
      if (r.erase || (leafProp && leafProp.eraseAll)) isErase = true;
    } else if (pkg === "chipper") {
      toast("chipper kit missing · reload desk");
      return false;
    } else if (pkg === "eraser") {
      toast("eraser kit missing · reload desk");
      return false;
    } else {
      const prop = (toolWin && toolWin.data && toolWin.data.prop) || {};
      const du = (toolWin && toolWin.data && toolWin.data.dressup) || {};
      const lp = (leafWin && leafWin.data && leafWin.data.prop) || {};
      const markable = lp.isMarkable;
      if (
        markable === false ||
        markable === "no" ||
        markable === "false"
      ) {
        toast("leaf is not markable");
        return false;
      }
      const plate =
        prop["Mark.type"] || prop["Mark.label"] || "urgent";
      // rubber stamp only — never touch Cite.*
      leafProp = {
        isMarkable: true,
        isMarked: true,
        "Mark.class": "stamp",
        "Mark.type": plate,
        "Mark.style": du.mark || prop["Mark.style"] || "classic",
      };
      if (pos) {
        leafProp["Mark.pos.x"] = pos.x;
        leafProp["Mark.pos.y"] = pos.y;
      }
    }
    // place only the scar this tool owns (eraser skips placement)
    if (pos && leafProp && !isErase) {
      if (pkg === "chipper" || leafProp["Cite.code"]) {
        leafProp["Cite.pos.x"] = pos.x;
        leafProp["Cite.pos.y"] = pos.y;
        // do not write Mark.pos for cites
        delete leafProp["Mark.pos.x"];
        delete leafProp["Mark.pos.y"];
      } else {
        leafProp["Mark.pos.x"] = pos.x;
        leafProp["Mark.pos.y"] = pos.y;
      }
    }
    const j = await api("/api/tool/mark", {
      method: "POST",
      body: JSON.stringify({ leaf_id: leafWin.data.id, prop: leafProp }),
    });
    if (!j.ok) {
      toast(j.error || (isErase ? "erase failed" : "mark failed"));
      return false;
    }
    if (isErase || j.erased) {
      // full replace with clean prop (server stripped scars)
      leafWin.data.prop = Object.assign({}, j.prop || {
        isMarkable: true,
        isMarked: false,
      });
      leafWin.data.cites = Array.isArray(j.cites) ? j.cites : [];
    } else {
      // prefer server prop (normalized isMarked / Mark.*) so paint sees scars
      leafWin.data.prop = Object.assign(
        {},
        leafWin.data.prop || {},
        leafProp,
        j.prop || {}
      );
      if (j.cites && j.cites.length) {
        leafWin.data.cites = j.cites;
      }
      if (j.face_cite) {
        leafWin.data.prop["Cite.code"] = j.face_cite;
      }
    }
    if (!isErase) {
      const style =
        (leafWin.data.prop && leafWin.data.prop["Mark.style"]) ||
        leafProp["Mark.style"] ||
        (toolWin && toolWin.data && toolWin.data.dressup && toolWin.data.dressup.mark) ||
        (pkg === "chipper" ? "ticket" : "classic");
      await ensureToolCss(
        pkg,
        "dressups/mark/" + style + ".dsc",
        pkg + ":mark-" + style + ":" + Date.now()
      );
    }
    // auto-saved via /api/tool/mark — paint immediately; drag will not wipe cfg prop
    if (leafWin.kind === "card") {
      paintCardFace(leafWin);
    } else {
      paintLeafStampPrint(leafWin);
      if (typeof leafWin.refreshStatus === "function") leafWin.refreshStatus();
      else {
        const st =
          leafWin.el && leafWin.el.querySelector("[data-paper-status]");
        if (st) st.textContent = leafStatusLine(leafWin.data);
      }
    }
    if (isErase || j.erased) {
      toast("erased · all stamps wiped · saved");
      return true;
    }
    const plateWord =
      leafProp["Cite.code"] ||
      leafProp["Mark.type"] ||
      leafProp["Mark.label"] ||
      "";
    const verb = pkg === "chipper" ? "chipped" : "stamped";
    const shown =
      leafProp["Cite.code"] ||
      leafProp["Mark.type"] ||
      leafProp["Mark.label"] ||
      plateWord ||
      "";
    toast(
      verb +
        " · " +
        shown +
        (pos ? " · @" + pos.x + "," + pos.y : "") +
        (j.cites && j.cites.length ? " · pin" : "") +
        " · saved"
    );
    return true;
  }

  /**
   * Click-room places (prove the fun · not 3D).
   * room = office overview · desk = current felt · host = one container focused.
   */
  function clearDeskPreview() {
    if (!felt) return;
    felt.classList.remove("is-desk-preview");
    // restore felt as body work surface (sibling of room)
    if (felt.parentElement !== document.body) {
      const leave = $("btnLeavePlace");
      if (leave && leave.parentElement === document.body) {
        document.body.insertBefore(felt, leave);
      } else if (roomEl && roomEl.parentElement === document.body) {
        document.body.insertBefore(felt, roomEl.nextSibling);
      } else {
        document.body.appendChild(felt);
      }
    }
    felt.style.cssText = "";
    delete felt.dataset.previewScale;
  }

  /** Live mini of the felt, parked inside the desk hotspot slot (see-only). */
  function layoutDeskPreview() {
    if (!felt || !roomEl || placeMode !== "room") return;
    const hot = roomEl.querySelector(".rx-hot-desk");
    const slot =
      $("deskPreviewSlot") ||
      (hot && hot.querySelector(".rx-desk-preview-slot"));
    if (!hot || !slot) return;

    // content bounds from free objects on the felt (not office-floor items)
    let maxX = 0;
    let maxY = 0;
    wins.forEach((w) => {
      if (!w || !w.el) return;
      if (isOfficePlaced(w)) return;
      if (w.el.style.display === "none") return;
      if (w.el.parentElement !== felt && !felt.contains(w.el)) return;
      const x = parseFloat(w.el.style.left) || 0;
      const y = parseFloat(w.el.style.top) || 0;
      const ww = w.el.offsetWidth || parseFloat(w.el.style.width) || 120;
      const hh = w.el.offsetHeight || parseFloat(w.el.style.height) || 100;
      maxX = Math.max(maxX, x + ww + 24);
      maxY = Math.max(maxY, y + hh + 24);
    });
    // empty desk still has a tabletop
    if (maxX < 200) maxX = 720;
    if (maxY < 150) maxY = 420;

    // room budget · prime work surface · big tabletop in the office
    const rw = roomEl.clientWidth || 800;
    const rh = roomEl.clientHeight || 500;
    const maxHotW = rw * 0.72;
    // floor band is ~50% of room · keep tabletop under that so it sits on the floor
    const maxHotH = rh * 0.46;
    // scale so content fits the budget · then SIZE THE BOX TO THE CONTENT
    let s = Math.min(maxHotW / maxX, maxHotH / maxY);
    if (!(s > 0) || !isFinite(s)) s = 0.25;
    // allow a larger dollhouse · still leave wall/shelf room
    s = Math.min(s, 0.85);
    s = Math.max(s, 0.1);
    const hotW = Math.round(maxX * s);
    const hotH = Math.round(maxY * s);

    // center desk a bit right of shelf · floor of the room
    // (CSS adds perspective tilt · leave room under for foreshortening)
    hot.style.width = hotW + "px";
    hot.style.height = hotH + "px";
    hot.style.left = Math.round((rw - hotW) * 0.55) + "px";
    hot.style.right = "auto";
    hot.style.bottom = Math.round(rh * 0.04) + "px";
    hot.style.top = "auto";

    // park felt inside the hotspot (fixed coords break under Deck Host transforms)
    if (felt.parentElement !== slot) {
      slot.appendChild(felt);
    }

    felt.classList.add("is-desk-preview");
    felt.dataset.previewScale = String(s);
    felt.style.position = "absolute";
    felt.style.left = "0";
    felt.style.top = "0";
    felt.style.right = "auto";
    felt.style.bottom = "auto";
    felt.style.inset = "auto";
    felt.style.width = maxX + "px";
    felt.style.height = maxY + "px";
    felt.style.transformOrigin = "0 0";
    // scale exactly to fill the box (box already matches aspect)
    felt.style.transform = "scale(" + s + ")";
    felt.style.overflow = "hidden";
    // reach in · drag objects at dollhouse scale (open via desk label)
    felt.style.pointerEvents = "auto";
    felt.style.visibility = "visible";
    felt.style.zIndex = "0";
  }

  /** Scale factor of room mini-desk (1 when full desk mode). */
  function getDeskPreviewScale() {
    if (
      placeMode !== "room" ||
      !felt ||
      !felt.classList.contains("is-desk-preview")
    )
      return 1;
    const s = parseFloat(felt.dataset.previewScale || "1");
    return s > 0 && isFinite(s) ? s : 1;
  }

  function applyPlaceChrome() {
    document.body.classList.remove(
      "rx-place-room",
      "rx-place-desk",
      "rx-place-host"
    );
    document.body.classList.add("rx-place-" + (placeMode || "desk"));
    if (roomEl) {
      if (placeMode === "room") roomEl.hidden = false;
      else roomEl.hidden = true;
    }
    if (btnLeavePlace) {
      btnLeavePlace.hidden = placeMode === "room";
      btnLeavePlace.textContent =
        placeMode === "host" ? "← desk" : "← office";
    }
    // when leaving host focus, un-dim other wins
    if (placeMode !== "host") {
      wins.forEach((w) => {
        if (w.el && w.el.style) {
          w.el.style.opacity = "";
          w.el.classList.remove("is-place-solo");
        }
      });
    }
    if (placeMode === "room") {
      showOfficeFloorItems(true);
      // next frame so room/hotspot geometry is laid out
      requestAnimationFrame(function () {
        requestAnimationFrame(layoutDeskPreview);
      });
    } else {
      clearDeskPreview();
      showOfficeFloorItems(false);
    }
  }

  function enterRoomPlace(opts) {
    opts = opts || {};
    // parked: office is set dressing that ate the desk. Stay on felt.
    if (DESK_ONLY) {
      enterDeskPlace({
        quiet: !!opts.quiet,
        noCurtain: !!opts.noCurtain,
        curtain: false,
      });
      if (!opts.quiet) {
        toast("desk only · office parked · multi-desk later");
      }
      return;
    }
    function go() {
      placeMode = "room";
      placeHostId = null;
      applyPlaceChrome();
      if (!opts.quiet) toast("office · click a place");
    }
    // curtain when leaving desk/host (avoids objects floating on void)
    // skip on first boot (rx-booting already covers) or opts.noCurtain
    if (
      !opts.noCurtain &&
      !document.body.classList.contains("rx-booting") &&
      (opts.curtain || placeMode === "desk" || placeMode === "host")
    ) {
      withPlaceCurtain(opts.curtainLabel || "back to office", go);
    } else {
      go();
    }
  }

  function enterDeskPlace(opts) {
    opts = opts || {};
    function go() {
      placeMode = "desk";
      placeHostId = null;
      applyPlaceChrome();
      if (!opts.quiet) toast("desk · papers live here");
    }
    if (
      !opts.noCurtain &&
      !document.body.classList.contains("rx-booting") &&
      (opts.curtain || placeMode === "room")
    ) {
      withPlaceCurtain(opts.curtainLabel || "at the desk", go);
    } else {
      go();
    }
  }

  function enterHostPlace(w, label) {
    if (!w || !w.el) {
      enterDeskPlace({ quiet: true });
      toast((label || "place") + " · not on desk yet");
      return;
    }
    placeMode = "host";
    placeHostId = w.data && (w.data.id || w.data.uid);
    applyPlaceChrome();
    // solo focus: dim others, bring this front
    wins.forEach((other) => {
      if (!other.el) return;
      if (other === w) {
        other.el.style.opacity = "1";
        other.el.classList.add("is-place-solo");
        other.el.style.display = other.el.style.display === "none" ? "" : other.el.style.display;
        if (other._onShelf) {
          // still on shelf membership but show for work
          other.el.style.display = "";
          other.el.removeAttribute("aria-hidden");
        }
      } else {
        other.el.style.opacity = "0.12";
        other.el.classList.remove("is-place-solo");
      }
    });
    bringFront(w.el);
    setFocus(w);
    // center-ish if tiny
    try {
      const fr = felt.getBoundingClientRect();
      const r = w.el.getBoundingClientRect();
      if (r.width < fr.width * 0.9) {
        const nx = Math.max(12, (fr.width - r.width) / 2);
        const ny = Math.max(12, (fr.height - r.height) / 2);
        // only nudge free hosts (not nested in pocket)
        if (w.el.parentElement === felt) {
          w.el.style.left = nx + "px";
          w.el.style.top = ny + "px";
        }
      }
    } catch (_) {}
    toast((label || "place") + " · " + (w.data.title || w.data.id || ""));
  }

  function stepBackPlace() {
    if (placeMode === "host") {
      enterDeskPlace({ quiet: true, curtain: true, curtainLabel: "back to desk" });
      return;
    }
    // never bounce through office while DESK_ONLY
    enterDeskPlace({ curtain: true, curtainLabel: "at the desk" });
  }

  function firstWin(pred) {
    let found = null;
    wins.forEach((w) => {
      if (!found && pred(w)) found = w;
    });
    return found;
  }

  function roomGo(kind) {
    if (kind === "desk") {
      enterDeskPlace({ curtain: true, curtainLabel: "at the desk" });
      return;
    }
    if (kind === "shelf") {
      const sw = firstWin((w) => w.kind === "board" && isShelfBin(w));
      withPlaceCurtain("shelf", function () {
        placeMode = "desk";
        placeHostId = null;
        applyPlaceChrome();
        enterHostPlace(sw, "shelf");
      });
      return;
    }
    // cork is wall set dressing for now · not a pocket
    if (kind === "cork") {
      toast("cork · wall board · pin later");
      return;
    }
    if (kind === "inbox") {
      const iw = firstWin(
        (w) =>
          w.kind === "tool" &&
          (w.data.package_id === "inbox" ||
            w.subtype === "inbox" ||
            String(w.data.uid || w.data.id || "").indexOf("inbox") >= 0)
      );
      withPlaceCurtain("mail", function () {
        enterDeskPlace({ quiet: true, noCurtain: true });
        if (iw) {
          bringFront(iw.el);
          setFocus(iw);
          // open the banker tray after desk settles
          window.setTimeout(function () {
            openInboxMail(iw);
          }, 80);
        } else toast("Hermes Mail · not on desk · -ins inbox");
      });
      return;
    }
    if (kind === "mat") {
      withPlaceCurtain("mat", function () {
        enterDeskPlace({ quiet: true, noCurtain: true });
        toast("mat · pocket carry later · for now: desk");
      });
      return;
    }
    enterDeskPlace({ curtain: true });
  }

  function wireRoomHotspots() {
    if (!roomEl || roomEl._wired) return;
    roomEl._wired = true;
    roomEl.querySelectorAll("[data-room-go]").forEach((btn) => {
      // capture: win over mini-felt / drag handlers that might sit on top in 3d
      btn.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          roomGo(btn.getAttribute("data-room-go") || "desk");
        },
        true
      );
    });
    // desk carpet: double-click empty wood (not a paper) also opens desk
    const deskHot = roomEl.querySelector(".rx-hot-desk");
    if (deskHot && !deskHot._openWired) {
      deskHot._openWired = true;
      deskHot.addEventListener("dblclick", (ev) => {
        if (ev.target.closest(".nb-win, .md-term, .rx-mail-tray, [data-room-go]"))
          return;
        ev.preventDefault();
        ev.stopPropagation();
        roomGo("desk");
      });
    }
    if (btnLeavePlace) {
      btnLeavePlace.addEventListener("click", (ev) => {
        ev.preventDefault();
        stepBackPlace();
      });
    }
    window.addEventListener(
      "resize",
      function () {
        if (placeMode === "room") layoutDeskPreview();
      },
      { passive: true }
    );
  }

  async function boot() {
    await bootHouseDress();
    await loadLeafDressupCatalog();
    felt.querySelectorAll(".nb-win").forEach((el) => el.remove());
    wins.clear();
    win = null;
    activeToolWin = null;
    heldToolWin = null;
    wireRoomHotspots();

    // boards / decks / books / shelves first (containers)
    const bj = await api("/api/bins");
    const boards = (bj && bj.surface) || [];
    for (const row of boards) {
      if (!row.bin) continue;
      await mountBoard(row.bin, row.config);
    }
    // legacy shelf: hide real volumes; rail shows spine stubs
    wins.forEach((bw) => {
      if (bw.kind === "board" && isShelfBin(bw)) hideShelvedVolumes(bw);
    });

    const j = await api("/api/leaves");
    const surface = (j && j.surface) || [];
    if (!j.ok || !surface.length) {
      const p = await api("/api/primary");
      if (!p.ok || !p.leaf) {
        toast(boards.length ? boards.length + " board(s)" : "no leaves");
      } else {
        await ensureDressupCss(p.leaf.paper || "lined");
        const lw = mountLeaf(p.leaf, p.config);
        if (p.config && p.config.prop) {
          lw.data.prop = p.config.prop;
          paintLeafStampPrint(lw);
        }
      }
    } else {
      let nestI = 0;
      for (const row of surface) {
        if (!row.leaf) continue;
        await ensureDressupCss(row.leaf.paper || "lined");
        const lw = mountLeaf(row.leaf, row.config, { skipPosePersist: true });
        if (row.config && row.config.prop) {
          lw.data.prop = Object.assign({}, lw.data.prop || {}, row.config.prop);
          const ms = row.config.prop["Mark.style"] || "classic";
          await ensureToolCss(
            "stamper",
            "dressups/mark/" + ms + ".dsc",
            "stamper:mark-" + ms
          );
        }
        paintLeafStampPrint(lw);
        // membership (leaf.bin) and/or home scar (prop.homeBin → envelope)
        const homeScar =
          (row.config &&
            row.config.prop &&
            row.config.prop.homeBin) ||
          null;
        const bid = row.leaf.bin || homeScar;
        if (homeScar) {
          lw.data.homeBin = homeScar;
          lw.data.prop = Object.assign({}, lw.data.prop || {}, {
            homeBin: homeScar,
          });
        }
        if (bid) {
          const bw = boardWinById(bid);
          if (bw) {
            if (isDeckBin(bw)) {
              // envelope · hide while still a member; show if only home (checked out)
              const chips = (bw.data.chips || []).map(String);
              const lid = String(row.leaf.id || row.leaf.uid || "");
              const stillIn =
                !!row.leaf.bin ||
                chips.indexOf(lid) >= 0 ||
                chips.indexOf(lid.replace(/^leaf_/, "leaf[")) >= 0;
              lw.data.homeBin = bid;
              lw.data.prop = Object.assign({}, lw.data.prop || {}, {
                homeBin: bid,
              });
              if (stillIn) {
                lw._inBin = bid;
                lw.data.bin = bid;
                hideCardInDeck(lw);
              }
              // if only homeScar and not in chips → free on desk (out)
            } else if (isBookBin(bw)) {
              // book pages live in TOC only
              lw._inBin = bid;
              lw.data.bin = bid;
              lw.el.style.display = "none";
              felt.appendChild(lw.el);
              setLeafInBoardScale(lw, false);
            } else if (!isShelfBin(bw)) {
              lw._inBin = bid;
              lw.data.bin = bid;
              const pocket = bw.el.querySelector("[data-board-pocket]");
              if (pocket) {
                const pose =
                  (row.config && (row.config.pose || row.config.pos)) || {};
                pocket.appendChild(lw.el);
                let lx = pose.x != null ? Number(pose.x) : 12 + nestI * 28;
                let ly = pose.y != null ? Number(pose.y) : 12 + nestI * 24;
                const pr = pocket.getBoundingClientRect();
                const maxX = Math.max(8, (pr.width || 400) - 80);
                const maxY = Math.max(8, (pr.height || 300) - 80);
                if (lx > maxX || ly > maxY || lx < -20 || ly < -20) {
                  lx = 12 + (nestI % 6) * 32;
                  ly = 12 + (nestI % 5) * 28;
                }
                lw.el.style.left = lx + "px";
                lw.el.style.top = ly + "px";
                setLeafInBoardScale(lw, true);
                nestI += 1;
              }
            }
          }
        }
      }
    }

    // rebuild book TOCs after leaves known
    wins.forEach((bw) => {
      if (bw.kind === "board" && isBookBin(bw)) renderBookToc(bw);
    });

    // chip cards (store package · not leaves)
    const cj = await api("/api/cards");
    if (cj.ok && cj.surface) {
      let nestC = 0;
      for (const row of cj.surface) {
        if (!row.card) continue;
        const cw = await mountCard(row.card, row.config, { skipFocus: true });
        if (!cw) continue;
        // home from prop (checked out) or membership (in box)
        if (row.config && row.config.prop && row.config.prop.homeBin) {
          cw.data.homeBin = row.config.prop.homeBin;
          cw.data.prop = Object.assign({}, cw.data.prop || {}, {
            homeBin: row.config.prop.homeBin,
          });
        }
        const bid = row.card.bin;
        if (bid) {
          const bw = boardWinById(bid);
          if (bw && isDeckBin(bw)) {
            // filed in deck · home + hidden until pull
            cw.data.homeBin = bid;
            cw.data.prop = Object.assign({}, cw.data.prop || {}, {
              homeBin: bid,
            });
            cw._inBin = bid;
            cw.data.bin = bid;
            hideCardInDeck(cw);
            nestC += 1;
          } else if (bw && !isBookBin(bw) && !isShelfBin(bw)) {
            // cork board pin (not filing)
            cw._inBin = bid;
            cw.data.bin = bid;
            const pocket = bw.el.querySelector("[data-board-pocket]");
            if (pocket) {
              const pose =
                (row.config && (row.config.pose || row.config.pos)) || {};
              pocket.appendChild(cw.el);
              let lx = pose.x != null ? Number(pose.x) : 12 + nestC * 28;
              let ly = pose.y != null ? Number(pose.y) : 12 + nestC * 24;
              cw.el.style.left = lx + "px";
              cw.el.style.top = ly + "px";
              setLeafInBoardScale(cw, true);
              nestC += 1;
            }
          }
        }
        paintCardFace(cw);
      }
    }

    const kj = await api("/api/keys");
    if (kj.ok && kj.surface) {
      let nestK = 0;
      for (const row of kj.surface) {
        if (!row.key) continue;
        const kw = await mountKey(row.key, row.config, { skipFocus: true });
        if (!kw) continue;
        const bid = row.key.bin;
        if (bid) {
          const bw = boardWinById(bid);
          if (bw && !isBookBin(bw) && !isShelfBin(bw) && !isDeckBin(bw)) {
            kw._inBin = bid;
            kw.data.bin = bid;
            const pocket = bw.el.querySelector("[data-board-pocket]");
            if (pocket) {
              const pose =
                (row.config && (row.config.pose || row.config.pos)) || {};
              pocket.appendChild(kw.el);
              let lx = pose.x != null ? Number(pose.x) : 12 + nestK * 28;
              let ly = pose.y != null ? Number(pose.y) : 12 + nestK * 24;
              kw.el.style.left = lx + "px";
              kw.el.style.top = ly + "px";
              setLeafInBoardScale(kw, true);
              nestK += 1;
            }
          }
        }
        paintKeyFace(kw);
      }
    }

    // envelope membership truth = bin.chips on disk · re-hide every member
    // (leaf boot used to only nest board-pockets; papers spilled free on refresh)
    wins.forEach((bw) => {
      if (!bw || bw.kind !== "board" || !isDeckBin(bw)) return;
      const did = String(bw.data.id || bw.data.uid || "");
      (bw.data.chips || []).forEach((cid) => {
        const mem =
          wins.get(String(cid)) ||
          wins.get(cid) ||
          null;
        if (!mem || !mem.el) return;
        if (mem.kind !== "card" && mem.kind !== "leaf") return;
        mem.data.homeBin = did;
        mem.data.prop = Object.assign({}, mem.data.prop || {}, {
          homeBin: did,
        });
        mem._inBin = did;
        mem.data.bin = did;
        hideCardInDeck(mem);
        if (mem.kind === "card") paintCardFace(mem);
      });
      if (bw.open === true) refreshDeckList(bw);
    });

    // guest tools already on surface (stamper / inbox / rom carts)
    // do NOT force-place ROM carts every boot — despawn must stick
    const tj = await api("/api/tools");
    if (tj.ok && tj.tools) {
      for (const cfg of tj.tools) {
        const uid = cfg.uid || (cfg.config && cfg.config.id);
        if (!uid) continue;
        const clean = String(uid).replace(/^tool-/, "");
        const uidPkgMatch = clean.match(/^([a-zA-Z][\w]*)\[/);
        const uidPkg = uidPkgMatch ? resolvePackageId(uidPkgMatch[1]) : "";
        const sub = resolvePackageId(
          uidPkg ||
            (cfg.config && cfg.config.subtype) ||
            cfg.package_id ||
            "stamper"
        );
        if (sub === "rom" || clean.toLowerCase().indexOf("rom[") === 0) {
          mountRomCart(
            {
              uid: clean,
              id: clean,
              title: (cfg.prop && cfg.prop["Rom.title"]) || clean,
              package_id: "rom",
              subtype: "rom",
              prop: cfg.prop || {},
            },
            Object.assign({}, cfg, { uid: clean, prop: cfg.prop || {} })
          );
          continue;
        }
        const isInb = sub === "inbox" || clean.toLowerCase().indexOf("inbox") >= 0;
        const tw = await mountTool(
          {
            uid: clean,
            id: clean,
            package_id: isInb ? "inbox" : sub,
            subtype: isInb ? "inbox" : sub,
            prop: cfg.prop,
            dress:
              (cfg.dressup && (cfg.dressup.tool || cfg.dressup.style)) ||
              (isInb ? "plain" : "brass"),
            dressup: cfg.dressup,
          },
          Object.assign({}, cfg, { uid: clean })
        );
        // tool in board bin → nest tiny in pocket (same as leaves)
        if (tw && cfg.bin) {
          const bw = boardWinById(cfg.bin);
          if (bw && !isBookBin(bw) && !isShelfBin(bw) && !isDeckBin(bw)) {
            const pose =
              (cfg.pose || cfg.pos || {}) &&
              (cfg.pose || cfg.pos);
            nestToolInBoardPocket(tw, bw, pose);
            refreshBoardMeta(bw);
          }
        }
      }
    }

    const nLeaf = [...wins.values()].filter((w) => w.kind === "leaf").length;
    const nBoard = [...wins.values()].filter((w) => w.kind === "board").length;
    const nTool = [...wins.values()].filter((w) => w.kind === "tool").length;
    toast(
      nLeaf +
        " leaf" +
        (nLeaf === 1 ? "" : "s") +
        (nBoard ? " · " + nBoard + " board" + (nBoard === 1 ? "" : "s") : "") +
        (nTool ? " · " + nTool + " tool" + (nTool === 1 ? "" : "s") : "")
    );
    // restore items left on the office floor (prop.place: office)
    wins.forEach((win) => {
      if (!win || !win.data || !win.data.prop) return;
      if (win.data.prop.place === "office" || win.data.prop.place === "room") {
        win._officePlace = true;
        win._officeScale =
          Number(win.data.prop.officeScale) || 0.42;
      }
    });

    // desk only — office dollhouse parked (was: start in office "for fun")
    enterDeskPlace({ quiet: true, noCurtain: true });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        finishBootScreen();
      });
    });
  }

  function finishBootScreen() {
    document.body.classList.remove("rx-booting");
    const boot = $("bootScreen");
    if (!boot) return;
    boot.classList.add("is-done");
    boot.setAttribute("aria-busy", "false");
    // keep node for place transitions (desk → office flash)
    window.setTimeout(function () {
      boot.setAttribute("hidden", "");
    }, 400);
  }

  /**
   * Short curtain so place changes don't flash bare objects / missing bg.
   * fn() should switch place; we reveal after layout settles.
   */
  function withPlaceCurtain(label, fn) {
    const boot = $("bootScreen");
    document.body.classList.add("rx-place-transition");
    if (boot) {
      boot.hidden = false;
      boot.removeAttribute("hidden");
      boot.classList.remove("is-done");
      boot.setAttribute("aria-busy", "true");
      const title = boot.querySelector(".rx-boot-title");
      if (title) title.textContent = label || "one moment";
    }
    function reveal() {
      document.body.classList.remove("rx-place-transition");
      if (boot) {
        boot.classList.add("is-done");
        boot.setAttribute("aria-busy", "false");
        window.setTimeout(function () {
          if (boot.classList.contains("is-done")) {
            boot.setAttribute("hidden", "");
            boot.hidden = true;
            const title = boot.querySelector(".rx-boot-title");
            if (title) title.textContent = "opening the office";
          }
        }, 320);
      }
    }
    // hard failsafe: never leave the office stuck under a permanent curtain
    const failSafe = window.setTimeout(function () {
      console.warn("place curtain failsafe");
      reveal();
    }, 2500);
    // let curtain paint, then switch place under it
    requestAnimationFrame(function () {
      try {
        if (typeof fn === "function") fn();
      } catch (e) {
        console.warn("place transition", e);
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          window.clearTimeout(failSafe);
          reveal();
        });
      });
    });
  }

  // empty felt = surface in hand (desk itself) · or put down held stamper
  felt.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    // only bare felt / surface chrome — not papers, shell, pads, menus
    if (ev.target !== felt && !ev.target.classList.contains("rx-felt")) return;
    if (ev.target.closest(".nb-win, .md-term, .rx-paper-check, .rx-ctx-menu")) return;
    if (heldToolWin) {
      const fr = felt.getBoundingClientRect();
      putDownTool(heldToolWin, ev.clientX - fr.left, ev.clientY - fr.top);
      setFocus(makeSurfaceFocus());
      return;
    }
    setFocus(makeSurfaceFocus());
  });

  // Esc · always release a stuck chase-stamp (is-held = pointer-events none)
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (!heldToolWin) {
      // recover orphan is-held chrome if handle was lost
      let freed = false;
      wins.forEach((w) => {
        if (w && w.kind === "tool" && w.el && w.el.classList.contains("is-held")) {
          clearHeldToolChrome(w);
          freed = true;
        }
      });
      if (freed) toast("stamp released");
      return;
    }
    const fr = felt.getBoundingClientRect();
    putDownTool(
      heldToolWin,
      lastFeltPtr.x,
      lastFeltPtr.y
    );
    ev.preventDefault();
  });

  // key in hand · [ / ] cycle 8-way heading (not while typing)
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "[" && ev.key !== "]") return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (
      t &&
      (t.closest(
        "input, textarea, [contenteditable=true], .rx-shell-in, .md-term-ta"
      ) ||
        (t.isContentEditable && t.isContentEditable !== "false"))
    )
      return;
    const tw = targetWin();
    if (!tw || tw.kind !== "key") return;
    ev.preventDefault();
    turnKey(tw, ev.key === "]" ? 1 : -1).then((h) => {
      if (h) toast("heading · " + h);
    });
  });

  // held stamper chases the pointer
  document.addEventListener(
    "pointermove",
    (ev) => {
      if (!heldToolWin || !heldToolWin.el) return;
      // heal desync: handle says held but class dropped
      if (!heldToolWin.el.classList.contains("is-held")) {
        heldToolWin.el.classList.add("is-held");
      }
      const fr = felt.getBoundingClientRect();
      chaseToolToPointer(
        heldToolWin,
        ev.clientX - fr.left,
        ev.clientY - fr.top
      );
    },
    { passive: true }
  );

  // felt right-click: Spawn menu — but NOT on text fields (browser spellcheck / cut-copy)
  felt.addEventListener("contextmenu", (ev) => {
    if (ev.target.closest(".rx-ctx-menu")) return;
    // native context menu: spelling fixes, undo, cut/copy/paste
    const t = ev.target;
    if (
      t &&
      (t.closest(
        "input:not([type=button]):not([type=submit]):not([type=checkbox]), textarea, [contenteditable=true], [contenteditable='']"
      ) ||
        (t.isContentEditable && t.isContentEditable !== "false"))
    ) {
      hideCtxMenu();
      return; // do not preventDefault — OS/browser spell menu
    }
    // check pads / shell chrome: no spawn clutter
    if (ev.target.closest(".rx-paper-check")) return;
    ev.preventDefault();
    const fr = felt.getBoundingClientRect();
    showSpawnMenu(ev.clientX, ev.clientY, ev.clientX - fr.left, ev.clientY - fr.top);
  });
  document.addEventListener("pointerdown", (ev) => {
    if (ctxMenu && !ctxMenu.contains(ev.target)) hideCtxMenu();
  });

  document.addEventListener("keydown", (ev) => {
    // Mira chord handled in capture listener (always available)
    if (isMiraShellChord(ev)) return;

    const tw = targetWin();
    if (!(ev.ctrlKey || ev.metaKey)) return;
    // no focused object: still allow shell (above); skip object chords
    if (!tw) return;
    if (ev.target && ev.target.classList && ev.target.classList.contains("md-term-ta")) {
      // Ctrl+E while in a body terminal: already editing — ignore
      if (ev.shiftKey && (ev.key === "i" || ev.key === "I")) {
        ev.preventDefault();
        openPaperCheck(tw);
      }
      if (ev.shiftKey && (ev.key === "r" || ev.key === "R")) {
        ev.preventDefault();
        openPaperCheck(tw, { red: true });
      }
      return;
    }
    // allow ^S while typing a title/author on leaf or board
    const inField =
      ev.target &&
      ev.target.matches &&
      ev.target.matches(
        "input:not([readonly]), textarea:not(.md-term-ta), .rx-shell-in"
      );
    if (inField) {
      if ((ev.key === "s" || ev.key === "S") && tw) {
        ev.preventDefault();
        if (tw.kind === "board") saveBoard(tw);
        else if (tw.kind === "card") {
          api("/api/card/save", {
            method: "POST",
            body: JSON.stringify({ card: tw.data }),
          }).then((j) => {
            if (j && j.ok && j.card) Object.assign(tw.data, j.card);
            paintCardFace(tw);
          });
        } else if (tw.kind === "key") {
          api("/api/key/save", {
            method: "POST",
            body: JSON.stringify({ key: tw.data }),
          }).then((j) => {
            if (j && j.ok && j.key) Object.assign(tw.data, j.key);
            paintKeyFace(tw);
            persistPose({}, tw);
          });
        } else sealLeaf(tw);
      }
      return;
    }
    if (ev.shiftKey && (ev.key === "i" || ev.key === "I")) {
      ev.preventDefault();
      openPaperCheck(tw);
      return;
    }
    if (ev.shiftKey && (ev.key === "r" || ev.key === "R")) {
      ev.preventDefault();
      openPaperCheck(tw, { red: true });
      return;
    }
    if (ev.key === "e" || ev.key === "E") {
      if (ev.shiftKey) return;
      if (tw.kind === "board" || tw.kind === "surface" || tw.kind === "tool")
        return;
      ev.preventDefault();
      if (tw.kind === "card") {
        openCardTerminal(tw);
        return;
      }
      if (tw.kind === "key") {
        openKeyTerminal(tw);
        return;
      }
      if (!tw.open) {
        renderOpen(tw, {
          openW: tw._lastOpenW,
          openH: tw._lastOpenH,
        });
      }
      openLeafTerminal(tw);
      return;
    }
    if ((ev.key === "s" || ev.key === "S") && tw.open) {
      if (tw.kind === "surface") return;
      ev.preventDefault();
      if (tw.kind === "board") saveBoard(tw);
      else if (tw.kind === "card") {
        // card body lives in openCardTerminal save; face-only S re-persists pose
        persistPose({}, tw);
      } else if (tw.kind === "key") {
        persistPose({}, tw);
      } else sealLeaf(tw);
    }
  });

  function placeShellAtPointer(term) {
    const fr = felt.getBoundingClientRect();
    const tw = term.offsetWidth || 420;
    const th = term.offsetHeight || 280;
    let x = lastFeltPtr.x;
    let y = lastFeltPtr.y;
    // keep the whole window on the desk
    x = Math.max(4, Math.min(x, Math.max(4, fr.width - tw - 8)));
    y = Math.max(4, Math.min(y, Math.max(4, fr.height - th - 8)));
    term.style.left = x + "px";
    term.style.top = y + "px";
  }

  /**
   * Surface shell — tiny command terminal inside the pocket OS.
   * Spawns under the cursor (last pointer on the desk).
   */
  function openSurfaceShell() {
    if (shellEl && shellEl.isConnected) {
      placeShellAtPointer(shellEl);
      // re-adopt focus chrome, THEN stack Mira above papers (setFocus would bury her)
      setFocus(focusWin || win);
      bringFront(shellEl);
      const inp = shellEl.querySelector("[data-shell-in]");
      if (inp) inp.focus();
      return;
    }
    const term = document.createElement("div");
    term.className = "md-term rx-shell-term";
    term.innerHTML =
      '<div class="md-term-bar" data-shell-drag>' +
      '<span class="md-term-dot" aria-hidden="true"></span>' +
      '<span class="md-term-title">MIRA SHELL ver. ʞ</span>' +
      // no tip rail — Hands does not want "papers please · help · quit" as permanent chrome
      '<button type="button" class="md-term-x" data-shell-close title="quit">×</button>' +
      "</div>" +
      '<div class="rx-shell-out" data-shell-out role="log" aria-live="polite"></div>' +
      '<div class="rx-shell-line">' +
      '<span class="rx-shell-ps" data-kind="none">' +
      '<span class="rx-shell-k" data-ps="mark" aria-hidden="true">' +
      '<span class="rx-shell-k-gt">&gt;</span>' +
      '<span class="rx-shell-k-bar">|</span>' +
      "</span>" +
      "</span>" +
      '<input type="text" class="rx-shell-in" data-shell-in autocomplete="off" spellcheck="false" />' +
      "</div>" +
      '<div class="md-term-resize" data-shell-resize></div>';
    felt.appendChild(term);
    shellEl = term;
    term.style.width = "420px";
    term.style.height = "280px";
    placeShellAtPointer(term);
    // focus updates prompt · then Mira on top so she isn't under the paper
    setFocus(focusWin || win);
    bringFront(term);

    const out = term.querySelector("[data-shell-out]");
    const inp = term.querySelector("[data-shell-in]");
    const hist = [];
    let histI = -1;

    /**
     * Printback: you (echo) bright · Mira (reply) a step dimmer.
     * kind: "echo" | "reply" (default reply)
     */
    function writeln(s, kind) {
      const k = kind === "echo" ? "echo" : "reply";
      const text = s == null ? "" : String(s);
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const row = document.createElement("div");
        row.className = "rx-shell-row rx-shell-" + k;
        row.textContent = lines[i].length ? lines[i] : "\u00a0";
        out.appendChild(row);
      }
      out.scrollTop = out.scrollHeight;
    }

    function ps() {
      // log echo — mark only, no trailing tip >
      if (!focusWin) return ">|";
      const k = shellObjectKind(focusWin);
      return k ? ">| " + k : ">|";
    }
    // paint once on open (setFocus may have run already)
    paintShellPs(term.querySelector(".rx-shell-ps"));

    // brand only — selection is the prompt, not a changing title bar

    /**
     * Hands verb law (2026-08):
     * - living names only · rename = kill the old word (no ghost aliases)
     * - no unix / DOS / "what it used to be called"
     * - long charming form first; short form only if Hands keeps it
     * - not a dollhouse: "dress up" is costume, not dress-ups zoo talk
     */
    async function runLine(raw) {
      const line = (raw || "").trim();
      if (!line) return;
      writeln(ps() + " " + line, "echo");
      const low = line.toLowerCase().replace(/\s+/g, " ");
      const parts = line.split(/\s+/);
      const tw = targetWin();

      // ── chrome ─────────────────────────────────────────────
      if (low === "help" || low === "?") {
        writeln(
          [
            "words that live here (Hands):",
            "  papers please           ALL papers for what is in hand",
            "                          tool → instance cfg + package",
            "                          leaf/board → matter + config",
            "  edit / edit this        leaf, card, or key → terminal",
            "  spawn key [glyph]       mint a key on the felt (or right-click Spawn)",
            "  turn / turn left        cycle key heading 45° ([ / ] on the key)",
            "  heading ne              face a key N NE E SE S SW W NW",
            "  color amber             paint a key (or color: in the edit sheet)",
            "  dress up octagon        key faces · plain · octagon · hexagon",
            "  edit name <title>       leaf/card/bin matter · name (face label)",
            "  edit by <author>        leaf/card/bin matter · author (face by)",
            "  edit tags               same terminal, caret on tags: (pin, not body)",
            "  edit tags <words>       replace the pin list (comma or space)",
            "  tag <word[, word]>      add pins · untag <word> lifts one · tags lists",
            "  edit dress up <name>    rewrite a costume sheet",
            "  dress up <name>         layer that sheet over _base (any file in the dress folder)",
            "  undress <name>          take that sheet off the leaf",
            "  dress up list           sheets in the general store",
            "  dress <name>            short for dress up <name>",
            "  -ins stamper [label] [dress]   install editor tool (surface)",
            "  -ins karaoke [·] [dress]       pull machine · KVEN · COPY (not a stamp yet)",
            "  -ins chipper [dress]           cite clipper · stamps clipboard chip codes",
            "  -ins eraser [dress]            rubber · wipe all stamps/cites on a paper",
            "  -ins inbox                     install receiver (mints address)",
            "  -ins fax                       Chester's Imports fax · dest + drop leaf → MD",
            "  open rom list          list ROMs (kde · hermes · pocket-go · terminals…)",
            "  open rom hermes        open Hermes mailer window",
            "  open rom sdk-import    open TERMINALS (FileKeeper network)",
            "  open rom pocket-go     open My Pocket Go (WWW explorer)",
            "  cart hermes            place Hermes cart on felt (dblclick to open)",
            "  cart sdk-import        place TERMINALS cart (IOX · DRX · OSX…)",
            "  cart pocket-go         place My Pocket Go cart (3.1 WWW)",
            "  cart glass-compost     place The Glass Compost cart",
            "  cart emt-bench         place EM Translation Bench cart",
            "  despawn                remove tool/rom · book/shelf/envelope/board in hand",
            "  trash can              put the wastebasket on the felt",
            "  trash                  file what's in hand into the can",
            "  empty / empty trash    move the can's papers to ~local/~trash",
            "  (inbox) click · open next letter onto desk · drag to move",
            "  save                    keep the focused leaf, card, key, or bin",
            "  clear                   wipe this shell's log",
            "  quit                    close the shell",
            "  help                    this list",
            "  (face name/by are labels · change matter with edit name / edit by)",
            "  (prompt kind: leaf · card · key · board · deck · book · shelf · tool…)",
          ].join("\n")
        );
        return;
      }
      if (low === "clear") {
        out.innerHTML = "";
        return;
      }
      if (low === "quit") {
        term.remove();
        shellEl = null;
        return;
      }
      if (
        low === "trash can" ||
        low === "wastebasket" ||
        low === "-ins trash"
      ) {
        const can = await ensureTrashCanWin();
        if (can) {
          setFocus(can);
          writeln("trash can · drop papers on it · empty to bury in ~trash");
        } else writeln("trash can failed");
        return;
      }
      if (low === "empty" || low === "empty trash" || low === "empty can") {
        const j = await emptyTrashCan();
        if (j && j.ok) {
          writeln(
            "empty · " +
              (j.count || 0) +
              " buried in ~trash" +
              (j.folder ? " · " + j.folder : "")
          );
        } else writeln((j && j.error) || "empty failed");
        return;
      }
      if (low === "trash" || low.startsWith("trash ")) {
        if (!tw || (tw.kind !== "leaf" && tw.kind !== "card")) {
          writeln("trash needs a leaf or card in hand · or: trash can");
          return;
        }
        const can = await ensureTrashCanWin();
        if (!can) {
          writeln("trash can failed");
          return;
        }
        const ok = await placeLeafInBoard(
          tw,
          can,
          lastFeltPtr.x,
          lastFeltPtr.y
        );
        writeln(
          ok
            ? "trash · in the can · empty to bury in ~trash"
            : "trash failed · drop the paper on the can"
        );
        return;
      }
      if (
        low === "despawn" ||
        low === "delete tool" ||
        low === "trash tool" ||
        low.startsWith("despawn ")
      ) {
        let tw0 = tw;
        if (low.startsWith("despawn ") && low !== "despawn") {
          const want = low.slice(8).trim();
          for (const [, ww] of wins) {
            if (
              String(ww.data.uid || ww.data.id || "").indexOf(want) >= 0
            ) {
              tw0 = ww;
              break;
            }
          }
        }
        // trash can is furniture · empty it; do not dump its papers back on the felt
        if (tw0 && tw0.kind === "board" && isTrashBin(tw0)) {
          writeln("despawn · that's the trash can · empty it instead");
          return;
        }
        // book, shelf, envelope, or cork board in hand · remove from desk (members ejected)
        if (tw0 && tw0.kind === "board") {
          const bid = tw0.data.id || tw0.data.uid;
          const wasShelf = isShelfBin(tw0);
          const wasBook = isBookBin(tw0);
          const wasEnv = isEnvelopeBin(tw0) && !wasBook && !wasShelf;
          const wasMembers = (tw0.data.chips || []).map(String);
          const jd = await api("/api/bin/despawn", {
            method: "POST",
            body: JSON.stringify({ id: bid }),
          });
          if (!jd.ok) {
            writeln(jd.error || "despawn failed");
            return;
          }
          // free hidden members onto the felt
          wasMembers.forEach((mid) => {
            const mem = wins.get(mid) || boardWinById(mid);
            if (!mem || !mem.el) return;
            mem._onShelf = null;
            if (mem.data) {
              mem.data.shelf = null;
              mem.data.bin = null;
              mem.data.homeBin = null;
              if (mem.data.prop) delete mem.data.prop.homeBin;
            }
            mem._inBin = null;
            try {
              clearShelfVolumeVisual(mem);
            } catch (_) {}
            try {
              setLeafInBoardScale(mem, false);
            } catch (_) {}
            mem.el.style.display = "";
            mem.el.removeAttribute("aria-hidden");
            if (mem.el.parentElement !== felt) felt.appendChild(mem.el);
          });
          if (tw0.el && tw0.el.parentElement)
            tw0.el.parentElement.removeChild(tw0.el);
          wins.delete(String(bid));
          if (focusWin === tw0) setFocus(null);
          writeln(
            wasShelf
              ? "despawned shelf · " + bid + " · volumes free on desk"
              : wasBook
                ? "despawned book · " + bid + " · pages free on desk"
                : wasEnv
                  ? "despawned envelope · " + bid + " · papers free on desk"
                  : "despawned board · " + bid + " · papers free on desk"
          );
          toast("despawned · " + bid);
          return;
        }
        if (!tw0 || tw0.kind !== "tool") {
          writeln(
            "despawn · click a tool, book, shelf, envelope, or board first (not the trash can)"
          );
          return;
        }
        const tid = tw0.data.uid || tw0.data.id;
        const rid =
          (tw0.data.prop && tw0.data.prop["Rom.id"]) ||
          tw0.data.rom_id ||
          "";
        const jd = await api("/api/tool/despawn", {
          method: "POST",
          body: JSON.stringify({ uid: tid }),
        });
        if (!jd.ok) {
          writeln(jd.error || "despawn failed");
          return;
        }
        if (rid) {
          try {
            await api("/api/rom/stop", {
              method: "POST",
              body: JSON.stringify({ id: rid }),
            });
          } catch (_) {}
        }
        if (tw0.el && tw0.el.parentElement) tw0.el.parentElement.removeChild(tw0.el);
        wins.delete(String(tid));
        wins.delete("tool-" + String(tid).replace(/^tool-/, ""));
        if (heldToolWin === tw0) heldToolWin = null;
        if (focusWin === tw0) setFocus(null);
        writeln(
          "despawned · " +
            tid +
            (rid ? " · " + rid : "") +
            " · gone on reload"
        );
        toast("despawned · " + tid);
        return;
      }

      // ── open rom (desk forever · program window) ─────────
      if (low === "open rom list" || low === "rom list") {
        const jl = await api("/api/rom/list");
        if (!jl.ok) {
          writeln(jl.error || "rom list fail");
          return;
        }
        writeln("roms on the desk:");
        (jl.roms || []).forEach((r) => {
          writeln(
            "  " +
              r.id +
              " · " +
              (r.title || "") +
              " · " +
              (r.up ? "up" : "down") +
              (r.sku ? " · " + r.sku : "")
          );
        });
        return;
      }
      // place cart only (no launch) — cart hermes · place rom hermes
      if (low.startsWith("cart ") || low.startsWith("place rom ")) {
        let rid = low.startsWith("cart ")
          ? line.replace(/^cart\s+/i, "").trim()
          : line.replace(/^place\s+rom\s+/i, "").trim();
        if (!rid) {
          writeln(
            "try: cart hermes · cart pocket-go · cart sdk-import · cart glass-compost · cart emt-bench · cart kde-001"
          );
          return;
        }
        if (rid.toLowerCase() === "kde" || rid.toLowerCase() === "kde 001") {
          rid = "kde-001";
        }
        if (
          rid.toLowerCase() === "go" ||
          rid.toLowerCase() === "pocket go" ||
          rid.toLowerCase() === "mypi go"
        ) {
          rid = "pocket-go";
        }
        writeln("cart · " + rid + " · …");
        const w = await placeRomCartAt(rid, lastFeltPtr.x, lastFeltPtr.y);
        if (w) writeln("cart · " + (w.data.title || rid) + " · dblclick to open");
        else writeln("cart failed · open rom list for ids");
        return;
      }
      if (low.startsWith("open rom ") || low.startsWith("rom ")) {
        let rid = low.startsWith("open rom ")
          ? line.replace(/^open\s+rom\s+/i, "").trim()
          : line.replace(/^rom\s+/i, "").trim();
        if (!rid || rid.toLowerCase() === "list") {
          writeln("try: open rom hermes · open rom kde-001 · open rom list");
          return;
        }
        if (rid.toLowerCase() === "kde" || rid.toLowerCase() === "kde 001") {
          rid = "kde-001";
        }
        if (rid.toLowerCase() === "mail" || rid.toLowerCase() === "mailer") {
          rid = "hermes";
        }
        if (
          rid.toLowerCase() === "go" ||
          rid.toLowerCase() === "pocket go" ||
          rid.toLowerCase() === "mypi go"
        ) {
          rid = "pocket-go";
        }
        writeln("rom · " + rid + " · …");
        const w = await openRomWindow(rid, {
          x: lastFeltPtr.x,
          y: lastFeltPtr.y,
        });
        if (w) writeln("rom open · " + (w.data.title || rid) + " · win/fill on chrome");
        else writeln("rom failed · is the server path right?");
        return;
      }

      // ── install guest tool (surface) ───────────────────────
      // >| surface  -ins stamper
      // >| surface  -ins karaoke angry
      if (
        low.startsWith("-ins ") ||
        low.startsWith("ins ") ||
        (low.startsWith("surface ") && low.indexOf("-ins") >= 0)
      ) {
        let rest = low;
        if (rest.startsWith("surface ")) rest = rest.slice(8).trim();
        if (rest.startsWith("-ins ")) rest = rest.slice(5).trim();
        else if (rest.startsWith("ins ")) rest = rest.slice(4).trim();
        const bits = rest.split(/\s+/).filter(Boolean);
        const cli = bits[0] || "stamper";
        const label = bits[1] || null;
        const dress = bits[2] || null;
        const j = await api("/api/tool/spawn", {
          method: "POST",
          body: JSON.stringify({
            cli: cli,
            label: label,
            dress: dress,
            x: lastFeltPtr.x,
            y: lastFeltPtr.y,
          }),
        });
        if (!j.ok || !j.tool) {
          writeln(j.error || "install failed");
          return;
        }
        const twTool = await mountTool(j.tool, j.config);
        if (twTool) setFocus(twTool);
        const addr =
          (j.tool.prop && j.tool.prop["Receive.address"]) ||
          (j.config && j.config.prop && j.config.prop["Receive.address"]) ||
          "";
        writeln(
          "installed · " +
            (j.tool.uid || cli) +
            (addr ? " · address " + addr : "") +
            (cli === "karaoke"
              ? " · PULL + COPY · dress karaoke|angry"
              : label && !addr
                ? " · plate " + label
                : "") +
            (dress && cli !== "karaoke" ? " · " + dress : "") +
            (dress && cli === "karaoke" ? " · " + dress : "") +
            (j.install && j.install.skipped ? " · (god-fork kept)" : " · loc mirror ok")
        );
        return;
      }

      // ── papers please — every paper for what's in hand
      if (low === "papers please") {
        if (!tw) {
          writeln("nothing in hand · click a leaf, board, tool, or the desk");
          return;
        }
        if (tw.kind === "surface") {
          await openPaperCheck(tw, { surface: true, stack: 0 });
          writeln("papers please · surface");
          return;
        }
        if (!tw.data) {
          writeln("nothing in hand · click a leaf, board, tool, or the desk");
          return;
        }
        if (tw.kind === "tool") {
          // every paper for this object: instance config + package definition
          const a = await openPaperCheck(tw, { config: true, stack: 0 });
          const b = await openPaperCheck(tw, { package: true, stack: 1 });
          const lines = ["papers please · tool · " + focusLabel(tw)];
          lines.push(
            a && a.ok
              ? "  · config  " + (a.path_display || a.file)
              : "  · config  MISSING · " + ((a && a.error) || "?")
          );
          lines.push(
            b && b.ok
              ? "  · package " + (b.path_display || b.file)
              : "  · package MISSING · " + ((b && b.error) || "?")
          );
          lines.forEach((ln) => writeln(ln));
          return;
        }
        // leaf / board / card — matter + instance config (both)
        const a = await openPaperCheck(tw, { stack: 0 });
        const b = await openPaperCheck(tw, { config: true, stack: 1 });
        const lines = [
          "papers please · " +
            focusLabel(tw) +
            (tw.kind === "card" ? " · card" : ""),
        ];
        lines.push(
          a && a.ok
            ? "  · matter  " + (a.path_display || a.file)
            : "  · matter  MISSING · " + ((a && a.error) || "?")
        );
        lines.push(
          b && b.ok
            ? "  · config  " + (b.path_display || b.file)
            : "  · config  MISSING · " + ((b && b.error) || "?")
        );
        lines.forEach((ln) => writeln(ln));
        return;
      }

      // ── edit … (edit always leads) ─────────────────────────
      // edit / edit this → leaf or card body terminal
      // edit name <title> / edit by <author> → matter fields (face is label only)
      // edit dress up <name> → costume sheet
      if (low === "edit" || low === "edit this") {
        if (!tw) {
          writeln("nothing in hand · click something first");
          return;
        }
        if (tw.kind === "leaf") {
          if (!tw.open) {
            await renderOpen(tw, {
              openW: tw._lastOpenW,
              openH: tw._lastOpenH,
            });
          }
          openLeafTerminal(tw);
          setFocus(tw);
          writeln("edit · body · " + focusLabel(tw));
          return;
        }
        if (tw.kind === "card") {
          openCardTerminal(tw);
          setFocus(tw);
          writeln("edit · card · " + focusLabel(tw));
          return;
        }
        if (tw.kind === "key") {
          openKeyTerminal(tw);
          setFocus(tw);
          writeln("edit · key · glyph or svg: · " + focusLabel(tw));
          return;
        }
        if (tw.kind === "board") {
          const sk = shellObjectKind(tw);
          writeln(
            sk +
              " · matter name/author: edit name … · edit by … · papers please for papers"
          );
          writeln("in hand · " + focusLabel(tw));
          return;
        }
        if (tw.kind === "surface") {
          await openPaperCheck(tw, { surface: true, stack: 0 });
          writeln("edit · surface paper");
          return;
        }
        writeln(
          "edit · nothing to open for that · kind " +
            (shellObjectKind(tw) || tw.kind || "?")
        );
        return;
      }
      // edit name … · edit by … (matter fields · same words as chip/bin papers)
      if (low.startsWith("edit name ") || low === "edit name") {
        const title =
          low === "edit name" ? "" : line.replace(/^edit\s+name\s+/i, "").trim();
        if (
          !tw ||
          (tw.kind !== "leaf" && tw.kind !== "board" && tw.kind !== "card")
        ) {
          writeln("edit name needs a leaf, card, board, deck, or book in hand");
          return;
        }
        if (!title) {
          writeln(
            "matter name · " +
              (tw.data.title || tw.data.name || "untitled") +
              " · try: edit name New Title"
          );
          return;
        }
        tw.data.title = title;
        if (tw.kind === "board") {
          const ok = await saveBoard(tw, { quiet: true });
          if (!ok) {
            writeln("edit name failed · bin save");
            return;
          }
          if (isBookBin(tw) && tw.open === false) {
            const ft = tw.el && tw.el.querySelector(".book-face-title");
            if (ft) ft.textContent = title;
          }
        } else if (tw.kind === "card") {
          const j = await api("/api/card/save", {
            method: "POST",
            body: JSON.stringify({ card: tw.data }),
          });
          if (!j.ok) {
            writeln(j.error || "edit name failed · card save");
            return;
          }
          if (j.card) Object.assign(tw.data, j.card);
          paintCardFace(tw);
        } else {
          const ok = await saveScrap(tw, { quiet: true });
          if (!ok) {
            writeln("edit name failed · leaf save");
            return;
          }
        }
        if (typeof tw.paintFaceMeta === "function") tw.paintFaceMeta();
        else if (tw.kind !== "card")
          paintFaceMetaEl(tw.el, tw.data.title, tw.data.author);
        setFocus(tw);
        writeln("edit name · " + focusLabel(tw));
        return;
      }
      if (low.startsWith("edit by ") || low === "edit by") {
        const who =
          low === "edit by" ? "" : line.replace(/^edit\s+by\s+/i, "").trim();
        if (
          !tw ||
          (tw.kind !== "leaf" && tw.kind !== "board" && tw.kind !== "card")
        ) {
          writeln("edit by needs a leaf, card, board, deck, or book in hand");
          return;
        }
        if (!who) {
          writeln(
            "matter author · " +
              normalizeAuthor(tw.data.author) +
              " · try: edit by AUORI"
          );
          return;
        }
        tw.data.author = rememberAuthor(who);
        if (tw.kind === "board") {
          const ok = await saveBoard(tw, { quiet: true });
          if (!ok) {
            writeln("edit by failed · bin save");
            return;
          }
          if (isBookBin(tw) && tw.open === false) {
            const fb = tw.el && tw.el.querySelector(".book-face-by");
            if (fb)
              fb.textContent = tw.data.author ? "by " + tw.data.author : "";
          }
        } else if (tw.kind === "card") {
          const j = await api("/api/card/save", {
            method: "POST",
            body: JSON.stringify({ card: tw.data }),
          });
          if (!j.ok) {
            writeln(j.error || "edit by failed · card save");
            return;
          }
          if (j.card) Object.assign(tw.data, j.card);
          paintCardFace(tw);
        } else {
          const ok = await saveScrap(tw, { quiet: true });
          if (!ok) {
            writeln("edit by failed · leaf save");
            return;
          }
        }
        if (typeof tw.paintFaceMeta === "function") tw.paintFaceMeta();
        else if (tw.kind !== "card")
          paintFaceMetaEl(tw.el, tw.data.title, tw.data.author);
        setFocus(tw);
        writeln("edit by · " + tw.data.author + " · " + focusLabel(tw));
        return;
      }
      if (
        low === "edit tags" ||
        low === "edit tag" ||
        low.startsWith("edit tags ") ||
        low.startsWith("edit tag ")
      ) {
        if (!tw || (tw.kind !== "leaf" && tw.kind !== "card")) {
          writeln("edit tags needs a leaf or card in hand");
          return;
        }
        const rest = /^edit\s+tags?\s+/i.test(line)
          ? line.replace(/^edit\s+tags?\s+/i, "").trim()
          : "";
        if (rest) {
          tw.data.tags = normalizePaperTags(parseTagArgs(rest));
          if (tw.kind === "card") {
            const j = await api("/api/card/save", {
              method: "POST",
              body: JSON.stringify({ card: tw.data }),
            });
            if (!j.ok) {
              writeln(j.error || "edit tags failed · card save");
              return;
            }
            if (j.card) Object.assign(tw.data, j.card);
            tw.data.tags = normalizePaperTags(tw.data.tags);
            paintCardFace(tw);
          } else {
            const ok = await saveScrap(tw, { quiet: true });
            if (!ok) {
              writeln("edit tags failed · leaf save");
              return;
            }
            if (typeof tw.refreshStatus === "function") tw.refreshStatus();
          }
          const now = normalizePaperTags(tw.data.tags);
          writeln(
            "edit tags · " +
              (now.length ? now.join(" · ") : "(none)") +
              " · pin on the chip"
          );
          return;
        }
        if (tw.kind === "leaf") {
          if (!tw.open) {
            await renderOpen(tw, {
              openW: tw._lastOpenW,
              openH: tw._lastOpenH,
            });
          }
          openLeafTerminal(tw, { focusTags: true });
        } else {
          openCardTerminal(tw, { focusTags: true });
        }
        setFocus(tw);
        writeln(
          "edit tags · write words after tags: · they live on the chip pin, not the body"
        );
        return;
      }
      if (
        low === "tags" ||
        low === "tag" ||
        low.startsWith("tag ") ||
        low.startsWith("untag ")
      ) {
        if (!tw || (tw.kind !== "leaf" && tw.kind !== "card")) {
          writeln("tag needs a leaf or card in hand");
          return;
        }
        tw.data.tags = normalizePaperTags(tw.data.tags);
        const listing = tw.data.tags.length
          ? tw.data.tags.join(" · ")
          : "(none)";
        if (low === "tags" || low === "tag") {
          writeln(
            listing === "(none)"
              ? "tags · none · Mira pins these (not inline). tag glass"
              : "tags · " + listing + " · untag <word> to lift"
          );
          return;
        }
        const taking = low.startsWith("untag ");
        const rest = taking
          ? line.replace(/^untag\s+/i, "").trim()
          : line.replace(/^tag\s+/i, "").trim();
        const words = parseTagArgs(rest);
        if (!words.length) {
          writeln("tags · " + listing);
          return;
        }
        if (taking) {
          const drop = {};
          words.forEach(function (w) {
            drop[w.toLowerCase()] = true;
          });
          tw.data.tags = tw.data.tags.filter(function (t) {
            return !drop[String(t).toLowerCase()];
          });
        } else {
          words.forEach(function (w) {
            const k = w.toLowerCase();
            if (
              tw.data.tags.some(function (t) {
                return String(t).toLowerCase() === k;
              })
            )
              return;
            tw.data.tags.push(w);
          });
        }
        if (tw.kind === "card") {
          const j = await api("/api/card/save", {
            method: "POST",
            body: JSON.stringify({ card: tw.data }),
          });
          if (!j.ok) {
            writeln(j.error || "tag failed · card save");
            return;
          }
          if (j.card) Object.assign(tw.data, j.card);
          tw.data.tags = normalizePaperTags(tw.data.tags);
          paintCardFace(tw);
        } else {
          const ok = await saveScrap(tw, { quiet: true });
          if (!ok) {
            writeln("tag failed · leaf save");
            return;
          }
          if (typeof tw.refreshStatus === "function") tw.refreshStatus();
        }
        const now = normalizePaperTags(tw.data.tags);
        writeln(
          (taking ? "untag · " : "tag · ") +
            (now.length ? now.join(" · ") : "(none)") +
            " · " +
            focusLabel(tw)
        );
        return;
      }
      if (low.startsWith("edit dress up ") || low.startsWith("edit dress ")) {
        const id = low.startsWith("edit dress up ")
          ? line.replace(/^edit\s+dress\s+up\s+/i, "").trim()
          : line.replace(/^edit\s+dress\s+/i, "").trim();
        const costume = id || "lined";
        const ok = await openDressEditTerminal(costume);
        writeln(
          ok
            ? "edit dress up · " + costume + " · ^S keeps it"
            : "could not open costume · " + costume
        );
        return;
      }

      // ── dress up (wear costume) / dress (short) ────────────
      // NOT: dress up edit (edit leads: edit dress up …)
      let dressRest = null;
      if (low === "dress up" || low.startsWith("dress up ")) {
        dressRest = low === "dress up" ? "" : line.replace(/^dress\s+up\s+/i, "").trim();
      } else if (parts[0] && parts[0].toLowerCase() === "dress") {
        dressRest = parts.slice(1).join(" ").trim();
      }
      if (dressRest !== null) {
        const dparts = dressRest ? dressRest.split(/\s+/) : [];
        const head = (dparts[0] || "").toLowerCase();
        if (head === "edit") {
          // old order died — point at living phrase, no ghost accept
          writeln("edit leads · try: edit dress up " + ((dparts[1] || "lined").trim()));
          return;
        }
        if (!head || head === "list") {
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

        const id = dressRest.trim().toLowerCase();
        // envelope in hand → face sheet from the store (not io/ab stations)
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
        if (tw && tw.kind === "key") {
          const face = normalizeKeyFace(id);
          const ok = await wearFaceSheet(tw, "key", face);
          if (!ok) {
            writeln("no key dress named " + face + " · try: dress up list");
            return;
          }
          writeln("dressed up · key " + face + " · " + focusLabel(tw));
          return;
        }
        // book in hand → cloth dress (Receiver color set)
        if (tw && tw.kind === "board" && isBookBin(tw)) {
          if (BOOK_CLOTHS.indexOf(id) < 0) {
            writeln(
              "no cloth named " +
                id +
                " · try: dress up list · " +
                BOOK_CLOTHS.join(" · ")
            );
            return;
          }
          tw.data.cloth = id;
          await persistPose({}, tw);
          if (tw.open === false) await renderBookClosed(tw);
          else await renderBookOpen(tw);
          writeln("dressed up · cloth " + id + " · " + focusLabel(tw));
          return;
        }
        // board in hand → pinboard tint (not envelope · not book)
        if (
          tw &&
          tw.kind === "board" &&
          !isBookBin(tw) &&
          !isDeckBin(tw) &&
          !isShelfBin(tw)
        ) {
          if (BOARD_TINTS.indexOf(id) < 0) {
            writeln(
              "no tint named " +
                id +
                " · try: dress up list · " +
                BOARD_TINTS.join(" · ")
            );
            return;
          }
          tw.data.cloth = id;
          tw.data.color = id;
          applyBoardTint(tw);
          await persistPose({}, tw);
          writeln("dressed up · board " + id + " · " + focusLabel(tw));
          return;
        }
        // karaoke stamp · two costumes (from Eddy Encoder modes)
        if (
          tw &&
          tw.kind === "tool" &&
          (resolvePackageId(tw.data.package_id || tw.data.subtype || "") ===
            "karaoke" ||
            String(tw.data.uid || "").indexOf("karaoke") >= 0)
        ) {
          const kCostumes = ["karaoke", "angry"];
          if (kCostumes.indexOf(id) < 0) {
            writeln(
              "karaoke costumes · " +
                kCostumes.join(" · ") +
                " · try: dress up angry"
            );
            return;
          }
          tw.data.dress = id;
          tw.data.dressup = Object.assign({}, tw.data.dressup || {}, {
            tool: id,
          });
          const face = tw.el && tw.el.querySelector("[data-tool=karaoke]");
          if (face) face.setAttribute("data-tool-dress", id);
          await ensureToolCss(
            "karaoke",
            "dressups/tool/" + id + ".dsc",
            "karaoke:tool-" + id + ":" + Date.now()
          );
          try {
            await api("/api/tool/pose", {
              method: "POST",
              body: JSON.stringify({
                id: tw.data.uid || tw.data.id,
                pose: {
                  x: parseFloat(tw.el.style.left) || 48,
                  y: parseFloat(tw.el.style.top) || 48,
                  openW: tw._lastOpenW,
                  openH: tw._lastOpenH,
                },
                dressup: tw.data.dressup,
                prop: tw.data.prop,
              }),
            });
          } catch (_) {}
          writeln("dressed up · karaoke " + id + " · " + focusLabel(tw));
          return;
        }
        if (!tw || tw.kind !== "leaf") {
          writeln(
            "dress up needs a leaf, board, book, envelope, or karaoke stamp in hand"
          );
          return;
        }
        const cur = wornSheets(tw);
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
        const rid = line.replace(/^undress\s+/i, "").trim().toLowerCase();
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

      if (low === "save") {
        if (!tw) {
          writeln("nothing in hand");
          return;
        }
        if (tw.kind === "surface") {
          writeln("surface keeps itself · edit its paper if you need a change");
          return;
        }
        if (tw.kind === "board") await saveBoard(tw);
        else if (tw.kind === "card") {
          const j = await api("/api/card/save", {
            method: "POST",
            body: JSON.stringify({ card: tw.data }),
          });
          if (!j.ok) {
            writeln(j.error || "card save failed");
            return;
          }
          if (j.card) Object.assign(tw.data, j.card);
          paintCardFace(tw);
          await persistPose({}, tw);
        } else if (tw.kind === "key") {
          const j = await api("/api/key/save", {
            method: "POST",
            body: JSON.stringify({ key: tw.data }),
          });
          if (!j.ok) {
            writeln(j.error || "key save failed");
            return;
          }
          if (j.key) Object.assign(tw.data, j.key);
          paintKeyFace(tw);
          await persistPose({}, tw);
        } else await sealLeaf(tw);
        setFocus(tw);
        writeln("kept · " + focusLabel(tw));
        return;
      }

      if (low === "spawn key" || low.startsWith("spawn key ")) {
        const rest =
          low === "spawn key" ? "" : line.replace(/^spawn\s+key\s+/i, "").trim();
        const w = await spawnKeyAt(lastFeltPtr.x, lastFeltPtr.y, {
          glyph: rest,
          title: rest || "key",
        });
        if (w) {
          setFocus(w);
          writeln(
            "spawn · key · " +
              (w.data.uid || "") +
              (rest ? " · " + rest : "")
          );
        } else writeln("spawn key failed");
        return;
      }
      if (low === "turn" || low === "turn right") {
        if (!tw || tw.kind !== "key") {
          writeln("turn needs a key in hand");
          return;
        }
        const h = await turnKey(tw, 1);
        writeln("heading · " + h);
        return;
      }
      if (low === "turn left") {
        if (!tw || tw.kind !== "key") {
          writeln("turn left needs a key in hand");
          return;
        }
        const h = await turnKey(tw, -1);
        writeln("heading · " + h);
        return;
      }
      if (low.startsWith("heading ")) {
        if (!tw || tw.kind !== "key") {
          writeln("heading needs a key in hand");
          return;
        }
        const want = line.replace(/^heading\s+/i, "").trim();
        const h = await setKeyHeading(tw, want);
        writeln("heading · " + h);
        return;
      }

      if (low === "color" || low.startsWith("color ")) {
        if (!tw || tw.kind !== "key") {
          writeln("color needs a key in hand");
          return;
        }
        const want = low === "color" ? "" : line.replace(/^color\s+/i, "").trim();
        if (!want) {
          writeln(
            "color · " +
              (keyColorOf(tw) || "cream (default)") +
              " · try: color amber · color #c45 · color none"
          );
          return;
        }
        const c = await setKeyColor(tw, want);
        writeln(c ? "color · " + c : "color · cream (default)");
        return;
      }

      // bare name / by die — edit leads (edit name · edit by)
      if (low === "name" || low.startsWith("name ")) {
        writeln("edit leads · try: edit name " + (line.replace(/^name\s*/i, "").trim() || "…"));
        return;
      }
      if (low === "by" || low.startsWith("by ")) {
        writeln("edit leads · try: edit by " + (line.replace(/^by\s*/i, "").trim() || "…"));
        return;
      }

      // dead words die quiet — not a museum of aliases
      writeln("not a word here yet · try help · or mint one with Hands");
    }

    inp.addEventListener("keydown", async (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const v = inp.value;
        inp.value = "";
        if (v.trim()) {
          hist.push(v);
          histI = hist.length;
        }
        await runLine(v);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (!hist.length) return;
        histI = Math.max(0, histI - 1);
        inp.value = hist[histI] || "";
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        histI = Math.min(hist.length, histI + 1);
        inp.value = histI >= hist.length ? "" : hist[histI] || "";
      } else if ((ev.ctrlKey || ev.metaKey) && (ev.key === "q" || ev.key === "Q")) {
        ev.preventDefault();
        term.remove();
        shellEl = null;
      }
    });

    term.querySelector("[data-shell-close]").onclick = () => {
      term.remove();
      shellEl = null;
    };

    const bar = term.querySelector("[data-shell-drag]");
    bar.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      bringFront(term);
      const r = term.getBoundingClientRect();
      const fr = felt.getBoundingClientRect();
      const ox = ev.clientX - r.left;
      const oy = ev.clientY - r.top;
      function move(e) {
        term.style.left =
          Math.max(0, Math.min(e.clientX - fr.left - ox, fr.width - 80)) + "px";
        term.style.top =
          Math.max(0, Math.min(e.clientY - fr.top - oy, fr.height - 40)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
    });
    term.querySelector("[data-shell-resize]").addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const sx = ev.clientX;
      const sy = ev.clientY;
      const sw = term.offsetWidth;
      const sh = term.offsetHeight;
      function move(e) {
        term.style.width = Math.max(280, sw + (e.clientX - sx)) + "px";
        term.style.height = Math.max(160, sh + (e.clientY - sy)) + "px";
      }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      ev.preventDefault();
      ev.stopPropagation();
    });

    inp.focus();
  }

  // const btn = $("btnReload");
  // if (btn) btn.onclick = () => boot();
  const btnShell = $("btnShell");
  if (btnShell) btnShell.onclick = () => openSurfaceShell();

  // felt is house.txt via /api/house (bootHouseDress). Do not stash a skin in
  // localStorage — that was how three copies of Hands drifted per girl.

  // track pointer so Ctrl+` can drop Mira under the hand
  document.addEventListener(
    "pointermove",
    (ev) => {
      if (!felt) return;
      const fr = felt.getBoundingClientRect();
      lastFeltPtr = {
        x: ev.clientX - fr.left,
        y: ev.clientY - fr.top,
      };
    },
    { passive: true }
  );

  // Ctrl+` (or Ctrl+~) open Mira under the hand — capture so nothing steals it
  function isMiraShellChord(ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return false;
    // layouts differ: key may be "`", "~", "Dead", or empty; code is more stable
    const k = ev.key || "";
    const c = ev.code || "";
    if (c === "Backquote" || c === "IntlBackslash") return true;
    if (k === "`" || k === "~" || k === "Dead") return true;
    // legacy keyCode for `
    if (ev.keyCode === 192) return true;
    return false;
  }
  document.addEventListener(
    "keydown",
    (ev) => {
      // allow chord even while typing in a leaf body terminal (not inside Mira input)
      if (
        ev.target &&
        ev.target.closest &&
        ev.target.closest("[data-shell-in]")
      ) {
        return;
      }
      if (!isMiraShellChord(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
      openSurfaceShell();
    },
    true
  );

  // DO NOT autosave every window every 4s — that rewrote surface/board layouts
  // from whatever left/top happened to be on the node (incl. mid-boot / hidden
  // book pages) and fought concurrent disk writes. Pose saves on drag-end only.

  boot();
  // Hermes listener · you've got mail without full reboot
  setInterval(pollInboxMailFlags, 4000);
  setTimeout(pollInboxMailFlags, 1200);
  // ROM carts · green warm pin when server health is up (like launcher)
  setInterval(pollRomWarmFlags, 5000);
  setTimeout(pollRomWarmFlags, 1500);
})();
