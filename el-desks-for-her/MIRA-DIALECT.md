# Mira terminal dialect

**One weather system per desk.** Neon terminal objects share `--mira-*` tokens.

## Where to edit

In each house:

`{sophia|cassandra|ava}-desk/prod/desk_sys/app.css`

Look for the banner:

```text
MIRA TERMINAL DIALECT (this house)
```

Change the **tokens only** when rethemeing:

| Token | Role |
|-------|------|
| `--mira-bg` | Shell body + toast body |
| `--mira-bg-deep` | Prompt strip / shell button rest |
| `--mira-fg` / `-bright` / `-dim` | Text hierarchy |
| `--mira-border` / `--mira-bar` / `--mira-line` | Frame |
| `--mira-dot` / `--mira-glow` | Status pip + glow |
| `--mira-shadow` / `--mira-sel` | Elevation + selection |

Pieces that ride the dialect:

- Mira shell frame + log + prompt  
- `.rx-toast` (whisper)  
- `#btnShell` on the rail  

## House defaults

| Desk | Dialect |
|------|---------|
| Sophia | phosphor green on dark CRT |
| Cassandra | neon red on dark red/black |
| Ava | electric blue (original) |

Do not scatter new neon hexes for Mira — add them to the token block.
