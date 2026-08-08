/* chip card · index proportions · desk motif (kind upper-right, uid foot) */
.tool-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  padding: 0.32rem 0.42rem 0.22rem;
  cursor: grab;
  user-select: none;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.tool-card:active {
  cursor: grabbing;
}
/* top rail: stamp (red) + cite (blue) left · kind "card" upper-right */
.tool-card-rail {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.3rem;
  flex: 0 0 auto;
  min-height: 0.7rem;
}
.tool-card-marks {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.2rem 0.35rem;
  flex: 1 1 auto;
  min-width: 0;
}
.tool-card-kind {
  flex: 0 0 auto;
  margin-left: auto;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 0.48rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #2a1c10;
  opacity: 0.4;
}
/* rubber stamp · stays rose/red even when a cite is also present */
.tool-card-mark {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  font-size: 0.48rem;
  letter-spacing: 0.06em;
  color: #8a2018;
  font-family: "Special Elite", "Courier New", monospace;
  transform: rotate(-3deg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
/* tree / time cite · blue ticket, separate from stamp */
.tool-card-cite {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  font-size: 0.46rem;
  letter-spacing: 0.02em;
  text-transform: none;
  color: #1a4a6a;
  font-family: "Special Elite", "Courier New", monospace;
  transform: rotate(-2deg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.tool-card-title {
  font-family: "Special Elite", "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.12;
  color: #2a1c10;
  font-weight: 600;
  max-height: 2.2em;
  overflow: hidden;
  flex: 0 0 auto;
}
.tool-card-by {
  font-size: 0.52rem;
  color: rgba(42, 28, 16, 0.65);
  font-style: italic;
  font-family: "Libre Baskerville", Georgia, serif;
  flex: 0 0 auto;
}
.tool-card-body {
  flex: 1 1 auto;
  min-height: 0;
  font-size: 0.56rem;
  line-height: 1.22;
  color: #3a2a18;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 0.06rem;
}
/* bottom rail · card[n] · deck home / unfiled · unfile */
.tool-card-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.28rem;
  justify-content: flex-start;
  margin-top: 0.08rem;
  padding-top: 0.12rem;
  border-top: 1px solid rgba(80, 55, 28, 0.12);
  min-width: 0;
}
.tool-card-uid {
  flex: 0 0 auto;
  font-size: 0.46rem;
  letter-spacing: 0.04em;
  color: rgba(60, 45, 30, 0.45);
  font-family: "IBM Plex Mono", "Courier New", monospace;
}
.tool-card-deck {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.44rem;
  letter-spacing: 0.03em;
  color: rgba(42, 28, 16, 0.55);
  font-family: "IBM Plex Mono", "Courier New", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
/* free on felt — not filed in a deck */
.tool-card-deck.is-unfiled {
  color: #a01818;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.9;
  flex: 0 1 auto;
}
/* checked out of home deck — still filed, working on felt */
.tool-card-deck.is-out:not(.is-unfiled) {
  opacity: 0.75;
}
.tool-card-putaway,
.tool-card-unfile {
  flex: 0 0 auto;
  border: 1px solid rgba(80, 55, 28, 0.3);
  background: rgba(255, 250, 240, 0.55);
  color: #3a2a18;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 0.4rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.08rem 0.24rem;
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.tool-card-putaway {
  margin-left: auto;
  border-color: rgba(60, 90, 50, 0.4);
  color: #2a4a28;
  background: rgba(235, 245, 230, 0.6);
}
.tool-card-putaway:hover {
  background: rgba(90, 140, 80, 0.15);
}
.tool-card-unfile {
  border-color: rgba(160, 40, 30, 0.35);
  background: rgba(255, 240, 235, 0.55);
  color: #8a2018;
}
.tool-card-unfile:hover {
  background: rgba(160, 40, 30, 0.12);
}

