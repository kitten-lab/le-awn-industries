# el-desks-for-her

Four seats. One Hands. Papers stay in each island’s `~local`. Escape is mail or fax.

| Folder | Seat | house.txt | Port | Felt sheet | Mira sheet |
|--------|------|-----------|------|------------|------------|
| `sophia-desk/` | ADM | Archivist Desk | 43167 | `green` | `phosphor` |
| `cassandra-desk/` | KME | Detective Desk | 43168 | `velvet` | `neon-red` |
| `ava-desk/` | HER | Letter Desk | 43171 | `blue` | `electric` |
| `key-desk/` | QUA | Key Desk | 43172 | `amber` | `electric` |

**Law:** islands keep `~local` (papers, surfaces). Identity is `house.txt`. Hands (`app.js` / `app.css`) live in `desk_core/hands/` — edit once, every desk wears it. Costumes are named `.dsc` sheets in `~store/marketplace/`. Do not clone `desk_sys` to get a fourth color.

**house.txt** (desk root) — who sits, which surface, which dresses this house likes:

```
auth: ADM
title: SophiaDesk
surface_folder: ArchivistDesk
port: 43167
felt: green
mira: phosphor
```

**Fourth desk** — new folder, new `house.txt`, new `~local/<AUTH>/`, new port. Copy `run-in-deck-host.py` + `prod/desk_sys/server.py` + `store.py` until those peel into core. Do not copy Hands. Mail still moves a paper between libraries.

**General store**

```
el-desks-for-her/~store/marketplace/
  chips/leaf/dressups/_base.dsc   always on
  chips/leaf/dressups/lined.dsc   named sheets
  desk/dressups/green.dsc
  mira/dressups/phosphor.dsc
```

Island `~host/marketplace/` is an overlay for a local experiment. Shared wins on the same name. `edit dress up <name>` writes the general store.

**Mira**

```
dress up lined          layer that sheet over _base (leaf in hand)
dress up letter         add another sheet — they stack
undress lined           take that sheet off
dress up list           whatever files are in the folder
```

The desk itself wears `felt` + `mira` from `house.txt` at boot (`/api/house`).

**Trash** — `trash can` puts a wastebasket on the felt. Drop papers on it (or `trash` with a leaf in hand). `empty` moves those files to `~local/<auth>/~trash/` — off the desk, still on disk.

**Run** — same launcher ids as before. Restart the desk after changing `house.txt`, Hands, or sheets.
