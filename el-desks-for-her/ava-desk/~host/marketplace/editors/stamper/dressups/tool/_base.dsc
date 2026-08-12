/* base layout for stamper tool face (always injected with tool dress) */
.tool-stamper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  cursor: grab;
  user-select: none;
  padding: 0.3rem 0.25rem 0.2rem;
  box-sizing: border-box;
}
.tool-stamper:active {
  cursor: grabbing;
}
.tool-stamper-body {
  width: 92px;
  height: 86px;
  border-radius: 8px 8px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.28rem 0.42rem 0.4rem;
  position: relative;
  box-sizing: border-box;
}
.tool-stamper-knob {
  width: 14px;
  height: 10px;
  border-radius: 50% 50% 40% 40%;
  margin-bottom: 1px;
  flex: 0 0 auto;
}
.tool-stamper-handle {
  width: 22px;
  height: 16px;
  border-radius: 4px 4px 2px 2px;
  margin-bottom: 0;
  flex: 0 0 auto;
  position: relative;
}
.tool-stamper-collar {
  width: 36px;
  height: 7px;
  border-radius: 2px;
  margin: 2px 0 4px;
  flex: 0 0 auto;
}
.tool-stamper-plate {
  flex: 1 1 auto;
  width: 100%;
  min-height: 36px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display), "Special Elite", "Courier New", monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.28rem 0.2rem;
  text-align: center;
  line-height: 1.12;
  position: relative;
  overflow: hidden;
}
.tool-stamper-plate-rim {
  position: absolute;
  inset: 3px;
  border-radius: 2px;
  border: 1px dashed transparent;
  pointer-events: none;
}
.tool-stamper-label {
  position: relative;
  z-index: 1;
  max-width: 100%;
  word-break: break-word;
}
.tool-stamper-meta {
  display: none; /* face only — no under-label */
}
.nb-win.kind-tool.is-focus .tool-stamper-body {
  filter: drop-shadow(0 0 0.5px rgba(255, 220, 140, 0.5));
}
.nb-win.kind-tool.is-held .tool-stamper-body {
  transform: rotate(-6deg) scale(1.04);
  transition: transform 0.08s ease-out;
}
