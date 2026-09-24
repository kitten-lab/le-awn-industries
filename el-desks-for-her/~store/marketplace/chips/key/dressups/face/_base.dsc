/* keyboard key · tiny tile on felt · local north is the pip */
.nb-win.kind-key .key-cap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: block;
  cursor: grab;
  user-select: none;
  border-radius: 7px;
  overflow: hidden;
  background: var(
    --key-fill,
    linear-gradient(180deg, #f4efe4 0%, #d8cbb3 55%, #c4b396 100%)
  );
  border: 1px solid rgba(70, 52, 32, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 245, 0.85),
    inset 0 -2px 0 rgba(90, 68, 42, 0.22),
    1px 2px 0 rgba(40, 28, 16, 0.18);
  font-family: "IBM Plex Mono", "Courier New", monospace;
  color: var(--key-ink, #2a1c10);
}
.nb-win.kind-key .key-cap:active {
  cursor: grabbing;
  box-shadow:
    inset 0 2px 4px rgba(40, 28, 16, 0.18),
    0 0 0 1px rgba(70, 52, 32, 0.3);
}
.nb-win.kind-key .key-pip {
  position: absolute;
  top: 3px;
  left: 50%;
  width: 10px;
  height: 2px;
  margin-left: -5px;
  border-radius: 1px;
  background: var(--key-ink, rgba(42, 28, 16, 0.55));
  opacity: 0.55;
  pointer-events: none;
  z-index: 2;
}
.nb-win.kind-key .key-face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  pointer-events: none;
}
.nb-win.kind-key .key-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  font-size: 0.48em;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0;
  color: inherit;
  text-align: center;
  width: auto;
  max-width: 86%;
  overflow: hidden;
  white-space: nowrap;
}
.nb-win.kind-key .key-glyph[hidden],
.nb-win.kind-key .key-svg[hidden] {
  display: none !important;
}
.nb-win.kind-key .key-svg {
  width: 70%;
  height: 70%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nb-win.kind-key .key-svg svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
.nb-win.kind-key.is-focus .key-cap {
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 245, 0.9),
    inset 0 -2px 0 rgba(90, 68, 42, 0.25),
    0 0 0 1px rgba(196, 160, 96, 0.55),
    2px 4px 10px rgba(40, 28, 16, 0.28);
}
