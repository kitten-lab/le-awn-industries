/* stamper tool dress · brass — warm desk toy */
.tool-stamper[data-tool-dress="brass"] .tool-stamper-body {
  background:
    radial-gradient(120% 80% at 20% 12%, rgba(255, 248, 210, 0.55) 0%, transparent 42%),
    linear-gradient(168deg, #f0d98a 0%, #d4b060 28%, #b89248 58%, #8a6a30 100%);
  border: 1px solid rgba(90, 62, 22, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 230, 0.65),
    inset 0 -3px 6px rgba(60, 40, 10, 0.22),
    0 1px 0 rgba(255, 230, 160, 0.25),
    3px 7px 16px rgba(20, 12, 0, 0.4);
}
/* little dome knob */
.tool-stamper[data-tool-dress="brass"] .tool-stamper-knob {
  background:
    radial-gradient(circle at 35% 30%, #fff6d0 0%, #e8c868 45%, #a07830 100%);
  box-shadow:
    inset 0 -1px 2px rgba(60, 40, 10, 0.35),
    0 1px 2px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(70, 48, 16, 0.35);
}
/* wood-dark handle with brass ring vibe */
.tool-stamper[data-tool-dress="brass"] .tool-stamper-handle {
  background:
    linear-gradient(90deg, #3a2a18 0%, #5c4428 35%, #2e2012 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 160, 0.15),
    0 1px 2px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(30, 20, 8, 0.5);
}
.tool-stamper[data-tool-dress="brass"] .tool-stamper-handle::after {
  content: "";
  position: absolute;
  left: 3px;
  right: 3px;
  top: 4px;
  height: 2px;
  border-radius: 1px;
  background: repeating-linear-gradient(
    90deg,
    rgba(200, 160, 80, 0.35) 0 2px,
    transparent 2px 4px
  );
  opacity: 0.7;
}
/* brass collar under handle */
.tool-stamper[data-tool-dress="brass"] .tool-stamper-collar {
  background:
    linear-gradient(180deg, #f2dc9a 0%, #c9a050 48%, #8a6828 100%);
  border: 1px solid rgba(70, 50, 18, 0.4);
  box-shadow:
    inset 0 1px 0 rgba(255, 250, 220, 0.55),
    0 1px 2px rgba(0, 0, 0, 0.2);
}
/* ink plate — deep pad with gold-ish type */
.tool-stamper[data-tool-dress="brass"] .tool-stamper-plate {
  background:
    radial-gradient(90% 70% at 50% 40%, #2a2418 0%, #12100c 70%, #0a0908 100%);
  color: #f8ecc4;
  text-shadow: 0 0 6px rgba(220, 180, 80, 0.25);
  border: 1px solid rgba(40, 30, 12, 0.7);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.55),
    inset 0 -1px 0 rgba(255, 220, 140, 0.08),
    0 1px 0 rgba(255, 230, 160, 0.2);
}
.tool-stamper[data-tool-dress="brass"] .tool-stamper-plate-rim {
  border-color: rgba(200, 160, 70, 0.28);
}
.tool-stamper[data-tool-dress="brass"] .tool-stamper-meta {
  color: rgba(230, 200, 130, 0.72);
  letter-spacing: 0.12em;
}
/* soft gold focus ring */
.nb-win.kind-tool.is-focus .tool-stamper[data-tool-dress="brass"] .tool-stamper-body {
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 230, 0.65),
    inset 0 -3px 6px rgba(60, 40, 10, 0.22),
    0 0 0 1.5px rgba(230, 190, 100, 0.55),
    0 0 14px rgba(210, 160, 60, 0.28),
    3px 8px 18px rgba(20, 12, 0, 0.42);
}
