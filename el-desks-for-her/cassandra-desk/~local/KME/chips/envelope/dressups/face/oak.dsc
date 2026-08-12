/* oak · sealed physical packet · darker velvet + cream label */
.nb-win.kind-deck[data-face="oak"] .env-flap {
  background: linear-gradient(180deg, #1a1012 0%, #100c0e 55%, #0a0808 100%);
}
.nb-win.kind-deck[data-face="oak"] .env-body {
  background:
    radial-gradient(ellipse at 40% 15%, #22181a 0%, transparent 50%),
    linear-gradient(165deg, #141012 0%, #0c0a0a 100%);
}
.nb-win.kind-deck[data-face="oak"] .env-label {
  background: linear-gradient(165deg, #ebe0cc 0%, #ddd2ba 100%);
  border-left: 2px solid rgba(140, 50, 55, 0.55);
  transform: rotate(0.3deg);
}
.nb-win.kind-deck[data-face="oak"] .deck-closed-kind::before {
  content: "sealed · ";
  color: #8a3038;
  opacity: 0.7;
}
