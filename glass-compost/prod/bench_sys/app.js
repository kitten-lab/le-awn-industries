/* Nim Bench · hand-cut branches */
(() => {
  const $ = (id) => document.getElementById(id);
  const PLACE_KEY = "nim-bench-place-v1";

  let logs = [];
  let openFaceId = null;
  let payload = null; // last /api/logs/:id
  let highlightBranch = null;
  let hideDown = false; // hide ▾ gravity messages
  /** Last non-collapsed selection inside a message body (survives ✂ mousedown). */
  let savedBodySel = null;
  let scrollSaveT = null;
  let restoringPlace = false;

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
    return next;
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
        return (
          `<button type="button" class="b-list-item${
            L.face_id === openFaceId ? " is-on" : ""
          }${done ? " is-done" : ""}" data-face="${esc(L.face_id)}" title="${esc(
            (L.title || L.log_code || "") +
              (done ? " · cut done" : "")
          )}">` +
          `<span class="code-row">` +
          `<span class="code">${esc(L.log_code)}</span>` +
          (done
            ? `<span class="b-check" title="cut into branches">✓</span>`
            : "") +
          `</span>` +
          `<span class="meta">${esc(d)} · ${esc(String(n))} msgs</span>` +
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
    btn.textContent = done ? "✓ cut done" : "mark cut done";
    btn.title = done
      ? "Cut complete — structure locked · click to unmark and recut"
      : "Finished cutting this log into trunks · hides new-cut rails";
  }

  function paintHideDownBtn() {
    const btn = $("hideDownBtn");
    if (!btn) return;
    const { down } = gravityCountsFromPayload();
    btn.classList.toggle("is-on", hideDown);
    btn.textContent = hideDown
      ? `show ▾${down ? " · " + down : ""}`
      : `hide ▾${down ? " · " + down : ""}`;
    btn.title = hideDown
      ? "Show don't-care messages again"
      : "Hide ▾ don't-care messages (gravity down)";
    btn.hidden = !payload;
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
        ? "marked · cut done · trunk cuts locked"
        : "unmarked · still cutting"
    );
  }

  function paintLog(opts) {
    opts = opts || {};
    if (!payload) return;
    const stKeep = stageEl();
    const keepScroll =
      opts.restoreScroll ? null : stKeep ? stKeep.scrollTop : null;
    $("emptyState").hidden = true;
    $("logView").hidden = false;
    const log = payload.log;
    const msgs = payload.messages || [];
    const branches = payload.branches || [];
    $("logCode").textContent = log.log_code || "—";
    paintDoneBtn();
    paintHideDownBtn();
    // no working/glass titles — date + counts only (titles were noise)
    $("logTitle").textContent = [
      log.date || "",
      log.msg_count != null ? log.msg_count + " messages" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    paintGravityQuiet();

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
        return (
          `<span class="b-branch-wrap">` +
          `<button type="button" class="b-branch-pill${
            highlightBranch === tn ? " is-on" : ""
          }" data-br="${tn}" data-start="${b.start_seq}" title="${esc(
            tip
          )}">${esc(label)}${
            tags.length
              ? `<span class="b-pill-tags">${esc(tags.slice(0, 2).join(" · "))}${
                  tags.length > 2 ? "…" : ""
                }</span>`
              : ""
          }</button>` +
          `<button type="button" class="b-chip-btn" data-copy-chip="${esc(
            tChip
          )}" title="Copy trunk chip ${esc(tChip)}">chip</button>` +
          `<button type="button" class="b-branch-name" data-edit-br="${b.start_seq}" title="Edit title, description, tags">edit</button>` +
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

    const cutStarts = new Set(
      (payload.cuts || []).map((c) => Number(c.start_seq))
    );
    const cutMeta = {};
    (payload.cuts || []).forEach((c) => {
      cutMeta[Number(c.start_seq)] = c;
    });

    const stream = $("msgStream");
    const cutLocked = !!(payload.log && payload.log.cut_done);
    let html = "";
    msgs.forEach((m) => {
      const seq = m.seq;
      const brN = m.branch_n || 1;
      const br = branchByN[brN];
      const brTitle = (br && br.title) || "";

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
          `<div class="b-cut-block is-cut${
            cutLocked ? " is-locked" : ""
          }${downHid}" data-seq="0">` +
          `<div class="b-cut-rail is-cut">` +
          `<div class="b-cut-line"></div>` +
          `<button type="button" class="b-cut-btn b-cut-name" data-edit="0" title="${
            cutLocked ? "Trunk locked · cut done (unmark to edit structure)" : "Edit first trunk"
          }">` +
          (t0 ? `T1 · ${esc(t0)}` : "T1 · edit trunk") +
          `</button>` +
          `<button type="button" class="b-cut-btn b-cut-chip" data-copy-chip="${esc(
            tChip0
          )}" title="Copy ${esc(tChip0)}">${esc(tChip0)}</button>` +
          (cutLocked
            ? `<span class="b-cut-locked" title="Cut done — trunk structure locked">locked</span>`
            : "") +
          `<div class="b-cut-line"></div>` +
          `</div>` +
          branchMetaBelow(tags0, note0) +
          `</div>`;
      } else {
        const gEarly = Number(m.gravity) || 0;
        const downHid = hideDown && gEarly < 0 ? " is-down-hid" : "";
        const isCut = cutStarts.has(seq);
        // Cut done: hide empty "new trunk" slots entirely — only show real trunks
        if (!isCut && cutLocked) {
          /* skip open cut rail */
        } else {
          const cm = cutMeta[seq];
          const brHere = branches.find((x) => x.start_seq === seq) || {};
          const tnHere = brHere.trunk_n || brHere.branch_n || brN;
          const tCut = (cm && cm.title) || brHere.title || "";
          const tagsC = brHere.tags || (cm && cm.tags) || [];
          const noteC = (brHere.note || (cm && cm.note) || "").trim();
          const tChipC = brHere.trunk_chip || trunkChipOf(tnHere);
          html +=
            `<div class="b-cut-block${isCut ? " is-cut" : ""}${
              cutLocked ? " is-locked" : ""
            }${downHid}" data-seq="${seq}">` +
            `<div class="b-cut-rail${isCut ? " is-cut" : ""}">` +
            `<div class="b-cut-line"></div>` +
            (isCut
              ? `<button type="button" class="b-cut-btn b-cut-name" data-edit="${seq}" title="${
                  cutLocked
                    ? "Trunk locked · cut done"
                    : "Edit this trunk"
                }">` +
                (tCut
                  ? `T${tnHere} · ${esc(tCut)}`
                  : `T${tnHere} · edit`) +
                `</button>` +
                `<button type="button" class="b-cut-btn b-cut-chip" data-copy-chip="${esc(
                  tChipC
                )}" title="Copy ${esc(tChipC)}">${esc(tChipC)}</button>` +
                (cutLocked
                  ? `<span class="b-cut-locked" title="Cut done — unmark to remove or recut">locked</span>`
                  : `<button type="button" class="b-cut-btn" data-uncut="${seq}" title="Merge — remove this trunk cut">remove</button>`)
              : `<button type="button" class="b-cut-btn" data-cut="${seq}" title="New trunk starts here">✂ cut · new trunk</button>`) +
            `<div class="b-cut-line"></div>` +
            `</div>` +
            (isCut ? branchMetaBelow(tagsC, noteC) : "") +
            `</div>`;
        }
      }

      const g = Number(m.gravity) || 0;
      const gClass =
        g > 0 ? " grav-up" : g < 0 ? " grav-down" : "";
      const downHidMsg = hideDown && g < 0 ? " is-down-hid" : "";
      const dim =
        highlightBranch != null && m.branch_n !== highlightBranch
          ? ' style="opacity:0.35"'
          : "";
      const chip = msgChip(m);
      const parsed = !!m.parsed;
      const leaves = Array.isArray(m.leaves) ? m.leaves : [];
      const split = !!m.split;
      const text = m.text || "";
      const chars = m.char_count != null ? m.char_count : text.length;
      const fat = chars > 900;
      // T# = trunk (hand-cut pocket), not time — title if named
      const trunkBit = brTitle
        ? `trunk T${brN} · ${brTitle}`
        : `trunk T${brN}`;
      // body: highlight partitions when split; always know L01 = whole if not
      const bodyHtml = renderMsgBodyHtml(text, leaves, split, chip, seq);
      const leafN = leaves.length || 1;
      const collapsed = isSeqCollapsed(seq, m);
      const railClass = collapsed ? " is-collapsed" : " is-open";
      // one-line peek of body when rail is collapsed
      const peek = String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 96);
      html +=
        `<article class="b-msg role-${esc(m.role)}${gClass}${downHidMsg}${
          parsed ? " is-parsed" : ""
        }${fat ? " is-fat" : ""}${split ? " is-split" : ""}${railClass}" data-seq="${seq}" data-branch="${brN}" data-chip="${esc(
          chip
        )}" data-gravity="${g}" data-parsed="${parsed ? "1" : "0"}"${dim}>` +
        `<div class="b-msg-h" data-rail-toggle="${seq}" title="Click rail to expand / collapse">` +
        `<span class="b-msg-h-left">` +
        `<button type="button" class="b-msg-expand" data-expand="${seq}" title="${
          collapsed ? "Expand message" : "Collapse to rail"
        }">${collapsed ? "▸" : "▾"}</button>` +
        `<button type="button" class="b-msg-parsed${
          parsed ? " is-on" : ""
        }" data-parsed-toggle="${seq}" title="${
          parsed ? "Unmark parsed" : "Mark parsed · I pulled the bits"
        }">${parsed ? "✓" : "○"}</button>` +
        `<button type="button" class="b-msg-chip" data-copy-chip="${esc(
          chip
        )}" title="Copy message chip">${esc(chip)}</button>` +
        `<span class="who">${esc(who(m.role))}</span>` +
        (m.when
          ? ` · <span class="b-when" title="message create_time">${esc(
              m.when
            )}</span>`
          : "") +
        ` <span class="br" title="hand-cut trunk (pocket) on this log">${esc(
          trunkBit
        )}</span>` +
        (chars
          ? ` <span class="b-chars" title="character count">${chars}c</span>`
          : "") +
        ` <span class="b-leaf-count" title="${
          split
            ? "split into leaf chunks"
            : "unsplit · whole turn is L01"
        }">${
          split ? leafN + " leaves" : "L01 whole"
        }</span>` +
        (collapsed && peek
          ? ` <span class="b-msg-peek" title="${esc(peek)}">${esc(peek)}${
              text.length > 96 ? "…" : ""
            }</span>`
          : "") +
        `</span>` +
        `<span class="b-msg-actions">` +
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
        // leaf-cut tools parked — not using the cutter right now
        `</article>`;
    });
    stream.innerHTML = html;

    stream.querySelectorAll("[data-cut]").forEach((btn) => {
      btn.onclick = () => placeCut(parseInt(btn.getAttribute("data-cut"), 10));
    });
    stream.querySelectorAll("[data-uncut]").forEach((btn) => {
      btn.onclick = () =>
        removeCut(parseInt(btn.getAttribute("data-uncut"), 10));
    });
    stream.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.onclick = () => {
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
    stream.querySelectorAll("[data-leaf-cut]").forEach((btn) => {
      // Keep the text selection alive — button focus would collapse it
      btn.onmousedown = (ev) => {
        ev.preventDefault();
      };
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seq = parseInt(btn.getAttribute("data-leaf-cut"), 10);
        cutLeafFromSelection(seq);
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
  function renderMsgBodyHtml(text, leaves, split, msgChipStr, seq) {
    const full = String(text || "");
    if (!split || !leaves || !leaves.length) {
      return esc(full);
    }
    const sorted = leaves.slice().sort((a, b) => a.start_off - b.start_off);
    let html = "";
    sorted.forEach((lf, i) => {
      const a = Math.max(0, Number(lf.start_off) || 0);
      const b = Math.max(a, Number(lf.end_off) || 0);
      const chunk = full.slice(a, b);
      if (!chunk && b > a) {
        /* still show empty? skip */
      }
      const ln = Number(lf.leaf_n) || i + 1;
      const lchip =
        lf.chip ||
        msgChipStr + ".L" + String(ln).padStart(2, "0");
      const chipped = !!(
        lf.chipped ||
        lf.title ||
        (lf.note && !lf.remainder)
      );
      const remainder = !!lf.remainder || (!chipped && !lf.implicit);
      const lab = lf.title
        ? `L${String(ln).padStart(2, "0")} · ${lf.title}`
        : remainder
          ? `L${String(ln).padStart(2, "0")} · remainder`
          : `L${String(ln).padStart(2, "0")} · chipped`;
      const lg = Number(lf.gravity) || 0;
      const gClass =
        lg > 0 ? " grav-up" : lg < 0 ? " grav-down" : "";
      html +=
        `<section class="b-leaf-block${
          chipped && !remainder ? " is-chipped" : ""
        }${remainder ? " is-remainder" : ""}${gClass}" data-leaf-seq="${seq}" data-leaf-n="${ln}" data-leaf-gravity="${lg}">` +
        `<div class="b-leaf-block-h">` +
        `<button type="button" class="b-leaf-chip" data-copy-chip="${esc(
          lchip
        )}" data-leaf-seq="${seq}" data-leaf-n="${ln}" title="Copy ${esc(
          lchip
        )}">${esc(lab)}</button>` +
        `<span class="b-leaf-chip-full mono">${esc(lchip)}</span>` +
        (chipped && !remainder
          ? `<span class="b-leaf-badge">chipped</span>`
          : `<span class="b-leaf-badge is-open-bit">open</span>`) +
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
        `<div class="b-leaf-block-body">${esc(chunk)}</div>` +
        `</section>`;
    });
    return html || esc(full);
  }

  /** Tags + full writeup under the cut bar (not crammed on the rail). */
  function branchMetaBelow(tags, note) {
    const hasTags = tags && tags.length;
    const hasNote = !!(note && String(note).trim());
    if (!hasTags && !hasNote) return "";
    let s = `<div class="b-cut-below">`;
    if (hasTags) {
      s +=
        `<div class="b-cut-tags">` +
        tags.map((t) => `<span class="b-tag">${esc(t)}</span>`).join("") +
        `</div>`;
    }
    if (hasNote) {
      s += `<div class="b-cut-note">${esc(String(note).trim())}</div>`;
    }
    s += `</div>`;
    return s;
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
    const bits = [
      branches.length +
        " trunk" +
        (branches.length === 1 ? "" : "s") +
        " · hand cuts",
    ];
    // always show the three piles once any mark exists (or always — clearer)
    bits.push(`▴${up} · ·${mid} · ▾${down}`);
    const nMsg = (payload.messages || []).length;
    const nParsed =
      payload.log.parsed_count != null
        ? payload.log.parsed_count
        : (payload.messages || []).filter((m) => m.parsed).length;
    if (nMsg) bits.push(`parsed ${nParsed}/${nMsg}`);
    if (payload.log.cut_done) bits.push("✓ cut done");
    $("logQuiet").textContent = bits.join(" · ");
  }

  async function setGravity(seq, gravity) {
    if (!openFaceId) return;
    const g = gravity === 1 || gravity === -1 ? gravity : 0;
    // optimistic
    applyGravityDom(seq, g);
    if (payload && payload.messages) {
      const m = payload.messages.find((x) => x.seq === seq);
      if (m) m.gravity = g;
    }
    paintGravityQuiet();
    paintHideDownBtn();
    const j = await api("/api/msg/gravity", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq,
        gravity: g,
      }),
    });
    if (!j.ok) {
      toast(j.error || "gravity fail");
      // reload to resync
      await openLog(openFaceId);
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
    if (body) body.hidden = !open;
    const btn = art.querySelector(`[data-expand="${seq}"]`);
    if (btn) {
      btn.textContent = open ? "▾" : "▸";
      btn.title = open ? "Collapse to rail" : "Expand message";
    }
    // peek line only when collapsed
    let peek = art.querySelector(".b-msg-peek");
    if (open && peek) peek.remove();
    if (!open && !peek) {
      const msg = (payload && payload.messages || []).find((x) => x.seq === seq);
      const raw = (msg && msg.text) || "";
      const p = String(raw).replace(/\s+/g, " ").trim().slice(0, 96);
      if (p) {
        peek = document.createElement("span");
        peek.className = "b-msg-peek";
        peek.title = p;
        peek.textContent = p + (raw.length > 96 ? "…" : "");
        const left = art.querySelector(".b-msg-h-left");
        if (left) left.appendChild(peek);
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
    let title = selected.trim().split(/\n/)[0] || "";
    if (title.length > 48) title = title.slice(0, 48).trim() + "…";
    const note = selected.length > 200 ? selected.slice(0, 200) + "…" : selected;
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
    const up = block.querySelector(`[data-leaf-grav-up="${seq}"][data-leaf-n="${leafN}"]`);
    const down = block.querySelector(
      `[data-leaf-grav-down="${seq}"][data-leaf-n="${leafN}"]`
    );
    if (up) up.classList.toggle("is-on", g > 0);
    if (down) down.classList.toggle("is-on", g < 0);
  }

  async function setLeafGravity(seq, leafN, gravity) {
    if (!openFaceId) return;
    const g = gravity === 1 || gravity === -1 ? gravity : 0;
    applyLeafGravityDom(seq, leafN, g);
    if (payload && payload.messages) {
      const m = payload.messages.find((x) => x.seq === seq);
      const lf = m && (m.leaves || []).find((x) => Number(x.leaf_n) === leafN);
      if (lf) lf.gravity = g;
    }
    const j = await api("/api/msg/leaf/gravity", {
      method: "POST",
      body: JSON.stringify({
        face_id: openFaceId,
        seq,
        leaf_n: leafN,
        gravity: g,
      }),
    });
    if (!j.ok) {
      toast(j.error || "leaf gravity fail");
      await openLog(openFaceId);
      return;
    }
    if (j.materialized) await openLog(openFaceId);
  }

  function toggleHideDown() {
    hideDown = !hideDown;
    savePlace({ hideDown: hideDown });
    paintLog();
    toast(hideDown ? "hiding ▾ don't-care" : "showing all");
  }

  function normalizeTag(t) {
    return String(t || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
  }

  function tagKey(t) {
    // JS has no Python casefold — lower-case is enough for flag matching
    return normalizeTag(t).toLowerCase();
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
        `<label class="b-field-lab">Title</label>` +
        `<input type="text" class="b-name-pop-input" data-field="title" maxlength="120" spellcheck="true" placeholder="short name for this pocket" />` +
        `<label class="b-field-lab">Description</label>` +
        `<textarea class="b-name-pop-area" data-field="note" maxlength="800" rows="3" spellcheck="true" placeholder="what this pocket is · enough to remember later"></textarea>` +
        `<label class="b-field-lab">Flags · your words</label>` +
        `<div class="b-tag-help">Not a fixed scale — invent names as you need them (e.g. later, heavy, ready, light). Reuse from below to stay consistent. Enter adds a flag; click a flag to remove it.</div>` +
        `<div class="b-tag-row" data-tag-chips></div>` +
        `<input type="text" class="b-name-pop-input b-tag-input" data-field="tagIn" maxlength="40" spellcheck="true" placeholder="type a flag · Enter to add" autocomplete="off" />` +
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
      titleIn.value = opts.title || "";
      noteIn.value = opts.note || "";

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
        const show = vocab
          .filter((t) => t && !have.has(tagKey(t)))
          .slice(0, 16);
        suggestEl.innerHTML = show.length
          ? show
              .map(
                (t, i) =>
                  `<button type="button" class="b-tag" data-add-i="${i}">${esc(
                    t
                  )}</button>`
              )
              .join("")
          : vocab.length
            ? ""
            : `<span class="b-tag-empty">first flags become your dictionary</span>`;
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

      pop.querySelector(".b-name-pop-cancel").onclick = (ev) => {
        ev.preventDefault();
        finish(null);
      };
      pop.querySelector(".b-name-pop-ok").onclick = (ev) => {
        ev.preventDefault();
        // if there's text sitting in the flag box, commit it first
        if (tagIn.value && tagIn.value.trim()) {
          addTag(tagIn.value);
          tagIn.value = "";
        }
        finish({
          title: titleIn.value,
          note: noteIn.value,
          tags: tags.slice(),
        });
      };
      tagIn.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          if (addTag(tagIn.value)) tagIn.value = "";
        }
      });
      pop.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(null);
          return;
        }
        // Ctrl/Cmd+Enter saves from anywhere
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          if (tagIn.value && tagIn.value.trim()) {
            addTag(tagIn.value);
            tagIn.value = "";
          }
          finish({
            title: titleIn.value,
            note: noteIn.value,
            tags: tags.slice(),
          });
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
          titleIn.focus();
          titleIn.select();
        } catch (e) {
          /* ignore */
        }
      }, 30);
    });
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
  const hideDownBtn = $("hideDownBtn");
  if (hideDownBtn) hideDownBtn.onclick = () => toggleHideDown();

  // Boot: prefs + last log you were in
  const boot = loadPlace();
  if (typeof boot.hideDown === "boolean") hideDown = boot.hideDown;
  if (boot.filter && $("logFilter")) $("logFilter").value = boot.filter;

  api("/api/health")
    .then((h) => {
      if (!h.ok || !h.yard_exists) {
        $("metaLine").textContent = "yard.db missing";
        toast("yard.db not found — ingest Nim Yard first");
      }
      return loadLogs(boot.filter || "");
    })
    .then(() => {
      const want = boot.faceId;
      if (!want) return;
      const hit = logs.find((L) => L.face_id === want);
      if (hit) return openLog(want, { restoreScroll: true });
    })
    .catch(() => {
      $("metaLine").textContent = "server offline";
    });
})();
