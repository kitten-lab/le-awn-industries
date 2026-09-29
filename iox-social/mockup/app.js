const BAYS = [
  ["video", "Video"],
  ["articles", "Articles"],
  ["music", "Music"],
  ["games", "Games"],
  ["galleries", "Galleries"],
  ["rooms", "Rooms"],
];

const PEOPLE = {
  me: { id: "me", name: "Rowan Hale", line: "I read here. The feed is only what I asked for. This page is the room I keep.", skin: "paper", alt: "hale-prints" },
  "hale-prints": { id: "hale-prints", name: "Hale Prints", line: "A secondary profile for one project: paper, folded and numbered.", skin: "ticket", thin: true, parent: "me" },
  june: { id: "june", name: "June Voss", line: "Four parts about a haircut that left the bathroom. If you are new, start at the kitchen.", skin: "ink", alt: "voss-pictures", pins: ["hair-1", "hair-3", "hair-4"] },
  "voss-pictures": { id: "voss-pictures", name: "Voss Pictures", line: "The hair films as a project, apart from June’s own page.", skin: "ticket", thin: true, parent: "june", pins: ["hair-4"] },
  pell: { id: "pell", name: "I. Pell", line: "Letters from a dry dock, and essays that are not in the set.", pins: ["dock-1", "dock-4", "pell-essay"] },
  marlow: { id: "marlow", name: "Marlow Key", line: "Records in ones and twos. The release is the piece.", pins: ["second-bell", "first-weather"] },
  otto: { id: "otto", name: "Otto Glass", line: "Galleries of rooms after people have gone.", pins: ["after", "stairs"] },
  sable: { id: "sable", name: "Sable Cart", line: "Small games about carrying something to the wrong counter.", pins: ["errand-1", "errand-2", "lamp"] },
  ned: { id: "ned", name: "Ned Carr", line: "Short films in kitchens after the service is over.", pins: ["kit-1", "kit-3"] },
  remy: { id: "remy", name: "Remy Sol", line: "Short films that look a lot like the one you just finished." },
  noor: { id: "noor", name: "Noor Vale", line: "Clips from the same few streets." },
  ada: { id: "ada", name: "Ada Quinn", line: "Mostly here to keep a room and sit in it." },
};

const CHANNELS = [
  { id: "june-video", person: "june", bay: "video", name: "Films" },
  { id: "ned-video", person: "ned", bay: "video", name: "Films" },
  { id: "remy-video", person: "remy", bay: "video", name: "Films" },
  { id: "noor-video", person: "noor", bay: "video", name: "Films" },
  { id: "pell-articles", person: "pell", bay: "articles", name: "Writing" },
  { id: "marlow-music", person: "marlow", bay: "music", name: "Records" },
  { id: "otto-galleries", person: "otto", bay: "galleries", name: "Sets" },
  { id: "sable-games", person: "sable", bay: "games", name: "Shelf" },
  { id: "me-video", person: "me", bay: "video", name: "Films" },
  { id: "me-articles", person: "me", bay: "articles", name: "Writing" },
  { id: "me-music", person: "me", bay: "music", name: "Records" },
  { id: "me-games", person: "me", bay: "games", name: "Shelf" },
  { id: "me-galleries", person: "me", bay: "galleries", name: "Sets" },
];

const WORKS = [
  { id: "hair-1", bay: "video", channel: "june-video", person: "june", series: "her-hair", seriesTitle: "Her Hair Was Insane", part: 1, title: "The Kitchen Light", date: "2026-06-02", runtime: "12 min", blurb: "She cuts it at the sink. The kitchen light is the whole room.", still: "A sink, a coil of dark hair, a bulb too close to the lens." },
  { id: "hair-2", bay: "video", channel: "june-video", person: "june", series: "her-hair", seriesTitle: "Her Hair Was Insane", part: 2, title: "Rain on the Part", date: "2026-07-14", runtime: "9 min", blurb: "The cut is already uneven. Rain finds the part she missed.", still: "Wet pavement, a hood half up, the part showing pale at the crown." },
  { id: "hair-3", bay: "video", channel: "june-video", person: "june", series: "her-hair", seriesTitle: "Her Hair Was Insane", part: 3, title: "She Cut It Over the Sink", date: "2026-08-19", runtime: "14 min", blurb: "A second cut, in a different sink, trying to make the first one make sense.", still: "Scissors on porcelain. The drain is the subject." },
  { id: "hair-4", bay: "video", channel: "june-video", person: "june", series: "her-hair", seriesTitle: "Her Hair Was Insane", part: 4, title: "The Station", date: "2026-09-26", runtime: "11 min", blurb: "She arrives already cut. The station clock is wrong.", still: "Fluorescent station, hair on the tile, a coat over one arm." },
  { id: "kit-1", bay: "video", channel: "ned-video", person: "ned", series: "closed-kitchens", seriesTitle: "Closed Kitchens", part: 1, title: "After Service", date: "2026-05-01", runtime: "8 min", blurb: "The pass is dark. Someone is still plating for no one.", still: "A steel counter and one warm lamp in the pass." },
  { id: "kit-2", bay: "video", channel: "ned-video", person: "ned", series: "closed-kitchens", seriesTitle: "Closed Kitchens", part: 2, title: "The Second Shift", date: "2026-07-20", runtime: "10 min", blurb: "The night cook arrives to a kitchen that was not cleaned.", still: "A mop bucket, a ticket spike, no faces." },
  { id: "kit-3", bay: "video", channel: "ned-video", person: "ned", series: "closed-kitchens", seriesTitle: "Closed Kitchens", part: 3, title: "Who Left the Light", date: "2026-09-25", runtime: "7 min", blurb: "The light is the only character who stays for the whole set.", still: "A doorway, the light left on, the street blue behind it." },
  { id: "coat-1", bay: "video", channel: "remy-video", person: "remy", series: "same-coat", seriesTitle: "Same Coat", part: 1, title: "The First Block", date: "2026-06-18", runtime: "6 min", blurb: "She does not take the coat off.", still: "A wool coat, a crosswalk, morning." },
  { id: "coat-2", bay: "video", channel: "remy-video", person: "remy", series: "same-coat", seriesTitle: "Same Coat", part: 2, title: "She Kept It On", date: "2026-08-02", runtime: "5 min", blurb: "Same coat, hotter day.", still: "The coat over an arm, a bus stop, noon glare." },
  { id: "coat-3", bay: "video", channel: "remy-video", person: "remy", series: "same-coat", seriesTitle: "Same Coat", part: 3, title: "Night Bus", date: "2026-09-21", runtime: "8 min", blurb: "The coat is the only thing you can recognize.", still: "Night bus window, the coat collar, interior lights." },
  { id: "lane-1", bay: "video", channel: "noor-video", person: "noor", series: "the-lane", seriesTitle: "The Lane", part: 1, title: "Corner", date: "2026-07-09", runtime: "4 min", blurb: "A corner you have already seen.", still: "Wet brick, one streetlamp, no one in the lane." },
  { id: "lane-2", bay: "video", channel: "noor-video", person: "noor", series: "the-lane", seriesTitle: "The Lane", part: 2, title: "The Lane Again", date: "2026-09-19", runtime: "4 min", blurb: "The same corner, later.", still: "The same brick, the lamp out, a bicycle." },
  { id: "mirror", bay: "video", channel: "remy-video", person: "remy", title: "Pocket Mirror", date: "2026-09-12", runtime: "3 min", blurb: "A single clip. Not part of a series.", still: "A hand, a small mirror, a hallway." },
  { id: "train", bay: "video", channel: "noor-video", person: "noor", title: "After the Train", date: "2026-08-28", runtime: "5 min", blurb: "A single clip from the platform.", still: "Platform edge, coats, a departing train." },
  { id: "pass", bay: "video", channel: "ned-video", person: "ned", title: "Pass Window", date: "2026-09-03", runtime: "2 min", blurb: "Not part of Closed Kitchens.", still: "The pass window from the dining room, one plate." },
  { id: "sink", bay: "video", channel: "june-video", person: "june", title: "A Minute of Sink", date: "2026-09-15", runtime: "1 min", blurb: "A one-off. The hair films are a different series.", still: "Running water, no scissors, the same bulb." },
  { id: "dock-1", bay: "articles", channel: "pell-articles", person: "pell", series: "dry-dock", seriesTitle: "Letters from the Dry Dock", part: 1, form: "letter", title: "The Key Still Turns", date: "2026-05-12", length: "9 min read", subjects: ["harbors", "keys"], blurb: "The lock still answers, which is not the same as the boat being yours.", text: ["The key still turns. I want that on the record before I tell you about the money, because the money makes it sound as if the question were ownership. The lock answers. The hull does not care who paid for the answer.", "I am writing from the shed that faces the cradle. They have her up on blocks and the water is a rumor at the end of the lane. If you read these in order, stay with the key. The berth comes later, and it will not mean much if you skip the part where I still had a way in."] },
  { id: "dock-2", bay: "articles", channel: "pell-articles", person: "pell", series: "dry-dock", seriesTitle: "Letters from the Dry Dock", part: 2, form: "letter", title: "What the Slip Owed", date: "2026-06-30", length: "8 min read", subjects: ["debt", "harbors"], blurb: "A slip can owe you time the way a person owes you a sentence.", text: ["They posted the slip as vacant while my name was still on the nail. Vacant, here, means the harbor would like the sentence to be over. I copied the board into the notebook so I would stop editing it in my head."] },
  { id: "dock-3", bay: "articles", channel: "pell-articles", person: "pell", series: "dry-dock", seriesTitle: "Letters from the Dry Dock", part: 3, form: "letter", title: "Weather on the Account", date: "2026-08-08", length: "7 min read", subjects: ["weather", "debt"], blurb: "Rain is not a metaphor in a yard. It is a line item.", text: ["Three days of rain and the account grew a new row, because water on bare wood is work whether or not anyone asked for the work. I am trying to keep the weather in its own column so it does not pretend to be a moral."] },
  { id: "dock-4", bay: "articles", channel: "pell-articles", person: "pell", series: "dry-dock", seriesTitle: "Letters from the Dry Dock", part: 4, form: "letter", title: "A Berth You Can Keep", date: "2026-09-24", length: "11 min read", subjects: ["harbors", "weather"], blurb: "The last letter names a place that will still be there in the morning.", text: ["There is a berth at the far end that nobody’s cousin is saving. It is narrow and the fenders are tired and it will still be there in the morning. I am telling you this at the end on purpose. If you arrived here first, go back to the key."] },
  { id: "pell-essay", bay: "articles", channel: "pell-articles", person: "pell", form: "essay", title: "Catalogues for People Who Leave", date: "2026-09-11", length: "14 min read", subjects: ["catalogues", "leaving"], blurb: "An essay, outside the letters, on lists made by people who are already gone.", text: ["A catalogue made by someone who has left is a kind of room. The objects stay in the order of their attention, which is not the order of value, and not the order a shop would use.", "I keep these apart from the dock letters. The letters are a series. This is a single piece. The bay can tell the difference, so the feed can too."] },
  { id: "rowan-note", bay: "articles", channel: "me-articles", person: "me", form: "note", title: "What I Asked to See", date: "2026-09-01", length: "4 min read", subjects: ["feeds", "attention"], blurb: "A note on keeping a feed that only holds subscriptions.", text: ["I got tired of opening a place and being handed a pile I had not asked for. This note is the short version. The feed is a list of channels. The bays are where I go when I want something I do not already receive."] },
  { id: "rowan-margin", bay: "articles", channel: "me-articles", person: "me", form: "essay", title: "A Margin for the Station", date: "2026-08-12", length: "6 min read", subjects: ["stations", "reading"], blurb: "On reading a series beside the part you were sent.", text: ["When someone sends me part four, I want the margin to still hold part one. The station in June’s film is like that. You can arrive there, and you can also walk back to the kitchen without hunting the platform for a face that looks the same."] },
  { id: "second-bell", bay: "music", channel: "marlow-music", person: "marlow", title: "Second Bell", date: "2026-09-20", runtime: "18 min", blurb: "Five tracks. The release is the unit, not a post with a file on it.", hue: "#8a5a32", tracks: [["Opening", "2:10"], ["Low Room", "3:40"], ["Second Bell", "4:05"], ["A Door That Sticks", "3:12"], ["Last Weather", "4:44"]] },
  { id: "first-weather", bay: "music", channel: "marlow-music", person: "marlow", title: "First Weather", date: "2026-08-02", runtime: "9 min", blurb: "An earlier record. It stays on the sleeve beside the new one.", hue: "#3d5a73", tracks: [["First Weather", "3:02"], ["Platform", "2:48"], ["Coat", "3:16"]] },
  { id: "errand-1", bay: "games", channel: "sable-games", person: "sable", series: "pocket-errand", seriesTitle: "Pocket Errand", part: 1, title: "Pocket Errand", date: "2026-04-18", runtime: "one sitting", blurb: "Carry a key to a counter that has already closed.", beats: ["You are carrying one key. The counter is closed. A lamp is on in the back.", "You knock. Someone says: we closed for the part where you come back. This is part 1. Part 2 is on the shelf beside it.", "The key is stamped RETURN. It does not open this door."] },
  { id: "errand-2", bay: "games", channel: "sable-games", person: "sable", series: "pocket-errand", seriesTitle: "Pocket Errand", part: 2, title: "The Return Key", date: "2026-09-08", runtime: "one sitting", blurb: "The same key, the next sitting. The set stays together.", beats: ["You still have the key from part 1. The counter is open. The person at it recognizes the stamp.", "They trade you a lamp for the key. The errand is over. The set has two parts and both are on this shelf."] },
  { id: "lamp", bay: "games", channel: "sable-games", person: "sable", title: "Lamp Market", date: "2026-06-11", runtime: "one sitting", blurb: "A single game, not part of the errand set.", beats: ["A market of lamps, none of them lit. You may light one.", "You light the smallest. The others stay dark, which is the whole game."] },
  { id: "after", bay: "galleries", channel: "otto-galleries", person: "otto", title: "After the Reception", date: "2026-09-18", blurb: "Eight pictures, one set. The feed keeps them together.", frames: ["The long table, cleared once", "A glass with a lipstick edge", "Coats still on the bed", "The kitchen light left on", "Flowers in the sink", "A chair pulled out and not returned", "The street from the stair window", "The door, from the inside"] },
  { id: "stairs", bay: "galleries", channel: "otto-galleries", person: "otto", title: "Stairs, Three Buildings", date: "2026-08-30", blurb: "One gallery across three stairwells.", frames: ["Building A, second landing", "Building A, the skylight", "Building B, tile and a red rail", "Building B, the door that sticks", "Building C, carpet worn to the tack", "Building C, from the top looking down"] },
  { id: "rowan-desk", bay: "galleries", channel: "me-galleries", person: "me", title: "Desk, Winter", date: "2026-07-02", blurb: "Six frames of one desk.", frames: ["Morning, before the lamp", "The notebook open", "A cup ring", "The window gone white", "Scissors", "The lamp, finally"] },
];

const ROOMS = [
  { id: "night-table", channel: "room-night", name: "The Night Table", host: "ada", line: "For whatever you just watched or read.", occupants: ["june", "pell", "ned", "ada"], talk: [{ who: "june", text: "Part IV is the station. If you want it in order, start at the kitchen." }, { who: "pell", text: "I am still on letter two. Do not tell me about the berth." }] },
  { id: "map-club", channel: "room-map", name: "Map Club", host: "ned", line: "A room for places. Empty at the moment.", occupants: [], talk: [] },
  { id: "open-notebook", channel: "room-notebook", name: "Open Notebook", host: "sable", line: "Someone is usually writing in the margin.", occupants: ["otto", "sable"], talk: [{ who: "otto", text: "The reception gallery is a set. Don’t pull the glass out on its own." }, { who: "sable", text: "Noted. I am still carrying the key." }] },
];

const state = {
  subs: new Set(["june-video", "pell-articles", "marlow-music", "otto-galleries", "room-night", "room-map"]),
  follows: new Set(["june"]),
  alerts: new Set(),
  search: "",
  articleForm: "all",
  skin: "paper",
  pages: ["Front", "Notes"],
  page: "Front",
  arrange: false,
  customPages: { Notes: "A page you added. It can hold writing that is not a post." },
  pins: ["rowan-note", "rowan-desk", "rowan-margin"],
  pinNote: "",
  blocks: [
    { id: "intro", kind: "intro", x: 0, y: 0, w: 440 },
    { id: "pins", kind: "pins", x: 464, y: 0, w: 400 },
    { id: "channels", kind: "channels", x: 0, y: 270, w: 440 },
    { id: "alt", kind: "alt", x: 464, y: 270, w: 400 },
    { id: "run", kind: "run", x: 0, y: 520, w: 864 },
  ],
  play: null,
  beat: 0,
  make: { title: "", series: "", part: "", form: "essay", tracks: "", frames: "6", room: "" },
  makeError: "",
};

let lastPerson = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function partsNow() {
  const raw = (location.hash || "#feed").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  return parts.length ? parts : ["feed"];
}

function person(id) { return PEOPLE[id]; }

function work(id) { return WORKS.find((w) => w.id === id); }

function seriesParts(seriesId) {
  return WORKS.filter((w) => w.series === seriesId).sort((a, b) => a.part - b.part);
}

function roman(n) {
  const map = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return map[n] || String(n);
}

function prettyDate(iso) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [y, m, d] = iso.split("-").map(Number);
  return months[m - 1] + " " + d + ", " + y;
}

function bayName(id) {
  const found = BAYS.find((b) => b[0] === id);
  return found ? found[1] : id;
}

function personLink(id) {
  const p = person(id);
  if (!p) return "";
  return `<a class="who" href="#person/${p.id}">${esc(p.name)}</a>`;
}

function subButton(channelId) {
  const on = state.subs.has(channelId);
  const label = on ? "Subscribed" : "Subscribe";
  return `<button class="primary${on ? " on" : ""}" data-act="sub" data-id="${esc(channelId)}">${label}</button>`;
}

function followButton(id) {
  if (!id || id === "me") return "";
  const on = state.follows.has(id);
  return `<button class="primary${on ? " on" : ""}" data-act="follow" data-id="${esc(id)}">${on ? "Following" : "Follow"}</button>`;
}

function feedModel() {
  const seen = new Set();
  const works = [];
  const mine = WORKS.filter((w) => state.subs.has(w.channel)).sort((a, b) => b.date.localeCompare(a.date) || (b.part || 0) - (a.part || 0));
  for (const item of mine) {
    if (item.series) {
      if (seen.has(item.series)) continue;
      seen.add(item.series);
      works.push({ kind: "series", work: item });
    } else {
      works.push({ kind: "work", work: item });
    }
  }
  const rooms = ROOMS.filter((r) => state.subs.has(r.channel));
  const active = rooms.filter((r) => r.occupants.length > 0).map((room) => ({ kind: "room", room }));
  const inactive = rooms.filter((r) => r.occupants.length === 0).map((room) => ({ kind: "room", room }));
  return [...active, ...works, ...inactive];
}

function hrefFor(w) {
  if (w.series) return `#${w.bay}/${w.series}/${w.part}`;
  if (w.bay === "music" || w.bay === "games" || w.bay === "galleries") return `#${w.bay}/${w.id}`;
  if (w.bay === "articles") return `#articles/w/${w.id}`;
  if (w.bay === "video") return `#video/w/${w.id}`;
  return `#${w.bay}/${w.id}`;
}

function partPhrase(w) {
  const all = w.series ? seriesParts(w.series) : [w];
  const total = all.length;
  if (w.bay === "articles") return `Letter ${w.part} of ${total}`;
  if (w.bay === "games") return `Part ${w.part} of ${total}`;
  return `Part ${roman(w.part)} of ${roman(total)}`;
}

function startPhrase(w) {
  if (w.bay === "articles") return "Read from the start";
  if (w.bay === "games") return "Start at part 1";
  return "Start at Part I";
}

function startHref(w) {
  const first = seriesParts(w.series)[0];
  return `#${w.bay}/${w.series}/${first.part}`;
}

function matches(w, q) {
  if (!q) return true;
  const blob = [w.title, w.seriesTitle, w.form, person(w.person).name, ...(w.subjects || [])].join(" ").toLowerCase();
  return blob.includes(q.toLowerCase());
}

function viewFeed() {
  const items = feedModel();
  const cards = items.length ? items.map(feedCard).join("") : `<p class="lede">Your feed is empty. The bays are where other people’s work lives. Subscribe to a channel and it arrives here.</p>`;
  return `<div class="column">
    <p class="kicker">Feed</p>
    <h1>What you asked for</h1>
    <p class="deck">Subscribed channels only. A series arrives as one card, with a way back to the start. A room arrives as ACTIVE when someone is in it, and INACTIVE when it is empty.</p>
    <p class="quiet">${state.subs.size} subscriptions</p>
    <div class="stack" id="feed-list">${cards}</div>
  </div>`;
}

function feedCard(item) {
  if (item.kind === "room") return roomCard(item.room);
  const w = item.work;
  if (item.kind === "series") {
    const all = seriesParts(w.series);
    const latest = all[all.length - 1];
    const open = hrefFor(latest);
    return `<article class="card" data-bay="${w.bay}" data-series="${esc(w.series)}">
      <div class="card-top"><span class="baytag">${esc(bayName(w.bay))}</span>${personLink(w.person)}</div>
      <h2><a href="${open}">${esc(w.seriesTitle)}</a></h2>
      <p class="lede">${esc(partPhrase(latest))} · ${esc(latest.title)}</p>
      <p>${esc(latest.blurb)}</p>
      <p class="meta">${esc(prettyDate(latest.date))}${latest.runtime ? " · " + esc(latest.runtime) : ""}</p>
      ${w.bay === "video" ? `<a class="feedstill" href="${open}" style="background:${stillBg(latest)}"></a>` : ""}
      <p class="actions"><a class="textlink" href="${open}">Open ${esc(partPhrase(latest))}</a>${latest.part !== 1 ? `<a class="textlink" href="${startHref(latest)}">${esc(startPhrase(latest))}</a>` : ""}</p>
    </article>`;
  }
  return `<article class="card" data-bay="${w.bay}">
    <div class="card-top"><span class="baytag">${esc(bayName(w.bay))}</span>${personLink(w.person)}</div>
    <h2><a href="${hrefFor(w)}">${esc(w.title)}</a></h2>
    ${w.bay === "video" ? `<a class="feedstill" href="${hrefFor(w)}" style="background:${stillBg(w)}"></a>` : ""}
    <p>${esc(w.blurb)}</p>
    <p class="meta">${esc(prettyDate(w.date))}${w.form ? " · " + esc(w.form) : ""}${w.runtime ? " · " + esc(w.runtime) : ""}</p>
  </article>`;
}

function roomCard(room) {
  const on = room.occupants.length > 0;
  const count = room.occupants.length;
  const sentence = on ? (count === 1 ? "1 person is in this room." : count + " people are in this room.") : "No one is in this room.";
  const names = on ? room.occupants.map(personLink).join(", ") : "Empty";
  return `<article class="card" data-bay="rooms" data-status="${on ? "active" : "inactive"}" data-room-id="${esc(room.id)}">
    <div class="card-top"><span class="lamp${on ? " on" : ""}"></span><span class="status${on ? " live" : ""}">${on ? "ACTIVE" : "INACTIVE"}</span><span class="baytag">Room</span></div>
    <h2><a href="#rooms/${room.id}">${esc(room.name)}</a></h2>
    <p class="lede">${sentence}</p>
    <p>${names}</p>
    <p class="actions"><a class="textlink" href="#rooms/${room.id}">Enter</a></p>
  </article>`;
}

function searchBox(placeholder) {
  return `<label class="search-label">Look<input class="search" id="bay-search" type="search" placeholder="${esc(placeholder)}" value="${esc(state.search)}"></label>`;
}

const VIDEO_SCROLL = ["hair-4", "coat-2", "kit-3", "lane-2", "mirror", "hair-2", "train", "kit-1", "coat-1", "sink", "hair-1", "pass", "lane-1", "coat-3", "kit-2", "hair-3"];

function stillBg(w) {
  let n = 0;
  const id = w.id || "x";
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i) * 19) % 360;
  return `radial-gradient(circle at 68% 32%, hsl(${(n + 36) % 360} 42% 46%), transparent 40%), linear-gradient(${n}deg, hsl(${n} 22% 16%), #070608 64%)`;
}

function videoOrder() {
  const ranked = VIDEO_SCROLL.map((id) => work(id)).filter(Boolean);
  const extra = WORKS.filter((w) => w.bay === "video" && !VIDEO_SCROLL.includes(w.id));
  return [...ranked, ...extra].filter((w) => matches(w, state.search));
}

function viewVideo(seriesId, partRaw) {
  const list = videoOrder();
  let focus = null;
  if (seriesId && seriesId !== "w") {
    const parts = seriesParts(seriesId);
    focus = parts.find((w) => w.part === Number(partRaw)) || parts[0] || null;
  } else if (seriesId === "w") focus = work(partRaw);
  if (focus && !list.some((w) => w.id === focus.id)) list.unshift(focus);
  if (!focus) focus = list[0] || null;
  const frames = list.map((w) => videoFrame(w, focus && w.id === focus.id)).join("");
  const thumbs = list.map((w) => `<button type="button" class="vthumb${focus && w.id === focus.id ? " on" : ""}" data-act="jump" data-id="${esc(w.id)}" style="background:${stillBg(w)}"><span>${w.series ? esc(roman(w.part)) + " · " : ""}${esc(w.title)}</span></button>`).join("");
  return `<div class="video-bay">
    <div class="viewer-wrap"><div class="viewer" id="viewer">${frames || "<p class='quiet'>No video by that name.</p>"}</div></div>
    <aside class="vside">
      ${searchBox("A title, a part, a person")}
      <div id="valerts"></div>
      <div id="vnow">${focus ? nowHtml(focus) : ""}</div>
      <p class="kicker">Wall</p>
      <div class="vwall">${thumbs}</div>
    </aside>
  </div>`;
}

function videoFrame(w, on) {
  const sticker = w.series ? `<span class="partsticker">${esc(roman(w.part))} / ${esc(roman(seriesParts(w.series).length))}</span>` : "";
  const seriesLine = w.series ? `<p class="vseries">${esc(w.seriesTitle)} · ${esc(partPhrase(w))}</p>` : `<p class="vseries">Single</p>`;
  const tools = w.series ? `<p class="actions">
      <button type="button" class="textlink" data-act="jump" data-id="${esc(seriesParts(w.series)[0].id)}">Start</button>
      <button type="button" class="textlink" data-act="jump" data-id="${esc(seriesParts(w.series).at(-1).id)}">Latest</button>
      <button type="button" class="ghost${state.alerts.has(w.series) ? " on" : ""}" data-act="alert" data-id="${esc(w.series)}">${state.alerts.has(w.series) ? "Alerting" : "Alert me"}</button>
    </p>` : "";
  return `<article class="vframe${on ? " on" : ""}" id="v-${esc(w.id)}" data-vid="${esc(w.id)}">
    <div class="vstill" style="background:${stillBg(w)}"></div>
    ${sticker}
    <span class="playmark" aria-hidden="true">▶</span>
    <div class="vshade">
      <div class="vwho">${personLink(w.person)}${followButton(w.person)}</div>
      <h2>${esc(w.title)}</h2>
      ${seriesLine}
      <p>${esc(w.blurb)}</p>
      <p class="quiet">${esc(w.runtime)} · ${esc(w.still)}</p>
      ${tools}
    </div>
  </article>`;
}

function nowHtml(w) {
  const alerts = [...state.alerts].map((id) => {
    const parts = seriesParts(id);
    if (!parts.length) return "";
    return `<button type="button" class="textlink" data-act="jump" data-id="${esc(parts[0].id)}">${esc(parts[0].seriesTitle)}</button>`;
  }).filter(Boolean);
  const alertRow = `<div class="alertrow"><p class="kicker">Alerts</p>${alerts.length ? `<p class="quiet">You’ll be told when another part lands.</p><p class="actions">${alerts.join("")}</p>` : `<p class="quiet">None yet. Alert me sits on a series while you scroll.</p>`}</div>`;
  let series = `<p class="quiet">This one is a single. Nothing to track.</p>`;
  if (w.series) {
    const parts = seriesParts(w.series);
    const spine = parts.map((part) => `<button type="button" class="jump${part.id === w.id ? " on" : ""}" data-act="jump" data-id="${esc(part.id)}"><span class="partno">${esc(roman(part.part))}</span><span>${esc(part.title)}</span></button>`).join("");
    series = `<p class="kicker">${esc(w.seriesTitle)}</p>
      <p>${esc(partPhrase(w))} · ${personLink(w.person)}</p>
      <p class="actions">
        <button type="button" class="ghost" data-act="jump" data-id="${esc(parts[0].id)}">Start</button>
        <button type="button" class="ghost" data-act="jump" data-id="${esc(parts.at(-1).id)}">Latest</button>
        <button type="button" class="ghost${state.alerts.has(w.series) ? " on" : ""}" data-act="alert" data-id="${esc(w.series)}">${state.alerts.has(w.series) ? "Alerting" : "Alert me"}</button>
      </p>
      <div class="spine">${spine}</div>
      <p class="quiet">The parts stay listed here. In the scroll they are mixed in with everything else.</p>`;
  }
  return `${alertRow}
    <div class="nowcard">
      <h2>${esc(w.title)}</h2>
      <p class="actions">${followButton(w.person)}${subButton(w.channel)}</p>
      ${series}
    </div>`;
}

let watching = null;

function showNow(id) {
  watching = id;
  const w = work(id);
  const box = document.getElementById("vnow");
  if (!w || !box) return;
  const alerts = document.getElementById("valerts");
  const html = nowHtml(w);
  const splitAt = html.indexOf(`<div class="nowcard">`);
  if (alerts) alerts.innerHTML = html.slice(0, splitAt);
  box.innerHTML = html.slice(splitAt);
  document.querySelectorAll(".vthumb").forEach((el) => el.classList.toggle("on", el.dataset.id === id));
}

function jumpVideo(id) {
  const el = document.getElementById("v-" + id);
  const w = work(id);
  if (!el || !w) return;
  el.scrollIntoView({ block: "start" });
  history.replaceState(null, "", w.series ? `#video/${w.series}/${w.part}` : `#video/w/${w.id}`);
  showNow(id);
}

function syncFollow() {
  document.querySelectorAll("[data-act='follow']").forEach((btn) => {
    const on = state.follows.has(btn.dataset.id);
    btn.textContent = on ? "Following" : "Follow";
    btn.classList.toggle("on", on);
  });
}

function syncAlerts() {
  document.querySelectorAll("[data-act='alert']").forEach((btn) => {
    const on = state.alerts.has(btn.dataset.id);
    btn.textContent = on ? "Alerting" : "Alert me";
    btn.classList.toggle("on", on);
  });
}

function bindVideo() {
  const viewer = document.querySelector(".viewer");
  if (!viewer) return;
  const frames = [...viewer.querySelectorAll(".vframe")];
  if (!frames.length) return;
  const focus = frames.find((f) => f.classList.contains("on")) || frames[0];
  focus.scrollIntoView();
  showNow(focus.dataset.vid);
  const io = new IntersectionObserver((entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (hit && hit.intersectionRatio >= 0.6) showNow(hit.target.dataset.vid);
  }, { root: viewer, threshold: [0.6, 0.8] });
  frames.forEach((frame) => io.observe(frame));
}

function viewArticles(a, b) {
  const q = state.search;
  const forms = ["all", "letter", "essay", "note"];
  const chips = forms.map((f) => `<button class="chip${state.articleForm === f ? " on" : ""}" data-act="form" data-id="${f}">${f === "all" ? "All forms" : esc(f)}</button>`).join("");
  let current = null;
  if (a && a !== "w") {
    const parts = seriesParts(a);
    current = parts.find((w) => w.part === Number(b)) || parts[0] || null;
  } else if (a === "w") current = work(b);
  const list = WORKS.filter((w) => w.bay === "articles" && matches(w, q) && (state.articleForm === "all" || w.form === state.articleForm));
  const seriesIds = [];
  list.filter((w) => w.series).forEach((w) => { if (!seriesIds.includes(w.series)) seriesIds.push(w.series); });
  const seriesHtml = seriesIds.map((id) => {
    const parts = seriesParts(id).filter((w) => state.articleForm === "all" || w.form === state.articleForm);
    const head = parts[0];
    if (!head) return "";
    const rows = parts.map((w) => `<a class="${current && current.id === w.id ? "on" : ""}" href="#articles/${w.series}/${w.part}"><span class="partno">${w.part}</span><span>${esc(w.title)}</span></a>`).join("");
    return `<section class="series-block"><h2>${esc(head.seriesTitle)}</h2><p class="quiet">${personLink(head.person)} · ${esc(head.form)} · ${parts.length} parts</p><p><a class="textlink" href="#articles/${head.series}/1">${esc(startPhrase(head))}</a></p><div class="spine">${rows}</div></section>`;
  }).join("");
  const singles = list.filter((w) => !w.series).map((w) => `<a class="hit${current && current.id === w.id ? " on" : ""}" href="#articles/w/${w.id}"><span class="partno">${esc(w.form)}</span><span>${esc(w.title)}</span></a>`).join("");
  let right = `<p class="lede">Pick a letter, or read a series from the start. Form, series, and subjects stay attached to the piece.</p>`;
  if (current) {
    const subjects = (current.subjects || []).map((s) => `<button class="chip" data-act="find" data-id="${esc(s)}">${esc(s)}</button>`).join("");
    const paras = (current.text || [current.blurb]).map((p) => `<p>${esc(p)}</p>`).join("");
    const seriesBit = current.series ? `<p class="actions"><a class="textlink" href="${startHref(current)}">${esc(startPhrase(current))}</a></p>` : "";
    right = `<p class="kicker">${current.series ? esc(partPhrase(current)) : esc(current.form)}</p>
      <h1>${esc(current.title)}</h1>
      <p class="quiet">${current.seriesTitle ? esc(current.seriesTitle) + " · " : ""}${personLink(current.person)} · ${esc(current.length || "")} · ${esc(prettyDate(current.date))}</p>
      <div class="reader">${paras}</div>
      <p class="actions">${subjects}</p>
      ${seriesBit}
      <p class="actions">${subButton(current.channel)}</p>`;
  }
  return `<p class="kicker">Articles</p>
    <h1>One library, with the set intact</h1>
    <p class="deck">Written work lives here together. Series, form, and subjects are part of the piece, so a long set opens at the beginning.</p>
    ${searchBox("Title, maker, or subject")}
    <div class="row" style="margin-bottom:12px">${chips}</div>
    <div class="split"><div class="index">${seriesHtml}<h3>Outside a series</h3>${singles || "<p class='quiet'>Nothing in this form.</p>"}</div><div>${right}</div></div>`;
}

function viewMusic(id) {
  const records = WORKS.filter((w) => w.bay === "music" && matches(w, state.search)).sort((a, b) => b.date.localeCompare(a.date));
  const current = (id && work(id)) || records[0];
  if (!current) return `<p class="kicker">Music</p><h1>Records</h1><p>No release by that name.</p>${searchBox("Release or maker")}`;
  const tracks = current.tracks.map((t, i) => {
    const key = current.id + ":" + i;
    const on = state.play === key;
    return `<button class="track${on ? " on" : ""}" data-act="play" data-id="${esc(key)}"><span>${i + 1}</span><span>${esc(t[0])}</span><span>${esc(t[1])}</span></button>`;
  }).join("");
  const others = records.filter((w) => w.id !== current.id).map((w) => `<a class="sleeve small" style="--hue:${esc(w.hue)}" href="#music/${w.id}"><strong>${esc(w.title)}</strong><span>${esc(person(w.person).name)}</span></a>`).join("");
  return `<p class="kicker">Music</p>
    <h1>The release is the piece</h1>
    <p class="deck">A record opens as a sleeve and a track list. The feed announces the release. It does not scatter the tracks into posts.</p>
    ${searchBox("Release or maker")}
    <div class="record">
      <div class="sleeve" style="--hue:${esc(current.hue)}"><strong>${esc(current.title)}</strong><span>${esc(person(current.person).name)}</span></div>
      <div>
        <p class="quiet">${personLink(current.person)} · ${esc(prettyDate(current.date))} · ${esc(current.runtime)}</p>
        <p>${esc(current.blurb)}</p>
        <div>${tracks}</div>
        <p class="actions">${subButton(current.channel)}</p>
        <p class="quiet">${state.play && state.play.startsWith(current.id) ? "Playing on this page. No file is attached in the prototype." : "Choose a track. The player stays on the release."}</p>
      </div>
    </div>
    <div class="sleeve-row">${others}</div>`;
}

function viewGames(id) {
  const games = WORKS.filter((w) => w.bay === "games" && matches(w, state.search));
  const seriesIds = [];
  games.filter((w) => w.series).forEach((w) => { if (!seriesIds.includes(w.series)) seriesIds.push(w.series); });
  const sets = seriesIds.map((sid) => {
    const parts = seriesParts(sid);
    const boxes = parts.map((w) => gameBox(w, id)).join("");
    return `<section class="set"><h2>${esc(parts[0].seriesTitle)}</h2><p class="quiet">A set of ${parts.length}. Part 2 stays beside part 1.</p><div class="shelf">${boxes}</div></section>`;
  }).join("");
  const singles = games.filter((w) => !w.series).map((w) => gameBox(w, id)).join("");
  const current = id ? work(id) : null;
  let mat = "";
  if (current && current.bay === "games") {
    const beat = current.beats[Math.min(state.beat, current.beats.length - 1)];
    const choices = current.beats.map((text, i) => `<button data-act="beat" data-id="${i}">${i === 0 ? "Look again" : "Choice " + i}</button>`).join("");
    const sibling = current.series ? seriesParts(current.series).filter((w) => w.id !== current.id).map((w) => `<a class="textlink" href="#games/${w.id}">${esc(w.title)}</a>`).join(" ") : "";
    mat = `<div class="playmat"><p class="kicker">Playing · ${esc(current.title)}</p><p>${esc(beat)}</p><div class="choices">${choices}</div><p class="quiet">${sibling}</p><p class="actions">${subButton(current.channel)}</p></div>`;
  }
  return `<p class="kicker">Games</p>
    <h1>A shelf, then a place to play</h1>
    <p class="deck">A set stays together. Play happens in this bay, on a mat, not as a post you scroll past.</p>
    ${searchBox("Game or maker")}
    ${sets}
    <h2>Single games</h2>
    <div class="shelf">${singles || "<p>None.</p>"}</div>
    ${mat}`;
}

function gameBox(w, id) {
  return `<article class="box">
    <div>
      <div class="band"></div>
      <h3>${esc(w.title)}</h3>
      <p class="quiet">${personLink(w.person)}${w.series ? " · " + esc(partPhrase(w)) : ""}</p>
    </div>
    <p class="actions"><a class="primary${id === w.id ? " on" : ""}" href="#games/${w.id}">${id === w.id ? "On the mat" : "Play"}</a></p>
  </article>`;
}

function viewGalleries(id) {
  const sets = WORKS.filter((w) => w.bay === "galleries" && matches(w, state.search));
  const current = (id && work(id) && work(id).bay === "galleries") ? work(id) : null;
  const index = sets.map((w) => `<a class="hit${current && current.id === w.id ? " on" : ""}" href="#galleries/${w.id}"><span class="partno">${w.frames.length}</span><span>${esc(w.title)}</span></a>`).join("");
  let wall = `<p class="lede">A gallery is one object. Open it and the pictures stay in the set.</p>`;
  if (current) {
    const mats = current.frames.map((caption, i) => {
      const hue = 20 + i * 28;
      return `<figure class="mat"><div class="print" style="background:linear-gradient(${hue}deg,#d9cfc2,#8d8274 ${40 + i * 5}%,#2c2824)"></div><figcaption>${i + 1} · ${esc(caption)}</figcaption></figure>`;
    }).join("");
    wall = `<p class="kicker">${current.frames.length} pictures · one set</p><h1>${esc(current.title)}</h1><p class="quiet">${personLink(current.person)} · ${esc(prettyDate(current.date))}</p><p>${esc(current.blurb)}</p><p class="actions">${subButton(current.channel)}</p><div class="mats">${mats}</div>`;
  }
  return `<p class="kicker">Galleries</p>
    <h1>Pictures stay in the set</h1>
    <p class="deck">The feed names the gallery. This bay opens it as mats, in order, with a count.</p>
    ${searchBox("Gallery or maker")}
    <div class="split"><div class="index spine">${index || "<p>No gallery by that name.</p>"}</div><div>${wall}</div></div>`;
}

function viewRooms(id) {
  const q = state.search.toLowerCase();
  const list = ROOMS.filter((r) => !q || r.name.toLowerCase().includes(q) || person(r.host).name.toLowerCase().includes(q));
  const links = list.map((r) => {
    const on = r.occupants.length > 0;
    return `<a class="roomlink${r.id === id ? " on" : ""}" href="#rooms/${r.id}"><span class="lamp${on ? " on" : ""}"></span> <span class="status${on ? " live" : ""}">${on ? "ACTIVE" : "INACTIVE"}</span> · ${esc(r.name)}</a>`;
  }).join("");
  const room = ROOMS.find((r) => r.id === id);
  let interior = `<p class="lede">A room you subscribe to shows on your feed as ACTIVE or INACTIVE, depending on whether anyone is inside.</p>`;
  if (room) {
    const on = room.occupants.length > 0;
    const chairs = on ? room.occupants.map((pid) => `<li>${personLink(pid)}</li>`).join("") : `<li class="empty-chair">No one is here</li>`;
    const talk = room.talk.length ? room.talk.map((line) => `<p class="line"><span></span><span>${personLink(line.who)} — ${esc(line.text)}</span><span></span></p>`).join("") : `<p class="quiet">The room is quiet.</p>`;
    const sitting = room.occupants.includes("me");
    interior = `<p class="kicker"><span class="lamp${on ? " on" : ""}"></span> <span class="status${on ? " live" : ""}">${on ? "ACTIVE" : "INACTIVE"}</span></p>
      <h1>${esc(room.name)}</h1>
      <p>${esc(room.line)}</p>
      <p class="quiet">Kept by ${personLink(room.host)}</p>
      <ul class="chairs">${chairs}</ul>
      <div class="talk">${talk}</div>
      <p class="actions"><button class="primary" data-act="sit" data-id="${esc(room.id)}">${sitting ? "Stand up" : "Sit down"}</button>${subButton(room.channel)}</p>
      <p class="quiet">Talk stays in the room. The feed only carries whether the room is occupied.</p>`;
  }
  return `<p class="kicker">Rooms</p>
    <h1>Occupied, or not</h1>
    <p class="deck">You come here to be in a room. Subscribe, and your feed keeps a lamp for it.</p>
    ${searchBox("Room or keeper")}
    <div class="split"><div class="room-list">${links}</div><div>${interior}</div></div>`;
}

function viewMake(bay) {
  if (!bay) {
    const links = BAYS.map(([id, label]) => `<a href="#make/${id}"><span class="kicker">${esc(label)}</span><strong>Make for ${esc(label.toLowerCase())}</strong></a>`).join("");
    return `<p class="kicker">Make</p><h1>Which bay is this for?</h1><p class="deck">Making starts by choosing the kind of work. There is no general post.</p><div class="make-grid">${links}</div>`;
  }
  const label = bayName(bay);
  const err = state.makeError ? `<p class="err">${esc(state.makeError)}</p>` : "";
  let fields = "";
  if (bay === "rooms") {
    fields = `<label class="field"><span>Room name</span><input id="make-room" value="${esc(state.make.room)}" placeholder="A name people can enter"></label>
      <p class="quiet">Opening a room puts you in it, subscribes you, and sets the feed lamp to ACTIVE.</p>
      <button class="primary" data-act="publish" data-id="rooms">Open the room</button>`;
  } else {
    const extra = bay === "video" || bay === "games" || bay === "articles"
      ? `<label class="field"><span>Series</span><input id="make-series" value="${esc(state.make.series)}" placeholder="Leave blank for a single piece"></label>
         <label class="field"><span>Part</span><input id="make-part" value="${esc(state.make.part)}" inputmode="numeric" placeholder="1"></label>`
      : "";
    const form = bay === "articles"
      ? `<label class="field"><span>Form</span><select id="make-form"><option ${state.make.form === "essay" ? "selected" : ""}>essay</option><option ${state.make.form === "letter" ? "selected" : ""}>letter</option><option ${state.make.form === "note" ? "selected" : ""}>note</option></select></label>`
      : "";
    const tracks = bay === "music" ? `<label class="field"><span>Tracks</span><input id="make-tracks" value="${esc(state.make.tracks)}" placeholder="Opening, Low Room, Last Weather"></label>` : "";
    const frames = bay === "galleries" ? `<label class="field"><span>How many pictures</span><input id="make-frames" value="${esc(state.make.frames)}" inputmode="numeric"></label>` : "";
    fields = `<label class="field"><span>Title</span><input id="make-title" value="${esc(state.make.title)}"></label>${form}${extra}${tracks}${frames}
      <p class="quiet">This goes on your ${esc(label.toLowerCase())} channel and on your page. It lands on someone else’s feed only if they subscribe to that channel.</p>
      <button class="primary" data-act="publish" data-id="${esc(bay)}">Put it on your page</button>`;
  }
  return `<div data-make-bay="${esc(bay)}"><p class="kicker">Make · ${esc(label)}</p><h1>Make for ${esc(label.toLowerCase())}</h1>${err}${fields}<p><a class="textlink" href="#make">A different bay</a></p></div>`;
}

function viewPerson(id, mode) {
  const p = person(id);
  if (!p) return `<h1>No such page</h1><p><a href="#feed">Back to the feed</a></p>`;
  if (p.thin) return thinProfile(p);
  const owner = p.id === "me";
  const arranging = owner && (mode === "arrange" || state.arrange);
  const pages = owner ? state.pages : (p.id === "june" ? ["Front", "Series"] : ["Front"]);
  const tabs = pages.map((name) => `<button class="${state.page === name ? "on" : ""}" data-act="page" data-id="${esc(name)}">${esc(name)}</button>`).join("");
  const adder = owner ? `<div class="row add-page"><input id="new-page" placeholder="New page" aria-label="New page"><button type="button" class="ghost" data-act="add-page">Add page</button></div>` : "";
  const tools = owner ? `<div class="row">${arranging ? `<a class="ghost" href="#person/me">Done arranging</a>` : `<a class="ghost" href="#person/me/arrange">Arrange this page</a>`}${arranging ? swatchRow() : ""}</div>` : "";
  let body;
  if (state.page === "Front") body = profileCanvas(p, arranging);
  else if (p.id === "june" && state.page === "Series") body = `<article class="sheet reader"><p>Her Hair Was Insane is four parts. The kitchen, the rain, the second sink, the station. In the video bay they sit in the scroll with everything else. The side of the viewer keeps the parts in order, and you can ask to be told when another one lands.</p><p><a class="textlink" href="#video/her-hair/1">Open Part I in the viewer</a></p></article>`;
  else body = sheetPage(state.page, owner && arranging);
  const followNote = owner ? "" : `<p class="quiet">${state.follows.has(p.id) ? "Following. Subscribe to a channel below if you want their work on your feed." : "Follow keeps the person. Subscribe sends a channel to your feed."}</p>`;
  return `<p class="kicker">${owner ? "Your page" : "Profile"}</p>
    <div class="row spread"><div><h1>${esc(p.name)}</h1></div><div class="row">${followButton(p.id)}</div></div>
    ${followNote}
    ${tools}
    <div class="pages">${tabs}</div>
    ${adder}
    ${body}`;
}

function swatchRow() {
  return `<span class="quiet">Skin</span><span class="swatches">${["paper", "ink", "ticket"].map((s) => `<button class="swatch ${s}${state.skin === s ? " on" : ""}" data-act="skin" data-id="${s}" aria-label="${s}"></button>`).join("")}</span>`;
}

function sheetPage(name, editing) {
  const text = state.customPages[name] || "";
  if (editing) return `<div class="sheet"><p class="quiet">Visitors see this as a page, not as a post.</p><textarea id="page-body" data-page="${esc(name)}">${esc(text)}</textarea></div>`;
  const paras = (text || "This page is still empty.").split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("");
  return `<article class="sheet reader">${paras}</article>`;
}

function profileCanvas(p, arranging) {
  const blocks = p.id === "me" ? state.blocks : layoutFor(p);
  const html = blocks.map((block) => {
    const grip = p.id === "me" ? `<div class="grip">Move</div>` : "";
    return `<section class="block" data-block="${esc(block.id)}" style="left:${block.x}px;top:${block.y}px;width:${block.w}px">${grip}${blockBody(block, p)}</section>`;
  }).join("");
  const add = arranging ? `<p class="actions"><button class="ghost" data-act="add-block">Add a block</button></p>` : "";
  return `${add}<div class="canvas${arranging ? " arrange" : ""}">${html}</div>`;
}

function layoutFor(p) {
  return [
    { id: "intro", kind: "intro", x: 0, y: 0, w: 460 },
    { id: "pins", kind: "pins", x: 484, y: 0, w: 400 },
    { id: "channels", kind: "channels", x: 0, y: 300, w: 460 },
    { id: "alt", kind: "alt", x: 484, y: 300, w: 400 },
    { id: "run", kind: "run", x: 0, y: 560, w: 884 },
  ];
}

function blockBody(block, p) {
  const kind = block.kind;
  if (kind === "intro") return `<p class="kicker">About</p><p>${esc(p.line)}</p>`;
  if (kind === "pins") return pinBlock(p);
  if (kind === "run") return runBlock(p);
  if (kind === "channels") return channelBlock(p);
  if (kind === "alt") return altBlock(p);
  if (kind === "note") {
    if (p.id === "me" && state.arrange) return `<p class="kicker">Block</p><textarea data-note="${esc(block.id)}">${esc(block.text || "")}</textarea>`;
    return `<p class="kicker">Block</p><p>${esc(block.text || "")}</p>`;
  }
  return "";
}

function pinBlock(p) {
  const ids = p.id === "me" ? state.pins : (p.pins || []);
  const pins = ids.map((id) => work(id)).filter(Boolean);
  const items = pins.map((w) => `<a class="pin" href="${hrefFor(w)}"><strong>${esc(w.title)}</strong><span class="quiet">${esc(w.seriesTitle || bayName(w.bay))}</span></a>`).join("");
  const empty = 3 - pins.length;
  const slots = empty > 0 ? `<p class="quiet">${empty} pin ${empty === 1 ? "slot" : "slots"} open. A page holds three.</p>` : "";
  const note = p.id === "me" && state.pinNote ? `<p class="err">${esc(state.pinNote)}</p>` : "";
  return `<p class="kicker">Pinned</p>${items || "<p>Nothing pinned.</p>"}${slots}${note}`;
}

function runBlock(p) {
  const items = WORKS.filter((w) => w.person === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const rows = items.map((w) => {
    const pin = p.id === "me" ? `<button class="ghost" data-act="pin" data-id="${esc(w.id)}">${state.pins.includes(w.id) ? "Unpin" : "Pin"}</button>` : "";
    return `<p class="actions"><a class="textlink" href="${hrefFor(w)}">${esc(w.title)}</a><span class="quiet">${esc(prettyDate(w.date))} · ${esc(bayName(w.bay))}</span>${pin}</p>`;
  }).join("");
  const who = p.id === "me" ? "you have" : "they have";
  return `<p class="kicker">Running feed</p><p class="quiet">Everything ${who} published, newest first. On a person’s page a series is listed part by part.</p>${rows || "<p>Nothing published yet.</p>"}`;
}

function channelBlock(p) {
  const channels = CHANNELS.filter((c) => c.person === p.id);
  const rooms = ROOMS.filter((r) => r.host === p.id);
  const rows = channels.map((c) => `<p class="actions"><span>${esc(bayName(c.bay))} · ${esc(c.name)}</span>${p.id === "me" ? "" : subButton(c.id)}</p>`).join("");
  const roomRows = rooms.map((r) => `<p class="actions"><a class="textlink" href="#rooms/${r.id}">${esc(r.name)}</a><span class="quiet">Room</span>${subButton(r.channel)}</p>`).join("");
  const mine = p.id === "me" ? `<p class="quiet">These are the channels other people subscribe to. Your own work does not appear on your feed unless you subscribe to yourself.</p>` : "";
  return `<p class="kicker">Channels</p>${mine}${rows}${roomRows}`;
}

function altBlock(p) {
  if (!p.alt) return `<p class="kicker">Other profiles</p><p class="quiet">No secondary profile linked.</p>`;
  const alt = person(p.alt);
  return `<p class="kicker">Also</p><h3><a href="#person/${alt.id}">${esc(alt.name)}</a></h3><p>${esc(alt.line)}</p><p class="quiet">A second profile, tied to this one, for a project or another kind of work.</p>`;
}

function thinProfile(p) {
  const parent = person(p.parent);
  const ids = p.pins || [];
  const pins = ids.map((id) => work(id)).filter(Boolean).map((w) => `<a class="pin" href="${hrefFor(w)}"><strong>${esc(w.title)}</strong><span class="quiet">${esc(w.seriesTitle || "")}</span></a>`).join("");
  const edition = p.id === "hale-prints" ? `<a class="pin" href="#person/me"><strong>Edition 0</strong><span class="quiet">A folded sheet. Not a channel yet.</span></a>` : pins;
  return `<div class="thin">
    <p class="kicker">Secondary profile</p>
    <h1>${esc(p.name)}</h1>
    <p class="lede">Tied to ${personLink(parent.id)}.</p>
    <p>${esc(p.line)}</p>
    <p>This page can be sculpted the same way as a main profile — pages, three pins, blocks, a skin. For now it only shows the link, and one thing worth opening.</p>
    <h2>Pinned</h2>
    ${edition || "<p>Nothing pinned.</p>"}
    <p class="actions">${followButton(p.id)}<a class="textlink" href="#person/${parent.id}">Back to ${esc(parent.name)}</a></p>
  </div>`;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "piece";
}

function addRoom() {
  const title = state.make.room.trim();
  if (!title) { state.makeError = "A room needs a name."; return null; }
  state.makeError = "";
  let id = slug(title);
  if (ROOMS.some((r) => r.id === id)) id = id + "-" + Date.now();
  const room = { id, channel: "room-" + id, name: title, host: "me", line: "A room you just opened.", occupants: ["me"], talk: [] };
  ROOMS.push(room);
  state.subs.add(room.channel);
  state.make.room = "";
  return room;
}

function addWork(bay) {
  if (bay === "rooms") return addRoom();
  const title = state.make.title.trim();
  if (!title) { state.makeError = "A title is required."; return null; }
  state.makeError = "";
  const channel = "me-" + (bay === "articles" ? "articles" : bay);
  const seriesName = state.make.series.trim();
  let series = null;
  let seriesTitle = null;
  let part = null;
  if (seriesName && (bay === "video" || bay === "articles" || bay === "games")) {
    const owned = WORKS.find((w) => w.person === "me" && w.seriesTitle && w.seriesTitle.toLowerCase() === seriesName.toLowerCase());
    series = owned ? owned.series : slug(seriesName);
    seriesTitle = owned ? owned.seriesTitle : seriesName;
    const existing = seriesParts(series).filter((w) => w.person === "me");
    part = Number(state.make.part) || existing.length + 1;
  }
  const item = {
    id: "me-" + Date.now(),
    bay,
    channel,
    person: "me",
    title,
    date: "2026-09-28",
    blurb: "Just placed on your page.",
    series,
    seriesTitle,
    part,
  };
  if (bay === "video") {
    item.runtime = "0 min";
    item.still = "A frame you have not shot yet. The slot is here so the series can hold it.";
  }
  if (bay === "articles") {
    item.form = state.make.form || "essay";
    item.length = "1 min read";
    item.subjects = [];
    item.text = [title + " is on your page. The bay will file it by its form" + (seriesTitle ? " and under " + seriesTitle + "." : ".")];
  }
  if (bay === "music") {
    const names = state.make.tracks.split(",").map((t) => t.trim()).filter(Boolean);
    item.tracks = (names.length ? names : [title]).map((name, i) => [name, "0:30"]);
    item.runtime = item.tracks.length + " tracks";
    item.hue = "#6e4b3a";
    item.series = null;
  }
  if (bay === "games") {
    item.beats = ["A mat for " + title + ".", "The second beat is a placeholder, so the bay feels enterable."];
    item.runtime = "one sitting";
  }
  if (bay === "galleries") {
    const n = Math.max(1, Math.min(12, Number(state.make.frames) || 6));
    item.frames = Array.from({ length: n }, (_, i) => "Picture " + (i + 1));
    item.series = null;
  }
  WORKS.unshift(item);
  state.make.title = "";
  state.make.series = "";
  state.make.part = "";
  return item;
}

function render(parts) {
  const stage = document.getElementById("stage");
  const top = parts[0];
  const who = top === "person" ? person(parts[1]) : null;
  stage.dataset.room = top === "person" ? "profile" : top;
  if (who) stage.dataset.skin = who.id === "me" ? state.skin : (who.skin || "paper");
  else stage.dataset.skin = "";
  const [a, b, c] = [parts[1], parts[2], parts[3]];
  let html = "";
  if (top === "feed") html = viewFeed();
  else if (top === "video") html = viewVideo(a, b);
  else if (top === "articles") html = viewArticles(a, b);
  else if (top === "music") html = viewMusic(a);
  else if (top === "games") html = viewGames(a);
  else if (top === "galleries") html = viewGalleries(a);
  else if (top === "rooms") html = viewRooms(a);
  else if (top === "make") html = viewMake(a);
  else if (top === "person") html = viewPerson(a, b);
  else html = `<h1>That page is not here</h1><p><a href="#feed">Back to the feed</a></p>`;
  stage.innerHTML = html;
  const roomTitle = { feed: "Feed", make: "Make", profile: "Page" };
  document.title = "IOX · " + (who ? who.name : (roomTitle[top] || bayName(top)));
  paintRail(parts);
  bindDrag();
  bindVideo();
  void c;
}

function paintRail(parts) {
  const top = parts[0];
  document.querySelectorAll(".nav").forEach((a) => {
    const nav = a.dataset.nav;
    const on = nav === top || (nav === "me" && top === "person" && parts[1] === "me");
    a.classList.toggle("is-on", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function paint() { render(partsNow()); }

function onHash() {
  state.search = "";
  state.articleForm = "all";
  state.beat = 0;
  state.play = null;
  const parts = partsNow();
  if (parts[0] !== "person" || parts[1] !== lastPerson) {
    state.page = "Front";
    lastPerson = parts[0] === "person" ? parts[1] : null;
  }
  state.arrange = parts[0] === "person" && parts[1] === "me" && parts[2] === "arrange";
  paint();
}

function onClick(e) {
  const actEl = e.target.closest("[data-act]");
  if (!actEl) return;
  const act = actEl.dataset.act;
  const id = actEl.dataset.id;
  if (act === "add-page") e.preventDefault();
  if (act === "jump") { jumpVideo(id); return; }
  if (act === "alert") {
    state.alerts.has(id) ? state.alerts.delete(id) : state.alerts.add(id);
    if (watching) showNow(watching);
    syncAlerts();
    return;
  }
  if (act === "sub") state.subs.has(id) ? state.subs.delete(id) : state.subs.add(id);
  else if (act === "follow") {
    state.follows.has(id) ? state.follows.delete(id) : state.follows.add(id);
    if (document.querySelector(".viewer")) {
      syncFollow();
      if (watching) showNow(watching);
      return;
    }
  }
  else if (act === "form") state.articleForm = id;
  else if (act === "find") { state.search = id; }
  else if (act === "play") state.play = state.play === id ? null : id;
  else if (act === "beat") state.beat = Number(id);
  else if (act === "sit") {
    const room = ROOMS.find((r) => r.id === id);
    if (room.occupants.includes("me")) room.occupants = room.occupants.filter((pid) => pid !== "me");
    else room.occupants.push("me");
  } else if (act === "page") state.page = id;
  else if (act === "skin") state.skin = id;
  else if (act === "add-page") {
    const input = document.getElementById("new-page");
    const name = input ? input.value.trim() : "";
    if (name && !state.pages.includes(name)) {
      state.pages.push(name);
      state.customPages[name] = "";
      state.page = name;
    }
  } else if (act === "add-block") {
    state.blocks.push({ id: "note-" + Date.now(), kind: "note", x: 24, y: 640, w: 280, text: "A block you added." });
  } else if (act === "pin") {
    if (state.pins.includes(id)) {
      state.pins = state.pins.filter((pid) => pid !== id);
      state.pinNote = "";
    } else if (state.pins.length < 3) {
      state.pins.push(id);
      state.pinNote = "";
    } else state.pinNote = "Unpin one first. A page holds three.";
  } else if (act === "publish") {
    const made = addWork(id);
    if (!made) { paint(); return; }
    if (made.channel && String(made.channel).startsWith("room-")) location.hash = "#rooms/" + made.id;
    else location.hash = "#person/me";
    return;
  }
  paint();
}

function onInput(e) {
  const t = e.target;
  if (t.id === "bay-search") {
    const caret = t.selectionStart;
    state.search = t.value;
    paint();
    const again = document.getElementById("bay-search");
    if (again) { again.focus(); if (caret != null) again.setSelectionRange(caret, caret); }
    return;
  }
  if (t.id === "make-title") state.make.title = t.value;
  if (t.id === "make-series") state.make.series = t.value;
  if (t.id === "make-part") state.make.part = t.value;
  if (t.id === "make-form") state.make.form = t.value;
  if (t.id === "make-tracks") state.make.tracks = t.value;
  if (t.id === "make-frames") state.make.frames = t.value;
  if (t.id === "make-room") state.make.room = t.value;
  if (t.id === "page-body") state.customPages[t.dataset.page] = t.value;
  if (t.dataset.note) {
    const block = state.blocks.find((b) => b.id === t.dataset.note);
    if (block) block.text = t.value;
  }
}

function bindDrag() {
  document.querySelectorAll(".canvas.arrange .grip").forEach((grip) => {
    grip.addEventListener("pointerdown", (e) => {
      const blockEl = grip.closest(".block");
      const item = state.blocks.find((b) => b.id === blockEl.dataset.block);
      if (!item) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = item.x;
      const origY = item.y;
      grip.setPointerCapture(e.pointerId);
      function move(ev) {
        item.x = Math.max(0, origX + (ev.clientX - startX));
        item.y = Math.max(0, origY + (ev.clientY - startY));
        blockEl.style.left = item.x + "px";
        blockEl.style.top = item.y + "px";
      }
      function up() {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
      }
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
    });
  });
}

function runSelfTest() {
  const lines = [];
  let failed = 0;
  function check(name, cond) {
    lines.push((cond ? "PASS" : "FAIL") + "  " + name);
    if (!cond) failed += 1;
  }
  let items = feedModel();
  check("active room is first", items[0].kind === "room" && items[0].room.id === "night-table" && items[0].room.occupants.length > 0);
  check("inactive room is last", items[items.length - 1].kind === "room" && items[items.length - 1].room.id === "map-club" && items[items.length - 1].room.occupants.length === 0);
  check("hair is one card", items.filter((i) => i.work && i.work.series === "her-hair").length === 1);
  check("hair card is part IV", items.find((i) => i.work && i.work.series === "her-hair").work.part === 4);
  check("sable is absent", !items.some((i) => i.work && i.work.channel === "sable-games"));
  check("ned is absent", !items.some((i) => i.work && i.work.person === "ned"));
  const hair = seriesParts("her-hair");
  check("spine starts at kitchen", hair[0].id === "hair-1" && hair[0].part === 1);
  check("spine ends at station", hair[3].id === "hair-4");
  const letters = seriesParts("dry-dock");
  check("letters start at the key", letters[0].id === "dock-1");
  state.subs.add("sable-games");
  items = feedModel();
  const errand = items.find((i) => i.work && i.work.series === "pocket-errand");
  check("subscribing adds the set", !!errand && errand.work.part === 2);
  state.subs.delete("sable-games");
  const map = ROOMS.find((r) => r.id === "map-club");
  map.occupants.push("me");
  items = feedModel();
  check("sitting makes the room active", items.some((i) => i.kind === "room" && i.room.id === "map-club" && i.room.occupants.includes("me")));
  check("active map is not in the tail", items.findIndex((i) => i.room && i.room.id === "map-club") < items.findIndex((i) => i.kind !== "room"));
  map.occupants = map.occupants.filter((id) => id !== "me");
  history.replaceState(null, "", "#feed");
  paint();
  const feedText = document.getElementById("stage").textContent;
  check("feed says ACTIVE", feedText.includes("ACTIVE") && feedText.includes("The Night Table"));
  check("feed says INACTIVE", feedText.includes("INACTIVE") && feedText.includes("Map Club"));
  check("feed offers the start", feedText.includes("Start at Part I"));
  check("feed hides the game", !feedText.includes("Pocket Errand"));
  history.replaceState(null, "", "#video/her-hair/4");
  paint();
  const videoText = document.getElementById("stage").textContent;
  check("part IV is open", videoText.includes("The Station") && videoText.includes("The Kitchen Light"));
  check("viewer is a scroll of frames", document.querySelectorAll(".vframe").length > 8);
  document.querySelector("#v-hair-4 [data-act='alert']").click();
  check("alert sticks on the series", state.alerts.has("her-hair") && document.getElementById("vnow").textContent.includes("Alerting"));
  document.querySelector(".vside [data-act='jump'][data-id='hair-1']").click();
  check("jump lands on part I", document.getElementById("vnow").textContent.includes("The Kitchen Light"));
  history.replaceState(null, "", "#articles/dry-dock/1");
  paint();
  check("letter one is open", document.getElementById("stage").textContent.includes("The key still turns"));
  history.replaceState(null, "", "#person/june");
  paint();
  check("june shows the alt", document.getElementById("stage").textContent.includes("Voss Pictures"));
  history.replaceState(null, "", "#person/voss-pictures");
  paint();
  const thin = document.getElementById("stage").textContent;
  check("alt is thin and tied", thin.includes("Tied to") && thin.includes("June Voss") && thin.includes("Secondary profile"));
  state.make.title = "Test Still";
  state.make.series = "Kitchen Studies";
  state.make.part = "1";
  const made = addWork("video");
  check("make lands on your channel", made && made.person === "me" && made.channel === "me-video" && made.part === 1);
  check("your new work stays off your feed", !feedModel().some((i) => i.work && i.work.id === made.id));
  const stage = document.getElementById("stage");
  stage.innerHTML = `<pre class="report">${esc(lines.join("\n"))}\n\n${failed ? failed + " failed" : "ALL PASS"}</pre>`;
  document.body.dataset.selftest = failed ? "fail" : "pass";
  document.title = failed ? "IOX selftest fail" : "IOX selftest pass";
}

function boot() {
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("input", onInput);
  document.body.addEventListener("change", onInput);
  window.addEventListener("hashchange", onHash);
  if ((location.hash || "") === "#selftest") runSelfTest();
  else {
    if (!location.hash) history.replaceState(null, "", "#feed");
    onHash();
  }
}

window.addEventListener("error", (e) => {
  document.body.dataset.selftest = "error";
  const stage = document.getElementById("stage");
  if (stage) stage.textContent = e.message + " (" + (e.filename || "") + ":" + e.lineno + ")";
});

boot();
