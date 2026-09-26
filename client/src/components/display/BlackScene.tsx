import type { BlackScreenPrefs, PublicMedia } from '../../types';
import { cn } from '../../lib/cn';

/** Logo box per size, in container units so a thumbnail and a 4K projector look the same. */
const SIZE: Record<BlackScreenPrefs['logoSize'], { h: string; w: string }> = {
  small: { h: '11cqh', w: '26cqw' },
  medium: { h: '19cqh', w: '40cqw' },
  large: { h: '30cqh', w: '56cqw' },
};

/**
 * "Black Screen". Pure black by default; optionally a quiet branded card: the logo at its
 * own proportions (never stretched) and a small line of text. Nothing moves once it is in.
 */
export function BlackScene({ settings, logo }: { settings: BlackScreenPrefs | undefined; logo: PublicMedia | null }) {
  const showLogo = !!settings?.showLogo && !!logo && !logo.missing;
  const text = settings?.statusText?.trim() ?? '';
  if (!showLogo && !text) return null;

  const size = SIZE[settings!.logoSize] ?? SIZE.medium;
  const corner = settings!.logoPosition === 'corner';
  const animate = settings!.animateLogo;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col',
        corner ? 'items-end justify-end p-[4cqh_3.5cqw]' : 'items-center',
        settings!.logoPosition === 'center' && 'justify-center',
        settings!.logoPosition === 'lower' && 'justify-end pb-[16cqh]',
      )}
    >
      {showLogo && (
        <img
          src={logo!.url}
          alt=""
          draggable={false}
          className={cn('block h-auto w-auto object-contain', animate && 'ec-black-logo-in')}
          // max-* on both axes + auto size: any logo keeps its aspect ratio and fits the box.
          style={corner ? { maxHeight: `calc(${size.h} * 0.6)`, maxWidth: `calc(${size.w} * 0.6)` } : { maxHeight: size.h, maxWidth: size.w }}
        />
      )}
      {text && (
        <p
          className={cn(
            'max-w-[70cqw] text-center text-[2.1cqh] font-medium tracking-[0.18em] text-[#fff]/55 uppercase',
            showLogo && (corner ? 'mt-[1.2cqh] text-right' : 'mt-[3.2cqh]'),
            animate && 'ec-black-text-in',
          )}
        >
          {text}
        </p>
      )}
    </div>
  );
}
