/* leaf dress · dotted · .dsc = dressup style sheet (costume)
 * bullet-journal grid: even spacing on X and Y (not stretched rows)
 */

.rx-paper[data-paper="dotted"] .rx-paper-preview {
  --dot-step: 0.88rem; /* square cell */
  --dot-size: .88px;
  background-color: transparent;
  background-image: radial-gradient(
    circle,
    rgba(120, 100, 72, 0.2) var(--dot-size),
    transparent calc(var(--dot-size) + 0.4px)
  );
  background-size: var(--dot-step) var(--dot-step);
  background-position: 0.35rem 0.35rem;
  background-attachment: local;
  background-repeat: repeat;
}
