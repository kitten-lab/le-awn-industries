/* base layout for eraser tool face */
.tool-eraser {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  cursor: grab;
  user-select: none;
  padding: 0.35rem 0.3rem 0.25rem;
  box-sizing: border-box;
}
.tool-eraser:active {
  cursor: grabbing;
}
.tool-eraser-body {
  width: 86px;
  height: 52px;
  border-radius: 6px 10px 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  box-sizing: border-box;
  transform: rotate(-8deg);
  box-shadow: 2px 4px 10px rgba(0, 0, 0, 0.35);
}
.tool-eraser-band {
  height: 10px;
  border-radius: 6px 10px 0 0;
  flex: 0 0 auto;
}
.tool-eraser-block {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.25rem;
  min-height: 28px;
}
.tool-eraser-label {
  font-family: var(--display), "Special Elite", "Courier New", monospace;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  line-height: 1;
}
.tool-eraser-edge {
  height: 6px;
  border-radius: 0 0 8px 6px;
  flex: 0 0 auto;
  opacity: 0.85;
}
.tool-eraser-meta {
  display: none;
}
.nb-win.kind-tool.is-focus .tool-eraser-body {
  filter: drop-shadow(0 0 0.5px rgba(255, 220, 140, 0.45));
}
.nb-win.kind-tool.is-held .tool-eraser-body {
  transform: rotate(-18deg) scale(1.06);
  transition: transform 0.08s ease-out;
}
