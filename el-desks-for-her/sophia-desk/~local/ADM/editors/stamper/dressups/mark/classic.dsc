/* stamp print · classic ink on leaf paper — soft rubber-stamp cute */
.rx-paper .leaf-stamp-print[data-mark-style="classic"] {
  position: absolute;
  z-index: 4;
  pointer-events: none;
  font-family: var(--display), "Special Elite", "Courier New", monospace;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(176, 42, 48, 0.82);
  border: 2.5px solid rgba(168, 48, 52, 0.62);
  border-radius: 4px;
  padding: 0.4rem 0.62rem;
  box-shadow:
    0 0 0 1px rgba(180, 50, 50, 0.1),
    1px 2px 0 rgba(180, 60, 50, 0.08);
  background:
    radial-gradient(120% 100% at 30% 20%, rgba(255, 245, 235, 0.22) 0%, transparent 55%),
    rgba(255, 248, 242, 0.12);
  max-width: 54%;
  text-align: center;
  line-height: 1.15;
  /* imperfect ink edges */
  filter: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>");
  right: 0.65rem;
  top: 2.4rem;
  transform: rotate(-9deg);
  opacity: 0.92;
}
.rx-paper .leaf-stamp-print[data-mark-style="classic"]::before {
  content: "";
  position: absolute;
  inset: 4px;
  border: 1px solid rgba(168, 48, 52, 0.22);
  border-radius: 2px;
  pointer-events: none;
}
/* placed by plate aim — center on Mark.pos percent */
.rx-paper .leaf-stamp-print[data-mark-style="classic"].is-placed {
  right: auto;
  transform: translate(-50%, -50%) rotate(-9deg);
}
