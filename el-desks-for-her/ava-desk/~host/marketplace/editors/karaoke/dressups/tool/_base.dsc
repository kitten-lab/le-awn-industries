/* karaoke stamp · base layout — wide machine, short height */
.tool-karaoke {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 0.22rem;
  padding: 0.55rem 0.65rem 0.4rem;
  cursor: grab;
  user-select: none;
  font-family: "Special Elite", "Courier New", monospace;
  border-radius: 2px;
  overflow: visible;
}
.tool-karaoke:active {
  cursor: grabbing;
}
.tool-karaoke-tag {
  position: absolute;
  top: -0.32rem;
  left: 0.45rem;
  z-index: 2;
  font-size: 0.5rem;
  letter-spacing: 0.07em;
  padding: 0.1rem 0.38rem;
  white-space: nowrap;
  max-width: calc(100% - 0.7rem);
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.tool-karaoke-slot {
  background: #08060a;
  border: 2px inset #4a4050;
  padding: 0.18rem 0.35rem;
  margin-top: 0.12rem;
  flex: 0 0 auto;
}
.tool-karaoke-face {
  font-size: 1.05rem;
  letter-spacing: 0.12em;
  text-align: center;
  min-height: 1.45rem;
  line-height: 1.45rem;
  color: #e8c060;
  text-shadow: 0 0 8px rgba(232, 160, 64, 0.35);
}
.tool-karaoke-face.is-live {
  animation: karaoke-pull 0.4s ease;
}
.tool-karaoke-face.is-glitch {
  color: #f0a0c0;
  text-shadow:
    2px 0 #40f0ff,
    -2px 0 #ff4060,
    0 0 10px rgba(255, 80, 160, 0.5);
  animation: karaoke-glitch-text 0.08s steps(2) infinite;
  letter-spacing: 0.16em;
}
.tool-karaoke-slot.is-glitching {
  animation: karaoke-slot-glitch 0.12s steps(2) infinite;
  border-color: #c04080;
  box-shadow:
    inset 0 0 16px rgba(255, 40, 120, 0.22),
    0 0 6px rgba(80, 220, 255, 0.15);
}
@keyframes karaoke-pull {
  0% {
    letter-spacing: 0.3em;
    opacity: 0.3;
    filter: hue-rotate(40deg);
  }
  60% {
    letter-spacing: 0.08em;
    opacity: 1;
    filter: hue-rotate(-10deg);
  }
  100% {
    letter-spacing: 0.12em;
    opacity: 1;
    filter: none;
  }
}
@keyframes karaoke-glitch-text {
  0% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(-1px, 1px);
  }
  50% {
    transform: translate(1px, -1px);
  }
  75% {
    transform: translate(-1px, 0);
  }
  100% {
    transform: translate(1px, 1px);
  }
}
@keyframes karaoke-slot-glitch {
  0% {
    filter: none;
  }
  50% {
    filter: hue-rotate(25deg) contrast(1.12);
  }
  100% {
    filter: invert(0.03);
  }
}
.tool-karaoke-levers {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  justify-content: center;
  flex: 0 0 auto;
}
.tool-karaoke-lever {
  font-family: "Special Elite", "Courier New", monospace;
  font-size: 0.58rem;
  letter-spacing: 0.07em;
  padding: 0.28rem 0.7rem;
  border: none;
  border-radius: 1px;
  cursor: pointer;
  color: #f8e8e0;
  box-shadow: 0 2px 0 #401018;
  flex: 1 1 auto;
  max-width: 5.5rem;
}
.tool-karaoke-lever:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 #401018;
}
.tool-karaoke-copy {
  box-shadow: 0 2px 0 #403010;
}
.tool-karaoke-meta {
  font-family: "Libre Baskerville", Georgia, serif;
  font-style: italic;
  font-size: 0.48rem;
  text-align: center;
  line-height: 1.15;
  opacity: 0.85;
  pointer-events: none;
  flex: 0 0 auto;
  margin: 0;
}
