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

## Run

```bat
cd C:\ALICE_BOX\le-awn-industries\glass-compost\prod
python run-in-deck-host.py
```

Port **43182**. Launcher recipe: `glass-compost`.
