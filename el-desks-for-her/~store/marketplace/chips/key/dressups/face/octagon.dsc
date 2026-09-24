/* key face · octagon (eight-sided scramble tile) */
.nb-win.kind-key[data-face="octagon"] .key-cap,
.nb-win.kind-key[data-face="octogon"] .key-cap {
  border-radius: 0;
  overflow: hidden;
  clip-path: polygon(
    29.29% 0%,
    70.71% 0%,
    100% 29.29%,
    100% 70.71%,
    70.71% 100%,
    29.29% 100%,
    0% 70.71%,
    0% 29.29%
  );
  box-shadow: none;
  filter: drop-shadow(1px 2px 1px rgba(40, 28, 16, 0.28));
}
.nb-win.kind-key[data-face="octagon"] .key-cap:active,
.nb-win.kind-key[data-face="octogon"] .key-cap:active {
  box-shadow: none;
  filter: drop-shadow(0 0 0 rgba(40, 28, 16, 0.2));
}
.nb-win.kind-key[data-face="octagon"].is-focus .key-cap,
.nb-win.kind-key[data-face="octogon"].is-focus .key-cap {
  box-shadow: none;
  filter: drop-shadow(0 0 2px rgba(196, 160, 96, 0.85))
    drop-shadow(2px 4px 6px rgba(40, 28, 16, 0.28));
}
.nb-win.kind-key[data-face="octagon"] .key-pip,
.nb-win.kind-key[data-face="octogon"] .key-pip {
  top: 2px;
  width: 8px;
  margin-left: -4px;
}
