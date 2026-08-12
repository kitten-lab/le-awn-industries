/* chipper tool Â· base layout */
.tool-chipper {
  width: 108px;
  user-select: none;
  cursor: grab;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}
.nb-win.kind-tool.is-held .tool-chipper {
  cursor: none;
}
.tool-chipper-body {
  position: relative;
  border-radius: 10px 10px 14px 14px;
  padding: 0.45rem 0.4rem 0.55rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}
.tool-chipper-clip {
  width: 42px;
  height: 10px;
  border-radius: 6px 6px 2px 2px;
  margin-bottom: 0.1rem;
}
.tool-chipper-jaw {
  width: 54px;
  height: 8px;
  border-radius: 2px;
  margin-bottom: 0.25rem;
}
.tool-chipper-plate {
  position: relative;
  min-width: 88px;
  max-width: 100px;
  min-height: 2.1rem;
  padding: 0.28rem 0.3rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.tool-chipper-label {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.52rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.2;
  word-break: break-all;
  text-transform: none;
}
.tool-chipper-meta {
  margin-top: 0.25rem;
  text-align: center;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  color: var(--dim, #8a8490);
}

.tool-chipper[data-tool-dress="ink"] .tool-chipper-body {
  background:
    radial-gradient(120% 80% at 25% 10%, rgba(200, 230, 255, 0.45) 0%, transparent 45%),
    linear-gradient(168deg, #6a8aaa 0%, #3d5a78 45%, #2a4058 100%);
  border: 1px solid rgba(20, 36, 52, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(220, 240, 255, 0.35),
    3px 7px 16px rgba(10, 16, 24, 0.45);
}
.tool-chipper[data-tool-dress="ink"] .tool-chipper-clip {
  background: linear-gradient(180deg, #d8e4f0 0%, #8aa0b8 100%);
  border: 1px solid rgba(30, 40, 55, 0.4);
}
.tool-chipper[data-tool-dress="ink"] .tool-chipper-jaw {
  background: linear-gradient(180deg, #2a3544 0%, #151c26 100%);
  border: 1px solid rgba(0, 0, 0, 0.35);
}
.tool-chipper[data-tool-dress="ink"] .tool-chipper-plate {
  background:
    radial-gradient(90% 70% at 50% 40%, #1a2838 0%, #0c1218 75%);
  color: #b8d4f0;
  border: 1px solid rgba(80, 120, 160, 0.35);
  text-shadow: 0 0 8px rgba(100, 160, 220, 0.35);
}