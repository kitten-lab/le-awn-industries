# Mira terminal dialect

Mira weather is a **dress sheet**, not a fork of `app.css`.

## Where to edit

General store:

`el-desks-for-her/~store/marketplace/mira/dressups/<name>.dsc`

`house.txt` on the desk names which sheet Mira wears (`mira: phosphor`).

Tokens in the sheet:

| Token | Role |
|-------|------|
| `--mira-bg` | Shell body + toast body |
| `--mira-bg-deep` | Prompt strip / shell button rest |
| `--mira-fg` / `-bright` / `-dim` | Text hierarchy |
| `--mira-border` / `--bar` / `--line` | Frame |
| `--mira-dot` / `--glow` | Status pip + glow |
| `--mira-shadow` / `--sel` | Elevation + selection |

Pieces that ride the dialect: Mira shell frame + log + prompt, `.rx-toast`, `#btnShell`.

## Stock sheets

| Sheet | House that likes it |
|-------|---------------------|
| `phosphor` | Sophia |
| `neon-red` | Cassandra |
| `electric` | Ava |

A desk can wear any of them. Add `mira/dressups/copper.dsc` and set `mira: copper` in `house.txt`.
