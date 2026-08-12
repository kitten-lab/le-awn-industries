/* cite ticket · tree chip code on paper (not URGENT rubber stamp) */
.rx-paper .leaf-stamp-print[data-mark-style="ticket"] {
  position: absolute;
  z-index: 4;
  pointer-events: none;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: none;
  color: rgba(70, 110, 150, 0.92);
  border: 1.5px dashed rgba(70, 110, 150, 0.55);
  border-radius: 3px;
  padding: 0.28rem 0.45rem;
  background: rgba(240, 246, 252, 0.55);
  max-width: 72%;
  text-align: center;
  line-height: 1.25;
  right: 0.55rem;
  top: 2.6rem;
  transform: rotate(-4deg);
  opacity: 0.95;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}
.rx-paper .leaf-stamp-print[data-mark-style="ticket"].is-placed {
  right: auto;
  transform: translate(-50%, -50%) rotate(-4deg);
}

/* second scar: default parking when not plate-aimed (leaves room for DRAFT stamp) */
.rx-paper .leaf-stamp-print.leaf-cite-print.is-cite-default {
  right: auto;
  left: 0.55rem;
  top: auto;
  bottom: 0.55rem;
  transform: rotate(3deg);
}