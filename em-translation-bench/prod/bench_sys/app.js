const HEB = [
  ["א", "alef"], ["ב", "bet"], ["ג", "gimel"], ["ד", "dalet"], ["ה", "he"],
  ["ו", "vav"], ["ז", "zayin"], ["ח", "chet"], ["ט", "tet"], ["י", "yod"],
  ["כ", "kaf"], ["ל", "lamed"], ["מ", "mem"], ["נ", "nun"], ["ס", "samekh"],
  ["ע", "ayin"], ["פ", "pe"], ["צ", "tsadi"], ["ק", "qof"], ["ר", "resh"],
  ["ש", "shin"], ["ת", "tav"],
];
const HEB_FINAL = { "כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ" };
const FINAL_NAME = { "ך": "kaf sofit", "ם": "mem sofit", "ן": "nun sofit", "ף": "pe sofit", "ץ": "tsadi sofit" };

const desk = document.getElementById("desk");
const shelf = document.getElementById("shelf");
const papers = new Map();
const state = { z: 10, focus: null, finals: false, activeId: "", place: { verse: "", index: "", chapter: "1" } };

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
async function api(path, opts) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function plainLetters(text) {
  return String(text || "").replace(/[\u0591-\u05C7]/g, "");
}

const MARKS = {
  translation: ["#3d4f6f", "translation", `<svg viewBox="0 0 12 12"><path fill="currentColor" d="M1.5 8.8 3 5.8 8.2 1.2l2.1 2.1L5.2 8 1.5 9.4z"/></svg>`],
  definition: ["#6b4a2a", "definition", `<svg viewBox="0 0 12 12"><path fill="currentColor" d="M2 1.5h3.2c.8 0 1.5.6 1.5 1.4V10c-.5-.4-1.1-.6-1.8-.6H2V1.5zm5.3 0H10v7.9H8.1c-.7 0-1.3.2-1.8.6V2.9c0-.8.7-1.4 1.5-1.4z"/></svg>`],
  consideration: ["#2f6b4f", "consideration", `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="6" r="1.1" fill="currentColor"/></svg>`],
  comparison: ["#6b3d5a", "comparison", `<svg viewBox="0 0 12 12"><path fill="currentColor" d="M1.5 3h4v2h-4zm5 4h4v2h-4zM1.5 7h3v2h-3zm5-4h4v2h-4z"/></svg>`],
  question: ["#8a5a12", "question", `<svg viewBox="0 0 12 12"><path fill="currentColor" d="M4 3.2C4 2 5 1.2 6.4 1.2 7.9 1.2 9 2.1 9 3.5c0 1.1-.6 1.8-1.7 2.3-.6.3-.8.6-.8 1.1V7.4H5.2v-.7c0-1 .5-1.6 1.5-2.1.6-.3.8-.6.8-1.1 0-.6-.4-1-1.1-1-.7 0-1.1.4-1.2 1H4zm1.6 6.2h1.6V11H5.6V9.4z"/></svg>`],
  reading: ["#6b645c", "reading", `<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="2" fill="currentColor"/></svg>`],
};
const FRAG_KINDS = ["translation", "definition", "consideration", "comparison", "question"];

function kindOptions(selected) {
  return FRAG_KINDS.map((kind) => `<option value="${kind}"${kind === selected ? " selected" : ""}>${kind}</option>`).join("");
}

function chips(grouped) {
  const pairs = Array.isArray(grouped)
    ? grouped.map((kind) => [kind, [kind]])
    : Object.entries(grouped || {});
  return pairs.map(([kind, texts]) => {
    const mark = MARKS[kind];
    if (!mark) return "";
    const lines = Array.isArray(texts) ? texts : [texts];
    const tip = lines.map((item) => {
      if (typeof item === "string") return escapeHtml(item);
      const name = String(item.headline || "").trim();
      const heat = Number(item.heat) || 0;
      const head = name ? `<b>${escapeHtml(name)}</b><br>` : "";
      const score = heat ? `heat ${heat}<br>` : "";
      return head + score + escapeHtml(item.text || "");
    }).join("<br><br>");
    return `<span class="chip" tabindex="0" style="color:${mark[0]}"><span class="tip">${tip}</span>${mark[2]}</span>`;
  }).join("");
}

function mergeGrouped(left, right) {
  const out = {};
  for (const src of [left, right]) {
    if (!src || Array.isArray(src)) continue;
    for (const [kind, texts] of Object.entries(src)) {
      out[kind] = (out[kind] || []).concat(texts);
    }
  }
  return out;
}

async function paintMarks(chapter, root) {
  const data = await api("/api/marks?chapter=" + chapter);
  root.querySelectorAll("[data-mark-for]").forEach((el) => {
    const shared = el.dataset.strong ? data.marks["s:" + el.dataset.strong] : null;
    el.innerHTML = chips(mergeGrouped(data.marks[el.dataset.markFor], shared));
  });
}

function repaintOpenBooks() {
  papers.forEach((paper, id) => {
    if (id.startsWith("book:") || id.startsWith("line:")) {
      const chapter = chapterOf(id);
      if (chapter) paintMarks(chapter, paper.body);
    }
  });
}

function chapterOf(id) {
  const book = /^book:(\d+)$/.exec(id);
  if (book) return book[1];
  const verse = /^(?:word|line):Genesis (\d+):/.exec(id);
  return verse ? verse[1] : "";
}

function verseKeyOf(id) {
  const match = /^(?:word|line):(Genesis \d+:\d+)/.exec(id);
  return match ? match[1] : "";
}

function refreshMarks() {
  const active = state.activeId;
  const activeChapter = chapterOf(active);
  const activeVerse = verseKeyOf(active);
  papers.forEach((paper, id) => {
    paper.el.querySelector(".paper-title")?.classList.toggle("is-current", id === active);
  });
  shelf.querySelectorAll("button").forEach((pill) => {
    pill.classList.toggle("is-current", pill.dataset.id === active);
  });
  document.querySelectorAll("[data-paper]").forEach((btn) => {
    const id = btn.dataset.paper;
    const current = active === id;
    btn.classList.toggle("is-open", papers.has(id) && !current);
    btn.classList.toggle("is-current", current);
  });
  document.querySelectorAll(".chapter-pick[data-chapter]").forEach((btn) => {
    const ch = btn.dataset.chapter;
    const bookOpen = papers.has("book:" + ch);
    const childOpen = [...papers.keys()].some((id) => chapterOf(id) === ch && id !== "book:" + ch);
    const current = active === "book:" + ch || activeChapter === ch;
    btn.classList.toggle("is-open", (bookOpen || childOpen) && !current);
    btn.classList.toggle("is-current", current);
  });
  document.querySelectorAll("[data-verse-key]").forEach((btn) => {
    const key = btn.dataset.verseKey;
    const open = [...papers.keys()].some((id) => verseKeyOf(id) === key);
    const current = activeVerse === key;
    btn.classList.toggle("is-open", open && !current);
    btn.classList.toggle("is-current", current);
  });
  document.querySelectorAll("[data-word-id]").forEach((btn) => {
    const id = btn.dataset.wordId;
    const current = active === id;
    btn.classList.toggle("is-open", papers.has(id) && !current);
    btn.classList.toggle("is-current", current);
  });
}

function setActive(id) {
  state.activeId = id;
  refreshMarks();
}

function raise(el) {
  state.z += 1;
  el.style.zIndex = String(state.z);
  for (const [id, paper] of papers) {
    if (paper.el === el) setActive(id);
  }
}

function bindResize(el) {
  const handle = document.createElement("div");
  handle.className = "paper-resize";
  handle.title = "resize";
  el.appendChild(handle);
  let resize = null;
  handle.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    raise(el);
    resize = { x: ev.clientX, y: ev.clientY, w: el.offsetWidth, h: el.offsetHeight };
    handle.setPointerCapture(ev.pointerId);
  });
  handle.addEventListener("pointermove", (ev) => {
    if (!resize) return;
    el.style.width = Math.max(220, resize.w + ev.clientX - resize.x) + "px";
    el.style.height = Math.max(140, resize.h + ev.clientY - resize.y) + "px";
  });
  handle.addEventListener("pointerup", () => { resize = null; snapshot(); });
  handle.addEventListener("pointercancel", () => { resize = null; });
}

function bindDrag(el, handle) {
  let drag = null;
  handle.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button")) return;
    raise(el);
    drag = { dx: ev.clientX - el.offsetLeft, dy: ev.clientY - el.offsetTop };
    handle.setPointerCapture(ev.pointerId);
  });
  handle.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    el.style.left = (ev.clientX - drag.dx) + "px";
    el.style.top = (ev.clientY - drag.dy) + "px";
  });
  handle.addEventListener("pointerup", () => { drag = null; snapshot(); });
}

function snapshot() {
  if (state.restoring) return;
  const items = [];
  papers.forEach((paper, id) => {
    items.push({
      id,
      left: paper.el.style.left,
      top: paper.el.style.top,
      width: paper.el.style.width,
      height: paper.el.style.height,
      shelved: !!paper.el.hidden,
      meta: paper.meta || null,
    });
  });
  localStorage.setItem("emb-desk", JSON.stringify({ activeId: state.activeId, items }));
}

function foldOpen(key) {
  try {
    return JSON.parse(localStorage.getItem("emb-folds") || "{}")[key] === true;
  } catch {
    return false;
  }
}

function setFold(key, open) {
  const all = JSON.parse(localStorage.getItem("emb-folds") || "{}");
  all[key] = open;
  localStorage.setItem("emb-folds", JSON.stringify(all));
}

function bindFolds(root) {
  root.querySelectorAll("details[data-fold]").forEach((node) => {
    node.addEventListener("toggle", () => setFold(node.dataset.fold, node.open));
  });
}

function shelve(id) {
  const paper = papers.get(id);
  if (!paper) return;
  paper.el.hidden = true;
  if ([...shelf.children].some((b) => b.dataset.id === id)) return;
  const pill = document.createElement("button");
  pill.type = "button";
  pill.dataset.id = id;
  pill.textContent = paper.shelfLabel || paper.label;
  pill.addEventListener("click", () => unshelve(id));
  shelf.appendChild(pill);
  refreshMarks();
  snapshot();
}

function unshelve(id) {
  const paper = papers.get(id);
  if (!paper) return;
  paper.el.hidden = false;
  raise(paper.el);
  const pill = shelf.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (pill) pill.remove();
}

function closePaper(id) {
  const paper = papers.get(id);
  if (!paper) return;
  paper.el.remove();
  papers.delete(id);
  const pill = shelf.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (pill) pill.remove();
  if (state.activeId === id) state.activeId = "";
  refreshMarks();
  snapshot();
}

function makePaper(id, kind, label, className) {
  const existing = papers.get(id);
  if (existing) {
    unshelve(id);
    return existing;
  }
  const el = document.createElement("article");
  el.className = "paper " + (className || "");
  const n = papers.size;
  el.style.left = (24 + (n % 6) * 28) + "px";
  el.style.top = (24 + (n % 5) * 24) + "px";
  const title = document.createElement("div");
  title.className = "paper-title";
  title.innerHTML = `<span class="kind">${escapeHtml(kind)}</span><span class="name">${escapeHtml(label)}</span>`;
  const actions = document.createElement("span");
  const shelfBtn = document.createElement("button");
  shelfBtn.type = "button";
  shelfBtn.textContent = "shelf";
  shelfBtn.addEventListener("click", () => shelve(id));
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.title = "close the paper. the note stays.";
  closeBtn.addEventListener("click", () => closePaper(id));
  actions.append(shelfBtn, closeBtn);
  title.appendChild(actions);
  const body = document.createElement("div");
  body.className = "paper-body";
  el.append(title, body);
  el.addEventListener("pointerdown", () => raise(el));
  desk.appendChild(el);
  bindDrag(el, title);
  bindResize(el);
  const paper = { el, body, label, kind };
  papers.set(id, paper);
  raise(el);
  return paper;
}

function wordButton(word, verseN, chapter) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "word";
  if (word.strong === "H853" || plainLetters(word.surface) === "את") b.classList.add("aleph-tav");
  b.dataset.wordId = `word:Genesis ${chapter}:${verseN}:${word.i}`;
  b.dataset.verseKey = `Genesis ${chapter}:${verseN}`;
  b.innerHTML =
    `<div class="heb">${escapeHtml(word.surface)}</div>` +
    `<div class="lemma">${escapeHtml(word.lemma)}</div>` +
    `<div class="en">${escapeHtml(word.english)}</div>` +
    `<div class="num">${escapeHtml(word.strong)}</div>`;
  const wrap = document.createElement("span");
  wrap.className = "word-wrap";
  const marks = document.createElement("span");
  marks.className = "marks";
  marks.dataset.markFor = `w:${verseN}:${word.i}`;
  if (word.strong) marks.dataset.strong = word.strong;
  wrap.append(b, marks);
  b.addEventListener("click", () => openWord(chapter, verseN, word));
  if (word.strong) {
    b.querySelector(".num").addEventListener("click", (ev) => {
      ev.stopPropagation();
      openWord(chapter, verseN, word, "strong");
    });
  }
  return wrap;
}

async function openBook(chapter) {
  const id = "book:" + chapter;
  const paper = makePaper(id, "book", "Genesis " + chapter, "book");
  paper.body.textContent = "Opening…";
  const data = await api("/api/chapter?n=" + chapter);
  paper.body.innerHTML = "";

  for (const verse of data.verses || []) {
    const sec = document.createElement("section");
    sec.className = "verse";
    const head = document.createElement("div");
    head.className = "verse-head";
    const line = document.createElement("button");
    line.type = "button";
    line.dataset.verseKey = `Genesis ${chapter}:${verse.verse}`;
    line.textContent = `Genesis ${chapter}:${verse.verse}`;
    line.addEventListener("click", () => openLine(chapter, verse));
    const pop = document.createElement("button");
    pop.type = "button";
    pop.className = "verse-pop";
    pop.textContent = "pop";
    pop.title = "float this line on the desk";
    pop.addEventListener("click", () => openLine(chapter, verse));
    const lineMarks = document.createElement("span");
    lineMarks.className = "marks";
    lineMarks.dataset.markFor = "l:" + verse.verse;
    head.append(line, pop, lineMarks);
    const words = document.createElement("div");
    words.className = "words";
    for (const word of verse.words) words.appendChild(wordButton(word, verse.verse, chapter));
    sec.append(head, words);
    if (verse.english) {
      const english = document.createElement("button");
      english.type = "button";
      english.className = "verse-en";
      english.textContent = verse.english;
      english.addEventListener("click", () => openLine(chapter, verse));
      sec.appendChild(english);
    }
    paper.body.appendChild(sec);
  }
  state.place = { verse: "", index: "", chapter: String(chapter) };
  paper.meta = { chapter };
  refreshMarks();
  paintMarks(chapter, paper.body);
  snapshot();
}

const HEADLINES = [...FRAG_KINDS, "reading"];

function headlineOptions(selected) {
  const kinds = HEADLINES.includes(selected) ? HEADLINES : [selected, ...HEADLINES];
  return kinds.map((kind) => `<option value="${kind}"${kind === selected ? " selected" : ""}>${kind}</option>`).join("");
}

function heatPips(heat) {
  return `<span class="heat">${[1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="pip${n <= heat ? " on" : ""}" data-heat="${n}" title="heat ${n}"></button>`
  ).join("")}</span>`;
}

function spotControl(scope, allowFollow) {
  if (!allowFollow) return "";
  if (scope === "position") {
    return `<label class="spot"><input type="checkbox" class="frag-spot" checked /> only this position</label>`;
  }
  return `<label class="spot"><input type="checkbox" class="frag-spot" /> only this position</label>`;
}

function mountFragments(host, save, onKept) {
  const allowFollow = !!save.allowFollow;
  let frags = (save.fragments || []).filter((f) => (f.text || "").trim()).map((f) => ({
    kind: f.kind || "reading",
    text: f.text,
    heat: Number(f.heat) || 0,
    headline: f.headline || "",
    scope: allowFollow && f.scope !== "position" ? "strong" : "position",
    editing: false,
  }));
  let draft = {
    kind: FRAG_KINDS[0],
    headline: "",
    heat: 0,
    text: "",
    scope: allowFollow ? "strong" : "position",
  };
  const payload = (list) => list.filter((f) => (f.text || "").trim()).map((f) => ({
    kind: f.kind,
    text: f.text,
    heat: Number(f.heat) || 0,
    headline: f.headline || "",
    scope: allowFollow && f.scope !== "position" ? "strong" : "position",
  }));
  const draw = () => {
    host.innerHTML = frags.map((frag, i) => {
      const name = frag.headline ? `<b class="frag-name">${escapeHtml(frag.headline)}</b>` : "";
      const pinned = frag.scope === "position" && allowFollow ? `<span class="spot">this position</span>` : "";
      if (frag.editing) {
        return `<div class="frag editing" data-i="${i}"><div class="frag-top"><select class="frag-kind-set">${headlineOptions(frag.kind)}</select><input class="headline" placeholder="headline" value="${escapeHtml(frag.headline)}" />${heatPips(frag.heat)}${spotControl(frag.scope, allowFollow)}</div><textarea rows="3">${escapeHtml(frag.text)}</textarea><div class="frag-actions"><button type="button" class="keep-one">keep</button><button type="button" class="frag-drop">drop</button></div></div>`;
      }
      return `<article class="committed" data-i="${i}"><div class="frag-top"><span class="frag-kind">${escapeHtml(frag.kind)}</span>${name}${heatPips(frag.heat)}${pinned}</div><div class="frag-body">${escapeHtml(frag.text)}</div><div class="frag-actions"><button type="button" class="edit">edit</button><button type="button" class="frag-drop">drop</button></div></article>`;
    }).join("") + `<div class="frag frag-new"><div class="frag-top"><select class="frag-kind">${kindOptions(draft.kind)}</select><input class="headline" placeholder="headline" value="${escapeHtml(draft.headline)}" />${heatPips(draft.heat)}${spotControl(draft.scope, allowFollow)}<button type="button" class="add-frag">add</button></div><textarea rows="3" placeholder="the thought">${escapeHtml(draft.text)}</textarea></div>`;
  };
  const readBox = (el, target) => {
    const area = el.querySelector("textarea");
    const kind = el.querySelector(".frag-kind-set, .frag-kind");
    const headline = el.querySelector(".headline");
    const spot = el.querySelector(".frag-spot");
    if (area) target.text = area.value;
    if (kind) target.kind = kind.value;
    if (headline) target.headline = headline.value;
    if (spot) target.scope = spot.checked ? "position" : "strong";
  };
  const readEditing = () => {
    host.querySelectorAll(".frag.editing").forEach((el) => {
      const frag = frags[Number(el.dataset.i)];
      if (frag) readBox(el, frag);
    });
  };
  const readDraft = () => {
    const box = host.querySelector(".frag-new");
    if (box) readBox(box, draft);
  };
  const persist = async (keepDraft) => {
    readEditing();
    if (!keepDraft) readDraft();
    const fragments = payload(frags);
    await api("/api/note", { method: "PUT", body: JSON.stringify({ ...save.body, fragments, weak: save.weak ? save.weak() : "" }) });
    frags = fragments.map((f, i) => ({ ...f, editing: !!frags.filter((item) => (item.text || "").trim())[i]?.editing }));
    draw();
    if (onKept) onKept();
  };
  host.addEventListener("click", async (ev) => {
    const pip = ev.target.closest(".pip");
    if (pip) {
      const n = Number(pip.dataset.heat);
      const drafting = pip.closest(".frag-new");
      if (drafting) {
        readDraft();
        draft.heat = draft.heat === n ? 0 : n;
        drafting.querySelectorAll(".pip").forEach((button) => {
          button.classList.toggle("on", Number(button.dataset.heat) <= draft.heat);
        });
        return;
      }
      readEditing();
      const frag = frags[Number(pip.closest("[data-i]").dataset.i)];
      frag.heat = frag.heat === n ? 0 : n;
      pip.closest(".heat").querySelectorAll(".pip").forEach((button) => {
        button.classList.toggle("on", Number(button.dataset.heat) <= frag.heat);
      });
      if (!frag.editing) await persist();
      return;
    }
    if (ev.target.closest(".add-frag")) {
      readDraft();
      readEditing();
      if (!(draft.text || "").trim()) {
        host.querySelector(".frag-new textarea")?.focus();
        return;
      }
      frags.push({
        kind: draft.kind,
        text: draft.text,
        heat: draft.heat,
        headline: draft.headline,
        scope: allowFollow && draft.scope !== "position" ? "strong" : "position",
        editing: false,
      });
      draft = { kind: FRAG_KINDS[0], headline: "", heat: 0, text: "", scope: allowFollow ? "strong" : "position" };
      await persist(true);
      return;
    }
    const drop = ev.target.closest(".frag-drop");
    if (drop) {
      readEditing();
      readDraft();
      frags.splice(Number(drop.closest("[data-i]").dataset.i), 1);
      await persist();
      return;
    }
    const edit = ev.target.closest(".edit");
    if (edit) {
      readEditing();
      readDraft();
      const i = Number(edit.closest(".committed").dataset.i);
      frags[i].editing = true;
      draw();
      host.querySelector(`.frag.editing[data-i="${i}"] textarea`)?.focus();
      return;
    }
    if (!ev.target.closest(".keep-one")) return;
    readEditing();
    frags[Number(ev.target.closest(".frag.editing").dataset.i)].editing = false;
    await persist();
  });
  draw();
}

function tallyUses(uses, key) {
  const counts = new Map();
  for (const use of uses || []) {
    const value = String(use[key] || "").trim();
    if (!value || value === "-" || value === "—" || value === ". . .") continue;
    if (key === "english" && !/[A-Za-z]/.test(value)) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function strongBlock(title, body) {
  if (!body) return "";
  return `<div class="strong-block"><div class="kicker">${title}</div><div class="box">${escapeHtml(body)}</div></div>`;
}

function countLine(pairs, hebrew) {
  if (!pairs.length) return "";
  const chips = pairs.map(([text, n]) => `<span${hebrew ? ' class="heb"' : ""}>${escapeHtml(text)} <span class="n">${n}</span></span>`).join("");
  return `<div class="glosses">${chips}</div>`;
}

function strongFacts(his) {
  if (!his) return `<p>No Strong's number on this word.</p>`;
  const glosses = tallyUses(his.uses, "english");
  const parsed = tallyUses(his.uses, "parsing_full");
  return `<p class="heb strong-lemma">${escapeHtml(his.lemma)}</p>` +
    `<p class="strong-meta">${escapeHtml(his.id || "")}${his.xlit ? " · " + escapeHtml(his.xlit) : ""}${his.pron ? " · " + escapeHtml(his.pron) : ""}</p>` +
    strongBlock("Definition", his.meaning) +
    strongBlock("Words he gives it", his.usage) +
    (glosses.length ? `<div class="strong-block"><div class="kicker">In Genesis</div>${countLine(glosses)}</div>` : "") +
    (parsed.length ? `<div class="strong-block"><div class="kicker">Parsing</div>${countLine(parsed)}</div>` : "") +
    strongBlock("Where he says it comes from", his.source);
}

function fillUses(host, uses, strongId) {
  if (!host) return;
  host.innerHTML = "";
  if (!uses || !uses.length) {
    host.textContent = "Does not occur in Genesis. There is nowhere in this book to open.";
    return;
  }
  for (const u of uses) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "jump";
    b.innerHTML = `<span class="heb">${escapeHtml(u.surface)}</span> ${escapeHtml(u.english || "")} <span class="n">Genesis ${u.chapter}:${u.verse}</span>`;
    b.addEventListener("click", async () => {
      await openBook(u.chapter);
      const ch = await api("/api/chapter?n=" + u.chapter);
      const verseRow = (ch.verses || []).find((v) => v.verse === u.verse);
      const found = verseRow && verseRow.words.find((w) => w.surface === u.surface && w.strong === strongId);
      if (found) openWord(u.chapter, u.verse, found);
    });
    host.appendChild(b);
  }
}

function showSheet(paper, name) {
  const tabs = paper.body.querySelectorAll(".sheet-tabs button");
  if (!tabs.length) return;
  tabs.forEach((btn) => btn.classList.toggle("on", btn.dataset.sheet === name));
  paper.body.querySelectorAll(".sheet").forEach((sheet) => {
    sheet.hidden = sheet.dataset.sheet !== name;
  });
}

async function openWord(chapter, verseN, word, sheet) {
  const verse = `Genesis ${chapter}:${verseN}`;
  const id = `word:${verse}:${word.i}`;
  const already = papers.has(id);
  const paper = makePaper(id, "word", word.english || word.surface);
  paper.shelfLabel = `${word.english || ""} ${word.surface}`.trim();
  paper.meta = { chapter, verseN, index: word.i, strong: word.strong || "" };
  state.place = { verse, index: String(word.i), chapter: String(chapter) };
  if (already) {
    if (sheet) showSheet(paper, sheet);
    return;
  }
  const his = word.strong ? await api("/api/strong/" + word.strong).catch(() => null) : null;
  const note = await api("/api/note?verse=" + encodeURIComponent(verse) + "&index=" + word.i + (word.strong ? "&strong=" + encodeURIComponent(word.strong) : ""));
  paper.body.innerHTML =
    `<div class="word-head${word.strong === "H853" || plainLetters(word.surface) === "את" ? " aleph-tav" : ""}"><div class="heb">${escapeHtml(word.surface)}</div>` +
    `<div>${escapeHtml(word.lemma)} · ${escapeHtml(word.english)}</div>` +
    `<div class="ids"><span>Strong ${escapeHtml(word.strong || "—")}</span>` +
    `<span class="weak-slot"></span></div></div>` +
    (his && his.meaning ? `<p class="fact">${escapeHtml(his.meaning)}</p>` : "") +
    `<div class="sheet-tabs"><button type="button" data-sheet="weak" class="on">Weak's</button>` +
    (his ? `<button type="button" data-sheet="strong">Strong's</button><button type="button" data-sheet="uses">Other uses</button>` : "") +
    `</div>` +
    `<div class="sheet" data-sheet="weak"><div class="fragments"></div></div>` +
    `<div class="sheet" data-sheet="strong" hidden>${strongFacts(his)}</div>` +
    `<div class="sheet" data-sheet="uses" hidden><div class="uses"></div></div>`;
  fillUses(paper.body.querySelector(".uses"), his && his.uses, word.strong);
  bindFolds(paper.body);
  const slot = paper.body.querySelector(".weak-slot");
  const paintWeak = (value) => {
    if (!value) {
      slot.innerHTML = `<label>Weak <input class="weak-id" placeholder="your number" /></label>`;
      return;
    }
    slot.innerHTML = `<span class="weak-print">Weak ${escapeHtml(value)}</span> <button type="button" class="tiny edit-weak">edit</button><input class="weak-id" hidden value="${escapeHtml(value)}" />`;
  };
  paintWeak(note.weak || "");
  slot.addEventListener("click", (ev) => {
    if (!ev.target.closest(".edit-weak")) return;
    const input = slot.querySelector(".weak-id");
    input.hidden = false;
    input.focus();
  });
  paper.body.querySelectorAll(".sheet-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => showSheet(paper, btn.dataset.sheet));
  });
  if (sheet) showSheet(paper, sheet);
  mountFragments(paper.body.querySelector(".fragments"), {
    fragments: note.fragments || [],
    allowFollow: !!word.strong,
    weak: () => paper.body.querySelector(".weak-id").value.trim(),
    body: { verse, index: word.i, strong: word.strong, surface: word.surface },
  }, () => {
    paintWeak(paper.body.querySelector(".weak-id").value.trim());
    repaintOpenBooks();
  });
  snapshot();
}

async function openLine(chapter, verse) {
  const label = `Genesis ${chapter}:${verse.verse}`;
  const id = "line:" + label;
  const already = papers.has(id);
  const paper = makePaper(id, "line", label);
  paper.meta = { chapter, verseN: verse.verse };
  state.place = { verse: label, index: "", chapter: String(chapter) };
  if (already) return;
  if (!paper.el.style.width) paper.el.style.width = "560px";
  if (!paper.el.style.height) paper.el.style.height = "340px";
  const note = await api("/api/note?verse=" + encodeURIComponent(label));
  const line = verse.english || verse.words.map((w) => w.english).filter((text) => text && text !== "-").join(" ");
  paper.body.innerHTML = "";
  const words = document.createElement("div");
  words.className = "words";
  for (const word of verse.words) words.appendChild(wordButton(word, verse.verse, chapter));
  const english = document.createElement("p");
  english.className = "verse-en";
  english.textContent = line;
  const fragments = document.createElement("div");
  fragments.className = "fragments";
  paper.body.append(words, english, fragments);
  mountFragments(fragments, {
    fragments: note.fragments || [],
    body: { verse: label, index: "", surface: "" },
  }, () => {
    repaintOpenBooks();
  });
  paintMarks(chapter, paper.body);
  snapshot();
}

async function openStrong(strongId) {
  const his = await api("/api/strong/" + strongId);
  const paper = makePaper("strong:" + strongId, "strong", (his.lemma || "") + " " + strongId);
  paper.meta = { strongId };
  paper.body.innerHTML = strongFacts(his) + `<div class="kicker">Other uses</div><div class="uses"></div>`;
  fillUses(paper.body.querySelector(".uses"), his.uses, strongId);
}

function openGenesis() {
  const paper = makePaper("genesis-pick", "book", "Genesis");
  if (paper.body.childElementCount) {
    refreshMarks();
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "words";
  wrap.style.direction = "ltr";
  for (let i = 1; i <= 50; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "word chapter-pick";
    b.textContent = String(i);
    b.dataset.chapter = String(i);
    b.addEventListener("click", () => openBook(i));
    wrap.appendChild(b);
  }
  paper.body.appendChild(wrap);
  refreshMarks();
}

async function showLexEntry(paper, strongId) {
  paper.lex.current = strongId;
  paper.body.querySelectorAll(".lex-row").forEach((row) => {
    row.classList.toggle("is-on", row.dataset.id === strongId);
  });
  const read = paper.body.querySelector(".lex-read");
  read.textContent = "Opening…";
  const his = await api("/api/strong/" + strongId);
  read.innerHTML = strongFacts(his) + `<div class="kicker">Other uses</div><div class="uses"></div>`;
  fillUses(read.querySelector(".uses"), his.uses, strongId);
  const name = paper.el.querySelector(".paper-title .name");
  if (name) name.textContent = `${his.lemma || ""} ${strongId}`.trim();
}

async function openLexicon() {
  const paper = makePaper("lexicon", "strong", "Strong's", "book");
  paper.el.classList.add("cab");
  if (paper.body.querySelector(".lex-list")) return;
  if (!paper.el.style.width) paper.el.style.width = "760px";
  if (!paper.el.style.height) paper.el.style.height = "560px";
  paper.lex = { order: "num", cursor: "H0", q: "", current: "", used: true };
  const fill = async (direction) => {
    const lex = paper.lex;
    const data = await api(
      "/api/lexicon?order=" + lex.order +
      "&around=" + encodeURIComponent(lex.cursor) +
      "&span=48&dir=" + direction +
      "&used=" + (lex.used ? "1" : "0") +
      "&q=" + encodeURIComponent(lex.q || "")
    );
    const rows = data.entries || [];
    if (rows.length && !lex.q) {
      lex.cursor = direction === "prev" ? rows[0].id : rows[rows.length - 1].id;
    }
    const list = paper.body.querySelector(".lex-list");
    list.innerHTML = "";
    for (const entry of rows) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lex-row" + (entry.id === lex.current ? " is-on" : "");
      b.dataset.id = entry.id;
      const count = Number(entry.uses);
      const uses = Number.isFinite(count) ? `<span class="n">${count || "0"}</span>` : "";
      b.innerHTML = `<span class="id">${escapeHtml(entry.id)}</span><span class="heb">${escapeHtml(entry.lemma)}</span> <span class="en">${escapeHtml(entry.xlit)}</span>${uses}`;
      b.addEventListener("click", () => showLexEntry(paper, entry.id));
      list.appendChild(b);
    }
    if (!rows.length) {
      list.textContent = "Nothing further that way.";
      return;
    }
    if (!rows.some((entry) => entry.id === lex.current)) showLexEntry(paper, rows[0].id);
  };
  paper.body.innerHTML =
    `<div class="cab-layout lex-cab">` +
    `<div class="cab-list"><div class="lex-tools">` +
    `<button type="button" class="order-num">Number order</button>` +
    `<button type="button" class="order-alpha">Letter order</button>` +
    `<button type="button" class="prev-page">Earlier</button>` +
    `<button type="button" class="next-page">Later</button>` +
    `<button type="button" class="only-used on">In Genesis</button>` +
    `<input class="lex-q" placeholder="find a number or a word" />` +
    `</div><div class="lex-list"></div></div>` +
    `<div class="lex-read"><p class="cab-empty">Choose a word.</p></div></div>`;
  paper.body.querySelector(".order-num").addEventListener("click", () => {
    paper.lex.order = "num";
    paper.lex.q = "";
    paper.lex.cursor = "H1";
    fill("next");
  });
  paper.body.querySelector(".order-alpha").addEventListener("click", () => {
    paper.lex.order = "alpha";
    paper.lex.q = "";
    paper.lex.cursor = "H1";
    fill("center");
  });
  paper.body.querySelector(".prev-page").addEventListener("click", () => fill("prev"));
  paper.body.querySelector(".next-page").addEventListener("click", () => fill("next"));
  const onlyUsed = paper.body.querySelector(".only-used");
  onlyUsed.addEventListener("click", () => {
    paper.lex.used = !paper.lex.used;
    onlyUsed.classList.toggle("on", paper.lex.used);
    onlyUsed.textContent = paper.lex.used ? "In Genesis" : "All numbers";
    paper.lex.cursor = "H0";
    fill("next");
  });
  paper.body.querySelector(".lex-q").addEventListener("change", (ev) => {
    paper.lex.q = ev.target.value.trim();
    fill("center");
  });
  fill("next");
}

function blankCab() {
  return {
    list: [],
    stem: null,
    title: "",
    body: "",
    folder: "_root",
    tags: "CONCOR,CAB,JX",
    rev: 0,
    verse: "",
    chapter: "",
    index: "",
  };
}

function fillCabEditor(paper) {
  const cab = paper.cab;
  paper.body.querySelector(".cab-title").value = cab.title || "";
  paper.body.querySelector(".cab-body").value = cab.body || "";
  const where = cab.verse || (cab.chapter ? "Genesis " + cab.chapter : "");
  paper.body.querySelector(".cab-meta").textContent = cab.stem
    ? `${cab.stem} · rev ${cab.rev || 1} · ${cab.folder || "_root"}${where ? " · " + where : ""}`
    : "new paper";
}

function paintCabList(paper) {
  const host = paper.body.querySelector(".cab-items");
  const list = paper.cab.list || [];
  if (!list.length) {
    host.innerHTML = `<div class="cab-empty">empty drawer · + new</div>`;
    return;
  }
  host.innerHTML = list.map((item) => (
    `<button type="button" class="cab-item${item.stem === paper.cab.stem ? " is-on" : ""}" data-stem="${escapeHtml(item.stem)}">` +
    `<span class="cab-item-title">${escapeHtml(item.title)}</span>` +
    `<span class="cab-item-meta">${escapeHtml(item.folder || "_root")} · r${item.rev || 1}</span></button>`
  )).join("");
}

async function loadCabList(paper) {
  const data = await api("/api/journal");
  paper.cab.list = data.entries || [];
  paintCabList(paper);
}

async function openCabStem(paper, stem) {
  const doc = await api("/api/journal?stem=" + encodeURIComponent(stem));
  paper.cab = {
    ...paper.cab,
    stem: doc.stem,
    title: doc.title || "",
    body: doc.body || "",
    folder: doc.folder || "_root",
    tags: doc.tags || "",
    rev: doc.rev || 1,
    verse: doc.verse || "",
    chapter: doc.chapter || "",
    index: doc.index || "",
  };
  fillCabEditor(paper);
  paintCabList(paper);
}

async function saveCab(paper) {
  const cab = paper.cab;
  const saved = await api("/api/journal", {
    method: "PUT",
    body: JSON.stringify({
      stem: cab.stem,
      title: cab.title,
      body: cab.body,
      folder: cab.folder || "_root",
      tags: cab.tags || "",
      verse: cab.verse || "",
      chapter: cab.chapter || "",
      index: cab.index || "",
    }),
  });
  const entry = saved.entry;
  paper.cab.stem = entry.stem;
  paper.cab.rev = entry.rev;
  paper.cab.title = entry.title;
  paper.cab.body = entry.body ?? paper.cab.body;
  fillCabEditor(paper);
  await loadCabList(paper);
}

function buildCab(paper) {
  paper.body.innerHTML =
    `<div class="cab-layout">` +
    `<div class="cab-list"><div class="cab-list-head"><span>Papers</span>` +
    `<button type="button" class="cab-new">+ new</button>` +
    `<button type="button" class="cab-refresh" title="refresh">↻</button></div>` +
    `<div class="cab-items"></div></div>` +
    `<div class="cab-edit"><label class="kicker">title</label>` +
    `<input class="cab-title" placeholder="title" />` +
    `<p class="cab-meta"></p>` +
    `<label class="kicker">body</label>` +
    `<textarea class="cab-body" placeholder="write the paper"></textarea>` +
    `<div class="cab-foot"><button type="button" class="cab-save">Save</button>` +
    `<span class="cab-hint">markdown in the journal</span></div></div></div>`;
  const title = paper.body.querySelector(".cab-title");
  const body = paper.body.querySelector(".cab-body");
  title.addEventListener("input", () => { paper.cab.title = title.value; });
  body.addEventListener("input", () => { paper.cab.body = body.value; });
  paper.body.querySelector(".cab-new").addEventListener("click", () => {
    const place = state.place;
    paper.cab = {
      ...paper.cab,
      stem: null,
      title: "brief",
      body: "",
      folder: "_root",
      tags: "CONCOR,CAB,JX",
      rev: 0,
      verse: place.verse,
      chapter: place.chapter,
      index: place.index,
    };
    fillCabEditor(paper);
    paintCabList(paper);
    title.focus();
  });
  paper.body.querySelector(".cab-refresh").addEventListener("click", () => loadCabList(paper));
  paper.body.querySelector(".cab-save").addEventListener("click", () => saveCab(paper));
  paper.body.querySelector(".cab-items").addEventListener("click", (ev) => {
    const row = ev.target.closest("[data-stem]");
    if (row) openCabStem(paper, row.dataset.stem);
  });
  fillCabEditor(paper);
}

async function openJournal() {
  const paper = makePaper("journal", "journal", "Cabinet", "book");
  paper.el.classList.add("cab");
  if (!paper.cab) paper.cab = blankCab();
  if (!paper.body.querySelector(".cab-layout")) buildCab(paper);
  await loadCabList(paper);
  snapshot();
}

document.getElementById("open-gen").addEventListener("click", () => openGenesis());
document.getElementById("open-lex").addEventListener("click", () => openLexicon());
async function openWeaks() {
  const paper = makePaper("weaks", "book", "Weak's");
  paper.meta = {};
  const data = await api("/api/weaks");
  paper.body.innerHTML =
    `<p class="kicker">Only the pieces you have numbered.</p>` +
    `<div class="frag-add"><input class="mint-surface" placeholder="letters" /><input class="mint-weak" placeholder="weak number" /><input class="mint-title" placeholder="name" /><button type="button" class="mint-add">Add</button></div>` +
    `<div class="weak-list"></div>`;
  const list = paper.body.querySelector(".weak-list");
  list.innerHTML = (data.items || []).map((item) => (
    `<button type="button" class="lex-row weak-row" data-where="${item.where}" data-chapter="${escapeHtml(item.chapter || "")}" data-verse-n="${escapeHtml(item.verse_n || "")}" data-index="${escapeHtml(item.index || "")}">` +
    `<span class="id">${escapeHtml(item.weak)}</span> <span class="heb">${escapeHtml(item.surface)}</span> ${escapeHtml(item.title || item.verse || "")}</button>`
  )).join("") || "<p>None numbered yet.</p>";
  paper.body.querySelector(".mint-add").addEventListener("click", async () => {
    await api("/api/mint", {
      method: "PUT",
      body: JSON.stringify({
        surface: paper.body.querySelector(".mint-surface").value,
        weak: paper.body.querySelector(".mint-weak").value,
        title: paper.body.querySelector(".mint-title").value,
      }),
    });
    closePaper("weaks");
    openWeaks();
  });
  list.addEventListener("click", async (ev) => {
    const row = ev.target.closest(".weak-row");
    if (!row || row.dataset.where !== "verse") return;
    const chapter = Number(row.dataset.chapter);
    const verseN = Number(row.dataset.verseN);
    const ch = await api("/api/chapter?n=" + chapter);
    const verse = (ch.verses || []).find((v) => v.verse === verseN);
    const word = verse && verse.words[Number(row.dataset.index)];
    if (word) {
      await openBook(chapter);
      openWord(chapter, verseN, word);
    }
  });
  snapshot();
}

document.getElementById("open-journal").addEventListener("click", () => openJournal());
document.getElementById("open-weak").addEventListener("click", () => openWeaks());
document.getElementById("toggle-keys").addEventListener("click", () => {
  document.getElementById("heb-board").hidden = false;
});
document.getElementById("heb-hide").addEventListener("click", (ev) => {
  ev.stopPropagation();
  document.getElementById("heb-board").hidden = true;
});
document.getElementById("close-desk").addEventListener("click", () => {
  for (const [id, paper] of [...papers.entries()]) {
    if (!paper.el.hidden) closePaper(id);
  }
});

function paintKeys() {
  document.getElementById("heb-keys").innerHTML = HEB.map(([glyph, name]) => {
    const shown = state.finals && HEB_FINAL[glyph] ? HEB_FINAL[glyph] : glyph;
    const label = FINAL_NAME[shown] || name;
    return `<button type="button" data-glyph="${shown}"><span class="glyph">${shown}</span><span class="name">${label}</span></button>`;
  }).join("");
  document.getElementById("heb-finals").classList.toggle("on", state.finals);
}
function typeGlyph(glyph) {
  const el = state.focus;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.value = el.value.slice(0, start) + glyph + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + glyph.length;
  el.focus();
}
document.getElementById("heb-keys").addEventListener("mousedown", (ev) => ev.preventDefault());
document.getElementById("heb-keys").addEventListener("click", (ev) => {
  const key = ev.target.closest("button");
  if (key) typeGlyph(key.dataset.glyph);
});
document.getElementById("heb-finals").addEventListener("mousedown", (ev) => ev.preventDefault());
document.getElementById("heb-finals").addEventListener("click", () => { state.finals = !state.finals; paintKeys(); });
document.getElementById("heb-back").addEventListener("mousedown", (ev) => ev.preventDefault());
document.getElementById("heb-back").addEventListener("click", () => {
  const el = state.focus;
  if (!el) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  if (start === end && start > 0) {
    el.value = el.value.slice(0, start - 1) + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start - 1;
  } else {
    el.value = el.value.slice(0, start) + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start;
  }
  el.focus();
});
document.addEventListener("focusin", (ev) => {
  if (ev.target.matches("textarea, input")) state.focus = ev.target;
});
let hebDrag = null;
document.getElementById("heb-drag").addEventListener("pointerdown", (ev) => {
  const board = document.getElementById("heb-board");
  hebDrag = { dx: ev.clientX - board.offsetLeft, dy: ev.clientY - board.offsetTop };
  ev.target.setPointerCapture(ev.pointerId);
});
document.getElementById("heb-drag").addEventListener("pointermove", (ev) => {
  if (!hebDrag) return;
  const board = document.getElementById("heb-board");
  board.style.left = (ev.clientX - hebDrag.dx) + "px";
  board.style.top = (ev.clientY - hebDrag.dy) + "px";
  board.style.bottom = "auto";
});
document.getElementById("heb-drag").addEventListener("pointerup", () => { hebDrag = null; });
const hover = document.createElement("div");
hover.id = "chip-hover";
hover.hidden = true;
document.body.appendChild(hover);
document.addEventListener("mouseover", (ev) => {
  const chip = ev.target.closest(".chip");
  if (!chip) return;
  const tip = chip.querySelector(".tip");
  if (!tip || !tip.textContent.trim()) return;
  hover.innerHTML = tip.innerHTML;
  hover.hidden = false;
  const rect = chip.getBoundingClientRect();
  const width = Math.min(288, window.innerWidth - 16);
  hover.style.width = width + "px";
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  if (left < 8) left = 8;
  hover.style.left = left + "px";
  let top = rect.top - hover.offsetHeight - 6;
  if (top < 8) top = Math.min(rect.bottom + 6, window.innerHeight - hover.offsetHeight - 8);
  hover.style.top = Math.max(8, top) + "px";
});
document.addEventListener("mouseout", (ev) => {
  const chip = ev.target.closest(".chip");
  if (!chip || chip.contains(ev.relatedTarget)) return;
  hover.hidden = true;
});
paintKeys();
bindResize(document.getElementById("heb-board"));
restore();

async function restore() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("emb-desk") || "null"); } catch { saved = null; }
  if (!saved || !saved.items || !saved.items.length) {
    openBook(1);
    return;
  }
  state.restoring = true;
  for (const item of saved.items) {
    const meta = item.meta || {};
    if (item.id === "journal") await openJournal();
    else if (item.id === "weaks") await openWeaks();
    else if (item.id === "lexicon") await openLexicon();
    else if (item.id === "genesis-pick") openGenesis();
    else if (item.id.startsWith("book:")) await openBook(meta.chapter);
    else if (item.id.startsWith("strong:")) await openStrong(meta.strongId);
    else if (item.id.startsWith("line:")) {
      const ch = await api("/api/chapter?n=" + meta.chapter);
      const verse = (ch.verses || []).find((v) => v.verse === meta.verseN);
      if (verse) await openLine(meta.chapter, verse);
    } else if (item.id.startsWith("word:")) {
      const ch = await api("/api/chapter?n=" + meta.chapter);
      const verse = (ch.verses || []).find((v) => v.verse === meta.verseN);
      const word = verse && verse.words[meta.index];
      if (word) await openWord(meta.chapter, meta.verseN, word);
    }
    const paper = papers.get(item.id);
    if (!paper) continue;
    if (item.left) paper.el.style.left = item.left;
    if (item.top) paper.el.style.top = item.top;
    if (item.width) paper.el.style.width = item.width;
    if (item.height) paper.el.style.height = item.height;
    if (item.shelved) shelve(item.id);
  }
  state.restoring = false;
  if (saved.activeId && papers.has(saved.activeId)) setActive(saved.activeId);
  snapshot();
}
