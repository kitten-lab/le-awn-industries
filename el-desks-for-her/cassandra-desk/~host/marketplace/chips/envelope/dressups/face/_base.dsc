/* envelope · physical black packet on felt · label on velvet (desk object, not digicore screen) */
/* named sheet for other desks: ~store/.../envelope/dressups/face/velvet.dsc  (dress up velvet) */
/* digicore / CRT case look lives in face/case.dsc — do not put terminal wash here */

.nb-win.kind-deck {
  background: transparent;
  border: none;
  box-shadow: none;
  min-width: 0;
  min-height: 0;
}
.nb-win.kind-deck.is-closed,
.nb-win.kind-deck.is-open,
.nb-win.kind-deck.is-envelope-open {
  width: 168px !important;
  height: 104px !important;
  min-width: 140px;
  min-height: 88px;
  max-width: 180px;
  max-height: 120px;
}
.deck-face {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* closed · soft black velvet / leather stock */
.deck-closed {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 0;
  border: none;
  background: transparent;
  cursor: grab;
  color: #2a2018;
  text-align: left;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  position: relative;
  filter: drop-shadow(2px 4px 7px rgba(0, 0, 0, 0.45));
  outline: none;
  user-select: none;
}
.deck-closed:active {
  cursor: grabbing;
}
/* flap · dark cloth fold · soft V */
.env-flap {
  position: relative;
  display: block;
  flex: 0 0 22%;
  min-height: 18px;
  margin: 0;
  background:
    linear-gradient(180deg, #2a181c 0%, #1a1012 50%, #120c0e 100%);
  border: 1px solid rgba(40, 24, 28, 0.85);
  border-bottom: none;
  border-radius: 3px 3px 0 0;
  clip-path: polygon(0 100%, 0 40%, 50% 4%, 100% 40%, 100% 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 210, 0.06),
    inset 0 -2px 4px rgba(0, 0, 0, 0.25);
  z-index: 2;
}
/* body · matte velvet pile (not CRT black) */
.env-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  margin: -1px 0 0;
  padding: 0.32rem 0.36rem 0.26rem 0.48rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.12rem;
  background:
    radial-gradient(ellipse at 30% 20%, #2a1c20 0%, transparent 55%),
    linear-gradient(165deg, #1c1416 0%, #141012 45%, #0e0a0c 100%);
  border: 1px solid rgba(36, 24, 28, 0.9);
  border-radius: 0 0 3px 3px;
  box-shadow:
    inset 0 1px 0 rgba(255, 230, 220, 0.04),
    inset 0 -12px 20px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(60, 36, 40, 0.35);
  z-index: 1;
  overflow: hidden;
}
/* soft cloth grain — not scanlines */
.env-body::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
  z-index: 0;
}
/* station stripe · thin fabric washi */
.env-station-band {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  z-index: 2;
  pointer-events: none;
  background: transparent;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.nb-win.kind-deck[data-station]:not([data-station=""]) .env-station-band {
  opacity: 1;
  box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.25);
}
.nb-win.kind-deck[data-station="io"] .env-station-band,
.nb-win.kind-deck[data-station="iox"] .env-station-band {
  background: #2d6b4a;
}
.nb-win.kind-deck[data-station="ab"] .env-station-band,
.nb-win.kind-deck[data-station="abx"] .env-station-band {
  background: #8a3840;
}
.nb-win.kind-deck[data-station="cu"] .env-station-band {
  background: #2a5c68;
}
.nb-win.kind-deck[data-station="dr"] .env-station-band,
.nb-win.kind-deck[data-station="drx"] .env-station-band {
  background: #5a4070;
}
.nb-win.kind-deck[data-station="osx"] .env-station-band {
  background: #3a5080;
}
.nb-win.kind-deck[data-station="dc"] .env-station-band,
.nb-win.kind-deck[data-station="dco"] .env-station-band {
  background: #8a6230;
}
.nb-win.kind-deck[data-station="icu"] .env-station-band {
  background: #5a6870;
}

/* LABEL · paper stuck on velvet (the physical bit) */
.env-label {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.06rem;
  margin: 0.06rem 0.04rem 0.02rem;
  padding: 0.28rem 0.32rem 0.22rem;
  min-height: 0;
  flex: 1 1 auto;
  /* cream paper on dark object */
  background:
    linear-gradient(165deg, #f2e8d4 0%, #e8dcc4 55%, #ddd0b4 100%);
  border: 1px solid rgba(90, 70, 48, 0.4);
  border-radius: 1px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 252, 245, 0.65);
  transform: rotate(-0.4deg);
}
.deck-closed-kind {
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 0.38rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.45;
  color: #5a4838;
  align-self: flex-end;
}
.deck-closed-title {
  font-family: "Special Elite", "Courier New", monospace;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.18;
  max-height: 2.4em;
  overflow: hidden;
  color: #2a2018;
  word-break: break-word;
  letter-spacing: 0.01em;
  text-shadow: none;
}
.deck-closed-count {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.4rem;
  letter-spacing: 0.04em;
  color: rgba(50, 40, 28, 0.5);
  margin-top: auto;
}
.deck-closed-hint {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.36rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  opacity: 0.35;
  color: #c8b0b4;
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
}

/* open stub */
.deck-open {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid rgba(50, 32, 36, 0.8);
  border-radius: 2px;
  background: linear-gradient(180deg, #1c1416 0%, #120e10 100%);
  box-shadow: 2px 6px 14px rgba(0, 0, 0, 0.4);
  color: #e8dcd0;
  overflow: hidden;
}
.deck-open[hidden],
.deck-closed[hidden] {
  display: none !important;
}
.deck-open-head,
.env-open-flap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  cursor: grab;
  padding: 0.32rem 0.4rem 0.28rem;
  background: linear-gradient(180deg, #24181a 0%, #181214 100%);
  border-bottom: 1px solid rgba(60, 40, 44, 0.6);
}
.deck-open-head:active {
  cursor: grabbing;
}
.deck-open-head .board-title {
  flex: 1 1 auto;
  min-width: 0;
  font-family: "Special Elite", "Courier New", monospace;
  font-size: 0.72rem;
  font-weight: 600;
  color: #e8dcd0;
}
.deck-open-head .board-kind {
  font-size: 0.4rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.45;
  color: #a89090;
}
.nb-win.kind-deck .board-byline,
.nb-win.kind-deck .board-meta {
  padding: 0.1rem 0.4rem 0;
  font-size: 0.42rem;
  opacity: 0.5;
  color: #a89898;
}
.deck-close-btn {
  flex: 0 0 auto;
  border: 1px solid rgba(80, 60, 64, 0.5);
  background: rgba(30, 22, 24, 0.9);
  color: #d0c0c0;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.45rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.12rem 0.35rem;
  border-radius: 2px;
  cursor: pointer;
}
.deck-close-btn:hover {
  background: rgba(50, 36, 40, 0.95);
}
.deck-list {
  flex: 1 1 auto;
  min-height: 72px;
  overflow: auto;
  margin: 0.2rem 0.35rem 0.15rem;
  border: 1px solid rgba(60, 44, 48, 0.45);
  border-radius: 1px;
  background: rgba(12, 10, 12, 0.55);
  padding: 0.12rem;
}
.deck-list-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  box-sizing: border-box;
  border: none;
  border-bottom: 1px solid rgba(60, 44, 48, 0.3);
  background: transparent;
  color: #e0d4d0;
  text-align: left;
  padding: 0.28rem 0.32rem;
  border-radius: 1px;
  cursor: pointer;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.54rem;
}
.deck-list-row:last-child {
  border-bottom: none;
}
.deck-list-row:hover {
  background: rgba(60, 40, 44, 0.4);
}
.deck-list-idx {
  flex: 0 0 auto;
  opacity: 0.4;
  width: 1.4em;
  font-size: 0.48rem;
}
.deck-list-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deck-list-out {
  flex: 0 0 auto;
  color: #c08088;
  font-size: 0.4rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}
.deck-list-empty {
  padding: 0.7rem 0.45rem;
  font-size: 0.5rem;
  opacity: 0.5;
  font-family: "IBM Plex Mono", monospace;
  text-align: center;
}
.nb-win.kind-deck .board-pocket.deck-drop {
  flex: 0 0 26px;
  min-height: 26px;
  max-height: 32px;
  margin: 0.1rem 0.35rem 0.3rem;
  overflow: hidden;
  opacity: 0.9;
  border: 1px dashed rgba(80, 60, 64, 0.45);
  border-radius: 1px;
  background: rgba(20, 14, 16, 0.5);
}
.nb-win.kind-deck .board-pocket.deck-drop .nb-win {
  display: none !important;
}
.nb-win.kind-deck .nb-resize {
  opacity: 0.35;
}
