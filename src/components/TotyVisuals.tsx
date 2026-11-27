import { LOGO_LIGHT_SVG } from '../data/ufroSeed';

export const TOTY_ESCUDO_SVG = '/assets/aistudio/Escudo_TOTY_f61c43b6.svg';
export const TOTY_ISO_SVG = '/assets/aistudio/Iso_TOTY_05bbbfbc.svg';
export const TOTY_LOGO_SVG = '/assets/aistudio/Logo_TOTY_0430e247.svg';

interface TotyCrestBadgeProps {
  className?: string;
}

/**
 * Official crowned TOTY isotipo SVG asset.
 */
export function TotyCrestBadge({ className = 'h-9 w-auto' }: TotyCrestBadgeProps) {
  return (
    <img
      src={TOTY_ISO_SVG}
      alt="TOTY"
      className={`object-contain select-none ${className}`}
    />
  );
}

interface TotyCoBrandLockupProps {
  compact?: boolean;
}

/**
 * UFRO Intercarreras isotipo paired with the official TOTY crowned isotipo.
 */
export function TotyCoBrandLockup({ compact = false }: TotyCoBrandLockupProps) {
  return (
    <div className="inline-flex items-center gap-3 text-white/95 shrink-0">
      <img
        src={LOGO_LIGHT_SVG}
        alt="Campeonato Intercarreras UFRO"
        className={compact ? 'h-6 w-auto opacity-95' : 'h-7 sm:h-8 w-auto opacity-95'}
      />
      <span
        aria-hidden="true"
        className={compact ? 'h-6 w-px bg-[#b8dcff]/45' : 'h-7 w-px bg-[#b8dcff]/45'}
      />
      <TotyCrestBadge className={compact ? 'h-7 w-auto opacity-95' : 'h-8 sm:h-9 w-auto opacity-95'} />
    </div>
  );
}

interface TotyDoubleShieldFrameProps {
  className?: string;
}

/**
 * Official crowned double-outline TOTY shield asset rendered with glacier ice-blue gradient.
 */
export function TotyDoubleShieldFrame({
  className = 'w-full h-full',
}: TotyDoubleShieldFrameProps) {
  return (
    <div
      aria-hidden="true"
      className={`toty-mask-shield aspect-[1403.79/2140.39] select-none pointer-events-none ${className}`}
    />
  );
}

interface TotyWordmarkProps {
  size?: 'hero' | 'banner';
}

/**
 * Official Team of the Year vector wordmark rendered in the glacier ice-blue metallic gradient.
 */
export function TotyWordmark({ size = 'banner' }: TotyWordmarkProps) {
  const sizeClass =
    size === 'hero'
      ? 'w-[270px] sm:w-[390px] xl:w-[460px]'
      : 'w-[245px] sm:w-[360px] lg:w-[420px]';

  return (
    <div className="inline-flex items-center max-w-full">
      <span className="sr-only">Team of the Year</span>
      <div
        aria-hidden="true"
        className={`toty-mask-logo max-w-full aspect-[545.9/91.92] drop-shadow-[0_10px_28px_rgba(88,150,255,0.28)] ${sizeClass}`}
      />
    </div>
  );
}
