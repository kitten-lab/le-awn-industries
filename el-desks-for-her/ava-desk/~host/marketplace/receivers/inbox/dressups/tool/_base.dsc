/* inbox base — wide mail tray, not stamp proportions */
.tool-inbox {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  user-select: none;
  cursor: grab;
  padding: 0.2rem;
}
.tool-inbox:active {
  cursor: grabbing;
}
.tool-inbox-shell {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0.45rem 0.5rem 0.4rem;
}
.tool-inbox-flag {
  position: absolute;
  top: 0.35rem;
  right: 0.4rem;
  font-size: 0.48rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  padding: 0.12rem 0.28rem;
  border-radius: 2px;
  z-index: 3;
}
.tool-inbox-slot {
  height: 0.55rem;
  width: 78%;
  margin: 0.35rem auto 0.55rem;
  border-radius: 1px;
  flex-shrink: 0;
  z-index: 1;
}
.tool-inbox-plate {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  text-align: center;
  min-height: 0;
}
.tool-inbox-word {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}
.tool-inbox-sub {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  margin-top: -0.1rem;
}
.tool-inbox-count {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0.15rem 0 0.05rem;
  min-height: 1em;
}
.tool-inbox-address {
  font-size: 0.52rem;
  font-weight: 600;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  word-break: break-all;
  line-height: 1.2;
  max-width: 100%;
  padding: 0 0.15rem;
  opacity: 0.85;
}
