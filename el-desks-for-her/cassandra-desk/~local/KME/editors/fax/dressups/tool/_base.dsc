/* Chester's Imports fax — base */
.tool-fax {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  user-select: none;
  cursor: grab;
  padding: 0.15rem;
}
.tool-fax:active {
  cursor: grabbing;
}
.tool-fax-shell {
  width: 100%;
  height: 100%;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  box-sizing: border-box;
  padding: 0.35rem 0.4rem 0.4rem;
  position: relative;
  overflow: hidden;
}
.tool-fax-brand {
  font-size: 0.42rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  opacity: 0.85;
}
.tool-fax-word {
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  line-height: 1;
}
.tool-fax-sub {
  font-size: 0.48rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  margin-bottom: 0.15rem;
  opacity: 0.9;
}
.tool-fax-dest {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 3px;
  padding: 0.22rem 0.4rem;
  cursor: pointer;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tool-fax-hint {
  font-size: 0.45rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  margin-top: 0.1rem;
}
