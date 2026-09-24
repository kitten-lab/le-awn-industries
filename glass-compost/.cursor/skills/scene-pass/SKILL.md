---
name: scene-pass
description: >-
  Full sequential scene pass for Glass Compost trunk cutting: read a whole
  ChatGPT log in order, propose seq cuts with title, TV shot, intensity, and
  shift note, seed them as proposed in bench.db, never auto-accept. After
  trunks exist, a second round proposes soft tags on those trunks (not the
  log). Use when ori'el asks to cut a log, scene-pass, propose trunks, tag
  trunks, run OT-00N as a proving ground, or do what we did on OT-001 / OT-008.
---

# Scene pass (trunk cutting)

This is the cut job for Glass Compost / JX·NIM. It replaced July CIO. CIO rooms stay in yard. Do not restore a CIO rail.

Training brief for a Grok bot playing Jack Nim (first read + trunk cut): `my-pocket-things/pocket-go/~hosts/agent/lookout/nim-process-for-glass-compost.md`. That page is the role, the process boundary, and the YAML output shape. This skill is how a compost-session agent lands those proposals in `bench.db`.

ori'el accepts, edits, or rejects. You propose.

## Hard rules

- **Read the whole log in order.** No 40-message caps. No begin/mid/end samples. No 3-user + 2-asst trays. No 420-char clips.
- **Yard is archive.** Do not delete `yard.db` segments. Compost writes live in `bench.db`.
- **Do not auto-accept.** Status is `proposed` until they hit accept · edit.
- **Do not silently move their cuts.** If they already chunked, propose the better seq and say so. Move only if they ask.
- **Do not commit** unless they ask.
- Live cut room: `glass-compost/prod/bench_sys/` · port **43182** · bind `0.0.0.0`.
- After UI changes, **cache-bust** `index.html` (`app.css` / `app.js` `?v=`).

## Words

| Word | Meaning |
|------|---------|
| Log | One chat (`OT-008`) |
| Trunk | A scene they cut (`T02`) |
| Branch | One message (`B014` = seq 14) |
| Leaf | A slice inside a message |
| Scene pass | Your sequential read → proposed trunks |
| Shot | Present-tense TV shot of the scene |
| Intensity | `calm` · `charged` · `triggering` |

Chip: `OT-001.T02.B014`. Seed tags on faces are Nim Yard ingest, not theirs.

## How to read

1. Resolve `face_id` from yard `faces` (`testament='OT'`, `face_serial=N`).
2. Dump **every** `messages.seq` in order (role + full text). Write a utf-8 file if PowerShell mangles unicode.
3. Walk it like film. A new trunk starts when the **scene** changes, not when a paste continues.
4. Classic miss (OT-001): they cut T04 at seq **22** (still the previous rite). Containment starts at seq **26** (she asks to trap the titan). Propose 26; do not treat 22 as the scene.

Cut at the same `seq` as `placeCut` / `POST /api/cut`.

## What you write

**Per trunk** (`scene_scenes`):

- `start_seq` / `end_seq`
- `title` — short, human, proposed (they will edit). Not a sentence of the shot.
- `shot` — present tense, camera in the room, 2–5 sentences
- `intensity` — `calm` | `charged` | `triggering`
- `shift_note` — why the cut is here (one line)
- `status` — `proposed`

**Whole log** (`scene_logs`): one throughline shot + intensity. Same accept · edit.

Title style that landed: `You always leave me`, `Hekate at the door`, `The mirror box`. Not a caption of the first line.

## How to land it

Add tuples next to `OT001_SCENES` / `OT008_SCENES` in `prod/bench_sys/server.py` and call `seed_scene_pass(con, FACE, SCENES, LOG)` from `init_bench`.

`seed_scene_pass` inserts if the face has no scene rows; fills empty `title` on existing rows. Restart the 43182 server after Python changes (static JS/CSS do not need a restart if you cache-bust).

Do **not** INSERT `hand_cuts` for them. Accept writes the cut:

- Opens editor: title, shot, intensity, shift
- Prefills **proposed title** (or their existing trunk title if they already named it)
- Keeps their note/tags if those already exist

If they already have a trunk near your seq: leave theirs, mark yours proposed, explain the disagreement. Shift in sqlite only when they say to.

## What they should see

- **One trunk plate:** title · tags · **your note** · then **shot** (not a second bay that hides tags)
- Proposed marks on the stream + dashed pills at the top
- Sticky **JUMP** rail: official = solid buttons, proposed = dashed. Toolbar **jumps** hides it
- Leaf cuts in message text = small vertical ticks, not 26px scissors (`font-size: 0` on `.b-sent-cut` zeros the hit box — never do that)

## Code map

| Piece | Where |
|-------|--------|
| Seed / accept / APIs | `prod/bench_sys/server.py` (`seed_scene_pass`, `accept_scene`, `/api/scene/*`) |
| Trunk card + accept pop + jump | `prod/bench_sys/app.js` (`renderTrunkBody`, `askSceneMeta`, `paintTrunkJump`) |
| Store | `prod/bench_sys/store/bench.db` → `scene_scenes`, `scene_logs`, `hand_cuts` |
| Messages | yard `C:/Builds/_mausoleum/alice-box-exiles/nim-data-forestry/prod/yard_sys/store/yard.db` |

Join that survives recut: `face_id` + `seq`.

## Proving ground (do not overwrite their titles)

**OT-001** `67aa5a6c-de9c-8004-b715-e91f7944b523` — 36 msgs. Your seqs: **0 / 14 / 17 / 26**. Their T04 was 22; you moved it to 26 when asked. Their names: *introduction to the story*, *She Believes in Magic*, *Afraid of her Own Rage*, *Mirror Box setup*.

**OT-008** `67b128b8-8938-8004-a635-f18ff8cee3a7` — 63 msgs. Proposed: **0** Chaos is the inner child · **4** You always leave me · **34** Hekate at the door · **43** Sweet little Dani · **59** Only wanted when funny.

**OT-009** `67b29d35-bbcc-8004-be91-de323c649600` — 52 msgs. Empty T01 only. Proposed: **0** You are not the storm · **8** Their paths are their own · **10** Syd is woven in · **20** The ancestors speak · **26** Maris · **38** Arius, Selene, Zephyros. Do not merge Maris into seq 20 — the named ancestor starts when she picks the farmer-healer.

## Next log checklist

1. Dump full sequential messages
2. Mark scene shifts (intensity + why)
3. Write title, shot, shift for each + whole-log throughline
4. Seed `proposed` (do not accept)
5. Open the log in the cut room and show them
6. They accept · edit / reject
7. If a seq disagrees with a hand cut, say it out loud; wait

## Round 2 — soft tags (after compact: talk, then do)

Not this pass. After trunks exist (they accepted, or they already cut), a **second round** proposes tags **on the trunks you created** — not on the whole log.

- Unit is the trunk (`hand_cuts.tags_json`). There is no log-level tag surface to write; seed tags on `faces` are Nim Yard ingest, not theirs.
- Soft: propose, do not overwrite tags they already put on a trunk. Empty trunks get the proposal; tagged trunks get extras only if they ask.
- Their words, same vocab as the tag pop (reuse dictionary, invent when needed). Not a fixed scale.
- Do not dump bag/CIO hashtags onto the plate.
- Wire it like scenes if you build UI: proposed flags they can accept · edit. Until then, show the list and wait.

OT-001 already has their tags on T01–T04. Do not restamp those. OT-008 is the first log this round would actually mark.
