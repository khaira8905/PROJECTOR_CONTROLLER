/**
 * Scrolls `el` into view inside its nearest scrollable ancestor only. Unlike
 * element.scrollIntoView(), this never moves the page itself, so following the
 * live item can't yank the operator's view somewhere else.
 */
export function revealWithin(el: HTMLElement | null | undefined, axis: 'x' | 'y' = 'y', center = false) {
  if (!el) return;
  let box = el.parentElement;
  while (box && box !== document.body) {
    const style = getComputedStyle(box);
    const overflow = axis === 'y' ? style.overflowY : style.overflowX;
    const scrollable = axis === 'y' ? box.scrollHeight > box.clientHeight : box.scrollWidth > box.clientWidth;
    if (scrollable && (overflow === 'auto' || overflow === 'scroll')) break;
    box = box.parentElement;
  }
  if (!box || box === document.body) return;
  const b = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (axis === 'y') {
    const top = r.top - b.top + box.scrollTop;
    const target = center ? top - (box.clientHeight - r.height) / 2 : r.top < b.top ? top - 8 : r.bottom > b.bottom ? top - box.clientHeight + r.height + 8 : null;
    if (target !== null) box.scrollTo({ top: target, behavior: 'smooth' });
  } else {
    const left = r.left - b.left + box.scrollLeft;
    const target = center ? left - (box.clientWidth - r.width) / 2 : r.left < b.left ? left - 8 : r.right > b.right ? left - box.clientWidth + r.width + 8 : null;
    if (target !== null) box.scrollTo({ left: target, behavior: 'smooth' });
  }
}
