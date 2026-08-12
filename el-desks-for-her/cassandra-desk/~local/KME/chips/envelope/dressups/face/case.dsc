/* case · digicore / CRT dossier look (kept as OPTIONAL dress · not default) */
/* use: dress up case · does not replace physical _base for plain */

.nb-win.kind-deck[data-face="case"] .deck-closed {
  color: #e8d0d4;
  font-family: "IBM Plex Mono", monospace;
  filter: drop-shadow(2px 4px 8px rgba(0, 0, 0, 0.55));
}
.nb-win.kind-deck[data-face="case"] .env-flap {
  background: linear-gradient(180deg, #6a1824 0%, #4a0c14 55%, #2a0810 100%);
  border: 1px solid rgba(180, 40, 55, 0.55);
  border-radius: 0;
  clip-path: polygon(0 100%, 0 42%, 50% 0, 100% 42%, 100% 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 120, 130, 0.12),
    0 0 12px rgba(120, 20, 30, 0.25);
}
.nb-win.kind-deck[data-face="case"] .env-body {
  background: linear-gradient(165deg, #1c1014 0%, #140a0e 48%, #0c0608 100%);
  border: 1px solid rgba(120, 40, 50, 0.55);
  border-radius: 0;
  box-shadow:
    inset 0 1px 0 rgba(255, 100, 110, 0.06),
    inset 0 -10px 18px rgba(0, 0, 0, 0.35),
    inset 3px 0 0 rgba(180, 40, 55, 0.35);
}
.nb-win.kind-deck[data-face="case"] .env-body::before {
  display: none;
}
.nb-win.kind-deck[data-face="case"] .env-body::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(255, 60, 70, 0.03) 3px,
    rgba(255, 60, 70, 0.03) 4px
  );
  opacity: 0.7;
  z-index: 0;
}
.nb-win.kind-deck[data-face="case"] .env-label {
  transform: none;
  background: linear-gradient(180deg, rgba(30, 12, 16, 0.92) 0%, rgba(18, 8, 10, 0.88) 100%);
  border: 1px solid rgba(160, 50, 60, 0.35);
  border-left: 2px solid rgba(220, 60, 75, 0.65);
  box-shadow: none;
}
.nb-win.kind-deck[data-face="case"] .deck-closed-kind {
  color: #c06070;
  opacity: 0.55;
}
.nb-win.kind-deck[data-face="case"] .deck-closed-title {
  font-family: "IBM Plex Mono", monospace;
  color: #f0dce0;
  text-shadow: 0 0 10px rgba(255, 60, 70, 0.15);
}
.nb-win.kind-deck[data-face="case"] .deck-closed-count {
  color: rgba(200, 120, 130, 0.55);
}
.nb-win.kind-deck[data-face="case"] .deck-closed-hint {
  color: #a05060;
}
