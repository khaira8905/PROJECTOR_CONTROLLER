/** Slow, theme-coloured light drifting behind the operator console. */
export function Backdrop() {
  return (
    <div className="ec-backdrop" aria-hidden>
      <div className="ec-aura ec-drift-a" style={{ background: 'radial-gradient(circle at 18% 12%, var(--backdrop-a), transparent 40%)' }} />
      <div className="ec-aura ec-drift-b" style={{ background: 'radial-gradient(circle at 86% 30%, var(--backdrop-b), transparent 38%)' }} />
      <div className="ec-aura ec-drift-c" style={{ background: 'radial-gradient(circle at 50% 95%, var(--backdrop-c), transparent 40%)' }} />
      <div className="ec-dots" />
    </div>
  );
}
