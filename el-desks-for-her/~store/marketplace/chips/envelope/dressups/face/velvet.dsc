/* velvet · Cassandra's black packet (cloth, cream label) · optional face */
/* Cassandra's island _base still wears this by default; other desks: dress up velvet */

.nb-win.kind-deck[data-face="velvet"] .deck-closed {
  color: #2a2018;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  filter: drop-shadow(2px 4px 7px rgba(0, 0, 0, 0.45));
}
.nb-win.kind-deck[data-face="velvet"] .env-flap {
  background:
    linear-gradient(180deg, #2a181c 0%, #1a1012 50%, #120c0e 100%);
  border: 1px solid rgba(40, 24, 28, 0.85);
  border-radius: 3px 3px 0 0;
  clip-path: polygon(0 100%, 0 40%, 50% 4%, 100% 40%, 100% 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 210, 0.06),
    inset 0 -2px 4px rgba(0, 0, 0, 0.25);
}
.nb-win.kind-deck[data-face="velvet"] .env-body {
  background:
    radial-gradient(ellipse at 30% 20%, #2a1c20 0%, transparent 55%),
    linear-gradient(165deg, #1c1416 0%, #141012 45%, #0e0a0c 100%);
  border: 1px solid rgba(36, 24, 28, 0.9);
  border-radius: 0 0 3px 3px;
  box-shadow:
    inset 0 1px 0 rgba(255, 230, 220, 0.04),
    inset 0 -12px 20px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(60, 36, 40, 0.35);
}
.nb-win.kind-deck[data-face="velvet"] .env-body::before {
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
.nb-win.kind-deck[data-face="velvet"] .env-label {
  background:
    linear-gradient(165deg, #f2e8d4 0%, #e8dcc4 55%, #ddd0b4 100%);
  border: 1px solid rgba(90, 70, 48, 0.4);
  border-radius: 1px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 252, 245, 0.65);
  transform: rotate(-0.4deg);
}
.nb-win.kind-deck[data-face="velvet"] .deck-closed-kind {
  font-family: "IBM Plex Mono", "Courier New", monospace;
  color: #5a4838;
  opacity: 0.45;
}
.nb-win.kind-deck[data-face="velvet"] .deck-closed-title {
  font-family: "Special Elite", "Courier New", monospace;
  color: #2a2018;
  text-shadow: none;
}
.nb-win.kind-deck[data-face="velvet"] .deck-closed-count {
  color: rgba(50, 40, 28, 0.5);
}
.nb-win.kind-deck[data-face="velvet"] .deck-closed-hint {
  color: #c8b0b4;
  opacity: 0.35;
}
.nb-win.kind-deck[data-face="velvet"] .deck-open {
  border: 1px solid rgba(50, 32, 36, 0.8);
  border-radius: 2px;
  background: linear-gradient(180deg, #1c1416 0%, #120e10 100%);
  box-shadow: 2px 6px 14px rgba(0, 0, 0, 0.4);
  color: #e8dcd0;
}
.nb-win.kind-deck[data-face="velvet"] .deck-open-head,
.nb-win.kind-deck[data-face="velvet"] .env-open-flap {
  background: linear-gradient(180deg, #24181a 0%, #181214 100%);
  border-bottom: 1px solid rgba(60, 40, 44, 0.6);
}
.nb-win.kind-deck[data-face="velvet"] .deck-open-head .board-title {
  font-family: "Special Elite", "Courier New", monospace;
  color: #e8dcd0;
}
.nb-win.kind-deck[data-face="velvet"] .deck-open-head .board-kind {
  color: #a89090;
}
.nb-win.kind-deck[data-face="velvet"] .board-byline,
.nb-win.kind-deck[data-face="velvet"] .board-meta {
  color: #a89898;
}
.nb-win.kind-deck[data-face="velvet"] .deck-close-btn {
  border: 1px solid rgba(80, 60, 64, 0.5);
  background: rgba(30, 22, 24, 0.9);
  color: #d0c0c0;
}
.nb-win.kind-deck[data-face="velvet"] .deck-close-btn:hover {
  background: rgba(50, 36, 40, 0.95);
}
.nb-win.kind-deck[data-face="velvet"] .deck-list {
  border: 1px solid rgba(60, 44, 48, 0.45);
  background: rgba(12, 10, 12, 0.55);
}
.nb-win.kind-deck[data-face="velvet"] .deck-list-row {
  border-bottom: 1px solid rgba(60, 44, 48, 0.3);
  color: #e0d4d0;
}
.nb-win.kind-deck[data-face="velvet"] .deck-list-row:hover {
  background: rgba(60, 40, 44, 0.4);
}
.nb-win.kind-deck[data-face="velvet"] .deck-list-out {
  color: #c08088;
}
.nb-win.kind-deck[data-face="velvet"] .board-pocket.deck-drop {
  border: 1px dashed rgba(80, 60, 64, 0.45);
  background: rgba(20, 14, 16, 0.5);
}
