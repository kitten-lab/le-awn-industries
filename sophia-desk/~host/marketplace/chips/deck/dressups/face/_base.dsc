/* deck · manila envelope · flat on the felt (not a 3D box) */
.nb-win.kind-deck {
  background: transparent;
  border: none;
  box-shadow: none;
  min-width: 0;
  min-height: 0;
}
/* closed · landscape envelope on the table (always this size; list is a pop) */
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

/* —— closed manila envelope —— */
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
  color: #3a2a18;
  text-align: left;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  position: relative;
  filter: drop-shadow(1px 3px 6px rgba(0, 0, 0, 0.28));
}
.deck-closed:active {
  cursor: grabbing;
}
/* top flap · flat fold, not a box lid */
.env-flap {
  position: relative;
  display: block;
  flex: 0 0 22%;
  min-height: 18px;
  margin: 0;
  background:
    linear-gradient(180deg, #e8d4a8 0%, #dcc896 55%, #d0bc88 100%);
  border: 1px solid rgba(90, 70, 40, 0.35);
  border-bottom: none;
  border-radius: 2px 2px 0 0;
  clip-path: polygon(0 100%, 0 38%, 50% 0, 100% 38%, 100% 100%);
  box-shadow: inset 0 1px 0 rgba(255, 250, 230, 0.45);
  z-index: 2;
}
.env-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  margin: -1px 0 0;
  padding: 0.32rem 0.4rem 0.28rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.12rem;
  background:
    linear-gradient(165deg, #f0e0b8 0%, #e4d0a0 45%, #d8c088 100%);
  border: 1px solid rgba(90, 70, 40, 0.4);
  border-radius: 0 0 2px 2px;
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 240, 0.5),
    inset 0 -8px 14px rgba(120, 90, 40, 0.06);
  z-index: 1;
}
/* paper label · like a written face on the envelope */
.env-label {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  padding: 0.18rem 0.22rem 0.16rem;
  background:
    linear-gradient(180deg, rgba(255, 252, 245, 0.75) 0%, rgba(245, 232, 200, 0.55) 100%);
  border: 1px dashed rgba(100, 75, 40, 0.28);
  border-radius: 1px;
  min-height: 0;
  flex: 1 1 auto;
}
.deck-closed-kind {
  font-size: 0.4rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.45;
  color: #5a4028;
  align-self: flex-end;
}
.deck-closed-title {
  font-family: "Special Elite", "Courier New", monospace;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.15;
  max-height: 2.4em;
  overflow: hidden;
  color: #2a1c10;
  word-break: break-word;
}
.deck-closed-count {
  font-size: 0.42rem;
  letter-spacing: 0.04em;
  color: rgba(42, 28, 16, 0.5);
  margin-top: auto;
}
.deck-closed-hint {
  font-size: 0.38rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
  opacity: 0.38;
  color: #3a2a18;
  flex: 0 0 auto;
}

/* —— open · face-up envelope (flat sheet of cards) —— */
.deck-open {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid rgba(100, 75, 40, 0.42);
  border-radius: 2px;
  background:
    linear-gradient(180deg, #efe0b8 0%, #e6d4a4 40%, #dcc892 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 240, 0.55),
    2px 6px 16px rgba(0, 0, 0, 0.28);
  color: #2a1c10;
  overflow: hidden;
}
.deck-open[hidden] {
  display: none !important;
}
.deck-closed[hidden] {
  display: none !important;
}
/* top flap strip · drag handle · opens downward from here */
.deck-open-head,
.env-open-flap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  cursor: grab;
  padding: 0.32rem 0.4rem 0.28rem;
  background:
    linear-gradient(180deg, #e8d4a8 0%, #dcc896 100%);
  border-bottom: 1px solid rgba(100, 75, 40, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 250, 230, 0.4);
}
.deck-open-head:active {
  cursor: grabbing;
}
.deck-open-head .board-title {
  flex: 1 1 auto;
  min-width: 0;
  font-family: "Special Elite", "Courier New", monospace;
  font-size: 0.78rem;
  font-weight: 600;
  color: #2a1c10;
}
.deck-open-head .board-kind {
  font-size: 0.42rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.45;
  color: #5a4028;
}
.nb-win.kind-deck .board-byline {
  padding: 0.12rem 0.4rem 0;
  font-size: 0.48rem;
  opacity: 0.55;
  color: #3a2a18;
}
.nb-win.kind-deck .board-meta {
  padding: 0.1rem 0.4rem 0;
  font-size: 0.42rem;
  opacity: 0.5;
  color: #3a2a18;
}
.deck-close-btn {
  flex: 0 0 auto;
  border: 1px solid rgba(90, 70, 40, 0.35);
  background: rgba(255, 252, 245, 0.65);
  color: #2a1c10;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 0.48rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.12rem 0.35rem;
  border-radius: 2px;
  cursor: pointer;
}
.deck-close-btn:hover {
  background: rgba(255, 252, 245, 0.95);
}
/* card index · flat list on the paper */
.deck-list {
  flex: 1 1 auto;
  min-height: 72px;
  overflow: auto;
  margin: 0.2rem 0.35rem 0.15rem;
  border: 1px solid rgba(100, 75, 40, 0.18);
  border-radius: 1px;
  background:
    linear-gradient(180deg, rgba(255, 252, 245, 0.55) 0%, rgba(245, 232, 200, 0.35) 100%);
  padding: 0.12rem;
}
.deck-list-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  box-sizing: border-box;
  border: none;
  border-bottom: 1px solid rgba(100, 75, 40, 0.08);
  background: transparent;
  color: #2a1c10;
  text-align: left;
  padding: 0.28rem 0.32rem;
  border-radius: 1px;
  cursor: pointer;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 0.54rem;
}
.deck-list-row:last-child {
  border-bottom: none;
}
.deck-list-row:hover {
  background: rgba(255, 250, 235, 0.65);
}
.deck-list-row.is-out .deck-list-title {
  opacity: 0.65;
  font-style: italic;
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
  color: #7a5030;
  font-size: 0.4rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}
.deck-list-empty {
  padding: 0.7rem 0.45rem;
  font-size: 0.5rem;
  opacity: 0.5;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  text-align: center;
}
/* drop strip · bottom of open envelope */
.nb-win.kind-deck .board-pocket.deck-drop {
  flex: 0 0 26px;
  min-height: 26px;
  max-height: 32px;
  margin: 0.1rem 0.35rem 0.3rem;
  overflow: hidden;
  opacity: 0.9;
  border: 1px dashed rgba(100, 75, 40, 0.35);
  border-radius: 1px;
  background: rgba(255, 252, 245, 0.35);
}
.nb-win.kind-deck .board-pocket.deck-drop .nb-win {
  display: none !important;
}
.nb-win.kind-deck .nb-resize {
  opacity: 0.35;
}
