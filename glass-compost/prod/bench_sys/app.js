/* Glass Compost · Terminal IO phosphor · house switch · hand-cut branches */
(() => {
  const $ = (id) => document.getElementById(id);
  const PLACE_KEY = "nim-bench-place-v1";
  const HOUSE_KEY = "glass-compost-house-v2";
  const SKIN_KEY = "glass-compost-skin-v1";
  const TONE_KEY = "glass-compost-tone-v1";
  const HOUSES = ["bios", "green", "red", "amber"];
  const SKINS = ["classic", "terminal"];
  const TONES = ["dark", "light"];

  let logs = [];
  let openFaceId = null;
  let payload = null; // last /api/logs/:id
  let highlightBranch = null;
  let hideDown = false; // hide ▾ gravity messages
  let showTrunkJump = true; // sticky jump rail for official + proposed trunks
  let sideRail = "logs"; // logs | find | reports
  let findScope = "forest";
  let findTurn = "all";
  let findHits = [];
  let findMeta = null;
  let findPicked = {}; // chip -> hit
  let findOpen = {}; // chip -> { text, leaves }
  let findAround = {}; // center chip -> { before, after, units }
  let reports = [];
  let openCxr = null;
  /** Last non-collapsed selection inside a message body (survives ✂ mousedown). */
  let savedBodySel = null;
  let scrollSaveT = null;
  let restoringPlace = false;

  /** House phosphor · green Terminal IO · red detective · amber lamp (BIOS owns blue) */
  function houseFromQuery() {
    try {
      const q = new URLSearchParams(window.location.search || "");
      const h = (q.get("house") || q.get("color") || "").toLowerCase().trim();
      if (HOUSES.indexOf(h) >= 0) return h;
      if (h === "work" || h === "vga" || h === "dos") return "bios";
      if (h === "archivist" || h === "adm" || h === "sophia") return "green";
      if (h === "detective" || h === "kme" || h === "cassandra") return "red";
      if (h === "lover" || h === "her" || h === "ava" || h === "blue" || h === "blu" || h === "amber" || h === "gold") return "amber";
    } catch (e) {}
    return null;
  }

  function getHouse() {
    const fromQ = houseFromQuery();
    if (fromQ) return fromQ;
    try {
      let h = (localStorage.getItem(HOUSE_KEY) || "").toLowerCase();
      if (h === "blue" || h === "blu") h = "amber";
      if (HOUSES.indexOf(h) >= 0) return h;
    } catch (e) {}
    return "bios";
  }

  function persistPref(patch) {
    try {
      if (patch.house) localStorage.setItem(HOUSE_KEY, patch.house);
      if (patch.skin) localStorage.setItem(SKIN_KEY, patch.skin);
      if (patch.tone) localStorage.setItem(TONE_KEY, patch.tone);
    } catch (e) {}
    try {
      const cur = JSON.parse(localStorage.getItem(PLACE_KEY) || "{}");
      Object.assign(cur, patch);
      localStorage.setItem(PLACE_KEY, JSON.stringify(cur));
    } catch (e) {}
  }

  function applyHouse(house, persist) {
    const h = HOUSES.indexOf(house) >= 0 ? house : "bios";
    document.body.classList.add("bench");
    document.body.setAttribute("data-house", h);
    document.querySelectorAll(".b-house-btn").forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute("data-house") === h);
    });
    if (persist !== false) persistPref({ house: h });
    return h;
  }

  function skinFromQuery() {
    try {
      const q = new URLSearchParams(window.location.search || "");
      const s = (q.get("skin") || q.get("theme") || "").toLowerCase().trim();
      if (SKINS.indexOf(s) >= 0) return s;
      if (s === "github" || s === "cursor" || s === "read") return "classic";
      if (s === "crt" || s === "phosphor" || s === "term") return "terminal";
    } catch (e) {}
    return null;
  }

  function toneFromQuery() {
    try {
      const q = new URLSearchParams(window.location.search || "");
      const t = (q.get("tone") || "").toLowerCase().trim();
      if (TONES.indexOf(t) >= 0) return t;
    } catch (e) {}
    return null;
  }

  function getSkin() {
    const fromQ = skinFromQuery();
    if (fromQ) return fromQ;
    if (houseFromQuery()) return "terminal";
    try {
      const s = (localStorage.getItem(SKIN_KEY) || "").toLowerCase();
      if (SKINS.indexOf(s) >= 0) return s;
    } catch (e) {}
    return "classic";
  }

  function getTone() {
    const fromQ = toneFromQuery();
    if (fromQ) return fromQ;
    try {
      const t = (localStorage.getItem(TONE_KEY) || "").toLowerCase();
      if (TONES.indexOf(t) >= 0) return t;
    } catch (e) {}
    return "dark";
  }

  function applySkin(skin, persist) {
    const s = SKINS.indexOf(skin) >= 0 ? skin : "classic";
    document.body.setAttribute("data-skin", s);
    document.querySelectorAll("button[data-skin]").forEach((btn) => {
      const on = btn.getAttribute("data-skin") === s;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (persist !== false) persistPref({ skin: s });
    return s;
  }

  function applyTone(tone, persist) {
    const t = TONES.indexOf(tone) >= 0 ? tone : "dark";
    document.body.setAttribute("data-tone", t);
    document.querySelectorAll("button[data-tone]").forEach((btn) => {
      const on = btn.getAttribute("data-tone") === t;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (persist !== false) persistPref({ tone: t });
    return t;
  }

  function wireHouseSwitch() {
    document.querySelectorAll(".b-house-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const h = btn.getAttribute("data-house");
        applyHouse(h, true);
        toast("house · " + (h === "bios" ? "BIOS work" : h + " phosphor"));
      });
    });
    document.querySelectorAll("button[data-skin]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = applySkin(btn.getAttribute("data-skin"), true);
        toast(s === "classic" ? "classic · reading" : "terminal · phosphor");
      });
    });
    document.querySelectorAll("button[data-tone]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = applyTone(btn.getAttribute("data-tone"), true);
        toast("classic · " + t);
      });
    });
  }

  // apply before first paint of lists
  applySkin(getSkin(), false);
  applyTone(getTone(), false);
  applyHouse(getHouse(), false);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── place memory (last log, scroll, collapsed rails, prefs) ── */
  function loadPlace() {
    try {
      const o = JSON.parse(localStorage.getItem(PLACE_KEY) || "{}");
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function savePlace(patch) {
    const cur = loadPlace();
    const next = Object.assign({}, cur, patch || {}, { at: Date.now() });
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } catch (e) {
      /* quota / private mode */
    }
    // also bench.db so Deck Host restarts keep log + scroll
    api("/api/place", {
      method: "POST",
      body: JSON.stringify({ key: "bench", place: next }),
    }).catch(() => {});
    return next;
  }

  async function loadPlaceMerged() {
    let local = loadPlace();
    try {
      const j = await api("/api/place", {
        method: "POST",
        body: JSON.stringify({ key: "bench", get: true }),
      });
      if (j && j.ok && j.place && typeof j.place === "object") {
        const remote = j.place;
        // newer at wins
        if ((remote.at || 0) >= (local.at || 0)) {
          local = Object.assign({}, local, remote);
          try {
            localStorage.setItem(PLACE_KEY, JSON.stringify(local));
          } catch (e) {}
        }
      }
    } catch (e) {
      /* offline */
    }
    return local;
  }

  function facePlace(faceId) {
    const p = loadPlace();
    const map = p.faces && typeof p.faces === "object" ? p.faces : {};
    const row = map[faceId];
    return row && typeof row === "object" ? row : {};
  }

  function patchFacePlace(faceId, patch) {
    if (!faceId) return;
    const p = loadPlace();
    const faces = Object.assign({}, p.faces || {});
    faces[faceId] = Object.assign({}, faces[faceId] || {}, patch || {}, {
      at: Date.now(),
    });
    savePlace({ faces });
  }

  function stageEl() {
    return document.querySelector(".b-stage");
  }

  function saveCurrentScroll() {
    if (!openFaceId || restoringPlace) return;
    const st = stageEl();
    if (!st) return;
    patchFacePlace(openFaceId, { scroll: st.scrollTop });
  }

  function scheduleScrollSave() {
    if (restoringPlace) return;
    clearTimeout(scrollSaveT);
    scrollSaveT = setTimeout(saveCurrentScroll, 200);
  }

  function restoreScroll(faceId) {
    const st = stageEl();
    if (!st || !faceId) return;
    const scroll = facePlace(faceId).scroll;
    if (scroll == null || !Number.isFinite(Number(scroll))) return;
    const y = Math.max(0, Number(scroll));
    restoringPlace = true;
    const apply = () => {
      st.scrollTop = y;
    };
    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        apply();
        restoringPlace = false;
      });
    });
  }

  /** collapsed map: { "12": true } — missing key → default (fat = collapsed) */
  function collapsedMapFor(faceId) {
    const c = facePlace(faceId).collapsed;
    return c && typeof c === "object" ? c : {};
  }

  function defaultCollapsedForMsg(m) {
    // don't-care · especially when fully leaf-chipped · single quiet rail (no bucket)
    const g = Number(m && m.gravity) || 0;
    if (g < 0) return true;
    const chars =
      m && m.char_count != null
        ? m.char_count
        : ((m && m.text) || "").length;
    return chars > 900;
  }

  function isSeqCollapsed(seq, msg) {
    if (!openFaceId) return defaultCollapsedForMsg(msg);
    const map = collapsedMapFor(openFaceId);
    const k = String(seq);
    if (Object.prototype.hasOwnProperty.call(map, k)) return !!map[k];
    return defaultCollapsedForMsg(msg);
  }

  function setSeqCollapsed(seq, collapsed) {
    if (!openFaceId) return;
    const map = Object.assign({}, collapsedMapFor(openFaceId));
    map[String(seq)] = !!collapsed;
    patchFacePlace(openFaceId, { collapsed: map });
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 2200);
  }

  function who(role) {
    const r = (role || "").toLowerCase();
    if (r === "user") return "YOU";
    if (r === "assistant") return "ASST";
    return role || "?";
  }

  /** Tree cites: log · trunk · branch (message). Leaves later: ….L02 */
  function logCodeOf() {
    return (payload && payload.log && payload.log.log_code) || "??";
  }

  function trunkChipOf(trunkN) {
    const n = Number(trunkN) || 1;
    return `${logCodeOf()}.T${String(n).padStart(2, "0")}`;
  }

  function branchChipOf(trunkN, seq) {
    const n = Number(trunkN) || 1;
    const s = Number(seq);
    const seqPart = Number.isFinite(s) ? String(s).padStart(3, "0") : "???";
    return `${logCodeOf()}.T${String(n).padStart(2, "0")}.B${seqPart}`;
  }

  function msgChip(m) {
    if (m && m.chip) return m.chip;
    return branchChipOf(m && (m.trunk_n || m.branch_n), m && m.seq);
  }

  function trunkLabel(trunkN, title) {
    const n = Number(trunkN) || 1;
    const t = (title || "").trim();
    return t ? `T${n} · ${t}` : `T${n}`;
  }

  async function copyChip(text) {
    const s = String(text || "").trim();
    if (!s) return;
    // ROM iframe often blocks clipboard API — try API, then execCommand
    let ok = false;
    try {
      if (
        navigator.clipboard &&
        navigator.clipboard.writeText &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(s);
        ok = true;
      }
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = s;
        ta.setAttribute("readonly", "");
        ta.style.cssText =
          "position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0.01;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, s.length);
        ok = document.execCommand("copy");
        ta.remove();
      } catch (e2) {
        ok = false;
      }
    }
    if (ok) toast("chip · " + s);
    else toast("copy blocked · select chip text · Ctrl+C");
  }

  async function api(path, opts) {
    const r = await fetch(path, {
      cache: "no-store",
      ...(opts || {}),
      headers: {
        "Content-Type": "application/json",
        ...((opts && opts.headers) || {}),
      },
    });
    return r.json();
  }

  async function loadLogs(filter) {
    const q = (filter || "").trim();
    const j = await api(
      q ? `/api/logs?q=${encodeURIComponent(q)}` : "/api/logs"
    );
    if (!j.ok) {
      $("logCount").textContent = j.error || "yard.db missing?";
      $("logList").innerHTML =
        '<div class="b-empty" style="padding:0.5rem">No logs. Ingest into Nim Yard first.</div>';
      return;
    }
    logs = j.logs || [];
    const nDone = j.cut_done_count != null
      ? j.cut_done_count
      : logs.filter((L) => L.cut_done).length;
    $("logCount").textContent =
      `${logs.length} logs · ${nDone} cut done · lived order`;
    $("metaLine").textContent = `${logs.length} logs · ${nDone} ✓`;
    paintLogList();
  }

  function paintLogList() {
    const el = $("logList");
    el.innerHTML = logs
      .map((L) => {
        const n = L.msg_count != null ? L.msg_count : "—";
        const d = (L.date || "").trim() || "—";
        const done = !!L.cut_done;
        const trunks = Number(L.trunk_count) || 0;
        const hasCuts = done || trunks > 1;
        const named = (L.title || L.orig_title || "").trim();
        const orig = (L.orig_title || "").trim();
        const tipBits = [
          L.log_code,
          named,
          orig && orig !== named ? "original: " + orig : "",
          done ? "cut done · reading" : "",
          trunks > 1 ? trunks + " trunks" : "",
        ].filter(Boolean);
        const metaBits = [d, String(n) + " msgs"];
        if (trunks > 1) {
          metaBits.push(
            trunks + " trunk" + (trunks === 1 ? "" : "s")
          );
        }
        return (
          `<button type="button" class="b-list-item${
            L.face_id === openFaceId ? " is-on" : ""
          }${done ? " is-done" : ""}${hasCuts ? " is-cut" : ""}" data-face="${esc(L.face_id)}" title="${esc(
            tipBits.join(" · ")
          )}">` +
          `<span class="code-row">` +
          `<span class="code">${esc(L.log_code)}</span>` +
          (done
            ? `<span class="b-list-mark is-sealed" title="Cut into trunks · reading view">cut</span>`
            : "") +
          (done || hasCuts
            ? `<span class="b-list-mark" title="${esc(
                String(trunks || 1)
              )} trunks">T${esc(String(trunks || 1))}</span>`
            : "") +
          `</span>` +
          (named
            ? `<span class="name">${esc(named)}</span>`
            : "") +
          `<span class="meta">${esc(metaBits.join(" · "))}</span>` +
          `</button>`
        );
      })
      .join("");
    el.querySelectorAll("[data-face]").forEach((btn) => {
      btn.onclick = () => openLog(btn.getAttribute("data-face"));
    });
  }

  async function openLog(faceId, opts) {
    opts = opts || {};
    if (openFaceId && openFaceId !== faceId) saveCurrentScroll();
    openFaceId = faceId;
    savePlace({ faceId: faceId, hideDown: hideDown });
    const fp = facePlace(faceId);
    // restore trunk highlight for this log
    if (opts.clearHighlight) highlightBranch = null;
    else if (
      fp.highlightBranch != null &&
      Number.isFinite(Number(fp.highlightBranch))
    )
      highlightBranch = Number(fp.highlightBranch);
    else highlightBranch = null;
    paintLogList();
    const j = await api("/api/logs/" + encodeURIComponent(faceId));
    if (!j.ok) {
      toast(j.error || "load fail");
      return;
    }
    payload = j;
    paintLog({ restoreScroll: opts.restoreScroll !== false });
  }

  function paintDoneBtn() {
    const btn = $("cutDoneBtn");
    if (!btn || !payload || !payload.log) return;
    const done = !!payload.log.cut_done;
    btn.classList.toggle("is-done", done);
    btn.textContent = done ? "✓ cut done" : "cut done";
    btn.title = done
      ? "Reading view · ▾ hidden · click to unmark and recut"
      : "Finished cutting this log into trunks · reading view hides ▾ rows";
  }

  function paintHideDownBtn() {
    const btn = $("hideDownBtn");
    if (!btn) return;
    const { down } = gravityCountsFromPayload();
    btn.classList.toggle("is-on", hideDown);
    btn.textContent = hideDown
      ? `show ↓${down ? " · " + down : ""}`
      : `hide ↓${down ? " · " + down : ""}`;
    btn.title = hideDown
      ? "Show don't-care messages again"
      : "Hide ▾ don't-care messages and leaves";
    btn.hidden = !payload || !!(payload.log && payload.log.cut_done);
  }

  async function toggleCutDone() {
    if (!openFaceId || !payload || !payload.log) return;
    const next = !payload.log.cut_done;
    const j = await api("/api/log/done", {
      method: "POST",
      body: JSON.stringify({ face_id: openFaceId, cut_done: next }),
    });
    if (!j.ok) return toast(j.error || "mark fail");
    payload.log.cut_done = !!j.cut_done;
    const row = logs.find((L) => L.face_id === openFaceId);
    if (row) row.cut_done = !!j.cut_done;
    paintDoneBtn();
    paintLogList();
    paintLog(); // lock/unlock trunk-cut rails immediately
    const nDone = logs.filter((L) => L.cut_done).length;
    $("logCount").textContent =
      `${logs.length} logs · ${nDone} cut done · lived order`;
    $("metaLine").textContent = `${logs.length} logs · ${nDone} ✓`;
    toast(
      next
        ? "marked · cut done · reading view"
        : "unmarked · still cutting"
    );
  }

  function renderDocTags(tags) {
    const list = (Array.isArray(tags) ? tags : [])
      .map(normalizeTag)
      .filter(Boolean);
    if (!list.length) return "";
    return (
      `<span class="b-doc-tags">` +
      list.map((t) => `<span class="b-doc-tag">${esc(t)}</span>`).join("") +
      `</span>`
    );
  }

  function renderDocTagAdd(attrs, title) {
    return (
      `<button type="button" class="b-doc-tag-add" ${attrs} title="${esc(
        title || "Add tags"
      )}">+</button>`
    );
  }

  function sceneAt(seq) {
    return (payload.scenes || []).find(
      (s) =>
        (s.status || "proposed") !== "rejected" &&
        Number(s.start_seq) === Number(seq)
    );
  }

  function renderSceneInner(sc, opts) {
    const locked = !!(opts && opts.locked);
    const accepted = (sc.status || "proposed") === "accepted";
    const acts = locked
      ? ""
      : `<div class="b-scene-acts">` +
        `<button type="button" class="b-export-btn" data-scene-accept="${esc(
          String(sc.start_seq)
        )}">${accepted ? "edit shot" : "accept · edit"}</button>` +
        (accepted
          ? ""
          : `<button type="button" class="b-export-btn" data-scene-reject="${esc(
              String(sc.start_seq)
            )}">reject</button>`) +
        `</div>`;
    return (
      `<div class="b-scene-h">${
        accepted ? "shot" : "scene pass"
      } · ${esc(sc.intensity || "calm")}${
        accepted ? " · accepted" : ""
      }</div>` +
      (sc.title
        ? `<div class="b-scene-name">${esc(sc.title)}</div>`
        : "") +
      `<div class="b-scene-shot">${esc(sc.shot || "")}</div>` +
      (sc.shift_note
        ? `<div class="b-scene-shift">${esc(sc.shift_note)}</div>`
        : "") +
      acts
    );
  }

  function renderSceneMark(sc, opts) {
    const onCut = !!(opts && opts.onCut);
    const accepted = (sc.status || "proposed") === "accepted";
    return (
      `<div class="b-scene-mark${onCut ? " is-on-cut" : ""}${
        accepted ? " is-accepted" : ""
      }">` +
      renderSceneInner(sc, opts) +
      `</div>`
    );
  }

  /** One plate: your tags, your note, then the scene shot. */
  function renderTrunkBody(opts) {
    const tags = Array.isArray(opts.tags) ? opts.tags : [];
    const note = (opts.note || "").trim();
    const scene = opts.scene || null;
    const seq = Number(opts.seq);
    const locked = !!(opts && opts.locked);
    const hasTags = tags.length > 0;
    if (!hasTags && !note && !scene) return "";
    return (
      `<div class="b-cut-below">` +
      `<div class="b-trunk-flags">` +
      renderDocTags(tags) +
      (locked
        ? ""
        : renderDocTagAdd(
            `data-trunk-tags="${seq}"`,
            "Add trunk tags"
          )) +
      `</div>` +
      (note
        ? `<div class="b-cut-note-lab">your note</div>` +
          `<div class="b-cut-note">${esc(note)}</div>`
        : "") +
      (scene
        ? `<div class="b-trunk-shot">${renderSceneInner(scene, {
            locked,
          })}</div>`
        : "") +
      `</div>`
    );
  }

  function renderDocTrunk(opts) {
    const tn = opts.tn || 1;
    const title = (opts.title || "").trim();
    const tChip = opts.tChip || trunkChipOf(tn);
    const tags = Array.isArray(opts.tags) ? opts.tags : [];
    const note = (opts.note || "").trim();
    const startSeq = Number.isFinite(Number(opts.startSeq))
      ? Number(opts.startSeq)
      : 0;
    const lab = title ? `T${tn} · ${esc(title)}` : `T${tn}`;
    const scene = sceneAt(startSeq);
    return (
      `<header class="b-doc-trunk" data-seq="${startSeq}">` +
      `<div class="b-doc-trunk-h">` +
      `<h2 class="b-doc-trunk-name">${lab}</h2>` +
      `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
        tChip
      )}" title="Copy ${esc(tChip)}">${esc(tChip)}</button>` +
      renderDocTags(tags) +
      renderDocTagAdd(
        `data-trunk-tags="${startSeq}"`,
        "Add trunk tags"
      ) +
      `</div>` +
      (note ? `<p class="b-doc-note">${esc(note)}</p>` : "") +
      (scene
        ? `<div class="b-trunk-shot">${renderSceneInner(scene, {
            locked: true,
          })}</div>`
        : "") +
      `</header>`
    );
  }

  /** Cut-done reading: skip ▾ rows; leaves as running prose + chip, not form cards. */
  function renderDocMsg(m, chip) {
    const g = Number(m.gravity) || 0;
    if (g < 0) return "";
    const text = m.text || "";
    const leaves = Array.isArray(m.leaves) ? m.leaves : [];
    const split = !!m.split;
    const gClass = g > 0 ? " grav-up" : "";
    let body = "";
    let nKeep = 0;
    if (split && leaves.length) {
      const sorted = leaves.slice().sort((a, b) => a.start_off - b.start_off);
      sorted.forEach((lf, i) => {
        const lg = Number(lf.gravity) || 0;
        if (lg < 0) return;
        const a = Math.max(0, Number(lf.start_off) || 0);
        const bOff = Math.max(a, Number(lf.end_off) || 0);
        const chunk = trimLeafChunk(String(text).slice(a, bOff));
        if (!chunk) return;
        nKeep += 1;
        const ln = Number(lf.leaf_n) || i + 1;
        const lchip =
          lf.chip || chip + ".L" + String(ln).padStart(2, "0");
        const lab = lchip;
        body +=
          `<section class="b-doc-leaf${lg > 0 ? " grav-up" : ""}">` +
          `<div class="b-doc-leaf-h">` +
          `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
            lchip
          )}" title="Copy ${esc(lchip)}">${lab}</button>` +
          renderDocTags(lf.tags) +
          renderDocTagAdd(
            `data-leaf-tags="${m.seq}" data-leaf-n="${ln}"`,
            "Add leaf tags"
          ) +
          `</div>` +
          `<div class="b-doc-prose">${esc(chunk)}</div>` +
          `</section>`;
      });
    } else {
      if (!String(text).trim()) return "";
      nKeep = 1;
      body = `<div class="b-doc-prose">${esc(text)}</div>`;
    }
    if (!nKeep) return "";
    return (
      `<article class="b-doc-msg role-${esc(m.role)}${gClass}" data-seq="${
        m.seq
      }">` +
      `<div class="b-doc-kicker">` +
      `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
        chip
      )}" title="Copy ${esc(chip)}">${esc(chip)}</button>` +
      renderDocTags(m.tags) +
      renderDocTagAdd(`data-msg-tags="${m.seq}"`, "Add tags") +
      `<span class="who">${esc(who(m.role))}</span>` +
      (m.when ? ` <span class="b-when">${esc(m.when)}</span>` : "") +
      `</div>` +
      body +
      `</article>`
    );
  }

  function paintLog(opts) {
    opts = opts || {};
    if (!payload) return;
    const stKeep = stageEl();
    const keepScroll =
      opts.restoreScroll ? null : stKeep ? stKeep.scrollTop : null;
    $("emptyState").hidden = true;
    if (sideRail === "logs") $("logView").hidden = false;
    const log = payload.log;
    const msgs = payload.messages || [];
    const branches = payload.branches || [];
    $("logCode").textContent = log.log_code || "—";
    paintDoneBtn();
    paintHideDownBtn();
    paintLogName();
    paintGravityQuiet();
    paintWorkLog();
    paintSceneLog();
    paintTrunkJump();

    // map trunk_n / branch_n → meta
    const branchByN = {};
    branches.forEach((b) => {
      const tn = b.trunk_n || b.branch_n;
      branchByN[tn] = b;
      branchByN[b.branch_n] = b;
    });

    $("branchPills").innerHTML = branches
      .map((b) => {
        const tn = b.trunk_n || b.branch_n;
        const titled = (b.title || "").trim();
        const tags = Array.isArray(b.tags) ? b.tags : [];
        const note = (b.note || "").trim();
        const tChip = b.trunk_chip || trunkChipOf(tn);
        // T1 is nameable before any cut — show that, not only msg count
        const label = titled
          ? `T${tn} · ${titled}`
          : tn === 1
            ? `T1 · name me`
            : `T${tn} · ${b.msg_count}b`;
        const tip = [
          tChip,
          titled || "untitled trunk",
          note,
          tags.length ? "flags: " + tags.join(", ") : "",
          b.msg_count + " branches · click focus · dblclick edit · chip copies",
        ]
          .filter(Boolean)
          .join(" · ");
        const tagShow = tags.slice(0, 6).join(" · ");
        const noteShow = note
          ? note.length > 90
            ? note.slice(0, 90) + "…"
            : note
          : "";
        return (
          `<span class="b-branch-wrap">` +
          `<button type="button" class="b-branch-pill${
            highlightBranch === tn ? " is-on" : ""
          }" data-br="${tn}" data-start="${b.start_seq}" title="${esc(
            tip
          )}">` +
          `<span class="b-branch-pill-label">${esc(label)}</span>` +
          (tags.length
            ? `<span class="b-pill-tags">${esc(tagShow)}${
                tags.length > 6 ? "…" : ""
              }</span>`
            : "") +
          (noteShow
            ? `<span class="b-pill-note">${esc(noteShow)}</span>`
            : "") +
          `</button>` +
          `<span class="b-branch-acts">` +
          `<button type="button" class="b-chip-btn" data-copy-chip="${esc(
            tChip
          )}" title="Copy trunk chip ${esc(tChip)}">chip</button>` +
          `<button type="button" class="b-branch-name" data-edit-br="${b.start_seq}" title="Edit title, description, tags">edit</button>` +
          `<button type="button" class="b-chip-btn" data-export-trunk="${b.start_seq}" title="Seal this trunk as a CXR">export</button>` +
          `</span>` +
          `</span>`
        );
      })
      .join("");
    // delayed single-click so we never steal edit (dblclick / edit btn)
    let pillClickT = null;
    $("branchPills").querySelectorAll("[data-br]").forEach((btn) => {
      btn.onclick = (ev) => {
        if (ev.detail > 1) {
          clearTimeout(pillClickT);
          return;
        }
        const n = parseInt(btn.getAttribute("data-br"), 10);
        clearTimeout(pillClickT);
        pillClickT = setTimeout(() => {
          highlightBranch = highlightBranch === n ? null : n;
          if (openFaceId)
            patchFacePlace(openFaceId, { highlightBranch: highlightBranch });
          paintLog();
          const first = document.querySelector(`.b-msg[data-branch="${n}"]`);
          if (first)
            first.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 260);
      };
      btn.ondblclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        clearTimeout(pillClickT);
        const start = parseInt(btn.getAttribute("data-start"), 10);
        const b = branchByN[parseInt(btn.getAttribute("data-br"), 10)];
        editBranch(Number.isFinite(start) ? start : 0, b || null);
      };
    });
    $("branchPills").querySelectorAll("[data-edit-br]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        clearTimeout(pillClickT);
        const start = parseInt(btn.getAttribute("data-edit-br"), 10);
        const b = branches.find((x) => x.start_seq === start);
        editBranch(Number.isFinite(start) ? start : 0, b || null);
      };
    });
    $("branchPills").querySelectorAll("[data-copy-chip]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        clearTimeout(pillClickT);
        copyChip(btn.getAttribute("data-copy-chip") || "");
      };
    });
    $("branchPills").querySelectorAll("[data-export-trunk]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        clearTimeout(pillClickT);
        const start = parseInt(btn.getAttribute("data-export-trunk"), 10);
        exportTrunk(start);
      };
    });
    paintSceneIndex();

    const cutStarts = new Set(
      (payload.cuts || []).map((c) => Number(c.start_seq))
    );
    const cutMeta = {};
    (payload.cuts || []).forEach((c) => {
      cutMeta[Number(c.start_seq)] = c;
    });

    const stream = $("msgStream");
    const cutLocked = !!(payload.log && payload.log.cut_done);
    const logView = $("logView");
    if (logView) logView.classList.toggle("is-reading", cutLocked);
    let html = "";
    msgs.forEach((m) => {
      const seq = m.seq;
      const brN = m.branch_n || 1;
      const br = branchByN[brN];
      const brTitle = (br && br.title) || "";

      if (cutLocked) {
        if (seq === 0) {
          const b1 = branchByN[1] || {};
          const t0 =
            (cutMeta[0] && cutMeta[0].title) ||
            b1.title ||
            brTitle ||
            "";
          html += renderDocTrunk({
            tn: 1,
            title: t0,
            tChip: b1.trunk_chip || trunkChipOf(1),
            tags: b1.tags || (cutMeta[0] && cutMeta[0].tags) || [],
            note: (b1.note || (cutMeta[0] && cutMeta[0].note) || "").trim(),
            startSeq: 0,
          });
        } else if (cutStarts.has(seq)) {
          const cm = cutMeta[seq];
          const brHere = branches.find((x) => x.start_seq === seq) || {};
          const tnHere = brHere.trunk_n || brHere.branch_n || brN;
          html += renderDocTrunk({
            tn: tnHere,
            title: (cm && cm.title) || brHere.title || "",
            tChip: brHere.trunk_chip || trunkChipOf(tnHere),
            tags: brHere.tags || (cm && cm.tags) || [],
            note: (brHere.note || (cm && cm.note) || "").trim(),
            startSeq: seq,
          });
        }
        const scLocked = sceneAt(seq);
        if (scLocked && !(cutStarts.has(seq) || seq === 0)) {
          html += renderSceneMark(scLocked, { onCut: false, locked: true });
        }
        html += renderDocMsg(m, msgChip(m));
        return;
      }

      if (seq === 0) {
        // T1 label always shows; when cut done, no structural changes
        const b1 = branchByN[1] || {};
        const t0 =
          (cutMeta[0] && cutMeta[0].title) ||
          b1.title ||
          brTitle ||
          "";
        const tags0 = b1.tags || (cutMeta[0] && cutMeta[0].tags) || [];
        const note0 = (b1.note || (cutMeta[0] && cutMeta[0].note) || "").trim();
        const gEarly = Number(m.gravity) || 0;
        const downHid = hideDown && gEarly < 0 ? " is-down-hid" : "";
        const tChip0 = b1.trunk_chip || trunkChipOf(1);
        html +=
          `<div class="b-cut-block b-trunk-carriage is-cut${
            cutLocked ? " is-locked" : ""
          }${downHid}" data-seq="0">` +
          `<div class="b-cut-rail is-cut">` +
          `<div class="b-cut-line"></div>` +
          `<span class="b-cut-hot" aria-hidden="true"></span>` +
          `<button type="button" class="b-cut-btn b-cut-name" data-toggle-cut="0" aria-expanded="false" title="Expand or collapse this trunk">` +
          (t0 ? `T01 · ${esc(t0)}` : "T01 · untitled") +
          `</button>` +
          `<button type="button" class="b-cut-btn b-cut-chip" data-copy-chip="${esc(
            tChip0
          )}" title="Copy ${esc(tChip0)}">${esc(tChip0)}</button>` +
          `<button type="button" class="b-cut-btn" data-edit="0" title="Edit title, description, tags">edit</button>` +
          (cutLocked
            ? `<span class="b-cut-locked" title="Cut done — trunk structure locked">locked</span>`
            : "") +
          `<div class="b-cut-line"></div>` +
          `</div>` +
          renderTrunkBody({
            tags: tags0,
            note: note0,
            scene: sceneAt(0),
            seq: 0,
            locked: cutLocked,
          }) +
          `</div>`;
      } else {
        const gEarly = Number(m.gravity) || 0;
        const downHid = hideDown && gEarly < 0 ? " is-down-hid" : "";
        const isCut = cutStarts.has(seq);
        const scHere = sceneAt(seq);
        const proposing = !!(scHere && (scHere.status || "proposed") !== "accepted");
        // Cut done: hide empty "new trunk" slots entirely — only show real trunks
        if (!isCut && cutLocked) {
          if (scHere) html += renderSceneMark(scHere, { onCut: false, locked: true });
        } else {
          const cm = cutMeta[seq];
          const brHere = branches.find((x) => x.start_seq === seq) || {};
          const tnHere = brHere.trunk_n || brHere.branch_n || brN;
          const tCut = (cm && cm.title) || brHere.title || "";
          const tagsC = brHere.tags || (cm && cm.tags) || [];
          const noteC = (brHere.note || (cm && cm.note) || "").trim();
          const tChipC = brHere.trunk_chip || trunkChipOf(tnHere);
          html +=
            `<div class="b-cut-block${isCut ? " b-trunk-carriage is-cut" : ""}${
              cutLocked ? " is-locked" : ""
            }${downHid}" data-seq="${seq}">` +
            `<div class="b-cut-rail${isCut ? " is-cut" : ""}">` +
            `<div class="b-cut-line"></div>` +
            `<span class="b-cut-hot" aria-hidden="true"></span>` +
            (isCut
              ? `<button type="button" class="b-cut-btn b-cut-name" data-toggle-cut="${seq}" aria-expanded="false" title="Expand or collapse this trunk">` +
                (tCut
                  ? `T${String(tnHere).padStart(2, "0")} · ${esc(tCut)}`
                  : `T${String(tnHere).padStart(2, "0")} · untitled`) +
                `</button>` +
                `<button type="button" class="b-cut-btn b-cut-chip" data-copy-chip="${esc(
                  tChipC
                )}" title="Copy ${esc(tChipC)}">${esc(tChipC)}</button>` +
                `<button type="button" class="b-cut-btn" data-edit="${seq}" title="Edit title, description, tags">edit</button>` +
                (cutLocked
                  ? `<span class="b-cut-locked" title="Cut done — unmark to remove or recut">locked</span>`
                  : `<button type="button" class="b-cut-btn" data-uncut="${seq}" title="Merge — remove this trunk cut">remove</button>`)
              : proposing
                ? `<span class="b-cut-locked">proposed trunk</span>`
                : `<button type="button" class="b-cut-btn" data-cut="${seq}" title="New trunk starts here">✂ cut · new trunk</button>`) +
            `<div class="b-cut-line"></div>` +
            `</div>` +
            (isCut
              ? renderTrunkBody({
                  tags: tagsC,
                  note: noteC,
                  scene: scHere,
                  seq,
                  locked: cutLocked,
                })
              : scHere
                ? renderSceneMark(scHere, {
                    onCut: false,
                    locked: cutLocked,
                  })
                : "") +
            `</div>`;
        }
      }

      const g = Number(m.gravity) || 0;
      const gClass =
        g > 0 ? " grav-up" : g < 0 ? " grav-down" : "";
      const downHidMsg = hideDown && g < 0 ? " is-down-hid" : "";
      const dim =
        highlightBranch != null && m.branch_n !== highlightBranch
          ? ' style="opacity:0.72"'
          : "";
      const chip = msgChip(m);
      const msgTags = Array.isArray(m.tags) ? m.tags.map(normalizeTag).filter(Boolean) : [];
      const parsed = !!m.parsed;
      const leaves = Array.isArray(m.leaves) ? m.leaves : [];
      const split = !!m.split;
      const text = m.text || "";
      const chars = m.char_count != null ? m.char_count : text.length;
      const fat = chars > 900;
      // T# only on the B-rail — long trunk name lives on the sticky cut carriage
      const trunkBit = `T${String(brN).padStart(2, "0")}`;
      const trunkTip = brTitle
        ? `trunk T${String(brN).padStart(2, "0")} · ${brTitle}`
        : `trunk T${String(brN).padStart(2, "0")}`;
      // body: highlight partitions when split; always know L01 = whole if not
      const bodyHtml = renderMsgBodyHtml(text, leaves, split, chip, seq, cutLocked);
      const leafN = leaves.length || 1;
      const collapsed = isSeqCollapsed(seq, m);
      const railClass = collapsed ? " is-collapsed" : " is-open";
      // one-line peek of body when rail is collapsed
      const peek = String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 96);
      // don't-care + leaf-chipped: single row label (bucket hidden while collapsed)
      const bagBit =
        g < 0 && split
          ? ` · bag ${leafN}L`
          : "";
      html +=
        `<article class="b-msg role-${esc(m.role)}${gClass}${downHidMsg}${
          parsed ? " is-parsed" : ""
        }${fat ? " is-fat" : ""}${split ? " is-split" : ""}${railClass}" data-seq="${seq}" data-branch="${brN}" data-chip="${esc(
          chip
        )}" data-gravity="${g}" data-parsed="${parsed ? "1" : "0"}"${dim}>` +
        `<div class="b-msg-h" data-rail-toggle="${seq}" title="Click rail to expand / collapse">` +
        `<span class="b-msg-h-left">` +
        `<button type="button" class="b-msg-expand" data-expand="${seq}" title="${
          collapsed
            ? g < 0 && split
              ? "Expand leaf bag (don't care · quiet)"
              : "Expand message"
            : "Collapse to rail"
        }">${collapsed ? "▸" : "▾"}</button>` +
        `<button type="button" class="b-msg-parsed${
          parsed ? " is-on" : ""
        }" data-parsed-toggle="${seq}" title="${
          parsed ? "Unmark parsed" : "Mark parsed · I pulled the bits"
        }">${parsed ? "✓" : "○"}</button>` +
        `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
          chip
        )}" title="Copy message chip">${esc(chip)}</button>` +
        renderDocTags(msgTags) +
        renderDocTagAdd(`data-msg-tags="${seq}"`, "Add tags") +
        (Number(m.exported) > 0
          ? `<span class="b-hit-exp" title="exported in ${m.exported} CXR report(s)">×${esc(
              String(m.exported)
            )}</span>`
          : "") +
        `<span class="who">${esc(who(m.role))}</span>` +
        (m.when
          ? ` · <span class="b-when" title="message create_time">${esc(
              m.when
            )}</span>`
          : "") +
        ` <span class="br" title="${esc(trunkTip)}">${esc(
          trunkBit
        )}</span>` +
        (chars
          ? ` <span class="b-chars" title="character count">${chars}c</span>`
          : "") +
        ` <span class="b-leaf-count" title="${
          g < 0 && split
            ? "don't care · leaf bag collapsed to one row"
            : split
              ? "split into leaf chunks"
              : "unsplit · whole turn is L01"
        }">${
          g < 0 && split && collapsed
            ? "▾ bag · " + leafN + "L"
            : split
              ? leafN + " leaves"
              : "L01 whole"
        }</span>` +
        bagBit +
        (collapsed && peek
          ? ` <span class="b-msg-peek" title="${esc(peek)}">${esc(peek)}${
              text.length > 96 ? "…" : ""
            }</span>`
          : "") +
        `</span>` +
        `<span class="b-msg-actions">` +
        (split
          ? `<button type="button" class="b-leaf-auto" data-leaf-reset="${seq}" title="Undo leaf cuts · whole turn L01">↺</button>`
          : `<button type="button" class="b-leaf-auto" data-leaf-auto="${seq}" title="Optional · auto-split on blank lines (dictation walls: use ✂ between sentences instead)">¶</button>`) +
        `<button type="button" class="b-leaf-auto" data-export-seq="${seq}" title="Seal this branch as a CXR">export</button>` +
        `<span class="b-grav" data-grav-wrap="${seq}">` +
        `<button type="button" class="b-grav-btn${
          g < 0 ? " is-on" : ""
        }" data-grav-down="${seq}" title="No gravity · don't care">▾</button>` +
        `<button type="button" class="b-grav-btn${
          g > 0 ? " is-on" : ""
        }" data-grav-up="${seq}" title="Real gravity · important">▴</button>` +
        `</span>` +
        `</span>` +
        `</div>` +
        `<div class="b-msg-body" data-body-seq="${seq}"${
          collapsed ? " hidden" : ""
        }>${bodyHtml}</div>` +
        `</article>`;
    });
    stream.innerHTML = html;

    stream.querySelectorAll("[data-cut]").forEach((btn) => {
      btn.onclick = () => placeCut(parseInt(btn.getAttribute("data-cut"), 10));
    });
    stream.querySelectorAll("[data-scene-accept]").forEach((btn) => {
      btn.onclick = () =>
        acceptScene(parseInt(btn.getAttribute("data-scene-accept"), 10));
    });
    stream.querySelectorAll("[data-scene-reject]").forEach((btn) => {
      btn.onclick = () =>
        rejectScene(parseInt(btn.getAttribute("data-scene-reject"), 10));
    });
    function wireCutSpread(el) {
      let enterT = null;
      const nearCenter = (ev) => {
        const r = el.getBoundingClientRect();
        const half = Math.min(110, Math.max(56, r.width * 0.18));
        return Math.abs(ev.clientX - (r.left + r.width / 2)) <= half;
      };
      const open = () => el.classList.add("is-spread");
      const close = () => {
        if (el.classList.contains("is-open")) return;
        if (el.contains(document.activeElement)) return;
        el.classList.remove("is-spread");
      };
      el.addEventListener("mousemove", (ev) => {
        if (el.classList.contains("is-spread") || el.classList.contains("is-open"))
          return;
        if (!nearCenter(ev)) {
          clearTimeout(enterT);
          enterT = null;
          return;
        }
        if (!enterT) enterT = setTimeout(open, 140);
      });
      el.addEventListener("mouseleave", () => {
        clearTimeout(enterT);
        enterT = null;
        close();
      });
      el.addEventListener("click", (ev) => {
        if (ev.target.closest("button")) return;
        if (!el.classList.contains("is-spread") && !nearCenter(ev)) return;
        el.classList.toggle("is-open");
      });
    }
    stream.querySelectorAll(".b-cut-block").forEach((el) => {
      wireCutSpread(el);
    });
    stream.querySelectorAll("[data-toggle-cut]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const el = btn.closest(".b-cut-block");
        if (!el) return;
        const on = !el.classList.contains("is-open");
        el.classList.toggle("is-open", on);
        btn.setAttribute("aria-expanded", on ? "true" : "false");
        if (!on) {
          el.classList.remove("is-spread");
          btn.blur();
        }
      };
    });
    stream.querySelectorAll("[data-uncut]").forEach((btn) => {
      btn.onclick = () =>
        removeCut(parseInt(btn.getAttribute("data-uncut"), 10));
    });
    stream.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const start = parseInt(btn.getAttribute("data-edit"), 10);
        const br = branches.find((b) => b.start_seq === start);
        editBranch(start, br || null);
      };
    });
    stream.querySelectorAll("[data-copy-chip]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        copyChip(btn.getAttribute("data-copy-chip") || "");
      };
    });
    stream.querySelectorAll("[data-grav-up]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-grav-up"), 10);
        const art = stream.querySelector(`.b-msg[data-seq="${seq}"]`);
        const cur = art
          ? parseInt(art.getAttribute("data-gravity") || "0", 10)
          : 0;
        // up again → back to moderate; otherwise set important
        setGravity(seq, cur > 0 ? 0 : 1);
      };
    });
    stream.querySelectorAll("[data-grav-down]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-grav-down"), 10);
        const art = stream.querySelector(`.b-msg[data-seq="${seq}"]`);
        const cur = art
          ? parseInt(art.getAttribute("data-gravity") || "0", 10)
          : 0;
        // down again → back to moderate; otherwise don't-care
        setGravity(seq, cur < 0 ? 0 : -1);
      };
    });
    stream.querySelectorAll("[data-parsed-toggle]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-parsed-toggle"), 10);
        const art = stream.querySelector(`.b-msg[data-seq="${seq}"]`);
        const cur = art && art.getAttribute("data-parsed") === "1";
        setParsed(seq, !cur);
      };
    });
    stream.querySelectorAll("[data-expand]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-expand"), 10);
        toggleMsgExpand(seq);
      };
    });
    // click empty rail chrome (not buttons) to fold/unfold
    stream.querySelectorAll("[data-rail-toggle]").forEach((h) => {
      h.onclick = (ev) => {
        if (ev.target.closest("button")) return;
        const seq = parseInt(h.getAttribute("data-rail-toggle"), 10);
        toggleMsgExpand(seq);
      };
    });
    // one-click auto leaf cut (paragraph / line breaks) — no manual select


    stream.querySelectorAll("[data-leaf-fold]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-fold"), 10);
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        toggleLeafFold(seq, ln);
      };
    });
    stream.querySelectorAll("[data-leaf-rail]").forEach((rail) => {
      rail.onclick = (ev) => {
        // ignore clicks on interactive children (chip / grav / fold already stop)
        if (ev.target !== rail && ev.target.closest("button")) return;
        const seq = parseInt(rail.getAttribute("data-leaf-rail"), 10);
        const ln = parseInt(rail.getAttribute("data-leaf-n"), 10);
        toggleLeafFold(seq, ln);
      };
    });

    stream.querySelectorAll("[data-leaf-at]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-at"), 10);
        const off = parseInt(btn.getAttribute("data-off"), 10);
        placeLeafAt(seq, off);
      };
    });


    stream.querySelectorAll("[data-msg-tags]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-msg-tags"), 10);
        editMsgTags(seq);
      };
    });
    stream.querySelectorAll("[data-leaf-tags]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-tags"), 10);
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        editLeafTags(seq, ln);
      };
    });
    stream.querySelectorAll("[data-trunk-tags]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const start = parseInt(btn.getAttribute("data-trunk-tags"), 10);
        editTrunkTags(Number.isFinite(start) ? start : 0);
      };
    });
    stream.querySelectorAll("[data-leaf-auto]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-auto"), 10);
        autoCutLeaves(seq);
      };
    });
    stream.querySelectorAll("[data-leaf-reset]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-reset"), 10);
        if (
          window.confirm(
            "Reset this message?\nAll leaf cuts go away · whole turn is one body again."
          )
        ) {
          clearLeaves(seq);
        }
      };
    });
    stream.querySelectorAll("[data-export-seq]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-export-seq"), 10);
        exportBranch(seq);
      };
    });
    stream.querySelectorAll(".b-leaf-chip[data-leaf-n]").forEach((btn) => {
      btn.ondblclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-seq"), 10);
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        if (window.confirm("Remove leaf L" + String(ln).padStart(2, "0") + "?")) {
          deleteLeaf(seq, ln);
        }
      };
    });
    stream.querySelectorAll("[data-leaf-grav-up]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-grav-up"), 10);
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        const block = stream.querySelector(
          `.b-leaf-block[data-leaf-seq="${seq}"][data-leaf-n="${ln}"]`
        );
        const cur = block
          ? parseInt(block.getAttribute("data-leaf-gravity") || "0", 10)
          : 0;
        setLeafGravity(seq, ln, cur > 0 ? 0 : 1);
      };
    });
    stream.querySelectorAll("[data-leaf-grav-down]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-grav-down"), 10);
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        const block = stream.querySelector(
          `.b-leaf-block[data-leaf-seq="${seq}"][data-leaf-n="${ln}"]`
        );
        const cur = block
          ? parseInt(block.getAttribute("data-leaf-gravity") || "0", 10)
          : 0;
        setLeafGravity(seq, ln, cur < 0 ? 0 : -1);
      };
    });
    // leaf fold wired via [data-leaf-rail] / [data-leaf-fold]

    // place: restore scroll after paint, or keep position across re-paints
    if (opts.restoreScroll && openFaceId) {
      restoreScroll(openFaceId);
    } else if (keepScroll != null && stKeep) {
      stKeep.scrollTop = keepScroll;
    }
  }

  /**
   * Render message body with leaf partitions highlighted.
   * Unsplit: plain text (implicit L01 whole). Split: each range is a section card.
   */
  function trimLeafChunk(s) {
    return String(s || "").replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
  }

  function renderMsgBodyHtml(text, leaves, split, msgChipStr, seq, cutLocked) {
    const full = String(text || "");
    const showRails = !cutLocked;
    if (!split || !leaves || !leaves.length) {
      return showRails
        ? renderTextWithSentenceCuts(full, seq, 0)
        : esc(full);
    }
    const sorted = leaves.slice().sort((a, b) => a.start_off - b.start_off);
    let html = "";
    sorted.forEach((lf, i) => {
      const a = Math.max(0, Number(lf.start_off) || 0);
      const b = Math.max(a, Number(lf.end_off) || 0);
      const chunkRaw = full.slice(a, b);
      const chunk = trimLeafChunk(chunkRaw);
      if (!chunk) {
        return;
      }
      const ln = Number(lf.leaf_n) || i + 1;
      const leafTags = Array.isArray(lf.tags)
        ? lf.tags.map(normalizeTag).filter(Boolean)
        : [];
      const lchip =
        lf.chip ||
        msgChipStr + ".L" + String(ln).padStart(2, "0");
      const chipped = !!(
        lf.chipped ||
        lf.title ||
        (lf.note && !lf.remainder)
      );
      const lg = Number(lf.gravity) || 0;
      const remainder = !!(
        lf.remainder ||
        lg < 0 ||
        (!chipped && !lf.implicit)
      );
      // Chip button = full cite code (click copies). Title is tooltip only.
      const tipBits = [lchip];
      if (remainder) tipBits.push("low");
      else if (chipped) tipBits.push("chipped");
      const tip = tipBits.join(" · ");
      const gClass =
        lg > 0 ? " grav-up" : lg < 0 ? " grav-down" : "";
      const bodyInner = showRails
        ? renderTextWithSentenceCuts(chunk, seq, a)
        : esc(chunk);
      const leafCollapsed = remainder || lg < 0;
      const leafHid = hideDown && lg < 0 ? " is-down-hid" : "";
      html +=
        `<section class="b-leaf-block${
          chipped && !remainder ? " is-chipped" : ""
        }${remainder ? " is-remainder" : ""}${gClass}${
          leafCollapsed ? " is-leaf-collapsed" : ""
        }${leafHid}" data-leaf-seq="${seq}" data-leaf-n="${ln}" data-leaf-gravity="${lg}" title="Click rail to collapse / expand leaf">` +
        `<div class="b-leaf-block-h" data-leaf-rail="${seq}" data-leaf-n="${ln}">` +
        `<button type="button" class="b-leaf-fold" data-leaf-fold="${seq}" data-leaf-n="${ln}" title="Collapse / expand">${
          leafCollapsed ? "▸" : "▾"
        }</button>` +
        `<button type="button" class="b-leaf-chip" data-copy-chip="${esc(
          lchip
        )}" data-leaf-seq="${seq}" data-leaf-n="${ln}" title="Copy ${esc(
          tip
        )}">${esc(lchip)}</button>` +
        renderDocTags(leafTags) +
        renderDocTagAdd(
          `data-leaf-tags="${seq}" data-leaf-n="${ln}"`,
          "Add leaf tags"
        ) +
        `<span class="b-leaf-range">${chunk.length}c</span>` +
        `<span class="b-grav b-leaf-grav" data-leaf-grav-wrap="${seq}-${ln}">` +
        `<button type="button" class="b-grav-btn${
          lg < 0 ? " is-on" : ""
        }" data-leaf-grav-down="${seq}" data-leaf-n="${ln}" title="Leaf · don't care">▾</button>` +
        `<button type="button" class="b-grav-btn${
          lg > 0 ? " is-on" : ""
        }" data-leaf-grav-up="${seq}" data-leaf-n="${ln}" title="Leaf · important">▴</button>` +
        `</span>` +
        `</div>` +
        `<div class="b-leaf-block-body">${bodyInner}</div>` +
        `</section>`;
    });
    return html || (showRails ? renderTextWithSentenceCuts(full, seq, 0) : esc(full));
  }

  function applyGravityDom(seq, g) {
    const art = document.querySelector(`.b-msg[data-seq="${seq}"]`);
    if (!art) return;
    art.setAttribute("data-gravity", String(g));
    art.classList.toggle("grav-up", g > 0);
    art.classList.toggle("grav-down", g < 0);
    art.classList.toggle("is-down-hid", hideDown && g < 0);
    const cut = document.querySelector(`.b-cut-block[data-seq="${seq}"]`);
    if (cut) cut.classList.toggle("is-down-hid", hideDown && g < 0);
    const up = art.querySelector(`[data-grav-up="${seq}"]`);
    const down = art.querySelector(`[data-grav-down="${seq}"]`);
    if (up) up.classList.toggle("is-on", g > 0);
    if (down) down.classList.toggle("is-on", g < 0);
  }

  function gravityCountsFromPayload() {
    const msgs = (payload && payload.messages) || [];
    let up = 0;
    let down = 0;
    let mid = 0;
    msgs.forEach((m) => {
      const g = Number(m.gravity) || 0;
      if (g > 0) up++;
      else if (g < 0) down++;
      else mid++;
    });
    return { up, down, mid };
  }

  function paintGravityQuiet() {
    if (!payload || !payload.log) return;
    const branches = payload.branches || [];
    const { up, down, mid } = gravityCountsFromPayload();
    const nMsg = (payload.messages || []).length;
    const nParsed =
      payload.log.parsed_count != null
        ? payload.log.parsed_count
        : (payload.messages || []).filter((m) => m.parsed).length;
    const bits = [];
    if (payload.log.date) bits.push(payload.log.date);
    if (nMsg) bits.push(nMsg + " messages");
    bits.push(
      branches.length +
        " trunk" +
        (branches.length === 1 ? "" : "s") +
        " · hand cuts"
    );
    bits.push(`▴${up} · ·${mid} · ▾${down}`);
    if (nMsg) bits.push(`parsed ${nParsed}/${nMsg}`);
    if (payload.log.cut_done) bits.push("✓ cut done · reading");
    $("logQuiet").textContent = bits.join(" · ");
  }

  function workKindLab(kind) {
    return (
      {
        scene_pass: "scene pass · proposed",
        trunk_accept: "you accepted",
        trunk_cut: "you cut",
        trunk_uncut: "you removed",
        throughline_accept: "you accepted throughline",
        cut_done: "you marked cut done",
        cut_undone: "you unmarked cut done",
      }[kind] || kind
    );
  }

  function workWhen(w) {
    const t = Number(w && w.at);
    if (Number.isFinite(t) && t > 0) {
      const d = new Date(t * 1000);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        return (
          d.getFullYear() +
          "-" +
          pad(d.getMonth() + 1) +
          "-" +
          pad(d.getDate()) +
          " " +
          pad(d.getHours()) +
          ":" +
          pad(d.getMinutes())
        );
      }
    }
    return String((w && w.day) || "").trim();
  }

  function paintWorkLog() {
    const wrap = $("logWork");
    const body = $("logWorkBody");
    if (!wrap || !body) return;
    const rows = (payload && payload.work) || [];
    if (!rows.length) {
      body.innerHTML = "";
      wrap.hidden = true;
      wrap.classList.remove("is-open");
      const btn = $("logWorkBtn");
      if (btn) btn.setAttribute("aria-expanded", "false");
      return;
    }
    wrap.hidden = false;
    body.innerHTML = rows
      .map((w) => {
        const when = workWhen(w);
        const lab = workKindLab(w.kind);
        const name = String(w.title || "").trim();
        const who = w.kind === "scene_pass" ? "proposed" : "yours";
        return (
          `<div class="b-work-row">` +
          `<div class="b-work-when">${esc(when || "—")}</div>` +
          `<div class="b-work-what">` +
          `<span class="b-work-who">${esc(who)}</span>` +
          ` ${esc(lab)}` +
          (name && lab.indexOf(name) < 0 ? ` · ${esc(name)}` : "") +
          `</div>` +
          `</div>`
        );
      })
      .join("");
  }

  function paintLogName() {
    if (!payload || !payload.log) return;
    const log = payload.log;
    const orig = (log.orig_title || "").trim();
    const work = (log.working_title || "").trim();
    const note = (log.log_note || "").trim();
    const named = (log.title || orig || log.log_code || "—").trim();
    $("logTitle").textContent = named;
    const titleBtn = $("logTitleBtn");
    if (titleBtn) {
      titleBtn.title = work
        ? "Edit official log title"
        : "Set official log title (used by other software)";
    }
    const origEl = $("logOrig");
    if (origEl) {
      const bits = [];
      if (work && orig && orig !== work) bits.push("original · " + orig);
      else if (!work && orig) bits.push("original name · click to rename for export");
      if (log.bag_code) bits.push("chunk · " + log.bag_code);
      if (note) bits.push(note);
      origEl.textContent = bits.join(" · ");
      origEl.hidden = !bits.length;
    }
  }

  function shotPeek(shot) {
    const t = String(shot || "").replace(/\s+/g, " ").trim();
    if (t.length <= 72) return t;
    return t.slice(0, 71).replace(/\s+\S*$/, "") + "…";
  }

  function jumpToSeq(seq) {
    const n = Number(seq);
    const stream = $("msgStream");
    const el =
      (stream &&
        stream.querySelector(
          `.b-cut-block[data-seq="${n}"], .b-doc-trunk[data-seq="${n}"], .b-msg[data-seq="${n}"], .b-doc-msg[data-seq="${n}"]`
        )) ||
      document.querySelector(`.b-cut-block[data-seq="${n}"]`) ||
      document.querySelector(`.b-doc-trunk[data-seq="${n}"]`) ||
      document.querySelector(`.b-msg[data-seq="${n}"]`);
    if (!el) return toast("seq " + n + " not on screen");
    const hid = [el];
    const msg = document.querySelector(`.b-msg[data-seq="${n}"]`);
    if (msg && msg !== el) hid.push(msg);
    hid.forEach((node) => node.classList.remove("is-down-hid"));
    el.classList.add("is-spread", "is-open");
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function paintSceneLog() {
    const el = $("sceneLogCard");
    if (!el) return;
    const sc = payload && payload.scene_log;
    if (!sc || (sc.status || "") === "rejected") {
      el.innerHTML = "";
      return;
    }
    const accepted = (sc.status || "proposed") === "accepted";
    const locked = !!(payload.log && payload.log.cut_done);
    el.innerHTML =
      `<div class="b-log-shot${accepted ? " is-accepted" : ""}">` +
      `<div class="b-cut-note-lab">throughline · ${esc(sc.intensity || "charged")}${
        accepted ? " · accepted" : ""
      }</div>` +
      `<div class="b-scene-shot">${esc(sc.shot || "")}</div>` +
      (locked
        ? ""
        : `<div class="b-scene-acts">` +
          `<button type="button" class="b-export-btn" data-scene-log-accept="1">${
            accepted ? "edit throughline" : "accept · edit"
          }</button>` +
          (accepted
            ? ""
            : `<button type="button" class="b-export-btn" data-scene-log-reject="1">reject</button>`) +
          `</div>`) +
      `</div>`;
    const acc = el.querySelector("[data-scene-log-accept]");
    if (acc) acc.onclick = () => acceptLogScene();
    const rej = el.querySelector("[data-scene-log-reject]");
    if (rej) rej.onclick = () => rejectLogScene();
  }

  function paintSceneIndex() {
    const el = $("sceneIndex");
    if (!el) return;
    const proposed = (payload.scenes || []).filter(
      (s) => (s.status || "proposed") === "proposed"
    );
    if (!proposed.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = proposed
      .map((s) => {
        return (
          `<button type="button" class="b-scene-jump" data-scene-jump="${esc(
            String(s.start_seq)
          )}">` +
          `<div class="b-scene-jump-h">proposed trunk · seq ${esc(
            String(s.start_seq)
          )} · ${esc(s.intensity || "calm")}</div>` +
          (s.title
            ? `<div class="b-scene-name">${esc(s.title)}</div>`
            : "") +
          `<div>${esc(shotPeek(s.shot))}</div>` +
          `</button>`
        );
      })
      .join("");
    el.querySelectorAll("[data-scene-jump]").forEach((btn) => {
      btn.onclick = () => jumpToSeq(btn.getAttribute("data-scene-jump"));
    });
  }

  function paintTrunkJumpBtn() {
    const btn = $("trunkJumpBtn");
    if (!btn) return;
    btn.classList.toggle("is-on", showTrunkJump);
    btn.textContent = showTrunkJump ? "jumps" : "jumps off";
    btn.title = showTrunkJump
      ? "Hide the trunk jump rail"
      : "Show the trunk jump rail (official + proposed)";
  }

  function toggleTrunkJump() {
    showTrunkJump = !showTrunkJump;
    savePlace({ showTrunkJump: showTrunkJump });
    paintTrunkJump();
    toast(showTrunkJump ? "trunk jumps on" : "trunk jumps off");
  }

  function paintTrunkJump() {
    const el = $("trunkJump");
    if (!el) return;
    paintTrunkJumpBtn();
    if (!payload || !payload.log || !showTrunkJump) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    const branches = payload.branches || [];
    const cutSeqs = new Set(branches.map((b) => Number(b.start_seq)));
    const stops = [];
    branches.forEach((b) => {
      const tn = b.trunk_n || b.branch_n;
      const titled = (b.title || "").trim();
      stops.push({
        seq: Number(b.start_seq),
        kind: "cut",
        tn,
        lab: titled ? `T${tn} · ${titled}` : `T${tn}`,
      });
    });
    (payload.scenes || []).forEach((s) => {
      if ((s.status || "proposed") === "rejected") return;
      const seq = Number(s.start_seq);
      if (cutSeqs.has(seq)) return;
      if ((s.status || "proposed") !== "proposed") return;
      stops.push({
        seq,
        kind: "proposed",
        tn: null,
        lab: (s.title || "").trim() || "seq " + seq,
      });
    });
    stops.sort((a, b) => a.seq - b.seq);
    if (!stops.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML =
      `<span class="b-trunk-jump-lab">jump</span>` +
      stops
      .map((s) => {
        const on = s.kind === "cut" && highlightBranch === s.tn;
        return (
          `<button type="button" class="b-trunk-jump-tab${
            s.kind === "proposed" ? " is-proposed" : ""
          }${on ? " is-on" : ""}" data-jump-seq="${esc(
            String(s.seq)
          )}" title="${esc(
            s.kind === "proposed"
              ? "Proposed trunk · seq " + s.seq
              : "Jump to trunk · seq " + s.seq
          )}">${esc(s.lab)}</button>`
        );
      })
      .join("");
    el.querySelectorAll("[data-jump-seq]").forEach((btn) => {
      btn.onclick = () => {
        const seq = parseInt(btn.getAttribute("data-jump-seq"), 10);
        const stop = stops.find((x) => x.seq === seq);
        if (stop && stop.kind === "cut" && stop.tn) {
          highlightBranch = stop.tn;
          if (openFaceId)
            patchFacePlace(openFaceId, { highlightBranch: highlightBranch });
        }
        jumpToSeq(seq);
        el.querySelectorAll(".b-trunk-jump-tab").forEach((b) => {
          b.classList.toggle("is-on", b === btn);
        });
      };
    });
  }

  async function setGravity(seq, gravity, faceId) {
    const fid = faceId || openFaceId;
    if (!fid) return;
    const g = gravity === 1 || gravity === -1 ? gravity : 0;
    if (fid === openFaceId) {
      applyGravityDom(seq, g);
      if (payload && payload.messages) {
        const m = payload.messages.find((x) => x.seq === seq);
        if (m) m.gravity = g;
      }
      if (g < 0) {
        /* don't-care → real thin rail (hide body + noisy chrome) */
        toggleMsgExpand(seq, false);
      }
      paintGravityQuiet();
      paintHideDownBtn();
    }
    const hit = findHits.find((h) => h.face_id === fid && h.seq === seq);
    if (hit) hit.gravity = g;
    Object.keys(findAround).forEach((k) => {
      ((findAround[k] && findAround[k].units) || []).forEach((u) => {
        if (u.face_id === fid && Number(u.seq) === Number(seq)) u.gravity = g;
      });
    });
    Object.keys(findPicked).forEach((chip) => {
      const u = findPicked[chip];
      if (u && u.face_id === fid && Number(u.seq) === Number(seq)) u.gravity = g;
    });
    if (hit || Object.keys(findAround).length) paintFindHits();
    const j = await api("/api/msg/gravity", {
      method: "POST",
      body: JSON.stringify({
        face_id: fid,
        seq,
        gravity: g,
      }),
    });
    if (!j.ok) {
      toast(j.error || "gravity fail");
      if (fid === openFaceId) await openLog(openFaceId);
      return;
    }
  }

  function applyParsedDom(seq, parsed) {
    const art = document.querySelector(`.b-msg[data-seq="${seq}"]`);
    if (!art) return;
    art.setAttribute("data-parsed", parsed ? "1" : "0");
    art.classList.toggle("is-parsed", !!parsed);
    const btn = art.querySelector(`[data-parsed-toggle="${seq}"]`);
    if (btn) {
      btn.classList.toggle("is-on", !!parsed);
      btn.textContent = parsed ? "✓" : "○";
      btn.title = parsed
        ? "Unmark parsed"
        : "Mark parsed · I pulled the bits";
    }
  }

  async function setParsed(seq, parsed) {
    if (!openFaceId) return;
    applyParsedDom(seq, parsed);
    if (payload && payload.messages) {
      const m = payload.messages.find((x) => x.seq === seq);
      if (m) m.parsed = !!parsed;
    }
    if (payload && payload.log) {
      const n = (payload.messages || []).filter((x) => x.parsed).length;
      payload.log.parsed_count = n;
    }
    paintGravityQuiet();
    const j = await api("/api/msg/parsed", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq,
        parsed: !!parsed,
      }),
    });
    if (!j.ok) {
      toast(j.error || "parse mark fail");
      await openLog(openFaceId);
      return;
    }
    toast(parsed ? "parsed · " + seq : "unparsed · " + seq);
  }

  function toggleMsgExpand(seq, forceOpen) {
    const art = document.querySelector(`.b-msg[data-seq="${seq}"]`);
    if (!art) return;
    let open;
    if (forceOpen === true) open = true;
    else if (forceOpen === false) open = false;
    else open = art.classList.contains("is-collapsed"); // was rail → open body
    art.classList.toggle("is-collapsed", !open);
    art.classList.toggle("is-open", open);
    const body = art.querySelector(`[data-body-seq="${seq}"]`);
    if (body) {
      body.hidden = !open;
      // belt+suspenders for split leaves / sentence rails
      body.style.display = open ? "" : "none";
    }
    const btn = art.querySelector(`[data-expand="${seq}"]`);
    if (btn) {
      const g = parseInt(art.getAttribute("data-gravity") || "0", 10);
      btn.textContent = open ? "▾" : "▸";
      btn.title = open
        ? "Collapse to thin rail"
        : g < 0
          ? "Expand (don't-care · quiet)"
          : "Expand message";
    }
    // peek only when collapsed — one quiet line
    let peek = art.querySelector(".b-msg-peek");
    if (open && peek) peek.remove();
    if (!open) {
      const msg = ((payload && payload.messages) || []).find((x) => x.seq === seq);
      const raw = (msg && msg.text) || "";
      const p = String(raw).replace(/\s+/g, " ").trim().slice(0, 72);
      if (!peek && p) {
        peek = document.createElement("span");
        peek.className = "b-msg-peek";
        const left = art.querySelector(".b-msg-h-left");
        if (left) left.appendChild(peek);
      }
      if (peek) {
        peek.title = String(raw).replace(/\s+/g, " ").trim().slice(0, 200);
        peek.textContent = p ? p + (raw.length > 72 ? "…" : "") : "";
      }
    }
    setSeqCollapsed(seq, !open);
    scheduleScrollSave();
    if (open) {
      art.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function normText(s) {
    return String(s || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
  }

  /**
   * Text roots that make up the message body string (skip leaf chrome/headers).
   * Unsplit: the whole .b-msg-body. Split: each .b-leaf-block-body in order.
   */
  function messageTextRoots(bodyEl) {
    if (!bodyEl) return [];
    const leaves = bodyEl.querySelectorAll(".b-leaf-block-body");
    if (leaves.length) return Array.from(leaves);
    return [bodyEl];
  }

  /**
   * Absolute char offset in message-body text for a DOM point.
   * Only counts leaf/body text — never chip labels or leaf headers.
   */
  function absoluteTextOffset(bodyEl, node, offset) {
    if (!bodyEl || !node) return -1;
    const roots = messageTextRoots(bodyEl);
    if (!roots.length) return -1;
    let acc = 0;
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      if (root === node || root.contains(node)) {
        try {
          const r = document.createRange();
          r.selectNodeContents(root);
          r.setEnd(node, offset);
          return acc + r.toString().length;
        } catch (e) {
          return -1;
        }
      }
      acc += (root.textContent || "").length;
    }
    // Point is outside pure text roots (e.g. leaf header) — not mappable
    return -1;
  }

  /**
   * Align [approxStart, approxEnd) to msg.text.
   * Prefer the longer of DOM-measured span vs selection string — never shrink
   * a good measured end because toString() dropped trailing words (the snake).
   */
  function snapSelectionToFull(full, approxStart, approxEnd, selected) {
    const f = normText(full);
    const selNorm = normText(selected);
    let start = Math.max(0, Math.min(Number(approxStart) || 0, f.length));
    let end = Math.max(start, Math.min(Number(approxEnd) || 0, f.length));
    const measured = f.slice(start, end);

    if (!selNorm) {
      return { start, end, selected: measured };
    }

    // Happy path: DOM offsets already land on the selection (or a superset)
    if (
      measured === selNorm ||
      (measured.length >= selNorm.length && measured.startsWith(selNorm)) ||
      (selNorm.length >= measured.length &&
        measured.length > 0 &&
        selNorm.startsWith(measured) &&
        f.slice(start, start + selNorm.length) === selNorm)
    ) {
      if (selNorm.length > measured.length && f.slice(start, start + selNorm.length) === selNorm) {
        end = start + selNorm.length;
      }
      // measured longer than toString → keep measured (do not shrink)
      return { start, end, selected: f.slice(start, end) };
    }

    // Offsets drifted — find selection text near measured start
    const win0 = Math.max(0, start - 96);
    const win1 = Math.min(f.length, Math.max(end, start) + selNorm.length + 96);
    const window = f.slice(win0, win1);
    let foundStart = -1;
    let idx = window.indexOf(selNorm);
    if (idx >= 0) {
      let best = idx;
      let bestDist = Math.abs(win0 + idx - start);
      let next = idx + 1;
      while (next < window.length) {
        const j = window.indexOf(selNorm, next);
        if (j < 0) break;
        const d = Math.abs(win0 + j - start);
        if (d < bestDist) {
          best = j;
          bestDist = d;
        }
        next = j + 1;
      }
      foundStart = win0 + best;
    } else {
      const g = f.indexOf(selNorm);
      if (g >= 0) foundStart = g;
    }

    if (foundStart >= 0) {
      const endFromSel = foundStart + selNorm.length;
      // Carry measured length if it was longer (shifted by start correction)
      const shiftedEnd = end + (foundStart - start);
      let useEnd = endFromSel;
      if (shiftedEnd > endFromSel) {
        const span = f.slice(foundStart, Math.min(f.length, shiftedEnd));
        if (span.startsWith(selNorm)) useEnd = Math.min(f.length, shiftedEnd);
      }
      start = foundStart;
      end = Math.min(f.length, Math.max(start, useEnd));
      return { start, end, selected: f.slice(start, end) };
    }

    // Last resort: measured offsets only
    return { start, end, selected: measured };
  }

  function rememberBodySelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node =
      range.commonAncestorContainer.nodeType === 3
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    const body =
      node && node.closest && node.closest(".b-msg-body[data-body-seq]");
    if (!body) return;
    // Both ends should live in message text (not the leaf header chrome)
    const roots = messageTextRoots(body);
    const inText = (n) =>
      roots.some((r) => r === n || (n && r.contains && r.contains(n)));
    if (!inText(range.startContainer) || !inText(range.endContainer)) {
      // still allow pure body (unsplit) selections already covered
      if (!body.contains(range.startContainer) || !body.contains(range.endContainer))
        return;
    }
    try {
      savedBodySel = {
        seq: parseInt(body.getAttribute("data-body-seq"), 10),
        range: range.cloneRange(),
        text: range.toString() || sel.toString() || "",
        at: Date.now(),
      };
    } catch (e) {
      /* clone can fail if node detaches */
    }
  }

  /**
   * Map DOM selection → [start, end) in original message text.
   * Walk only body/leaf text nodes so chip labels never shift offsets.
   */
  function selectionOffsetsInMessage(bodyEl, msg, range) {
    const full = (msg && msg.text) || "";
    let start = absoluteTextOffset(
      bodyEl,
      range.startContainer,
      range.startOffset
    );
    let end = absoluteTextOffset(bodyEl, range.endContainer, range.endOffset);
    if (start < 0 || end < 0) {
      // Legacy fallback: single-root measure (unsplit or one leaf)
      const common =
        range.commonAncestorContainer.nodeType === 3
          ? range.commonAncestorContainer.parentElement
          : range.commonAncestorContainer;
      let root = bodyEl;
      let base = 0;
      const leafBody =
        common && common.closest && common.closest(".b-leaf-block-body");
      if (leafBody && bodyEl.contains(leafBody)) {
        root = leafBody;
        const block = leafBody.closest(".b-leaf-block");
        const ln = block ? parseInt(block.getAttribute("data-leaf-n"), 10) : 0;
        const lf =
          msg && (msg.leaves || []).find((x) => Number(x.leaf_n) === ln);
        base = lf ? Number(lf.start_off) || 0 : 0;
      }
      try {
        const rs = document.createRange();
        rs.selectNodeContents(root);
        rs.setEnd(range.startContainer, range.startOffset);
        start = rs.toString().length + base;
        const re = document.createRange();
        re.selectNodeContents(root);
        re.setEnd(range.endContainer, range.endOffset);
        end = re.toString().length + base;
      } catch (e) {
        return null;
      }
    }
    if (end < start) {
      const t = start;
      start = end;
      end = t;
    }
    // Longest available selection string (some engines drop the tail on one API)
    const a = range.toString() || "";
    const b =
      (window.getSelection() && window.getSelection().toString()) || "";
    const c =
      (savedBodySel &&
        savedBodySel.seq ===
          parseInt(bodyEl.getAttribute("data-body-seq"), 10) &&
        savedBodySel.text) ||
      "";
    let selected = a;
    if (b.length > selected.length) selected = b;
    if (c.length > selected.length) selected = c;
    return snapSelectionToFull(full, start, end, selected);
  }


  /** Offsets where a new sentence starts (after .!?… + space/newline). */
  function sentenceBreakOffsets(text) {
    const t = String(text || "");
    const out = [];
    const push = (at) => {
      if (at > 0 && at < t.length && out.indexOf(at) < 0) out.push(at);
    };
    // sentence ends
    const re = /[.!?…]+(?:["')\]]+)?(?=\s+\S)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
      let at = m.index + m[0].length;
      while (at < t.length && /[ \t]/.test(t[at])) at += 1;
      while (at < t.length && /[\r\n]/.test(t[at])) at += 1;
      push(at);
    }
    // blank lines
    const re2 = /(?:\r\n|\n|\r){2,}/g;
    while ((m = re2.exec(t)) !== null) {
      push(m.index + m[0].length);
    }
    // dictation walls: few sentence marks → soft cuts ~every 220 chars at a word break
    if (out.length < 2 && t.length > 280) {
      let cursor = 220;
      while (cursor < t.length - 80) {
        let at = cursor;
        // prefer space before a word
        while (at < t.length && t[at] !== " " && t[at] !== "\n") at += 1;
        while (at < t.length && /[ \t]/.test(t[at])) at += 1;
        if (at >= t.length - 40) break;
        push(at);
        cursor = at + 220;
      }
    }
    out.sort((a, b) => a - b);
    return out;
  }

  /** Render text with ✂ leaf-cut rails at sentence (and blank-line) breaks. */
  function renderTextWithSentenceCuts(text, seq, baseOff) {
    const full = String(text || "");
    const base = Number(baseOff) || 0;
    const localBreaks = sentenceBreakOffsets(full);
    if (!localBreaks.length) return esc(full);
    let html = "";
    let prev = 0;
    localBreaks.forEach((loc) => {
      if (loc <= prev || loc >= full.length) return;
      html += esc(full.slice(prev, loc));
      const abs = base + loc;
      html +=
        `<button type="button" class="b-sent-cut" data-leaf-at="${seq}" data-off="${abs}" aria-label="Leaf cut starts here" title="Leaf cut starts here"></button>`;
      prev = loc;
    });
    html += esc(full.slice(prev));
    return html;
  }


  function toggleLeafFold(seq, leafN) {
    const block = document.querySelector(
      `.b-leaf-block[data-leaf-seq="${seq}"][data-leaf-n="${leafN}"]`
    );
    if (!block) return;
    block.classList.toggle("is-leaf-collapsed");
    block.classList.remove("is-leaf-open");
    const folded = block.classList.contains("is-leaf-collapsed");
    const btn = block.querySelector(
      `[data-leaf-fold="${seq}"][data-leaf-n="${leafN}"]`
    );
    if (btn) btn.textContent = folded ? "▸" : "▾";
  }

  async function placeLeafAt(seq, offset) {
    if (!openFaceId) return;
    if (payload && payload.log && payload.log.cut_done) {
      toast("unmark cut done to place leaf cuts");
      return;
    }
    const j = await api("/api/msg/leaf/at", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq: Number(seq),
        offset: Number(offset),
      }),
    });
    if (!j.ok) {
      toast(j.error || "leaf cut fail");
      return;
    }
    const chipOut =
      (j.leaf && j.leaf.chip) ||
      (j.chip) ||
      "leaf";
    toast("leaf cut · " + chipOut);
    if (j.leaf && j.leaf.chip) copyChip(j.leaf.chip);
    await openLog(openFaceId);
    requestAnimationFrame(() => {
      const art = document.querySelector(`.b-msg[data-seq="${seq}"]`);
      if (art && art.classList.contains("is-collapsed")) toggleMsgExpand(seq);
    });
  }

  async function cutLeafFromSelection(seq) {
    if (!openFaceId) return;
    const body = document.querySelector(`[data-body-seq="${seq}"]`);
    if (!body) return;
    const msg = (payload.messages || []).find((x) => x.seq === seq);
    const full = (msg && msg.text) || "";
    const sel = window.getSelection();
    let range = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      if (body.contains(sel.anchorNode) && body.contains(sel.focusNode)) {
        range = sel.getRangeAt(0);
      }
    }
    // Clicking chrome can clear the live selection — use stashed range
    if (
      !range &&
      savedBodySel &&
      savedBodySel.seq === seq &&
      savedBodySel.range &&
      Date.now() - savedBodySel.at < 60000
    ) {
      try {
        range = savedBodySel.range;
      } catch (e) {
        range = null;
      }
    }
    if (!range) {
      toast("select text inside the message first");
      return;
    }
    const offs = selectionOffsetsInMessage(body, msg, range);
    if (!offs || offs.end <= offs.start) {
      toast("empty selection");
      return;
    }
    const start = offs.start;
    const end = offs.end;
    const selected = offs.selected || full.slice(start, end);
    const title = "";
    const note = "";
    const j = await api("/api/msg/leaf", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq,
        start_off: start,
        end_off: end,
        title,
        note,
      }),
    });
    if (!j.ok || !j.leaf) {
      toast(j.error || "leaf cut fail");
      return;
    }
    const chipOut =
      (j.leaf && j.leaf.chip) ||
      (j.leaves && j.leaves[0] && j.leaves[0].chip) ||
      "leaf";
    toast("chipped · " + chipOut + " · highlighted in body");
    if (j.leaf && j.leaf.chip) copyChip(j.leaf.chip);
    await openLog(openFaceId);
    requestAnimationFrame(() => {
      const art = document.querySelector(`.b-msg[data-seq="${seq}"]`);
      if (art && !art.classList.contains("is-open")) toggleMsgExpand(seq);
    });
  }

  async function deleteLeaf(seq, leafN) {
    if (!openFaceId) return;
    const j = await api("/api/msg/leaf/delete", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq,
        leaf_n: leafN,
      }),
    });
    if (!j.ok) {
      toast(j.error || "delete leaf fail");
      return;
    }
    toast("leaf removed");
    await openLog(openFaceId);
  }

  /** ✂ one click: split on blank-line paragraphs (tiny islands merge) */
  async function autoCutLeaves(seq) {
    if (!openFaceId) return;
    const j = await api("/api/msg/leaf/auto", {
      method: "POST",
      body: JSON.stringify({ face_id: openFaceId, seq }),
    });
    if (!j.ok) {
      toast(j.error || "auto cut fail");
      return;
    }
    const n = j.count != null ? j.count : (j.leaves || []).length;
    if (!j.split || n <= 1) {
      toast("no breaks to cut · still L01 whole");
    } else {
      toast("cut · " + n + " leaves · paragraphs · tiny bits merged");
    }
    await openLog(openFaceId);
    requestAnimationFrame(() => {
      const art = document.querySelector(`.b-msg[data-seq="${seq}"]`);
      if (art && art.classList.contains("is-collapsed")) toggleMsgExpand(seq);
    });
  }

  async function clearLeaves(seq) {
    if (!openFaceId) return;
    const j = await api("/api/msg/leaf/clear", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq,
      }),
    });
    if (!j.ok) {
      toast(j.error || "reset fail");
      return;
    }
    toast(
      "message reset · " +
        (j.cleared != null ? j.cleared + " cuts cleared" : "unsplit")
    );
    await openLog(openFaceId);
  }

  function applyLeafGravityDom(seq, leafN, g) {
    const block = document.querySelector(
      `.b-leaf-block[data-leaf-seq="${seq}"][data-leaf-n="${leafN}"]`
    );
    if (!block) return;
    block.setAttribute("data-leaf-gravity", String(g));
    block.classList.toggle("grav-up", g > 0);
    block.classList.toggle("grav-down", g < 0);
    // don't-care leaf → fold body; clear peek when leaving ▾
    if (g < 0) {
      block.classList.remove("is-leaf-open");
      block.classList.add("is-leaf-collapsed");
      block.title = "Leaf · don't care · click rail to expand";
      const fold = block.querySelector(".b-leaf-fold");
      if (fold) fold.textContent = "▸";
    } else {
      block.classList.remove("is-leaf-open");
      /* leave collapsed state to user unless expanding from don't-care */
      block.title = "Click rail to collapse / expand leaf";
    }
    const up = block.querySelector(`[data-leaf-grav-up="${seq}"][data-leaf-n="${leafN}"]`);
    const down = block.querySelector(
      `[data-leaf-grav-down="${seq}"][data-leaf-n="${leafN}"]`
    );
    if (up) up.classList.toggle("is-on", g > 0);
    if (down) down.classList.toggle("is-on", g < 0);
  }

  async function setLeafGravity(seq, leafN, gravity, faceId) {
    const fid = faceId || openFaceId;
    if (!fid) return;
    const g = gravity === 1 || gravity === -1 ? gravity : 0;
    if (fid === openFaceId) {
      applyLeafGravityDom(seq, leafN, g);
      if (payload && payload.messages) {
        const m = payload.messages.find((x) => x.seq === seq);
        const lf = m && (m.leaves || []).find((x) => Number(x.leaf_n) === leafN);
        if (lf) lf.gravity = g;
      }
    }
    Object.keys(findOpen).forEach((chip) => {
      const opened = findOpen[chip];
      if (!opened || typeof opened !== "object") return;
      const lf = (opened.leaves || []).find((x) => Number(x.leaf_n) === leafN);
      const hit = findHits.find((h) => h.chip === chip);
      if (lf && hit && hit.seq === seq && hit.face_id === fid) lf.gravity = g;
    });
    const j = await api("/api/msg/leaf/gravity", {
      method: "POST",
      body: JSON.stringify({
        face_id: fid,
        seq,
        leaf_n: leafN,
        gravity: g,
      }),
    });
    if (!j.ok) {
      toast(j.error || "leaf gravity fail");
      if (fid === openFaceId) await openLog(openFaceId);
      return;
    }
    if (j.materialized && fid === openFaceId) await openLog(openFaceId);
    if (sideRail === "find") paintFindHits();
  }

  function toggleHideDown() {
    hideDown = !hideDown;
    savePlace({ hideDown: hideDown });
    paintLog();
    toast(hideDown ? "hiding ▾ don't-care (msgs + leaves)" : "showing all");
  }

  function normalizeTag(t) {
    let s = String(t || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.:+-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.:]+|[-.:]+$/g, "");
    return s.slice(0, 48);
  }

  function tagKey(t) {
    return normalizeTag(t);
  }

  /** Full branch editor: title + description + your tags (not a fixed scale). */
  function askBranchMeta(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const old = document.getElementById("branchNamePop");
      if (old) old.remove();
      const vocab = Array.isArray(opts.vocab) ? opts.vocab.slice() : [];
      let tags = (opts.tags || []).map(normalizeTag).filter(Boolean);
      let settled = false;
      const pop = document.createElement("div");
      pop.id = "branchNamePop";
      pop.className = "b-name-pop";
      pop.innerHTML =
        `<div class="b-name-pop-card b-name-pop-card-wide" data-card>` +
        `<div class="b-name-pop-lab">${esc(opts.label || "Edit branch")}</div>` +
        (opts.hideTitleNote
          ? ""
          : `<label class="b-field-lab">Title</label>` +
            `<input type="text" class="b-name-pop-input" data-field="title" maxlength="120" spellcheck="true" placeholder="short name for this pocket" />` +
            `<label class="b-field-lab">Description</label>` +
            `<textarea class="b-name-pop-area" data-field="note" maxlength="800" rows="3" spellcheck="true" placeholder="what this pocket is · enough to remember later"></textarea>`) +
        `<label class="b-field-lab">${opts.hideTitleNote ? "Tags · your words" : "Flags · your words"}</label>` +
        `<div class="b-tag-help">Not a fixed scale — invent names as you need them. Type to filter · Tab or tap adds · Enter adds (or makes new) · empty Enter or Esc saves the row · click a chip to remove.</div>` +
        `<div class="b-tag-row" data-tag-chips></div>` +
        `<input type="text" class="b-name-pop-input b-tag-input" data-field="tagIn" maxlength="40" spellcheck="true" placeholder="type · Enter adds · empty Enter or Esc saves" autocomplete="off" />` +
        `<div class="b-tag-suggest" data-tag-suggest></div>` +
        `<div class="b-name-pop-acts">` +
        `<button type="button" class="b-name-pop-cancel">cancel</button>` +
        `<button type="button" class="b-name-pop-ok">save</button>` +
        `</div></div>`;
      document.body.appendChild(pop);
      const titleIn = pop.querySelector('[data-field="title"]');
      const noteIn = pop.querySelector('[data-field="note"]');
      const tagIn = pop.querySelector('[data-field="tagIn"]');
      const chipsEl = pop.querySelector("[data-tag-chips]");
      const suggestEl = pop.querySelector("[data-tag-suggest]");
      if (titleIn) titleIn.value = opts.title || "";
      if (noteIn) noteIn.value = opts.note || "";

      const paintChips = () => {
        chipsEl.innerHTML = tags.length
          ? tags
              .map(
                (t, i) =>
                  `<button type="button" class="b-tag is-on" data-rm="${i}" title="remove flag">${esc(
                    t
                  )} ×</button>`
              )
              .join("")
          : `<span class="b-tag-empty">no flags yet</span>`;
      };

      const paintSuggest = () => {
        const have = new Set(tags.map(tagKey));
        const q = normalizeTag(tagIn && tagIn.value);
        const qKey = q;
        let show = vocab.filter((t) => t && !have.has(tagKey(t)));
        if (qKey) {
          show = show
            .filter((t) => {
              const k = tagKey(t);
              return k.startsWith(qKey) || k.includes(qKey);
            })
            .sort((a, b) => {
              const ak = tagKey(a);
              const bk = tagKey(b);
              const as = ak.startsWith(qKey) ? 0 : 1;
              const bs = bk.startsWith(qKey) ? 0 : 1;
              if (as !== bs) return as - bs;
              return ak.localeCompare(bk);
            });
        }
        show = show.slice(0, 16);
        const head =
          show.length || (!vocab.length && !qKey)
            ? `<div class="b-tag-suggest-lab">${
                qKey
                  ? "matches · tap or Tab"
                  : "your dictionary · tap to add"
              }</div>`
            : "";
        suggestEl.innerHTML =
          head +
          (show.length
            ? show
                .map(
                  (t, i) =>
                    `<button type="button" class="b-tag${
                      i === 0 && qKey ? " is-hint" : ""
                    }" data-add-i="${i}">${esc(t)}</button>`
                )
                .join("")
            : vocab.length
              ? qKey
                ? `<span class="b-tag-empty">no match · Enter makes new</span>`
                : ""
              : `<span class="b-tag-empty">first flags become your dictionary</span>`);
        // stash visible suggest labels on the element for click handler
        suggestEl._show = show;
      };

      const repaintTags = () => {
        try {
          paintChips();
          paintSuggest();
        } catch (err) {
          console.error("tag paint", err);
        }
      };

      const addTag = (raw) => {
        const t = normalizeTag(raw);
        if (!t) return false;
        if (tags.some((x) => tagKey(x) === tagKey(t))) return false;
        if (tags.length >= 12) {
          toast("max 12 flags on a branch");
          return false;
        }
        tags.push(t);
        if (!vocab.some((v) => tagKey(v) === tagKey(t))) vocab.unshift(t);
        repaintTags();
        return true;
      };

      const removeTagAt = (i) => {
        if (i < 0 || i >= tags.length) return;
        tags.splice(i, 1);
        repaintTags();
      };

      // event delegation — survives re-renders, no per-button rebind bugs
      chipsEl.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-rm]");
        if (!btn || !chipsEl.contains(btn)) return;
        ev.preventDefault();
        ev.stopPropagation();
        removeTagAt(parseInt(btn.getAttribute("data-rm"), 10));
      });
      suggestEl.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-add-i]");
        if (!btn || !suggestEl.contains(btn)) return;
        ev.preventDefault();
        ev.stopPropagation();
        const i = parseInt(btn.getAttribute("data-add-i"), 10);
        const show = suggestEl._show || [];
        if (show[i] != null) addTag(show[i]);
      });

      repaintTags();

      const finish = (val) => {
        if (settled) return;
        settled = true;
        try {
          pop.remove();
        } catch (e) {
          /* ignore */
        }
        resolve(val);
      };

      const saveNow = () => {
        if (tagIn.value && tagIn.value.trim()) commitTagInput(true);
        finish({
          title: (titleIn && titleIn.value) || "",
          note: (noteIn && noteIn.value) || "",
          tags: tags.slice(),
        });
      };

      const commitTagInput = (preferHint) => {
        const raw = (tagIn.value || "").trim();
        if (!raw) return false;
        const show = suggestEl._show || [];
        const hintBtn = suggestEl.querySelector(".b-tag.is-hint");
        let hi = hintBtn
          ? parseInt(hintBtn.getAttribute("data-add-i"), 10)
          : suggestEl._hint;
        if (!Number.isFinite(hi)) hi = preferHint && show.length ? 0 : -1;
        const typed = normalizeTag(raw);
        // Prefer highlighted / top match over a half-typed scrap (o, oy, …)
        if (hi >= 0 && show[hi] != null) {
          const pick = normalizeTag(show[hi]);
          if (
            pick &&
            (pick === typed ||
              pick.startsWith(typed) ||
              tagKey(pick).includes(typed))
          ) {
            if (addTag(show[hi])) {
              tagIn.value = "";
              paintSuggest();
              return true;
            }
          }
        }
        // Don't mint ultra-short leftovers when dictionary has longer matches
        if (typed.length <= 2 && show.length) {
          if (addTag(show[0])) {
            tagIn.value = "";
            paintSuggest();
            return true;
          }
        }
        if (addTag(raw)) {
          tagIn.value = "";
          paintSuggest();
          return true;
        }
        return false;
      };

      pop.querySelector(".b-name-pop-cancel").onclick = (ev) => {
        ev.preventDefault();
        finish(null);
      };
      pop.querySelector(".b-name-pop-ok").onclick = (ev) => {
        ev.preventDefault();
        saveNow();
      };
      tagIn.addEventListener("input", () => {
        paintSuggest();
      });
      tagIn.addEventListener("keydown", (ev) => {
        if (ev.key === "Tab") {
          const show = suggestEl._show || [];
          if (show.length && tagIn.value.trim()) {
            ev.preventDefault();
            ev.stopPropagation();
            commitTagInput(true);
          }
          return;
        }
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          const btns = suggestEl.querySelectorAll("[data-add-i]");
          if (!btns.length) return;
          ev.preventDefault();
          const cur = suggestEl.querySelector(".b-tag.is-hint");
          let i = cur
            ? parseInt(cur.getAttribute("data-add-i"), 10)
            : -1;
          if (ev.key === "ArrowDown") i = Math.min(btns.length - 1, i + 1);
          else i = Math.max(0, i <= 0 ? 0 : i - 1);
          btns.forEach((b) => b.classList.remove("is-hint"));
          btns[i].classList.add("is-hint");
          suggestEl._hint = i;
          return;
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          if (!(tagIn.value || "").trim()) {
            saveNow();
            return;
          }
          commitTagInput(true);
        }
      });

      pop.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          saveNow();
          return;
        }
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          saveNow();
        }
      });
      // only backdrop closes — not the card
      pop.addEventListener("mousedown", (ev) => {
        if (ev.target === pop) finish(null);
      });
      const card = pop.querySelector("[data-card]");
      if (card) {
        card.addEventListener("mousedown", (ev) => ev.stopPropagation());
      }
      setTimeout(() => {
        try {
          const focusEl = titleIn || tagIn;
          if (focusEl) {
            focusEl.focus();
            if (focusEl.select) focusEl.select();
          }
        } catch (e) {
          /* ignore */
        }
      }, 30);
    });
  }

  async function editMsgTags(seq) {
    if (!openFaceId) return;
    const n = Number(seq);
    if (!Number.isFinite(n) || n < 0) {
      toast("tags fail · bad seq");
      return;
    }
    const msgs = (payload && payload.messages) || [];
    const m = msgs.find((x) => Number(x.seq) === n) || {};
    const chip = (typeof msgChip === "function" ? msgChip(m) : "") || `seq ${n}`;
    const cur = Array.isArray(m.tags) ? m.tags : [];
    const trunkTags = ((payload && payload.branches) || []).flatMap((b) =>
      Array.isArray(b.tags) ? b.tags : []
    );
    const vocab = [
      ...((payload && payload.tag_vocab) || []),
      ...trunkTags,
      ...(((payload && payload.messages) || []).flatMap((x) =>
        Array.isArray(x.tags) ? x.tags : []
      )),
    ];
    // unique by normalize
    const seen = new Set();
    const vocabU = [];
    for (const t of vocab) {
      const k = tagKey(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      vocabU.push(normalizeTag(t));
    }
    const next = await askBranchMeta({
      label: `Tags · ${chip}`,
      hideTitleNote: true,
      tags: cur,
      vocab: vocabU,
    });
    if (next === null) return;
    const tags = (next.tags || []).map(normalizeTag).filter(Boolean);
    const j = await api("/api/msg/tags", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq: n,
        tags,
      }),
    });
    if (!j.ok) return toast(j.error || "tags fail");
    toast(tags.length ? "tags · " + tags.join(", ") : "tags cleared");
    saveCurrentScroll();
    await openLog(openFaceId);
  }

  async function editLeafTags(seq, leafN) {
    if (!openFaceId) return;
    const n = Number(seq);
    const ln = Number(leafN);
    if (!Number.isFinite(n) || n < 0 || !Number.isFinite(ln) || ln < 1) {
      toast("leaf tags fail · bad id");
      return;
    }
    const msgs = (payload && payload.messages) || [];
    const m = msgs.find((x) => Number(x.seq) === n) || {};
    const leaves = Array.isArray(m.leaves) ? m.leaves : [];
    const lf =
      leaves.find((x) => Number(x.leaf_n) === ln) ||
      leaves[ln - 1] ||
      {};
    const chip =
      lf.chip ||
      (typeof msgChip === "function" ? msgChip(m) : `seq ${n}`) +
        ".L" +
        String(ln).padStart(2, "0");
    const cur = Array.isArray(lf.tags) ? lf.tags : [];
    const trunkTags = ((payload && payload.branches) || []).flatMap((b) =>
      Array.isArray(b.tags) ? b.tags : []
    );
    const leafTagBag = (((payload && payload.messages) || []) || []).flatMap(
      (x) =>
        (Array.isArray(x.leaves) ? x.leaves : []).flatMap((L) =>
          Array.isArray(L.tags) ? L.tags : []
        )
    );
    const vocab = [
      ...((payload && payload.tag_vocab) || []),
      ...trunkTags,
      ...(((payload && payload.messages) || []).flatMap((x) =>
        Array.isArray(x.tags) ? x.tags : []
      )),
      ...leafTagBag,
    ];
    const seen = new Set();
    const vocabU = [];
    for (const t of vocab) {
      const k = tagKey(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      vocabU.push(normalizeTag(t));
    }
    const next = await askBranchMeta({
      label: `Leaf tags · ${chip}`,
      hideTitleNote: true,
      tags: cur,
      vocab: vocabU,
    });
    if (next === null) return;
    const tags = (next.tags || []).map(normalizeTag).filter(Boolean);
    const j = await api("/api/msg/leaf/tags", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq: n,
        leaf_n: ln,
        tags,
      }),
    });
    if (!j.ok) return toast(j.error || "leaf tags fail");
    toast(tags.length ? "leaf · " + tags.join(", ") : "leaf tags cleared");
    saveCurrentScroll();
    await openLog(openFaceId);
  }

  async function editTrunkTags(startSeq) {
    if (!openFaceId) return;
    const seq = Number(startSeq);
    if (!Number.isFinite(seq) || seq < 0) {
      toast("tags fail · bad trunk");
      return;
    }
    const branches = (payload && payload.branches) || [];
    const br =
      branches.find((b) => Number(b.start_seq) === seq) ||
      (seq === 0 ? branches[0] : null) ||
      {};
    const tn = br.trunk_n || br.branch_n || (seq === 0 ? 1 : "?");
    const tChip = br.trunk_chip || trunkChipOf(tn);
    const vocab = [
      ...((payload && payload.tag_vocab) || []),
      ...branches.flatMap((b) => (Array.isArray(b.tags) ? b.tags : [])),
    ];
    const seen = new Set();
    const vocabU = [];
    for (const t of vocab) {
      const k = tagKey(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      vocabU.push(normalizeTag(t));
    }
    const next = await askBranchMeta({
      label: `Tags · ${tChip}`,
      hideTitleNote: true,
      tags: br.tags || [],
      vocab: vocabU,
    });
    if (next === null) return;
    const tags = (next.tags || []).map(normalizeTag).filter(Boolean);
    const j = await api("/api/branch/meta", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        start_seq: seq,
        title: br.title || "",
        note: br.note || "",
        tags,
      }),
    });
    if (!j.ok) return toast(j.error || "tags fail");
    toast(tags.length ? "trunk tags · " + tags.join(", ") : "trunk tags cleared");
    saveCurrentScroll();
    await openLog(openFaceId);
  }

  async function editBranch(startSeq, branch) {
    if (!openFaceId) return;
    const seq = Number(startSeq);
    if (!Number.isFinite(seq) || seq < 0) {
      toast("edit fail · bad branch");
      return;
    }
    const br = branch || {};
    const tn = br.trunk_n || br.branch_n || (seq === 0 ? 1 : "?");
    const tChip = br.trunk_chip || trunkChipOf(tn);
    const next = await askBranchMeta({
      label:
        seq === 0
          ? `Trunk T1 · ${tChip}`
          : `Trunk T${tn} · ${tChip}`,
      title: br.title || "",
      note: br.note || "",
      tags: br.tags || [],
      vocab: (payload && payload.tag_vocab) || [],
    });
    if (next === null) return;
    const title = String(next.title || "").trim();
    const note = String(next.note || "").trim();
    const tags = (next.tags || []).map(normalizeTag).filter(Boolean);
    const j = await api("/api/branch/meta", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        start_seq: seq,
        title,
        note,
        tags,
      }),
    });
    if (!j.ok) return toast(j.error || "save fail");
    toast(title ? "trunk · " + title : "trunk saved");
    await openLog(openFaceId);
  }

  function askLogMeta(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const old = document.getElementById("logNamePop");
      if (old) old.remove();
      const pop = document.createElement("div");
      pop.id = "logNamePop";
      pop.className = "b-name-pop";
      pop.innerHTML =
        `<div class="b-name-pop-card b-name-pop-card-wide" data-card>` +
        `<div class="b-name-pop-lab">${esc(opts.label || "Log title")}</div>` +
        (opts.orig
          ? `<div class="b-field-lab">Original name</div>` +
            `<div class="b-log-orig-static">${esc(opts.orig)}</div>`
          : "") +
        `<label class="b-field-lab">Official title</label>` +
        `<input type="text" class="b-name-pop-input" data-field="title" maxlength="200" spellcheck="true" placeholder="name other software should use" />` +
        `<label class="b-field-lab">Big picture</label>` +
        `<textarea class="b-name-pop-area" data-field="note" maxlength="800" rows="3" spellcheck="true" placeholder="what this whole log is · not a trunk"></textarea>` +
        `<div class="b-name-pop-acts">` +
        `<button type="button" class="b-name-pop-cancel">cancel</button>` +
        `<button type="button" class="b-name-pop-ok">save</button>` +
        `</div></div>`;
      document.body.appendChild(pop);
      const titleIn = pop.querySelector('[data-field="title"]');
      const noteIn = pop.querySelector('[data-field="note"]');
      if (titleIn) titleIn.value = opts.title || opts.orig || "";
      if (noteIn) noteIn.value = opts.note || "";
      const finish = (val) => {
        try {
          pop.remove();
        } catch (e) {}
        resolve(val);
      };
      pop.querySelector(".b-name-pop-cancel").onclick = (ev) => {
        ev.preventDefault();
        finish(null);
      };
      pop.querySelector(".b-name-pop-ok").onclick = (ev) => {
        ev.preventDefault();
        finish({
          title: (titleIn && titleIn.value) || "",
          note: (noteIn && noteIn.value) || "",
        });
      };
      pop.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(null);
        }
        if (ev.key === "Enter" && ev.target === titleIn) {
          ev.preventDefault();
          pop.querySelector(".b-name-pop-ok").click();
        }
      });
      pop.addEventListener("mousedown", (ev) => {
        if (ev.target === pop) finish(null);
      });
      setTimeout(() => {
        try {
          titleIn.focus();
          titleIn.select();
        } catch (e) {}
      }, 30);
    });
  }

  async function editLogName() {
    if (!openFaceId || !payload || !payload.log) return;
    const log = payload.log;
    const next = await askLogMeta({
      label: "Log " + (log.log_code || ""),
      orig: log.orig_title || "",
      title: log.working_title || "",
      note: log.log_note || "",
    });
    if (next === null) return;
    const j = await api("/api/log/meta", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        working_title: String(next.title || "").trim(),
        log_note: String(next.note || "").trim(),
      }),
    });
    if (!j.ok) return toast(j.error || "save fail");
    toast(j.working_title ? "log · " + j.working_title : "log name cleared");
    await loadLogs($("logFilter") && $("logFilter").value);
    await openLog(openFaceId);
  }

  async function placeCut(startSeq) {
    if (!openFaceId) return;
    const j = await api("/api/cut", {
      method: "POST",
      body: JSON.stringify({ face_id: openFaceId, start_seq: startSeq }),
    });
    if (!j.ok) return toast(j.error || "cut fail");
    toast("trunk cut · seq " + startSeq);
    await openLog(openFaceId);
    // offer editor right after the cut (cancel = leave bare)
    const br = ((payload && payload.branches) || []).find(
      (b) => b.start_seq === startSeq
    );
    if (br) await editBranch(startSeq, br);
  }

  function askSceneMeta(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const old = document.getElementById("sceneMetaPop");
      if (old) old.remove();
      let intensity = opts.intensity || "charged";
      const pop = document.createElement("div");
      pop.id = "sceneMetaPop";
      pop.className = "b-name-pop";
      pop.innerHTML =
        `<div class="b-name-pop-card b-name-pop-card-wide" data-card>` +
        `<div class="b-name-pop-lab">${esc(opts.label || "Accept scene")}</div>` +
        (opts.hideTitle
          ? ""
          : `<label class="b-field-lab">Trunk title</label>` +
            `<input type="text" class="b-name-pop-input" data-field="title" maxlength="120" spellcheck="true" placeholder="short name for this trunk" />`) +
        `<label class="b-field-lab">Shot</label>` +
        `<textarea class="b-name-pop-area" data-field="shot" maxlength="2000" rows="6" spellcheck="true" placeholder="television shot · present tense"></textarea>` +
        `<label class="b-field-lab">Intensity</label>` +
        `<div class="b-int-row" data-int-row>` +
        ["calm", "charged", "triggering"]
          .map(
            (k) =>
              `<button type="button" class="b-find-opt${
                k === intensity ? " is-on" : ""
              }" data-int="${k}">${esc(k)}</button>`
          )
          .join("") +
        `</div>` +
        (opts.hideShift
          ? ""
          : `<label class="b-field-lab">Why the cut</label>` +
            `<textarea class="b-name-pop-area" data-field="shift" maxlength="400" rows="2" spellcheck="true" placeholder="what shifted here"></textarea>`) +
        `<div class="b-name-pop-acts">` +
        `<button type="button" class="b-name-pop-cancel">cancel</button>` +
        `<button type="button" class="b-name-pop-ok">${esc(
          opts.okLab || "accept"
        )}</button>` +
        `</div></div>`;
      document.body.appendChild(pop);
      const titleIn = pop.querySelector('[data-field="title"]');
      const shotIn = pop.querySelector('[data-field="shot"]');
      const shiftIn = pop.querySelector('[data-field="shift"]');
      if (titleIn) titleIn.value = opts.title || "";
      if (shotIn) shotIn.value = opts.shot || "";
      if (shiftIn) shiftIn.value = opts.shift_note || "";
      pop.querySelectorAll("[data-int]").forEach((btn) => {
        btn.onclick = () => {
          intensity = btn.getAttribute("data-int") || "charged";
          pop.querySelectorAll("[data-int]").forEach((b) => {
            b.classList.toggle("is-on", b === btn);
          });
        };
      });
      const finish = (val) => {
        try {
          pop.remove();
        } catch (e) {}
        resolve(val);
      };
      pop.querySelector(".b-name-pop-cancel").onclick = (ev) => {
        ev.preventDefault();
        finish(null);
      };
      pop.querySelector(".b-name-pop-ok").onclick = (ev) => {
        ev.preventDefault();
        finish({
          title: (titleIn && titleIn.value) || "",
          shot: (shotIn && shotIn.value) || "",
          intensity,
          shift_note: (shiftIn && shiftIn.value) || "",
        });
      };
      pop.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(null);
        }
      });
      setTimeout(() => {
        const focus = titleIn || shotIn;
        if (focus) focus.focus();
      }, 30);
    });
  }

  async function acceptScene(startSeq) {
    if (!openFaceId) return;
    const sc = sceneAt(startSeq) || {};
    const br = ((payload && payload.branches) || []).find(
      (b) => Number(b.start_seq) === Number(startSeq)
    );
    const next = await askSceneMeta({
      label:
        (sc.status || "proposed") === "accepted"
          ? "Edit scene shot · seq " + startSeq
          : "Accept scene · seq " + startSeq,
      title: ((br && br.title) || "").trim() || sc.title || "",
      shot: sc.shot || "",
      intensity: sc.intensity || "charged",
      shift_note: sc.shift_note || "",
      okLab:
        (sc.status || "proposed") === "accepted" ? "save shot" : "accept trunk",
    });
    if (next === null) return;
    const j = await api("/api/scene/accept", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        start_seq: startSeq,
        title: next.title,
        shot: next.shot,
        intensity: next.intensity,
        shift_note: next.shift_note,
      }),
    });
    if (!j.ok) return toast(j.error || "scene fail");
    toast("scene · seq " + startSeq);
    await openLog(openFaceId);
  }

  async function acceptLogScene() {
    if (!openFaceId) return;
    const sc = (payload && payload.scene_log) || {};
    const next = await askSceneMeta({
      label: "Whole log throughline",
      hideTitle: true,
      hideShift: true,
      shot: sc.shot || "",
      intensity: sc.intensity || "charged",
      okLab: (sc.status || "proposed") === "accepted" ? "save" : "accept",
    });
    if (next === null) return;
    const j = await api("/api/scene/log/accept", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        shot: next.shot,
        intensity: next.intensity,
      }),
    });
    if (!j.ok) return toast(j.error || "log scene fail");
    toast("log throughline accepted");
    await openLog(openFaceId);
  }

  async function rejectLogScene() {
    if (!openFaceId) return;
    const j = await api("/api/scene/log/reject", {
      method: "POST",
      body: JSON.stringify({ face_id: openFaceId }),
    });
    if (!j.ok) return toast(j.error || "log scene fail");
    toast("log throughline rejected");
    await openLog(openFaceId);
  }

  async function rejectScene(startSeq) {
    if (!openFaceId) return;
    const j = await api("/api/scene/reject", {
      method: "POST",
      body: JSON.stringify({ face_id: openFaceId, start_seq: startSeq }),
    });
    if (!j.ok) return toast(j.error || "scene fail");
    toast("scene rejected · seq " + startSeq);
    await openLog(openFaceId);
  }

  async function removeCut(startSeq) {
    if (!openFaceId || startSeq === 0) return;
    const j = await api("/api/cut/remove", {
      method: "POST",
      body: JSON.stringify({ face_id: openFaceId, start_seq: startSeq }),
    });
    if (!j.ok) return toast(j.error || "remove fail");
    toast("cut removed · branches merged");
    await openLog(openFaceId);
  }

  function setRail(name) {
    sideRail = name === "find" || name === "reports" ? name : "logs";
    document.querySelectorAll(".b-rail-tab").forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute("data-rail") === sideRail);
    });
    const logs = $("railLogs");
    const find = $("railFind");
    const reps = $("railReports");
    if (logs) logs.hidden = sideRail !== "logs";
    if (find) find.hidden = sideRail !== "find";
    if (reps) reps.hidden = sideRail !== "reports";
    const empty = $("emptyState");
    const logView = $("logView");
    const findView = $("findView");
    const reportView = $("reportView");
    if (sideRail === "find") {
      if (empty) empty.hidden = true;
      if (logView) logView.hidden = true;
      if (findView) findView.hidden = false;
      if (reportView) reportView.hidden = true;
    } else if (sideRail === "reports") {
      if (empty) empty.hidden = true;
      if (logView) logView.hidden = true;
      if (findView) findView.hidden = true;
      if (reportView) reportView.hidden = false;
      loadReports();
    } else {
      if (findView) findView.hidden = true;
      if (reportView) reportView.hidden = true;
      if (payload) {
        if (empty) empty.hidden = true;
        if (logView) logView.hidden = false;
      } else {
        if (empty) empty.hidden = false;
        if (logView) logView.hidden = true;
      }
    }
  }

  function fmtSnip(s) {
    return esc(s || "")
      .replace(/\u0002/g, "<mark>")
      .replace(/\u0003/g, "</mark>");
  }

  function pickedCount() {
    return Object.keys(findPicked).length;
  }

  function unitForChip(chip) {
    const hit = findHits.find((x) => x.chip === chip);
    if (hit) return hit;
    const keys = Object.keys(findAround);
    for (let i = 0; i < keys.length; i++) {
      const pack = findAround[keys[i]];
      const units = (pack && pack.units) || [];
      const u = units.find((x) => x.chip === chip);
      if (u) return u;
    }
    return null;
  }

  function paintFindPicked() {
    const n = pickedCount();
    if ($("findPicked")) $("findPicked").textContent = n + " selected";
    if ($("findSeal")) $("findSeal").disabled = n === 0;
  }

  function paintFindHits() {
    const el = $("findHits");
    if (!el) return;
    if (!findHits.length) {
      el.innerHTML =
        findMeta && findMeta.q
          ? `<div class="b-empty">no hits for ${esc(findMeta.q)}</div>`
          : "";
      return;
    }
    el.innerHTML = findHits
      .map((h) => {
        const chip = h.chip || "";
        const on = !!findPicked[chip];
        const g = Number(h.gravity) || 0;
        const gClass = g > 0 ? " grav-up" : g < 0 ? " grav-down" : "";
        const opened = findOpen[chip];
        const openedObj = opened && typeof opened === "object";
        const openedText = openedObj ? opened.text || "" : opened || "";
        const leaves = openedObj && Array.isArray(opened.leaves) ? opened.leaves : [];
        const splitLeaves =
          leaves.length > 1 && !(leaves.length === 1 && leaves[0].implicit);
        let fullHtml = "";
        if (opened) {
          if (splitLeaves) {
            fullHtml = leaves
              .map((lf) => {
                const ln = Number(lf.leaf_n) || 0;
                const lg = Number(lf.gravity) || 0;
                const a = Math.max(0, Number(lf.start_off) || 0);
                const bOff = Math.max(a, Number(lf.end_off) || 0);
                const chunk = String(openedText).slice(a, bOff);
                const lchip = lf.chip || chip + ".L" + String(ln).padStart(2, "0");
                return (
                  `<section class="b-hit-leaf${lg > 0 ? " grav-up" : ""}${
                    lg < 0 ? " grav-down" : ""
                  }">` +
                  `<div class="b-hit-h">` +
                  `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
                    lchip
                  )}">${esc(lf.chip_short || "L" + String(ln).padStart(2, "0"))}</button>` +
                  `<span class="b-grav">` +
                  `<button type="button" class="b-grav-btn${
                    lg < 0 ? " is-on" : ""
                  }" data-hit-leaf-down="${esc(chip)}" data-leaf-n="${ln}">▾</button>` +
                  `<button type="button" class="b-grav-btn${
                    lg > 0 ? " is-on" : ""
                  }" data-hit-leaf-up="${esc(chip)}" data-leaf-n="${ln}">▴</button>` +
                  `</span>` +
                  `</div>` +
                  `<div class="b-hit-full">${esc(chunk)}</div>` +
                  `</section>`
                );
              })
              .join("");
          } else {
            fullHtml = `<div class="b-hit-full">${esc(openedText)}</div>`;
          }
        }
        let aroundHtml = "";
        const around = findAround[chip];
        if (around && around.units && around.units.length) {
          aroundHtml =
            `<div class="b-hit-around">` +
            `<div class="b-hit-around-h">` +
            `<span>around −${esc(String(around.before || 0))} / +${esc(
              String(around.after || 0)
            )} · neighbors may not say the word</span>` +
            `<button type="button" class="b-find-opt" data-around-grow="${esc(
              chip
            )}" title="Widen by 2 turns each side">+2</button>` +
            `<button type="button" class="b-find-opt" data-around-take="${esc(
              chip
            )}" title="Check every turn in this window">check window</button>` +
            `<button type="button" class="b-find-opt" data-around-close="${esc(
              chip
            )}">fold around</button>` +
            `</div>` +
            around.units
              .map((u) => {
                const uc = u.chip || "";
                const uOn = !!findPicked[uc];
                const ug = Number(u.gravity) || 0;
                const center = !!u.is_center;
                const uOpen = findOpen[uc];
                const uObj = uOpen && typeof uOpen === "object";
                const uText = uObj ? uOpen.text || u.text || "" : uOpen || "";
                const showNbBody = !center && !!uOpen;
                return (
                  `<div class="b-hit-nb${center ? " is-center" : ""}${
                    uOn ? " is-on" : ""
                  }${ug > 0 ? " grav-up" : ""}${ug < 0 ? " grav-down" : ""}" data-nb-chip="${esc(
                    uc
                  )}">` +
                  `<div class="b-hit-h">` +
                  `<input type="checkbox" data-hit-pick="${esc(uc)}"${
                    uOn ? " checked" : ""
                  } />` +
                  `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
                    uc
                  )}">${esc(uc)}</button>` +
                  `<span class="who">${esc(who(u.role))}</span>` +
                  (center ? `<span class="b-hit-exp">hit</span>` : "") +
                  `<span class="b-hit-when">${esc(
                    u.when_full || u.when || ""
                  )}</span>` +
                  `<span class="b-grav">` +
                  `<button type="button" class="b-grav-btn${
                    ug < 0 ? " is-on" : ""
                  }" data-hit-down="${esc(uc)}">▾</button>` +
                  `<button type="button" class="b-grav-btn${
                    ug > 0 ? " is-on" : ""
                  }" data-hit-up="${esc(uc)}">▴</button>` +
                  `</span>` +
                  (center
                    ? ""
                    : `<button type="button" class="b-find-opt" data-hit-open="${esc(
                        uc
                      )}">${uOpen ? "fold" : "unfold"}</button>`) +
                  `</div>` +
                  `<div class="b-hit-snip">${esc(u.peek || "")}</div>` +
                  (showNbBody
                    ? `<div class="b-hit-full">${esc(uText || u.text || "")}</div>`
                    : "") +
                  `</div>`
                );
              })
              .join("") +
            `</div>`;
        }
        return (
          `<article class="b-hit${gClass}${on ? " is-on" : ""}" data-hit-chip="${esc(
            chip
          )}">` +
          `<div class="b-hit-h">` +
          `<input type="checkbox" data-hit-pick="${esc(chip)}"${
            on ? " checked" : ""
          } />` +
          `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
            chip
          )}">${esc(chip)}</button>` +
          `<span class="who">${esc(who(h.role))}</span>` +
          (h.exported
            ? `<span class="b-hit-exp" title="in ${h.exported} CXR">×${esc(
                String(h.exported)
              )}</span>`
            : "") +
          `<span class="b-hit-when" title="${esc(h.when_iso || "")}">${esc(
            h.when_full || h.when || ""
          )}</span>` +
          `<span class="br">${esc(h.log_code || "")}</span>` +
          `<span class="b-grav" data-hit-grav="${esc(chip)}">` +
          `<button type="button" class="b-grav-btn${
            g < 0 ? " is-on" : ""
          }" data-hit-down="${esc(chip)}">▾</button>` +
          `<button type="button" class="b-grav-btn${
            g > 0 ? " is-on" : ""
          }" data-hit-up="${esc(chip)}">▴</button>` +
          `</span>` +
          `<button type="button" class="b-find-opt${
            around ? " is-on" : ""
          }" data-hit-around="${esc(
            chip
          )}" title="Lived-order neighbors — they may not say the word">${
            around ? "around on" : "around"
          }</button>` +
          `<button type="button" class="b-find-opt" data-hit-open="${esc(
            chip
          )}">${opened ? "fold" : "unfold"}</button>` +
          `</div>` +
          `<div class="b-hit-snip">${fmtSnip(h.snippet)}</div>` +
          fullHtml +
          aroundHtml +
          `</article>`
        );
      })
      .join("");
    el.querySelectorAll("[data-hit-pick]").forEach((box) => {
      box.onchange = () => {
        const chip = box.getAttribute("data-hit-pick");
        const unit = unitForChip(chip);
        if (box.checked && unit) findPicked[chip] = unit;
        else delete findPicked[chip];
        paintFindPicked();
        const safe = (chip || "").replace(/"/g, "");
        el.querySelectorAll('[data-hit-pick="' + safe + '"]').forEach((b) => {
          b.checked = box.checked;
        });
        el.querySelectorAll(
          '[data-hit-chip="' + safe + '"], [data-nb-chip="' + safe + '"]'
        ).forEach((n) => n.classList.toggle("is-on", box.checked));
      };
    });
    el.querySelectorAll("[data-copy-chip]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        copyChip(btn.getAttribute("data-copy-chip") || "");
      };
    });
    el.querySelectorAll("[data-hit-open]").forEach((btn) => {
      btn.onclick = async (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-hit-open");
        if (findOpen[chip]) {
          delete findOpen[chip];
          paintFindHits();
          return;
        }
        const unit = unitForChip(chip);
        if (!unit) return;
        const j = await api(
          `/api/hit?face_id=${encodeURIComponent(unit.face_id)}&seq=${unit.seq}`
        );
        if (!j.ok) return toast(j.error || "unfold fail");
        findOpen[chip] = {
          text: j.text || "",
          leaves: j.leaves || [],
        };
        paintFindHits();
      };
    });
    el.querySelectorAll("[data-hit-up]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-hit-up");
        const unit = unitForChip(chip);
        if (!unit) return;
        const cur = Number(unit.gravity) || 0;
        setGravity(unit.seq, cur > 0 ? 0 : 1, unit.face_id);
      };
    });
    el.querySelectorAll("[data-hit-down]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-hit-down");
        const unit = unitForChip(chip);
        if (!unit) return;
        const cur = Number(unit.gravity) || 0;
        setGravity(unit.seq, cur < 0 ? 0 : -1, unit.face_id);
      };
    });
    el.querySelectorAll("[data-hit-leaf-up]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-hit-leaf-up");
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        const hit = findHits.find((x) => x.chip === chip);
        const opened = findOpen[chip];
        const lf =
          opened &&
          (opened.leaves || []).find((x) => Number(x.leaf_n) === ln);
        if (!hit || !lf) return;
        const cur = Number(lf.gravity) || 0;
        setLeafGravity(hit.seq, ln, cur > 0 ? 0 : 1, hit.face_id);
      };
    });
    el.querySelectorAll("[data-hit-leaf-down]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-hit-leaf-down");
        const ln = parseInt(btn.getAttribute("data-leaf-n"), 10);
        const hit = findHits.find((x) => x.chip === chip);
        const opened = findOpen[chip];
        const lf =
          opened &&
          (opened.leaves || []).find((x) => Number(x.leaf_n) === ln);
        if (!hit || !lf) return;
        const cur = Number(lf.gravity) || 0;
        setLeafGravity(hit.seq, ln, cur < 0 ? 0 : -1, hit.face_id);
      };
    });
    el.querySelectorAll("[data-hit-around]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-hit-around");
        if (findAround[chip]) {
          delete findAround[chip];
          paintFindHits();
          return;
        }
        loadAround(chip, 2, 2);
      };
    });
    el.querySelectorAll("[data-around-close]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-around-close");
        delete findAround[chip];
        paintFindHits();
      };
    });
    el.querySelectorAll("[data-around-grow]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-around-grow");
        const pack = findAround[chip] || { before: 2, after: 2 };
        loadAround(
          chip,
          Math.min(24, (Number(pack.before) || 2) + 2),
          Math.min(24, (Number(pack.after) || 2) + 2)
        );
      };
    });
    el.querySelectorAll("[data-around-take]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const chip = btn.getAttribute("data-around-take");
        const pack = findAround[chip];
        ((pack && pack.units) || []).forEach((u) => {
          if (u && u.chip) findPicked[u.chip] = u;
        });
        paintFindHits();
      };
    });
    paintFindPicked();
  }

  async function loadAround(centerChip, before, after) {
    const hit = findHits.find((x) => x.chip === centerChip);
    if (!hit) return;
    const b = Math.max(0, Math.min(24, Number(before) || 0));
    const a = Math.max(0, Math.min(24, Number(after) || 0));
    const j = await api(
      `/api/around?face_id=${encodeURIComponent(hit.face_id)}&seq=${hit.seq}&before=${b}&after=${a}`
    );
    if (!j.ok) return toast(j.error || "around fail");
    findAround[centerChip] = {
      before: j.before,
      after: j.after,
      units: j.units || [],
    };
    paintFindHits();
  }

  async function runFind() {
    const q = (($("findQ") && $("findQ").value) || "").trim();
    if (!q) return toast("type a keyword");
    setRail("find");
    if ($("findCount")) $("findCount").textContent = "searching…";
    if ($("findHead")) $("findHead").textContent = q;
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("scope", findScope);
    params.set("turn", findTurn);
    if (findScope === "log") {
      if (!openFaceId) return toast("open a log first for this-log find");
      params.set("face_id", openFaceId);
    }
    const j = await api("/api/find?" + params.toString());
    if (!j.ok) {
      if ($("findCount")) $("findCount").textContent = j.error || "find fail";
      return toast(j.error || "find fail");
    }
    findMeta = j;
    findHits = j.hits || [];
    findAround = {};
    const still = {};
    findHits.forEach((h) => {
      if (findPicked[h.chip]) still[h.chip] = h;
    });
    findPicked = still;
    const n = findHits.length;
    const total = j.total != null ? j.total : n;
    const bits = [
      total + " hit" + (total === 1 ? "" : "s"),
      j.scope === "log" ? "this log" : "forest",
      j.turn || "all",
    ];
    if (j.truncated) bits.push("showing " + n);
    if ($("findCount")) $("findCount").textContent = bits.join(" · ");
    if ($("findHead")) $("findHead").textContent = "FIND · " + q;
    if ($("findHeadSub"))
      $("findHeadSub").textContent = bits.join(" · ") + " · unfold for full · around for neighbors";
    paintFindHits();
  }

  function askSeal(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const pop = document.createElement("div");
      pop.className = "b-name-pop";
      pop.innerHTML =
        `<div class="b-name-pop-card" data-card>` +
        `<div class="b-name-pop-lab">${esc(opts.label || "Seal CXR")}</div>` +
        `<input class="b-name-pop-input" data-field="title" placeholder="title" />` +
        (opts.keywordShow
          ? `<input class="b-name-pop-input" data-field="keyword" placeholder="keyword" />`
          : "") +
        `<label class="b-find-fax"><input type="checkbox" data-field="fax"${
          opts.fax ? " checked" : ""
        } /> fax to go.glass/shards</label>` +
        `<div class="b-name-pop-acts">` +
        `<button type="button" class="b-name-pop-cancel">cancel</button>` +
        `<button type="button" class="b-name-pop-ok">seal</button>` +
        `</div></div>`;
      document.body.appendChild(pop);
      const titleIn = pop.querySelector('[data-field="title"]');
      const keyIn = pop.querySelector('[data-field="keyword"]');
      const faxIn = pop.querySelector('[data-field="fax"]');
      titleIn.value = opts.title || "";
      if (keyIn) keyIn.value = opts.keyword || "";
      const finish = (val) => {
        try {
          pop.remove();
        } catch (e) {}
        resolve(val);
      };
      pop.querySelector(".b-name-pop-cancel").onclick = (ev) => {
        ev.preventDefault();
        finish(null);
      };
      pop.querySelector(".b-name-pop-ok").onclick = (ev) => {
        ev.preventDefault();
        finish({
          title: (titleIn && titleIn.value) || "",
          keyword: keyIn ? keyIn.value : opts.keyword || "",
          fax: !!(faxIn && faxIn.checked),
        });
      };
      pop.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(null);
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          finish({
            title: (titleIn && titleIn.value) || "",
            keyword: keyIn ? keyIn.value : opts.keyword || "",
            fax: !!(faxIn && faxIn.checked),
          });
        }
      });
      pop.addEventListener("mousedown", (ev) => {
        if (ev.target === pop) finish(null);
      });
      setTimeout(() => {
        try {
          titleIn.focus();
          titleIn.select();
        } catch (e) {}
      }, 30);
    });
  }

  async function sealFind() {
    const units = Object.keys(findPicked).map((chip) => {
      const h = findPicked[chip];
      return { face_id: h.face_id, seq: h.seq };
    });
    if (!units.length) return toast("select hits first");
    const q = (findMeta && findMeta.q) || (($("findQ") && $("findQ").value) || "");
    const faxDefault = $("findFaxToo") ? $("findFaxToo").checked : true;
    const next = await askSeal({
      label: `Seal ${units.length} messages`,
      title: q ? "find · " + q : "find",
      keyword: q,
      keywordShow: true,
      fax: faxDefault,
    });
    if (!next) return;
    const j = await api("/api/reports/seal", {
      method: "POST",
      body: JSON.stringify({
        kind: "find",
        title: next.title,
        keyword: next.keyword,
        scope: findScope,
        face_id: findScope === "log" ? openFaceId || "" : "",
        units,
        fax: !!next.fax,
      }),
    });
    if (!j.ok) return toast(j.error || "seal fail");
    const cxr = j.report && j.report.cxr;
    toast(
      (cxr || "CXR") +
        " · " +
        (j.count || units.length) +
        (j.fax && j.fax.ok ? " · faxed" : "")
    );
    findHits.forEach((h) => {
      if (findPicked[h.chip]) h.exported = (Number(h.exported) || 0) + 1;
    });
    Object.keys(findAround).forEach((k) => {
      ((findAround[k] && findAround[k].units) || []).forEach((u) => {
        if (findPicked[u.chip]) u.exported = (Number(u.exported) || 0) + 1;
      });
    });
    paintFindHits();
    if (j.fax && j.fax.ok) loadReports();
  }

  async function exportBranch(seq) {
    if (!openFaceId) return;
    const m = (payload && payload.messages || []).find((x) => x.seq === seq);
    const chip = m && (m.chip || msgChip(m));
    const next = await askSeal({
      label: "Export branch " + (chip || seq),
      title: chip || "branch",
      fax: true,
    });
    if (!next) return;
    const j = await api("/api/reports/seal", {
      method: "POST",
      body: JSON.stringify({
        kind: "branch",
        title: next.title,
        face_id: openFaceId,
        seq,
        fax: !!next.fax,
      }),
    });
    if (!j.ok) return toast(j.error || "export fail");
    toast((j.report && j.report.cxr) + (j.fax && j.fax.ok ? " · faxed" : ""));
    await openLog(openFaceId);
  }

  async function exportTrunk(startSeq) {
    if (!openFaceId) return;
    const br = ((payload && payload.branches) || []).find(
      (b) => b.start_seq === startSeq
    );
    const lab = br
      ? br.trunk_chip || "T" + (br.trunk_n || br.branch_n)
      : "trunk";
    const next = await askSeal({
      label: "Export trunk " + lab,
      title: (br && br.title) || lab,
      fax: true,
    });
    if (!next) return;
    const j = await api("/api/reports/seal", {
      method: "POST",
      body: JSON.stringify({
        kind: "trunk",
        title: next.title,
        face_id: openFaceId,
        start_seq: startSeq,
        fax: !!next.fax,
      }),
    });
    if (!j.ok) return toast(j.error || "export fail");
    toast((j.report && j.report.cxr) + (j.fax && j.fax.ok ? " · faxed" : ""));
    await openLog(openFaceId);
  }

  async function exportLog() {
    if (!openFaceId || !payload || !payload.log) return;
    const code = payload.log.log_code || "log";
    const named = (payload.log.title || "").trim();
    const next = await askSeal({
      label: "Export whole log " + code + " (seal only — fax swallows)",
      title: named ? named : "log · " + code,
      fax: false,
    });
    if (!next) return;
    const j = await api("/api/reports/seal", {
      method: "POST",
      body: JSON.stringify({
        kind: "log",
        title: next.title,
        face_id: openFaceId,
        fax: !!next.fax,
      }),
    });
    if (!j.ok) return toast(j.error || "export fail");
    toast((j.report && j.report.cxr) + " · log sealed");
    await openLog(openFaceId);
  }

  function whenReport(ts) {
    if (!ts) return "";
    try {
      const n = Number(ts);
      if (!Number.isFinite(n) || n <= 0) return "";
      return new Date(n * 1000).toISOString();
    } catch (e) {
      return "";
    }
  }

  async function loadReports() {
    const j = await api("/api/reports");
    if (!j.ok) {
      if ($("reportCount")) $("reportCount").textContent = j.error || "fail";
      return;
    }
    reports = j.reports || [];
    if ($("reportCount"))
      $("reportCount").textContent = reports.length + " seals";
    const el = $("reportList");
    if (!el) return;
    el.innerHTML = reports
      .map((r) => {
        return (
          `<button type="button" class="b-list-item${
            r.cxr === openCxr ? " is-on" : ""
          }" data-cxr="${esc(r.cxr)}">` +
          `<span class="code-row"><span class="code">${esc(r.cxr)}</span>` +
          (r.faxed ? `<span class="b-check">fax</span>` : "") +
          `</span>` +
          `<span class="meta">${esc(r.title || r.kind || "")} · ${esc(
            String(r.chip_count || 0)
          )} chips</span>` +
          `</button>`
        );
      })
      .join("");
    el.querySelectorAll("[data-cxr]").forEach((btn) => {
      btn.onclick = () => openReport(btn.getAttribute("data-cxr"));
    });
  }

  async function openReport(cxr) {
    openCxr = cxr;
    setRail("reports");
    loadReports();
    const j = await api("/api/reports/" + encodeURIComponent(cxr));
    if (!j.ok) return toast(j.error || "report fail");
    const r = j.report || {};
    if ($("reportHead")) $("reportHead").textContent = r.cxr || cxr;
    const sub = [
      r.title || "",
      r.kind || "",
      (r.chip_count || 0) + " chips",
      r.faxed ? "faxed" : "not faxed",
      whenReport(r.created),
    ]
      .filter(Boolean)
      .join(" · ");
    if ($("reportHeadSub")) $("reportHeadSub").textContent = sub;
    const chips = Array.isArray(r.chips) ? r.chips : [];
    const chipEl = $("reportChips");
    if (chipEl) {
      chipEl.innerHTML = chips
        .map(
          (c) =>
            `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
              c
            )}">${esc(c)}</button>`
        )
        .join("");
      chipEl.querySelectorAll("[data-copy-chip]").forEach((btn) => {
        btn.onclick = (ev) => {
          ev.preventDefault();
          copyChip(btn.getAttribute("data-copy-chip") || "");
        };
      });
    }
    const copyBtn = $("reportCopyBtn");
    if (copyBtn) {
      copyBtn.onclick = () => copyChip(chips.join(", "));
    }
    if ($("reportBody")) $("reportBody").textContent = j.markdown || "";
    const faxBtn = $("reportFaxBtn");
    if (faxBtn) faxBtn.textContent = r.faxed ? "fax again" : "fax to shards";
  }

  async function faxOpenReport() {
    if (!openCxr) return toast("open a CXR first");
    const j = await api("/api/reports/fax", {
      method: "POST",
      body: JSON.stringify({ cxr: openCxr }),
    });
    if (!j.ok) return toast(j.error || "fax fail");
    toast(openCxr + " · faxed to go.glass/shards");
    await openReport(openCxr);
  }

  let filterT = null;
  $("logFilter").addEventListener("input", () => {
    clearTimeout(filterT);
    filterT = setTimeout(() => {
      const q = $("logFilter").value;
      savePlace({ filter: q });
      loadLogs(q);
    }, 180);
  });
  // Stash body selections so ✂ still sees the full drag (incl. last words)
  document.addEventListener("mouseup", () => {
    setTimeout(rememberBodySelection, 0);
  });
  document.addEventListener("keyup", (ev) => {
    if (ev.shiftKey || ev.key === "Shift") rememberBodySelection();
  });

  // Remember scroll while reading
  const stage = stageEl();
  if (stage) {
    stage.addEventListener("scroll", scheduleScrollSave, { passive: true });
  }
  window.addEventListener("beforeunload", () => {
    saveCurrentScroll();
    if (openFaceId) savePlace({ faceId: openFaceId, hideDown: hideDown });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveCurrentScroll();
      if (openFaceId) savePlace({ faceId: openFaceId, hideDown: hideDown });
    }
  });

  const cutDoneBtn = $("cutDoneBtn");
  if (cutDoneBtn) cutDoneBtn.onclick = () => toggleCutDone();
  (function wireRoomHelp() {
    const wrap = $("roomHelp");
    const btn = $("roomHelpBtn");
    if (!wrap || !btn) return;
    const setOpen = (on) => {
      wrap.classList.toggle("is-open", !!on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    };
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(!wrap.classList.contains("is-open"));
    });
    document.addEventListener("click", (ev) => {
      if (!wrap.contains(ev.target)) setOpen(false);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") setOpen(false);
    });
  })();
  (function wireLogWork() {
    const wrap = $("logWork");
    const btn = $("logWorkBtn");
    if (!wrap || !btn) return;
    const setOpen = (on) => {
      wrap.classList.toggle("is-open", !!on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    };
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(!wrap.classList.contains("is-open"));
    });
    document.addEventListener("click", (ev) => {
      if (!wrap.contains(ev.target)) setOpen(false);
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") setOpen(false);
    });
  })();
  const hideDownBtn = $("hideDownBtn");
  if (hideDownBtn) hideDownBtn.onclick = () => toggleHideDown();
  const trunkJumpBtn = $("trunkJumpBtn");
  if (trunkJumpBtn) trunkJumpBtn.onclick = () => toggleTrunkJump();
  const exportLogBtn = $("exportLogBtn");
  if (exportLogBtn) exportLogBtn.onclick = () => exportLog();
  const logTitleBtn = $("logTitleBtn");
  if (logTitleBtn) logTitleBtn.onclick = () => editLogName();
  const findGo = $("findGo");
  if (findGo) findGo.onclick = () => runFind();
  const findSeal = $("findSeal");
  if (findSeal) findSeal.onclick = () => sealFind();
  const findQ = $("findQ");
  if (findQ) {
    findQ.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        runFind();
      }
    });
  }
  document.querySelectorAll("[data-find-scope]").forEach((btn) => {
    btn.onclick = () => {
      findScope = btn.getAttribute("data-find-scope") || "forest";
      document.querySelectorAll("[data-find-scope]").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
      });
    };
  });
  document.querySelectorAll("[data-find-turn]").forEach((btn) => {
    btn.onclick = () => {
      findTurn = btn.getAttribute("data-find-turn") || "all";
      document.querySelectorAll("[data-find-turn]").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
      });
    };
  });
  document.querySelectorAll(".b-rail-tab").forEach((btn) => {
    btn.onclick = () => setRail(btn.getAttribute("data-rail"));
  });
  const reportFaxBtn = $("reportFaxBtn");
  if (reportFaxBtn) reportFaxBtn.onclick = () => faxOpenReport();

  wireHouseSwitch();

  // Boot: prefs + last log (localStorage + bench.db)
  loadPlaceMerged()
    .then((boot) => {
      // query wins; else place blob; else localStorage
      if (!skinFromQuery() && boot && boot.skin) {
        applySkin(boot.skin, false);
      } else {
        applySkin(getSkin(), false);
      }
      if (!toneFromQuery() && boot && boot.tone) {
        applyTone(boot.tone, false);
      } else {
        applyTone(getTone(), false);
      }
      if (!houseFromQuery() && boot && boot.house) {
        applyHouse(boot.house, false);
      } else {
        applyHouse(getHouse(), false);
      }
      if (typeof boot.hideDown === "boolean") hideDown = boot.hideDown;
      if (typeof boot.showTrunkJump === "boolean") showTrunkJump = boot.showTrunkJump;
      if (boot.filter && $("logFilter")) $("logFilter").value = boot.filter;
      return api("/api/health").then((h) => {
        if (!h.ok || !h.yard_exists) {
          $("metaLine").textContent = "yard.db missing";
          toast("yard.db not found — ingest Nim Yard first");
        }
        return loadLogs(boot.filter || "").then(() => boot);
      });
    })
    .then((boot) => {
      const want = boot && boot.faceId;
      if (!want) return;
      const hit = logs.find((L) => L.face_id === want);
      if (hit) return openLog(want, { restoreScroll: true });
    })
    .catch(() => {
      $("metaLine").textContent = "server offline";
    });

  /* mobile side drawer — JX·NIM chip toggles (no floating RAIL tab) */
  (function wireRailDrawer() {
    const main = document.querySelector(".b-main");
    const side = document.querySelector(".b-side");
    const chip =
      document.querySelector("[data-rail-toggle-chip]") ||
      document.querySelector(".b-chip[data-deck-menu]");
    if (!main || !side || main.getAttribute("data-rail-drawer") === "1") return;
    main.setAttribute("data-rail-drawer", "1");

    const scrim = document.createElement("div");
    scrim.className = "b-rail-scrim";
    main.appendChild(scrim);

    // legacy pull tab: do not create; hide any leftover
    document.querySelectorAll(".b-rail-pull").forEach((el) => {
      el.hidden = true;
      el.style.display = "none";
    });

    function isNarrow() {
      return window.matchMedia && window.matchMedia("(max-width: 960px)").matches;
    }

    function setOpen(on) {
      main.classList.toggle("is-rail-open", !!on);
      if (chip) {
        chip.classList.toggle("is-rail-open", !!on);
        chip.setAttribute("aria-expanded", on ? "true" : "false");
        chip.title = on
          ? "Stow side rail"
          : "Open side rail (logs / find / CXR)";
      }
    }

    if (chip) {
      chip.setAttribute("aria-controls", "railLogs");
      chip.setAttribute("aria-expanded", "false");
      chip.addEventListener("click", function (ev) {
        if (!isNarrow()) return; // desk: chip is just the mark
        ev.preventDefault();
        setOpen(!main.classList.contains("is-rail-open"));
      });
    }
    scrim.addEventListener("click", function () {
      setOpen(false);
    });
  })();

})();
