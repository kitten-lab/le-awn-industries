/* leaf dress · letter · .dsc = dressup style sheet (costume) */

.rx-paper[data-paper="letter"] .rx-paper-preview {
  background-color: transparent;
  background-image:
    linear-gradient(
      90deg,
      transparent 0,
      transparent 0.2rem,
      rgba(180, 60, 60, 0.16) 0.2rem,
      rgba(180, 60, 60, 0.16) calc(0.2rem + 1px),
      transparent calc(0.2rem + 1px)
    ),
    repeating-linear-gradient(
      transparent,
      transparent calc(1.45rem - 1px),
      rgba(200, 184, 152, 0.38) calc(1.45rem - 1px),
      rgba(200, 184, 152, 0.38) 1.45rem
    );
  background-attachment: local;
  padding-left: 0.75rem;
}
