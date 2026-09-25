/**
 * A soft light that follows the pointer across cards marked `.ec-spot`.
 * One delegated listener for the whole app: it only writes two CSS variables on the
 * hovered card, and the gradient itself is drawn by CSS (styles/console.css).
 */
export function installSpotlight() {
  if (typeof window === 'undefined' || window.matchMedia?.('(pointer: coarse)').matches) return;
  let frame = 0;
  let last: PointerEvent | null = null;
  const update = () => {
    frame = 0;
    const e = last;
    if (!e) return;
    const card = (e.target as Element | null)?.closest?.<HTMLElement>('.ec-spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  window.addEventListener(
    'pointermove',
    (e) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
}
