/* chipper tool · base layout */
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
