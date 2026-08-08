/* Jack's Concor · CO.JX-001-CONCOR · desk client */
(() => {
  "use strict";

  const HEB_BASE = [
    ["א", "alef"],
    ["ב", "bet"],
    ["ג", "gimel"],
    ["ד", "dalet"],
    ["ה", "he"],
    ["ו", "vav"],
    ["ז", "zayin"],
    ["ח", "chet"],
    ["ט", "tet"],
    ["י", "yod"],
    ["כ", "kaf"],
    ["ל", "lamed"],
    ["מ", "mem"],
    ["נ", "nun"],
    ["ס", "samekh"],
    ["ע", "ayin"],
    ["פ", "pe"],
    ["צ", "tsadi"],
    ["ק", "qof"],
    ["ר", "resh"],
    ["ש", "shin"],
    ["ת", "tav"],
  ];

  const HEB_FINAL = {
    כ: "ך",
    מ: "ם",
    נ: "ן",
    פ: "ף",
    צ: "ץ",
  };

  const HELP_TEXT = [
    "TABLE — drag by title bar. Corner grip resizes. Zoom the window if you want bigger type.",
    "BOOK — three rows: Hebrew · Strong #s · English. Each cell opens a paper.",
    "× CLOSE — leaves the desk. Not on the shelf. Click the book token again to reopen.",
    "SHELF — parks a paper on the bottom bar (right of the divider). Click the pill to restore.",
    "GEN on the left bar is the library slot (open/raise book), not a shelved paper.",
    "HEBREW BOARD (א ב) — focus a field, tap letters. Finals = sofit.",
    "SURFACE = as written. STRONG FORM = close-enough spelling Strong assigned.",
    "READINGS — each row has its own weight pips + who + meaning.",
    "STRONG # — definer (lemma / gloss / definition) + words sharing that number.",
    "ENGLISH row — English paper for that gloss token (KJV/Strong word choice · mother-tongue etymology).",
    "H853 / את — untranslatable object marker; always marked red.",
    "LET book — letter library (functions/codes). א ב board is typing only.",
    "WORDS book — weak force lexicon. Your invents + all word forms. Strong is optional later.",
    "BLUE word = weak force (your definitions). RED Strong = strong force (his def). Not required to invent.",
    "CAB — FileKeeper cabinet. Papers save to paper/jx/ (shared with JX terminal when it loads).",
  ].join("\n\n");

  /** @type {any} */
  let store = null;
  let saveTimer = null;
  let dragState = null;
  let resizeState = null;
  let focusField = null;
  let zTop = 20;

  const $ = (id) => document.getElementById(id);
  const table = $("table");
  const toastEl = $("toast");

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => {
      toastEl.hidden = true;
    }, 1400);
  }

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const ALEPH_SEED = [
    ["א", "alef", 1, "silent / glottal"],
    ["ב", "bet", 2, "b / v"],
    ["ג", "gimel", 3, "g"],
    ["ד", "dalet", 4, "d"],
    ["ה", "he", 5, "h"],
    ["ו", "vav", 6, "v / u / o"],
    ["ז", "zayin", 7, "z"],
    ["ח", "chet", 8, "ch"],
    ["ט", "tet", 9, "t"],
    ["י", "yod", 10, "y / i"],
    ["כ", "kaf", 20, "k / kh"],
    ["ל", "lamed", 30, "l"],
    ["מ", "mem", 40, "m"],
    ["נ", "nun", 50, "n"],
    ["ס", "samekh", 60, "s"],
    ["ע", "ayin", 70, "silent / pharyngeal"],
    ["פ", "pe", 80, "p / f"],
    ["צ", "tsadi", 90, "ts"],
    ["ק", "qof", 100, "q"],
    ["ר", "resh", 200, "r"],
    ["ש", "shin", 300, "sh / s"],
    ["ת", "tav", 400, "t"],
  ];

  /** Ensure library books + full aleph-bet survive user saves / old stores. */
  function migrateHouseLibraries() {
    let dirty = false;
    if (!store.books) store.books = [];
    if (!store.letters) store.letters = [];

    if (!store.books.some((b) => b.id === "book-gen")) {
      store.books.unshift({
        id: "book-gen",
        title: "Genesis",
        short: "GEN",
        open_locus: "Genesis 1:1",
        line_id: "line-gen1-1",
        line_ids: ["line-gen1-1", "line-gen1-2"],
      });
      dirty = true;
    } else {
      const gen = store.books.find((b) => b.id === "book-gen");
      if (gen) {
        if (!Array.isArray(gen.line_ids) || !gen.line_ids.length) {
          gen.line_ids = ["line-gen1-1", "line-gen1-2"];
          dirty = true;
        } else if (gen.line_ids.indexOf("line-gen1-2") < 0) {
          gen.line_ids.push("line-gen1-2");
          dirty = true;
        }
        if (!gen.line_id) {
          gen.line_id = gen.line_ids[0] || "line-gen1-1";
          dirty = true;
        }
      }
    }

    if (!store.books.some((b) => b.id === "book-letters")) {
      // insert LET right after GEN if present
      const genIdx = store.books.findIndex((b) => b.id === "book-gen");
      const letBook = {
        id: "book-letters",
        title: "Letters",
        short: "LET",
        kind: "letters",
        blurb: "Letter functions / codes — not the typing board",
      };
      if (genIdx >= 0) store.books.splice(genIdx + 1, 0, letBook);
      else store.books.push(letBook);
      dirty = true;
    } else {
      const lb = store.books.find((b) => b.id === "book-letters");
      if (lb && lb.kind !== "letters") {
        lb.kind = "letters";
        lb.short = lb.short || "LET";
        dirty = true;
      }
    }

    // WORDS library — weak force lexicon (invent + all forms)
    if (!store.books.some((b) => b.id === "book-words")) {
      store.books.push({
        id: "book-words",
        title: "Words",
        short: "WRD",
        kind: "words",
        blurb: "Weak force · your lexicon · Strong optional",
      });
      dirty = true;
    }

    const byKey = {};
    const byGlyph = {};
    store.letters.forEach((L) => {
      if (L.key) byKey[L.key] = L;
      if (L.glyph) byGlyph[L.glyph] = L;
    });

    ALEPH_SEED.forEach(([glyph, key, gem, sound]) => {
      let L = byKey[key] || byGlyph[glyph];
      if (!L) {
        L = {
          id: `let-${key}`,
          glyph,
          key,
          readings: [
            {
              function: "",
              weight: 1,
              notes: "",
              gematria: gem,
              sounds: sound,
            },
          ],
        };
        store.letters.push(L);
        byKey[key] = L;
        byGlyph[glyph] = L;
        dirty = true;
      } else {
        if (!L.id) {
          L.id = `let-${key}`;
          dirty = true;
        }
        if (L.key !== key && key !== "mem") {
          /* keep operator key if intentional */
        }
        if (!L.glyph) {
          L.glyph = glyph;
          dirty = true;
        }
        if (!L.readings || !L.readings.length) {
          L.readings = [
            {
              function: "",
              weight: 1,
              notes: "",
              gematria: gem,
              sounds: sound,
            },
          ];
          dirty = true;
        } else {
          const r0 = L.readings[0];
          if (r0.gematria == null || r0.gematria === "") {
            r0.gematria = gem;
            dirty = true;
          }
          if (!r0.sounds) {
            r0.sounds = sound;
            dirty = true;
          }
        }
      }
    });

    return dirty;
  }

  async function loadStore() {
    const r = await fetch("/api/store", { cache: "no-store" });
    if (!r.ok) throw new Error("store load failed");
    store = await r.json();
    if (!store.papers) store.papers = [];
    if (!store.desk) store.desk = { books_on_table: [], next_z: 20 };
    zTop = store.desk.next_z || 20;
    // migrate words: strongs_form defaults to plain surface
    (store.words || []).forEach((w) => {
      if (w.strongs_form == null || w.strongs_form === "") {
        w.strongs_form = w.surface_plain || stripNiqqud(w.surface || "");
      }
      if (w.eng == null) w.eng = "";
    });
    if (!store.english) store.english = [];
    if (!store.strongs) store.strongs = {};
    // H853 always red / untranslatable mark
    const h853 = store.strongs.H853 || store.strongs.h853;
    if (h853) {
      h853.mark_red = true;
      h853.special = "untranslatable";
    }
    const libDirty = migrateHouseLibraries();
    if (libDirty) {
      // persist so LET stays even after next save cycle
      scheduleSave();
    }
  }

  function stripNiqqud(s) {
    return String(s || "").replace(/[\u0591-\u05C7]/g, "");
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 450);
  }

  async function saveNow() {
    if (!store) return;
    store.desk.next_z = zTop;
    try {
      const r = await fetch("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(store),
      });
      if (!r.ok) throw new Error("save failed");
      toast("saved");
    } catch (e) {
      toast("save error");
      console.error(e);
    }
  }

  function tickClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    $("clock").textContent = `${hh}:${mm}:${ss}`;
  }

  function wordById(id) {
    return (store.words || []).find((w) => w.id === id);
  }
  function letterById(id) {
    return (store.letters || []).find((l) => l.id === id);
  }
  function lineById(id) {
    return (store.lines || []).find((l) => l.id === id);
  }
  function bookById(id) {
    return (store.books || []).find((b) => b.id === id);
  }

  function defaultPaperGeom(kind) {
    if (kind === "help") return { w: 280, h: 320 };
    if (kind === "strong") return { w: 280, h: 320 };
    if (kind === "english") return { w: 260, h: 300 };
    if (kind === "letter") return { w: 240, h: 260 };
    if (kind === "line") return { w: 300, h: 280 };
    return { w: 300, h: 360 }; // word ticket — stackable; resize if you need long defs
  }

  function isMarkRedStrongs(num) {
    if (!num) return false;
    const n = String(num).toUpperCase();
    if (n === "H853") return true; // את untranslatable object marker
    const e = (store.strongs || {})[n] || (store.strongs || {})[num];
    return !!(e && (e.mark_red || e.special === "untranslatable"));
  }

  function ensurePaper(kind, refId, title) {
    let p = (store.papers || []).find(
      (x) => x.kind === kind && x.ref_id === refId && !x.orphan
    );
    if (p) {
      if (!p.w || !p.h) {
        const g = defaultPaperGeom(kind);
        p.w = p.w || g.w;
        p.h = p.h || g.h;
      }
      return p;
    }
    const tw = table.clientWidth || 900;
    const th = table.clientHeight || 500;
    const g = defaultPaperGeom(kind);
    p = {
      id: uid("paper"),
      kind,
      ref_id: refId,
      title: title || kind,
      shelved: false,
      x: 70 + Math.random() * Math.max(40, tw * 0.28),
      y: 36 + Math.random() * Math.max(30, th * 0.22),
      z: ++zTop,
      w: g.w,
      h: g.h,
    };
    store.papers.push(p);
    scheduleSave();
    return p;
  }

  function raisePaper(p) {
    p.z = ++zTop;
    p.shelved = false;
    scheduleSave();
    render();
  }

  /** Park on bottom bar — still exists, click pill to restore. */
  function shelvePaper(p) {
    p.shelved = true;
    scheduleSave();
    render();
  }

  /** True close — leave the table, not the shelf. Ledger data stays; re-click book token to open again. */
  function closePaper(p) {
    store.papers = (store.papers || []).filter((x) => x.id !== p.id);
    scheduleSave();
    render();
  }

  function openWord(wordId) {
    const w = wordById(wordId);
    if (!w) return;
    const p = ensurePaper("word", wordId, w.surface_plain || stripNiqqud(w.surface));
    raisePaper(p);
  }

  function openLetter(letterId) {
    const L = letterById(letterId);
    if (!L) return;
    raisePaper(ensurePaper("letter", letterId, L.glyph));
  }

  function openLine(lineId) {
    const L = lineById(lineId);
    if (!L) return;
    raisePaper(ensurePaper("line", lineId, L.locus));
  }

  function openStrong(strongs) {
    if (!strongs) return;
    raisePaper(ensurePaper("strong", strongs, strongs));
  }

  function englishBySurface(surface) {
    const key = String(surface || "")
      .trim()
      .toLowerCase();
    if (!key) return null;
    return (store.english || []).find(
      (e) => String(e.surface || "").trim().toLowerCase() === key
    );
  }

  function ensureEnglish(surface, fromWord) {
    if (!store.english) store.english = [];
    const key = String(surface || "")
      .trim()
      .toLowerCase();
    if (!key || key === "·") return null;
    let rec = englishBySurface(surface);
    if (!rec) {
      rec = {
        id: uid("en"),
        surface: String(surface).trim(),
        source: "KJV-shaped gloss",
        strongs: (fromWord && fromWord.strongs) || "",
        word_ids: fromWord ? [fromWord.id] : [],
        readings: [
          {
            gloss_or_function: "",
            weight: 1,
            interpreter: "operator",
            era_notes: "",
            notes: "",
          },
        ],
        etymology: "",
        era_notes: "",
        notes: "",
      };
      store.english.push(rec);
      scheduleSave();
    } else if (fromWord) {
      if (!rec.word_ids) rec.word_ids = [];
      if (!rec.word_ids.includes(fromWord.id)) {
        rec.word_ids.push(fromWord.id);
        scheduleSave();
      }
      if (fromWord.strongs && !rec.strongs) {
        rec.strongs = fromWord.strongs;
        scheduleSave();
      }
    }
    return rec;
  }

  function openEnglish(surface, fromWord) {
    const rec = ensureEnglish(surface, fromWord);
    if (!rec) return;
    raisePaper(ensurePaper("english", rec.id, rec.surface));
  }

  function openHelp() {
    raisePaper(ensurePaper("help", "help", "how to"));
  }

  function wordsWithStrongs(num) {
    return (store.words || []).filter(
      (w) => (w.strongs || "").toUpperCase() === (num || "").toUpperCase()
    );
  }

  function ensureStrongsEntry(num) {
    if (!num) return null;
    if (!store.strongs) store.strongs = {};
    const key = String(num).toUpperCase();
    // normalize keys
    let entry = store.strongs[key] || store.strongs[num];
    if (!entry) {
      entry = {
        lemma: "",
        gloss: "",
        def: "",
        era_notes: "",
        notes: "",
      };
      store.strongs[key] = entry;
    }
    return entry;
  }

  /* ── drag / resize (mouse + pen tablet safe) ─────────────
   * Wacom/pen often: loses capture, fires pointercancel, reports
   * buttons=0 on move, or fails setPointerCapture on wrong node.
   */
  function isPrimaryContact(ev) {
    // mouse left, pen tip, or touch — ignore barrel/eraser as primary drag
    if (ev.pointerType === "mouse") return ev.button === 0;
    if (ev.pointerType === "pen") return ev.button === 0 || ev.buttons === 1;
    if (ev.pointerType === "touch") return true;
    return ev.button === 0;
  }

  function endDragOrResize(ev) {
    if (resizeState) {
      if (ev && resizeState.pointerId != null && ev.pointerId !== resizeState.pointerId)
        return;
      try {
        if (resizeState.captureEl && resizeState.pointerId != null) {
          resizeState.captureEl.releasePointerCapture(resizeState.pointerId);
        }
      } catch (_) {}
      resizeState.el.classList.remove("is-raised");
      resizeState = null;
      scheduleSave();
      return;
    }
    if (!dragState) return;
    if (ev && dragState.pointerId != null && ev.pointerId !== dragState.pointerId)
      return;
    try {
      if (dragState.captureEl && dragState.pointerId != null) {
        dragState.captureEl.releasePointerCapture(dragState.pointerId);
      }
    } catch (_) {}
    dragState.el.classList.remove("is-raised");
    dragState = null;
    scheduleSave();
  }

  function raiseToFront(el, onRaise) {
    const z = ++zTop;
    el.style.zIndex = String(z);
    el.classList.add("is-raised");
    if (onRaise) onRaise(z);
  }

  function bindDrag(el, onMove, onRaise) {
    const head = el.querySelector(".cc-obj-title");
    if (!head) return;
    head.style.touchAction = "none";
    head.addEventListener(
      "pointerdown",
      (ev) => {
        if (ev.target.closest("button") || ev.target.closest(".cc-resize"))
          return;
        if (!isPrimaryContact(ev)) return;
        // Bring to front even when stopPropagation blocks the body handler
        raiseToFront(el, onRaise);
        const rect = el.getBoundingClientRect();
        const parent = table.getBoundingClientRect();
        dragState = {
          el,
          captureEl: head,
          pointerId: ev.pointerId,
          pointerType: ev.pointerType,
          ox: ev.clientX - rect.left,
          oy: ev.clientY - rect.top,
          parent,
          onMove,
        };
        try {
          head.setPointerCapture(ev.pointerId);
        } catch (_) {
          /* capture optional; document listeners still work */
        }
        try {
          ev.preventDefault();
        } catch (_) {}
        ev.stopPropagation();
      },
      { passive: false }
    );
  }

  function bindResize(el, onSize, onRaise) {
    const handle = document.createElement("div");
    handle.className = "cc-resize";
    handle.title = "resize";
    handle.style.touchAction = "none";
    el.appendChild(handle);
    handle.addEventListener(
      "pointerdown",
      (ev) => {
        if (!isPrimaryContact(ev)) return;
        raiseToFront(el, onRaise);
        ev.stopPropagation();
        const rect = el.getBoundingClientRect();
        resizeState = {
          el,
          captureEl: handle,
          pointerId: ev.pointerId,
          pointerType: ev.pointerType,
          startX: ev.clientX,
          startY: ev.clientY,
          startW: rect.width,
          startH: rect.height,
          onSize,
        };
        try {
          handle.setPointerCapture(ev.pointerId);
        } catch (_) {}
        try {
          ev.preventDefault();
        } catch (_) {}
      },
      { passive: false }
    );
  }

  function onPointerMove(ev) {
    if (resizeState) {
      if (
        resizeState.pointerId != null &&
        ev.pointerId !== resizeState.pointerId
      )
        return;
      const { el, startX, startY, startW, startH, onSize } = resizeState;
      // pen drivers sometimes omit clientX on coalesced junk — guard
      if (!Number.isFinite(ev.clientX) || !Number.isFinite(ev.clientY)) return;
      const w = Math.max(200, startW + (ev.clientX - startX));
      const h = Math.max(140, startH + (ev.clientY - startY));
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      if (onSize) onSize(w, h);
      try {
        ev.preventDefault();
      } catch (_) {}
      return;
    }
    if (!dragState) return;
    if (dragState.pointerId != null && ev.pointerId !== dragState.pointerId)
      return;
    if (!Number.isFinite(ev.clientX) || !Number.isFinite(ev.clientY)) return;
    const { el, ox, oy, onMove } = dragState;
    // refresh parent bounds each move (window resize / deck host)
    const parent = table.getBoundingClientRect();
    dragState.parent = parent;
    let x = ev.clientX - parent.left - ox;
    let y = ev.clientY - parent.top - oy;
    x = Math.max(0, Math.min(x, parent.width - 80));
    y = Math.max(0, Math.min(y, parent.height - 40));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (onMove) onMove(x, y);
    try {
      ev.preventDefault();
    } catch (_) {}
  }

  // capture:true so we still get moves when pen leaves the webview chrome
  document.addEventListener("pointermove", onPointerMove, {
    capture: true,
    passive: false,
  });
  document.addEventListener("pointerup", endDragOrResize, { capture: true });
  document.addEventListener("pointercancel", endDragOrResize, {
    capture: true,
  });
  document.addEventListener("lostpointercapture", (ev) => {
    if (dragState && dragState.pointerId === ev.pointerId) endDragOrResize(ev);
    if (resizeState && resizeState.pointerId === ev.pointerId)
      endDragOrResize(ev);
  });

  document.addEventListener("focusin", (ev) => {
    const t = ev.target;
    if (
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable)
    ) {
      focusField = t;
    }
  });

  /* ── hebrew board ─────────────────────────────────────── */
  function buildHebGrid() {
    const grid = $("hebGrid");
    const finals = $("hebFinals").checked;
    grid.innerHTML = "";
    for (const [g, name] of HEB_BASE) {
      const glyph = finals && HEB_FINAL[g] ? HEB_FINAL[g] : g;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-heb-key";
      const sub =
        HEB_FINAL[g] && !finals ? `${name} · ${HEB_FINAL[g]}` : name;
      btn.innerHTML = `${glyph}<small>${sub}</small>`;
      btn.addEventListener("click", () => insertHeb(glyph));
      grid.appendChild(btn);
    }
    const sp = document.createElement("button");
    sp.type = "button";
    sp.className = "cc-heb-key";
    sp.style.gridColumn = "span 3";
    sp.textContent = "space";
    sp.addEventListener("click", () => insertHeb(" "));
    grid.appendChild(sp);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "cc-heb-key";
    del.style.gridColumn = "span 3";
    del.textContent = "⌫";
    del.addEventListener("click", () => backspaceHeb());
    grid.appendChild(del);
  }

  function insertHeb(ch) {
    const el = focusField;
    if (!el || el.disabled || el.readOnly) {
      toast("focus a field first");
      return;
    }
    if (typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const v = el.value || "";
      el.value = v.slice(0, start) + ch + v.slice(end);
      const pos = start + ch.length;
      el.setSelectionRange(pos, pos);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    } else {
      el.value = (el.value || "") + ch;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function backspaceHeb() {
    const el = focusField;
    if (!el || typeof el.selectionStart !== "number") return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const v = el.value || "";
    if (start !== end) {
      el.value = v.slice(0, start) + v.slice(end);
      el.setSelectionRange(start, start);
    } else if (start > 0) {
      el.value = v.slice(0, start - 1) + v.slice(end);
      el.setSelectionRange(start - 1, start - 1);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  }

  /* ── render helpers ───────────────────────────────────── */
  function weightPips(container, value, onSet) {
    container.innerHTML = "";
    container.className = "cc-weight";
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.title = String(i);
      if (i <= (value || 0)) b.classList.add("on");
      b.addEventListener("click", () => onSet(i));
      container.appendChild(b);
    }
  }

  function renderReadings(host, readings, onChange) {
    host.innerHTML = "";
    host.className = "cc-readings";
    const list = readings || [];
    list.forEach((rd, idx) => {
      // Each meaning = its own weight (not shared). Layout: top line weight+who+body+rm, notes under.
      const row = document.createElement("div");
      row.className = "cc-rd-row";

      const top = document.createElement("div");
      top.className = "cc-rd-top";

      const pips = document.createElement("span");
      pips.className = "cc-rd-weight";
      const applyWeight = (w) => {
        rd.weight = w;
        onChange();
        weightPips(pips, w, applyWeight);
      };
      weightPips(pips, rd.weight || 0, applyWeight);
      top.appendChild(pips);

      const who = document.createElement("input");
      who.className = "cc-rd-who";
      who.value = rd.interpreter || "";
      who.placeholder = "who";
      who.title = "interpreter for this reading";
      who.addEventListener("change", () => {
        rd.interpreter = who.value;
        onChange();
      });
      top.appendChild(who);

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "cc-mini";
      rm.textContent = "×";
      rm.title = "remove reading";
      rm.addEventListener("click", () => {
        list.splice(idx, 1);
        onChange();
        render();
      });
      top.appendChild(rm);
      row.appendChild(top);

      // Full-width definition — scannable (not a one-line mono micro field)
      const body = document.createElement("textarea");
      body.className = "cc-rd-body";
      body.rows = 2;
      body.value = rd.gloss_or_function || rd.text || rd.function || "";
      body.placeholder = "definition / reading";
      body.addEventListener("input", () => {
        const v = body.value;
        rd.gloss_or_function = v;
        if ("function" in rd) rd.function = v;
        if ("text" in rd) rd.text = v;
        onChange();
      });
      row.appendChild(body);

      const notes = document.createElement("textarea");
      notes.className = "cc-rd-notes";
      notes.rows = 1;
      notes.value = rd.notes || "";
      notes.placeholder = "notes";
      notes.addEventListener("input", () => {
        rd.notes = notes.value;
        onChange();
      });
      row.appendChild(notes);

      host.appendChild(row);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "+rd";
    add.className = "cc-row-btn";
    add.addEventListener("click", () => {
      list.push({
        gloss_or_function: "",
        text: "",
        function: "",
        weight: 1,
        interpreter: "operator",
        era_notes: "",
        notes: "",
      });
      onChange();
      render();
    });
    host.appendChild(add);
  }

  function kindSkin(kind) {
    const k = String(kind || "").toUpperCase();
    if (k === "STRONG" || k === "WORD" || k === "EN" || k === "ENGLISH")
      return k === "ENGLISH" ? "en" : k.toLowerCase();
    if (k === "LETTER") return "letter";
    if (k === "LINE") return "line";
    if (k === "HELP") return "help";
    if (k === "BOOK") return "book";
    if (k === "CAB") return "cab";
    return "default";
  }

  function makeObjShell(opts) {
    const el = document.createElement("div");
    const skin = kindSkin(opts.kind);
    el.className =
      "cc-obj " +
      (opts.className || "") +
      " cc-skin-" +
      skin;
    el.style.left = `${opts.x || 40}px`;
    el.style.top = `${opts.y || 40}px`;
    el.style.zIndex = String(opts.z || 5);
    el.style.width = `${opts.w || 320}px`;
    el.style.height = `${opts.h || 280}px`;
    el.dataset.paperId = opts.paperId || "";
    el.dataset.kind = opts.kind || "";

    const title = document.createElement("div");
    title.className = "cc-obj-title";
    title.innerHTML = `<span class="cc-obj-kind">${opts.kind || ""}</span><span class="cc-obj-name"></span>`;
    title.querySelector(".cc-obj-name").textContent = opts.name || "";

    const actions = document.createElement("div");
    actions.className = "cc-obj-actions";

    if (opts.onShelve) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "SHELF";
      b.title = "park on bottom bar";
      b.addEventListener("click", opts.onShelve);
      actions.appendChild(b);
    }
    if (opts.onClose) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "×";
      b.title = opts.closeTitle || "close (not shelved)";
      b.addEventListener("click", opts.onClose);
      actions.appendChild(b);
    }
    title.appendChild(actions);
    el.appendChild(title);

    const body = document.createElement("div");
    body.className = "cc-obj-body";
    el.appendChild(body);

    const onRaise = opts.onRaise
      ? (z) => {
          opts.onRaise(z);
        }
      : null;

    bindDrag(
      el,
      (x, y) => {
        if (opts.onPos) opts.onPos(x, y);
      },
      onRaise
    );
    bindResize(
      el,
      (w, h) => {
        if (opts.onSize) opts.onSize(w, h);
      },
      onRaise
    );

    // Body click stacks to front (title/resize already raise in bindDrag/bindResize)
    el.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest(".cc-obj-title") || ev.target.closest(".cc-resize"))
        return;
      if (!isPrimaryContact(ev)) return;
      raiseToFront(el, onRaise);
    });

    return { el, body, title };
  }

  function field(label, inputEl) {
    const wrap = document.createElement("div");
    wrap.className = "cc-field";
    const lab = document.createElement("label");
    lab.textContent = label;
    wrap.appendChild(lab);
    wrap.appendChild(inputEl);
    return wrap;
  }

  /** Fixed facts as printout (not inputs) — identity / joins you don't edit on the card. */
  function printField(label, value, opts) {
    opts = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "cc-field cc-field-print";
    const lab = document.createElement("label");
    lab.textContent = label;
    wrap.appendChild(lab);
    const val = document.createElement("div");
    val.className = "cc-print";
    if (opts.he) val.classList.add("cc-print-he", "cc-print-chip");
    if (opts.en) val.classList.add("cc-print-en", "cc-print-chip");
    if (opts.chip && !opts.he && !opts.en) val.classList.add("cc-print-chip");
    if (opts.mono) val.classList.add("cc-print-mono");
    const t = value == null || value === "" ? "—" : String(value);
    val.textContent = t;
    if (opts.empty || t === "—") val.classList.add("is-empty");
    wrap.appendChild(val);
    return wrap;
  }

  /* ── books: scripture spread OR library catalog ───────── */
  function renderBook(bookState) {
    const book = bookById(bookState.book_id);
    if (!book) return;

    const isLetters = book.kind === "letters";
    const isWords = book.kind === "words" || book.id === "book-words";
    if (!bookState.w) bookState.w = isLetters || isWords ? 380 : 440;
    if (!bookState.h) bookState.h = isLetters || isWords ? 480 : 280;

    const { el, body } = makeObjShell({
      className: "cc-book" + (isLetters ? " cc-book-lib" : ""),
      kind: "BOOK",
      name: book.title,
      x: bookState.x,
      y: bookState.y,
      z: bookState.z,
      w: bookState.w,
      h: bookState.h,
      onPos: (x, y) => {
        bookState.x = x;
        bookState.y = y;
      },
      onSize: (w, h) => {
        bookState.w = w;
        bookState.h = h;
      },
      onRaise: () => {
        bookState.z = zTop;
      },
      onClose: () => {
        // Book leaves the table. Bar keeps library slots.
        store.desk.books_on_table = (store.desk.books_on_table || []).filter(
          (b) => b.book_id !== bookState.book_id
        );
        scheduleSave();
        render();
      },
      closeTitle: "close book (library keeps bar slot)",
    });

    if (isLetters) {
      renderLettersBookBody(body);
      table.appendChild(el);
      return;
    }
    if (isWords) {
      renderWordsBookBody(body);
      table.appendChild(el);
      return;
    }

    // current line: desk state override → book.line_id → first of line_ids
    const lineIds =
      (Array.isArray(book.line_ids) && book.line_ids.length
        ? book.line_ids
        : null) ||
      (book.line_id ? [book.line_id] : []);
    if (!bookState.line_id || lineIds.indexOf(bookState.line_id) < 0) {
      bookState.line_id = book.line_id || lineIds[0] || null;
    }
    const line = lineById(bookState.line_id || book.line_id);
    if (!line) {
      body.textContent = "—";
      table.appendChild(el);
      return;
    }

    const nav = document.createElement("div");
    nav.className = "cc-book-nav";
    const idx = Math.max(0, lineIds.indexOf(line.id));
    if (lineIds.length > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "cc-book-nav-btn";
      prev.textContent = "◀";
      prev.title = "Previous verse";
      prev.disabled = idx <= 0;
      prev.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (idx <= 0) return;
        bookState.line_id = lineIds[idx - 1];
        book.line_id = bookState.line_id;
        const L = lineById(bookState.line_id);
        if (L) book.open_locus = L.locus;
        scheduleSave();
        render();
      });
      nav.appendChild(prev);
    }
    const locus = document.createElement("button");
    locus.type = "button";
    locus.className = "cc-book-locus";
    locus.textContent = line.locus;
    locus.title = "Open line paper";
    locus.addEventListener("click", () => openLine(line.id));
    nav.appendChild(locus);
    if (lineIds.length > 1) {
      const next = document.createElement("button");
      next.type = "button";
      next.className = "cc-book-nav-btn";
      next.textContent = "▶";
      next.title = "Next verse";
      next.disabled = idx >= lineIds.length - 1;
      next.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (idx >= lineIds.length - 1) return;
        bookState.line_id = lineIds[idx + 1];
        book.line_id = bookState.line_id;
        const L = lineById(bookState.line_id);
        if (L) book.open_locus = L.locus;
        scheduleSave();
        render();
      });
      nav.appendChild(next);
    }
    body.appendChild(nav);

    const words = (line.word_ids || [])
      .map((id) => wordById(id))
      .filter(Boolean);

    // Row 1 — Hebrew surface (as written)
    const rowHe = document.createElement("div");
    rowHe.className = "cc-book-row cc-book-he";
    rowHe.setAttribute("dir", "rtl");
    words.forEach((w) => {
      const tok = document.createElement("button");
      tok.type = "button";
      tok.className = "cc-tok";
      if (isMarkRedStrongs(w.strongs)) tok.classList.add("is-mark-red");
      tok.textContent = w.surface || w.surface_plain || "";
      tok.title = w.surface_plain || "";
      tok.addEventListener("click", () => openWord(w.id));
      rowHe.appendChild(tok);
    });
    body.appendChild(rowHe);

    // Row 2 — Strong numbers (same order)
    const rowSt = document.createElement("div");
    rowSt.className = "cc-book-row cc-book-strongs";
    rowSt.setAttribute("dir", "rtl");
    words.forEach((w) => {
      const tok = document.createElement("button");
      tok.type = "button";
      tok.className = "cc-tok cc-tok-num";
      if (isMarkRedStrongs(w.strongs)) tok.classList.add("is-mark-red");
      tok.textContent = w.strongs || "·";
      tok.disabled = !w.strongs;
      if (w.strongs) {
        tok.addEventListener("click", () => openStrong(w.strongs));
      }
      rowSt.appendChild(tok);
    });
    body.appendChild(rowSt);

    // Row 3 — English gloss tokens → English paper (mother-tongue / KJV choice)
    const rowEn = document.createElement("div");
    rowEn.className = "cc-book-row cc-book-en-row";
    words.forEach((w) => {
      const tok = document.createElement("button");
      tok.type = "button";
      tok.className = "cc-tok cc-tok-en";
      if (isMarkRedStrongs(w.strongs)) tok.classList.add("is-mark-red");
      tok.textContent = w.eng || "·";
      tok.title = w.eng ? `English: ${w.eng}` : "";
      if (w.eng && w.eng !== "·") {
        tok.addEventListener("click", () => openEnglish(w.eng, w));
      } else {
        tok.disabled = true;
      }
      rowEn.appendChild(tok);
    });
    body.appendChild(rowEn);

    if (line.surface_en) {
      const full = document.createElement("button");
      full.type = "button";
      full.className = "cc-book-en-full";
      full.textContent = line.surface_en;
      full.addEventListener("click", () => openLine(line.id));
      body.appendChild(full);
    }

    table.appendChild(el);
  }

  /** Weak-force word library — invents + seeded forms; open blue paper to work. */
  function renderWordsBookBody(body) {
    const locus = document.createElement("div");
    locus.className = "cc-book-locus";
    locus.textContent = "Words · weak force · click to open";
    body.appendChild(locus);

    const tools = document.createElement("div");
    tools.className = "cc-words-tools";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "cc-row-btn";
    addBtn.textContent = "+ invent word";
    addBtn.addEventListener("click", () => newWord());
    tools.appendChild(addBtn);
    body.appendChild(tools);

    const list = document.createElement("div");
    list.className = "cc-words-list";

    const words = (store.words || []).slice().sort((a, b) => {
      const ai = !a.strongs ? 0 : 1;
      const bi = !b.strongs ? 0 : 1;
      if (ai !== bi) return ai - bi;
      const as = a.surface_plain || stripNiqqud(a.surface || "") || "";
      const bs = b.surface_plain || stripNiqqud(b.surface || "") || "";
      return as.localeCompare(bs, "he");
    });

    words.forEach((w) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "cc-words-row" + (!w.strongs || w.invent ? " is-invent" : "");
      const he = w.surface || w.surface_plain || "·";
      const plain = w.surface_plain || stripNiqqud(w.surface || "") || "";
      const nRd = (w.readings || []).filter(
        (r) => (r.gloss_or_function || r.text || r.function || "").trim()
      ).length;
      const tag = !w.strongs || w.invent ? "invent" : w.strongs || "";
      btn.innerHTML =
        `<span class="cc-words-he" dir="rtl">${he}</span>` +
        `<span class="cc-words-meta">${plain || "—"}${
          w.eng && w.eng !== "·" ? " · " + w.eng : ""
        }</span>` +
        `<span class="cc-words-tag">${tag}</span>` +
        `<span class="cc-words-n">${nRd} def</span>`;
      btn.title = [plain, w.eng, tag].filter(Boolean).join(" · ");
      btn.addEventListener("click", () => openWord(w.id));
      list.appendChild(btn);
    });

    if (!words.length) {
      const empty = document.createElement("div");
      empty.className = "cc-lib-foot";
      empty.textContent = "no words yet · + invent word";
      list.appendChild(empty);
    }
    body.appendChild(list);

    const foot = document.createElement("div");
    foot.className = "cc-lib-foot";
    const nInv = words.filter((w) => !w.strongs || w.invent).length;
    foot.textContent = `${words.length} words · ${nInv} without Strong · weak force first`;
    body.appendChild(foot);
  }

  /** Letters library — definitions/codes, not the typing board (א ב). */
  function renderLettersBookBody(body) {
    const locus = document.createElement("div");
    locus.className = "cc-book-locus";
    locus.textContent = "Letter functions · open a paper to edit";
    body.appendChild(locus);

    const grid = document.createElement("div");
    grid.className = "cc-lib-grid";

    const letters = (store.letters || []).slice().sort((a, b) => {
      const ga = (a.readings && a.readings[0] && a.readings[0].gematria) || 0;
      const gb = (b.readings && b.readings[0] && b.readings[0].gematria) || 0;
      if (ga !== gb) return ga - gb;
      return String(a.key || "").localeCompare(String(b.key || ""));
    });

    letters.forEach((L) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-lib-cell";
      const fn =
        (L.readings &&
          L.readings[0] &&
          (L.readings[0].function || L.readings[0].gloss_or_function)) ||
        "";
      const gem =
        L.readings && L.readings[0] && L.readings[0].gematria != null
          ? String(L.readings[0].gematria)
          : "";
      btn.innerHTML = `<span class="cc-lib-glyph">${L.glyph || "?"}</span><span class="cc-lib-key">${
        L.key || ""
      }</span><span class="cc-lib-fn">${fn || "—"}</span><span class="cc-lib-gem">${gem}</span>`;
      btn.title = [L.glyph, L.key, fn].filter(Boolean).join(" · ");
      btn.addEventListener("click", () => openLetter(L.id));
      grid.appendChild(btn);
    });
    body.appendChild(grid);

    const foot = document.createElement("div");
    foot.className = "cc-lib-foot";
    foot.textContent = `${letters.length} letters · click to open · א ב is type-only`;
    body.appendChild(foot);
  }

  function renderWordPaper(p) {
    const w = wordById(p.ref_id);
    if (!w) return;
    const g = defaultPaperGeom("word");
    const { el, body } = makeObjShell({
      kind: "WORD",
      name: w.surface_plain || stripNiqqud(w.surface) || p.title,
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });

    // Blue card = invent / think space. Strong # is optional later — not required.
    ensureWordWorkspace(w);

    const invent = !w.strongs;
    const banner = document.createElement("div");
    banner.className = "cc-sec" + (invent ? " cc-sec-invent" : "");
    banner.textContent = invent
      ? "invent / think — no Strong required · fill the form, write readings"
      : "word workspace · Strong join optional";
    body.appendChild(banner);

    const syncTitle = () => {
      const t =
        w.surface_plain || stripNiqqud(w.surface || "") || p.title || "word";
      p.title = t;
      const titleEl = el.querySelector(".cc-obj-title");
      if (titleEl) titleEl.textContent = t;
    };

    const surf = document.createElement("input");
    surf.className = "cc-input cc-input-he";
    surf.dir = "rtl";
    surf.placeholder = "the form · Hebrew (niqqud ok)";
    surf.value = w.surface || "";
    surf.addEventListener("input", () => {
      w.surface = surf.value;
      if (
        !w.surface_plain ||
        w.surface_plain === stripNiqqud(w.surface || "")
      ) {
        w.surface_plain = stripNiqqud(surf.value);
        if (plain && document.activeElement !== plain)
          plain.value = w.surface_plain;
      }
      syncTitle();
      scheduleSave();
    });
    body.appendChild(field("the form (as written)", surf));

    const plain = document.createElement("input");
    plain.className = "cc-input cc-input-he";
    plain.dir = "rtl";
    plain.placeholder = "plain letters";
    plain.value = w.surface_plain || stripNiqqud(w.surface || "") || "";
    plain.addEventListener("input", () => {
      w.surface_plain = plain.value;
      syncTitle();
      scheduleSave();
    });
    body.appendChild(field("plain", plain));

    const engIn = document.createElement("input");
    engIn.className = "cc-input";
    engIn.placeholder = "working English (optional · not Strong)";
    engIn.value = w.eng && w.eng !== "·" ? w.eng : "";
    engIn.addEventListener("input", () => {
      w.eng = engIn.value;
      scheduleSave();
    });
    body.appendChild(field("working English", engIn));
    if (w.eng && w.eng !== "·") {
      const enBtn = document.createElement("button");
      enBtn.type = "button";
      enBtn.className = "cc-btn-en";
      enBtn.textContent = "open English";
      enBtn.addEventListener("click", () => openEnglish(w.eng, w));
      body.appendChild(enBtn);
    }

    if (w.letters && w.letters.length) {
      const chips = document.createElement("div");
      chips.className = "cc-chips";
      w.letters.forEach((lid) => {
        const L = letterById(lid);
        if (!L) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cc-chip-glyph";
        b.textContent = L.glyph;
        b.title = L.key;
        b.addEventListener("click", () => openLetter(lid));
        chips.appendChild(b);
      });
      body.appendChild(chips);
    }

    const rh = document.createElement("div");
    rh.className = "cc-sec";
    rh.textContent = invent
      ? "your definitions (this is the work)"
      : "your readings (not Strong’s def)";
    body.appendChild(rh);
    const host = document.createElement("div");
    renderReadings(host, w.readings, scheduleSave);
    body.appendChild(host);

    // Strong is a later join — collapsed so invent-mode isn't haunted by H####
    const strongFold = document.createElement("details");
    strongFold.className = "cc-strong-fold";
    if (w.strongs) strongFold.open = true;
    const sum = document.createElement("summary");
    sum.textContent = w.strongs
      ? "Strong join · " + w.strongs
      : "optional · attach Strong # later";
    strongFold.appendChild(sum);

    const formLink = document.createElement("input");
    formLink.className = "cc-input cc-input-he";
    formLink.dir = "rtl";
    formLink.placeholder = "lemma form if different from plain";
    formLink.value = w.strongs_form || "";
    formLink.addEventListener("input", () => {
      w.strongs_form = formLink.value;
      scheduleSave();
    });
    strongFold.appendChild(field("form link", formLink));

    const join = document.createElement("div");
    join.className = "cc-word-join";
    const numIn = document.createElement("input");
    numIn.className = "cc-input cc-input-mono cc-word-join-num";
    numIn.placeholder = "H#### if you have one";
    numIn.value = w.strongs || "";
    numIn.addEventListener("change", () => {
      let v = String(numIn.value || "").trim().toUpperCase();
      if (v && !/^H/i.test(v)) v = "H" + v.replace(/^H/i, "");
      w.strongs = v;
      numIn.value = v;
      scheduleSave();
      render();
    });
    join.appendChild(numIn);
    const openR = document.createElement("button");
    openR.type = "button";
    openR.className =
      "cc-btn-strong" + (isMarkRedStrongs(w.strongs) ? " is-mark-red" : "");
    openR.textContent = "open Strong paper";
    openR.disabled = !w.strongs;
    openR.addEventListener("click", () => {
      if (w.strongs) {
        ensureStrongsEntry(w.strongs);
        openStrong(w.strongs);
      }
    });
    join.appendChild(openR);
    strongFold.appendChild(field("Strong # (optional)", join));

    if (w.strongs) {
      const hits = wordsWithStrongs(w.strongs).filter((x) => x.id !== w.id);
      if (hits.length) {
        const box = document.createElement("div");
        box.className = "cc-strong-hits";
        const lab = document.createElement("div");
        lab.className = "cc-sec";
        lab.textContent = "other words on " + w.strongs;
        box.appendChild(lab);
        hits.forEach((h) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = h.surface_plain || stripNiqqud(h.surface);
          b.addEventListener("click", () => openWord(h.id));
          box.appendChild(b);
        });
        strongFold.appendChild(box);
      }
    }
    body.appendChild(strongFold);

    table.appendChild(el);
    // invent: focus the form so aleph board / typing lands somewhere real
    if (invent && !w.surface) {
      setTimeout(() => {
        try {
          surf.focus();
        } catch (_) {}
      }, 30);
    }
  }

  /** Blue card: operator workspace only — strip Strong-layer readings if any snuck in. */
  function ensureWordWorkspace(w) {
    if (!w.readings) w.readings = [];
    const kept = w.readings.filter((r) => {
      const who = String(r.interpreter || "")
        .trim()
        .toLowerCase();
      if (!who) return true;
      if (who === "strong" || who.startsWith("strong")) return false;
      if (who === "tradition") return false;
      return true;
    });
    if (!kept.length) {
      kept.push({
        gloss_or_function: "",
        weight: 1,
        interpreter: "operator",
        era_notes: "",
        notes: "",
      });
    }
    w.readings = kept;
  }

  function renderLetterPaper(p) {
    const L = letterById(p.ref_id);
    if (!L) return;
    const g = defaultPaperGeom("letter");
    const { el, body } = makeObjShell({
      kind: "LETTER",
      name: `${L.glyph} · ${L.key || ""}`,
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });

    const big = document.createElement("div");
    big.className = "cc-letter-big";
    big.textContent = L.glyph;
    body.appendChild(big);

    const inp = document.createElement("input");
    inp.value = L.key || "";
    inp.addEventListener("change", () => {
      L.key = inp.value;
      scheduleSave();
    });
    body.appendChild(field("key", inp));

    const rh = document.createElement("div");
    rh.className = "cc-sec";
    rh.textContent = "functions";
    body.appendChild(rh);
    if (!L.readings) L.readings = [];
    L.readings.forEach((r) => {
      if (r.function && !r.gloss_or_function) r.gloss_or_function = r.function;
    });
    const host = document.createElement("div");
    renderReadings(host, L.readings, () => {
      L.readings.forEach((r) => {
        if (r.gloss_or_function) r.function = r.gloss_or_function;
      });
      scheduleSave();
    });
    body.appendChild(host);

    table.appendChild(el);
  }

  function renderLinePaper(p) {
    const L = lineById(p.ref_id);
    if (!L) return;
    const g = defaultPaperGeom("line");
    const { el, body } = makeObjShell({
      kind: "LINE",
      name: L.locus,
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });

    const he = document.createElement("div");
    he.className = "cc-line-he";
    he.setAttribute("dir", "rtl");
    he.textContent = L.surface || "";
    body.appendChild(he);

    if (L.surface_en) {
      const en = document.createElement("div");
      en.className = "cc-line-en";
      en.textContent = L.surface_en;
      body.appendChild(en);
    }

    const chips = document.createElement("div");
    chips.className = "cc-chips";
    (L.word_ids || []).forEach((wid) => {
      const w = wordById(wid);
      if (!w) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-chip-glyph";
      b.textContent = w.surface_plain || stripNiqqud(w.surface);
      b.addEventListener("click", () => openWord(wid));
      chips.appendChild(b);
    });
    body.appendChild(chips);

    const rh = document.createElement("div");
    rh.className = "cc-sec";
    rh.textContent = "readings";
    body.appendChild(rh);
    if (!L.readings) L.readings = [];
    L.readings.forEach((r) => {
      if (r.text && !r.gloss_or_function) r.gloss_or_function = r.text;
    });
    const host = document.createElement("div");
    renderReadings(host, L.readings, () => {
      L.readings.forEach((r) => {
        if (r.gloss_or_function) r.text = r.gloss_or_function;
      });
      scheduleSave();
    });
    body.appendChild(host);

    table.appendChild(el);
  }

  function renderStrongPaper(p) {
    const num = p.ref_id;
    const hits = wordsWithStrongs(num);
    const entry = ensureStrongsEntry(num);
    const g = defaultPaperGeom("strong");
    if (!p.w) p.w = 280;
    if (!p.h) p.h = 320;
    const red = isMarkRedStrongs(num);
    const { el, body } = makeObjShell({
      kind: "STRONG",
      name: num,
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });
    if (red) el.classList.add("is-mark-red-obj");

    // Little definer card
    const definer = document.createElement("div");
    definer.className = "cc-definer" + (red ? " is-mark-red" : "");

    const head = document.createElement("div");
    head.className = "cc-definer-head";
    head.innerHTML = `<span class="cc-definer-tag">Strong</span><span class="cc-definer-num">${num}</span>`;
    if (red) {
      const mark = document.createElement("span");
      mark.className = "cc-mark-badge";
      mark.textContent = "untranslatable";
      head.appendChild(mark);
    }
    definer.appendChild(head);

    // lemma = fixed identity chip (don't fat-finger Strong’s headword)
    definer.appendChild(
      printField("lemma", entry.lemma || "—", { he: true })
    );

    const gloss = document.createElement("input");
    gloss.value = entry.gloss || "";
    gloss.placeholder = "gloss";
    gloss.addEventListener("input", () => {
      entry.gloss = gloss.value;
      scheduleSave();
    });
    definer.appendChild(field("gloss", gloss));

    const def = document.createElement("textarea");
    def.value = entry.def || "";
    def.placeholder = "Strong’s definition";
    def.rows = 3;
    def.addEventListener("input", () => {
      entry.def = def.value;
      scheduleSave();
    });
    definer.appendChild(field("definition", def));

    const era = document.createElement("input");
    era.value = entry.era_notes || "";
    era.placeholder = "gloss-era / source notes";
    era.addEventListener("input", () => {
      entry.era_notes = era.value;
      scheduleSave();
    });
    definer.appendChild(field("era", era));

    body.appendChild(definer);

    const sec = document.createElement("div");
    sec.className = "cc-sec";
    sec.textContent = "in text";
    body.appendChild(sec);

    const box = document.createElement("div");
    box.className = "cc-strong-hits";
    if (!hits.length) {
      box.textContent = "—";
    } else {
      hits.forEach((h) => {
        const b = document.createElement("button");
        b.type = "button";
        const form =
          h.strongs_form &&
          h.strongs_form !== (h.surface_plain || stripNiqqud(h.surface))
            ? ` · ${h.strongs_form}`
            : "";
        const eng = h.eng ? ` — ${h.eng}` : "";
        b.textContent = `${h.surface_plain || stripNiqqud(h.surface)}${form}${eng}`;
        b.addEventListener("click", () => openWord(h.id));
        box.appendChild(b);
      });
    }
    body.appendChild(box);
    table.appendChild(el);
  }

  function renderEnglishPaper(p) {
    const rec = (store.english || []).find((e) => e.id === p.ref_id);
    if (!rec) return;
    const g = defaultPaperGeom("english");
    const { el, body } = makeObjShell({
      kind: "EN",
      name: rec.surface,
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });

    const head = document.createElement("div");
    head.className = "cc-definer-head";
    head.innerHTML = `<span class="cc-definer-tag">English</span><span class="cc-definer-num"></span>`;
    head.querySelector(".cc-definer-num").textContent = rec.surface;
    body.appendChild(head);

    body.appendChild(printField("gloss token", rec.surface, { en: true }));
    body.appendChild(
      printField("source tradition", rec.source || "KJV-shaped gloss", {
        chip: true,
      })
    );

    // Your work on this English spell
    const ety = document.createElement("textarea");
    ety.value = rec.etymology || "";
    ety.placeholder = "etymology · why this word was chosen";
    ety.rows = 3;
    ety.addEventListener("input", () => {
      rec.etymology = ety.value;
      scheduleSave();
    });
    body.appendChild(field("etymology / word choice", ety));

    const era = document.createElement("input");
    era.value = rec.era_notes || "";
    era.placeholder = "era of this English spell";
    era.addEventListener("input", () => {
      rec.era_notes = era.value;
      scheduleSave();
    });
    body.appendChild(field("era", era));

    if (rec.strongs) {
      const join = document.createElement("div");
      join.className = "cc-word-join";
      const numPrint = document.createElement("div");
      numPrint.className = "cc-print cc-print-mono cc-word-join-num";
      numPrint.textContent = rec.strongs;
      join.appendChild(numPrint);
      const st = document.createElement("button");
      st.type = "button";
      st.className =
        "cc-btn-strong" + (isMarkRedStrongs(rec.strongs) ? " is-mark-red" : "");
      st.textContent = "open Strong";
      st.addEventListener("click", () => openStrong(rec.strongs));
      join.appendChild(st);
      body.appendChild(field("join → Strong (red)", join));
    }

    const sec = document.createElement("div");
    sec.className = "cc-sec";
    sec.textContent = "hebrew links";
    body.appendChild(sec);
    const links = document.createElement("div");
    links.className = "cc-strong-hits";
    (rec.word_ids || []).forEach((wid) => {
      const w = wordById(wid);
      if (!w) return;
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${w.surface_plain || stripNiqqud(w.surface)} · ${
        w.strongs || ""
      }`;
      if (isMarkRedStrongs(w.strongs)) b.classList.add("is-mark-red");
      b.addEventListener("click", () => openWord(wid));
      links.appendChild(b);
    });
    body.appendChild(links);

    const rh = document.createElement("div");
    rh.className = "cc-sec";
    rh.textContent = "readings (why this English)";
    body.appendChild(rh);
    if (!rec.readings) rec.readings = [];
    const host = document.createElement("div");
    renderReadings(host, rec.readings, scheduleSave);
    body.appendChild(host);

    table.appendChild(el);
  }

  function renderHelpPaper(p) {
    const g = defaultPaperGeom("help");
    const { el, body } = makeObjShell({
      kind: "HELP",
      name: "how to",
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });
    const pre = document.createElement("div");
    pre.className = "cc-help-body";
    pre.textContent = HELP_TEXT;
    body.appendChild(pre);
    table.appendChild(el);
  }

  function renderBar() {
    const books = $("barBooks");
    const papers = $("barPapers");
    books.innerHTML = "";
    papers.innerHTML = "";

    (store.books || []).forEach((b) => {
      const onTable = (store.desk.books_on_table || []).some(
        (x) => x.book_id === b.id
      );
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-bar-pill" + (onTable ? " is-open" : "");
      btn.textContent = b.short || b.title;
      btn.title = b.title;
      btn.addEventListener("click", () => {
        if (onTable) {
          const st = store.desk.books_on_table.find((x) => x.book_id === b.id);
          if (st) st.z = ++zTop;
        } else {
          const isLet = b.kind === "letters" || b.id === "book-letters";
          const isWrd = b.kind === "words" || b.id === "book-words";
          store.desk.books_on_table.push({
            book_id: b.id,
            x: 60 + Math.random() * 80,
            y: 50 + Math.random() * 40,
            z: ++zTop,
            w: isLet || isWrd ? 380 : 440,
            h: isLet || isWrd ? 480 : 280,
          });
        }
        scheduleSave();
        render();
      });
      books.appendChild(btn);
    });

    // shortcut — not a library book (dashed)
    const quick = document.createElement("button");
    quick.type = "button";
    quick.className = "cc-bar-pill cc-bar-shortcut";
    quick.textContent = "אדם/אדמה";
    quick.title = "shortcut: open Adam + adama word papers";
    quick.addEventListener("click", () => {
      openWord("w-adam");
      openWord("w-adama");
    });
    books.appendChild(quick);

    (store.papers || [])
      .filter((p) => p.shelved)
      .forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cc-bar-pill paper-pill";
        btn.textContent = p.title || p.kind;
        btn.title = p.kind;
        btn.addEventListener("click", () => raisePaper(p));
        papers.appendChild(btn);
      });
  }

  function render() {
    if (!store) return;
    table.innerHTML = "";
    (store.desk.books_on_table || []).forEach(renderBook);
    (store.papers || [])
      .filter((p) => !p.shelved)
      .sort((a, b) => (a.z || 0) - (b.z || 0))
      .forEach((p) => {
        if (p.kind === "word") renderWordPaper(p);
        else if (p.kind === "letter") renderLetterPaper(p);
        else if (p.kind === "line") renderLinePaper(p);
        else if (p.kind === "strong") renderStrongPaper(p);
        else if (p.kind === "english") renderEnglishPaper(p);
        else if (p.kind === "cab") renderCabPaper(p);
        else if (p.kind === "help") renderHelpPaper(p);
      });
    renderBar();
  }

  function newWord() {
    const id = uid("w");
    store.words.push({
      id,
      surface: "",
      surface_plain: "",
      strongs_form: "",
      eng: "",
      letters: [],
      strongs: "",
      // no Strong yet — invent mode; fill form + readings
      invent: true,
      readings: [
        {
          gloss_or_function: "",
          weight: 1,
          interpreter: "operator",
          era_notes: "",
          notes: "",
        },
      ],
    });
    scheduleSave();
    openWord(id);
    toast("new word · invent · Strong optional");
  }

  /* ── Cab: FileKeeper papers on station jx ─────────────── */
  let cabList = [];
  let cabOpenStem = null;
  let cabDraft = {
    stem: null,
    title: "",
    body: "",
    folder: "_root",
    tags_raw: "CONCOR,CAB,JX",
    rev: 0,
  };

  async function cabFetchList() {
    const r = await fetch("/api/cab/list", { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "list failed");
    cabList = j.papers || [];
    return cabList;
  }

  async function cabFetchDoc(stem) {
    const r = await fetch(
      "/api/cab/get?stem=" + encodeURIComponent(stem),
      { cache: "no-store" }
    );
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "get failed");
    return j.doc;
  }

  async function cabSaveDraft() {
    const r = await fetch("/api/cab/save", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: cabDraft.stem,
        title: cabDraft.title,
        body: cabDraft.body,
        folder: cabDraft.folder || "_root",
        tags_raw: cabDraft.tags_raw || "",
      }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "save failed");
    const doc = j.doc;
    cabDraft.stem = doc.stem;
    cabDraft.rev = (doc.head && doc.head.rev) || 1;
    cabOpenStem = doc.stem;
    toast("cab saved · rev " + cabDraft.rev);
    await cabFetchList();
    return doc;
  }

  function ensureCabPaper() {
    let p = (store.papers || []).find(
      (x) => x.kind === "cab" && x.ref_id === "cab-main"
    );
    if (!p) {
      const g = { w: 520, h: 440 };
      p = {
        id: uid("paper"),
        kind: "cab",
        ref_id: "cab-main",
        title: "Cab",
        shelved: false,
        x: 40,
        y: 36,
        z: ++zTop,
        w: g.w,
        h: g.h,
      };
      store.papers.push(p);
      scheduleSave();
    }
    return p;
  }

  function openCab() {
    const p = ensureCabPaper();
    raisePaper(p);
    cabFetchList()
      .then(() => render())
      .catch((e) => {
        console.error(e);
        toast("cab list error");
      });
  }

  function cabNewDraft() {
    cabOpenStem = null;
    cabDraft = {
      stem: null,
      title: "brief",
      body: "",
      folder: "_root",
      tags_raw: "CONCOR,CAB,JX",
      rev: 0,
    };
    render();
  }

  async function cabOpenStemDoc(stem) {
    try {
      const doc = await cabFetchDoc(stem);
      const head = doc.head || {};
      cabOpenStem = doc.stem;
      cabDraft = {
        stem: doc.stem,
        title: head.title || "",
        body: (head.body || "").replace(/\r\n/g, "\n"),
        folder: doc.folder || "_root",
        tags_raw: head.tags_raw || "",
        rev: head.rev || 1,
      };
      render();
    } catch (e) {
      console.error(e);
      toast("open failed");
    }
  }

  function renderCabPaper(p) {
    const g = { w: 520, h: 440 };
    const { el, body } = makeObjShell({
      className: "cc-cab",
      kind: "CAB",
      name: "Cab · jx papers",
      paperId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      w: p.w || g.w,
      h: p.h || g.h,
      onPos: (x, y) => {
        p.x = x;
        p.y = y;
      },
      onSize: (ww, hh) => {
        p.w = ww;
        p.h = hh;
      },
      onRaise: () => {
        p.z = zTop;
      },
      onShelve: () => shelvePaper(p),
      onClose: () => closePaper(p),
    });

    const layout = document.createElement("div");
    layout.className = "cc-cab-layout";

    // list pane
    const listPane = document.createElement("div");
    listPane.className = "cc-cab-list";
    const listHead = document.createElement("div");
    listHead.className = "cc-cab-list-head";
    listHead.innerHTML = "<span>JX papers</span>";
    const btnNew = document.createElement("button");
    btnNew.type = "button";
    btnNew.className = "cc-cab-mini";
    btnNew.textContent = "+NEW";
    btnNew.addEventListener("click", () => cabNewDraft());
    const btnRef = document.createElement("button");
    btnRef.type = "button";
    btnRef.className = "cc-cab-mini";
    btnRef.textContent = "↻";
    btnRef.title = "refresh list";
    btnRef.addEventListener("click", () => {
      cabFetchList()
        .then(() => render())
        .catch(() => toast("refresh failed"));
    });
    listHead.appendChild(btnNew);
    listHead.appendChild(btnRef);
    listPane.appendChild(listHead);

    const ul = document.createElement("div");
    ul.className = "cc-cab-items";
    if (!cabList.length) {
      const empty = document.createElement("div");
      empty.className = "cc-cab-empty";
      empty.textContent = "empty drawer · +NEW";
      ul.appendChild(empty);
    } else {
      cabList.forEach((item) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className =
          "cc-cab-item" + (item.stem === cabOpenStem ? " is-on" : "");
        row.innerHTML = `<span class="cc-cab-item-title"></span><span class="cc-cab-item-meta"></span>`;
        row.querySelector(".cc-cab-item-title").textContent = item.title;
        row.querySelector(".cc-cab-item-meta").textContent = `${
          item.folder || "_root"
        } · r${item.rev || 1}`;
        row.addEventListener("click", () => cabOpenStemDoc(item.stem));
        ul.appendChild(row);
      });
    }
    listPane.appendChild(ul);
    layout.appendChild(listPane);

    // editor pane
    const ed = document.createElement("div");
    ed.className = "cc-cab-edit";
    const tLab = document.createElement("label");
    tLab.className = "cc-cab-lab";
    tLab.textContent = "title";
    ed.appendChild(tLab);
    const tIn = document.createElement("input");
    tIn.className = "cc-cab-title";
    tIn.value = cabDraft.title || "";
    tIn.placeholder = "title";
    tIn.addEventListener("input", () => {
      cabDraft.title = tIn.value;
    });
    ed.appendChild(tIn);

    const meta = document.createElement("div");
    meta.className = "cc-cab-meta";
    meta.textContent = cabDraft.stem
      ? `${cabDraft.stem} · rev ${cabDraft.rev || "—"} · ${
          cabDraft.folder || "_root"
        }`
      : "new · saves to paper/jx/";
    ed.appendChild(meta);

    const bLab = document.createElement("label");
    bLab.className = "cc-cab-lab";
    bLab.textContent = "body";
    ed.appendChild(bLab);
    const bIn = document.createElement("textarea");
    bIn.className = "cc-cab-body";
    bIn.value = cabDraft.body || "";
    bIn.placeholder = "write the brief…";
    bIn.addEventListener("input", () => {
      cabDraft.body = bIn.value;
    });
    ed.appendChild(bIn);

    const foot = document.createElement("div");
    foot.className = "cc-cab-foot";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "cc-btn-cab-save";
    saveBtn.textContent = "SAVE TO JX";
    saveBtn.addEventListener("click", () => {
      cabSaveDraft()
        .then(() => render())
        .catch((e) => {
          console.error(e);
          toast("cab save failed");
        });
    });
    foot.appendChild(saveBtn);
    const hint = document.createElement("span");
    hint.className = "cc-cab-hint";
    hint.textContent = "shared drawer · station jx";
    foot.appendChild(hint);
    ed.appendChild(foot);

    layout.appendChild(ed);
    body.appendChild(layout);
    table.appendChild(el);
  }

  function newLetter() {
    const id = uid("let");
    store.letters.push({
      id,
      glyph: "א",
      key: "new",
      readings: [
        {
          function: "",
          gloss_or_function: "",
          weight: 1,
          notes: "",
          gematria: null,
          sounds: "",
        },
      ],
    });
    openLetter(id);
  }

  async function boot() {
    tickClock();
    setInterval(tickClock, 1000);
    buildHebGrid();
    $("hebFinals").addEventListener("change", buildHebGrid);
    $("hebClose").addEventListener("click", () => {
      $("hebBoard").hidden = true;
      $("btnHeb").classList.remove("is-on");
    });
    $("btnHeb").addEventListener("click", () => {
      const board = $("hebBoard");
      board.hidden = !board.hidden;
      $("btnHeb").classList.toggle("is-on", !board.hidden);
    });
    $("btnHelp").addEventListener("click", openHelp);
    $("btnCab").addEventListener("click", openCab);
    $("btnNewWord").addEventListener("click", newWord);
    // no +LET — alphabet is closed; edit via LET book
    $("btnSave").addEventListener("click", () => saveNow());

    try {
      await loadStore();
    } catch (e) {
      console.error(e);
      toast("failed to load store");
      return;
    }
    render();
  }

  boot();
})();
