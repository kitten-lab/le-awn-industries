# The Glass Compost · CO.LEA-003-GLASS

**Maker:** L.E. AWN Industries · `CO.LEA`  
**Address:** `ALICE_BOX/le-awn-industries/glass-compost/`  
**Was:** Nim Bench · `jacks-cross/nim-bench`

Hand-cut branches on the chat mountain. **This is the live cut room** — not data forestry.

| Word | Meaning |
|------|---------|
| **Log** | One chat mountain |
| **Trunk** | A stretch *you* cut |
| **Message / branch chip** | One turn |
| **Leaf** | A chunk of text on a message |
| **Parsed** | You checked this turn |

## Data

- **Reads** messages from mausoleum Yard `yard.db`:  
  `C:\Builds\_mausoleum\alice-box-exiles\nim-data-forestry\prod\yard_sys\store\yard.db`  
  Override: env `GLASS_COMPOST_YARD_DB`
- **Writes** hand cuts to:  
  `glass-compost/prod/bench_sys/store/bench.db`

## ZIP hand-off (like desk `leaf[n]`)

Cite grammar lives here — not in raw `conversations.json`:

| Chip | Meaning |
|------|---------|
| `OT-093` | log / bag |
| `.T01` | trunk (hand-cut pocket; first trunk if uncut) |
| `.B011` | branch = one message (seq **11**) |
| `.L02` | optional leaf bit inside a fat turn |

```bat
cd C:\ALICE_BOX\le-awn-industries\glass-compost\prod
python fetch-zip.py OT-093.T01.B011
python fetch-zip.py OT-093.T01.B011 --json
```

## Find · CXR · fax

Keyword **FIND** searches the mountain (`yard.db` `messages_fts`). Default is forest-wide; clamp to the open log if you want. Turn filter: all / user / assistant.

Check hits, **seal CXR** (Chester Export Report). Full messages, full timestamps, gravity words, ZIP chips. Thin PocketGo frontmatter.

- Seals live in `prod/bench_sys/store/reports/`
- Fax copies into `my-pocket-things/pocket-go/~hosts/glass/shards/` (`go.glass`)
- Chips count how many CXR reports they belong to
- A whole-log export stays in the compost drawer unless you fax it on purpose

Cabinets in PocketGo stay hand work. Compost does not write Charlie.

## Run

```bat
cd C:\ALICE_BOX\le-awn-industries\glass-compost\prod
python run-in-deck-host.py
```

Port **43182**. Launcher recipe: `glass-compost`.

## Terminal phosphor · house colors

Looks like **Chester TERMINAL IO** (green CRT inventory), not a soft gray notepad.

| House | Phosphor | Who |
|-------|----------|-----|
| `green` | Terminal IO green (default) | Archivist / Sophia |
| `red` | oxblood | Detective / Cassandra |
| `blue` | deep channel | Lover / Ava |

- Chrome buttons: **GRN · RED · BLU**
- Persist: `localStorage` + place blob (`house`)
- Deep-link: `http://127.0.0.1:43182/?house=red` (also `?house=detective` / `kme` / `lover` / `ava` …)

Same cut room for every girl — only the phosphor changes. Not exclusive to the archivist desk.
