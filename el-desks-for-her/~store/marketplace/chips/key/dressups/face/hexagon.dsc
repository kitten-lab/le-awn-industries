/* key face · hexagon (flat north · honeycomb tile) */
.nb-win.kind-key[data-face="hexagon"] .key-cap {
  border-radius: 0;
  overflow: hidden;
  clip-path: polygon(
    25% 0%,
    75% 0%,
    100% 50%,
    75% 100%,
    25% 100%,
    0% 50%
  );
  box-shadow: none;
  filter: drop-shadow(1px 2px 1px rgba(40, 28, 16, 0.28));
}
.nb-win.kind-key[data-face="hexagon"] .key-cap:active {
  box-shadow: none;
  filter: drop-shadow(0 0 0 rgba(40, 28, 16, 0.2));
}
.nb-win.kind-key[data-face="hexagon"].is-focus .key-cap {
  box-shadow: none;
  filter: drop-shadow(0 0 2px rgba(196, 160, 96, 0.85))
    drop-shadow(2px 4px 6px rgba(40, 28, 16, 0.28));
}
.nb-win.kind-key[data-face="hexagon"] .key-pip {
  top: 2px;
  width: 8px;
  margin-left: -4px;
}
