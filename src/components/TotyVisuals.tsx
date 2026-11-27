import { LOGO_LIGHT_SVG } from '../data/ufroSeed';

interface TotyCrestBadgeProps {
  className?: string;
}

/**
 * Geometric crowned TOTY shield emblem inspired by the official TOTYs identity.
 */
export function TotyCrestBadge({ className = 'w-9 h-10' }: TotyCrestBadgeProps) {
  return (
    <svg
      viewBox="0 0 44 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Subtle 3-point crown perched on top rim */}
      <path
        d="M17.5 11.5L16.5 6.8L20 9.4L22 5.2L24 9.4L27.5 6.8L26.5 11.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Shield outline */}
      <path
        d="M6.5 11.5H37.5V35.2C37.5 38.4 35.4 41.1 32.3 42.1L22 45.6L11.7 42.1C8.6 41.1 6.5 38.4 6.5 35.2V11.5Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Stacked geometric TO / TY */}
      <text
        x="22"
        y="24.5"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="11.5"
        letterSpacing="0.06em"
      >
        TO
      </text>
      <text
        x="22"
        y="36.2"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="11.5"
        letterSpacing="0.08em"
      >
        TY
      </text>
    </svg>
  );
}

interface TotyCoBrandLockupProps {
  compact?: boolean;
}

/**
 * UFRO Intercarreras isotipo paired with the TOTY crowned crest.
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
      <TotyCrestBadge className={compact ? 'w-7 h-8 text-[#e6f3ff]' : 'w-8 h-9 sm:w-9 sm:h-10 text-[#e6f3ff]'} />
    </div>
  );
}

interface TotyDoubleShieldFrameProps {
  className?: string;
}

/**
 * Architectural ice-blue double-outline shield motif from the TOTYs visual system.
 */
export function TotyDoubleShieldFrame({
  className = 'w-full h-full',
}: TotyDoubleShieldFrameProps) {
  return (
    <svg
      viewBox="0 0 360 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="toty-shield-stroke" x1="180" y1="12" x2="180" y2="428" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2f1ff" stopOpacity="0.92" />
          <stop offset="52%" stopColor="#9ec8ff" stopOpacity="0.58" />
          <stop offset="100%" stopColor="#cce4ff" stopOpacity="0.88" />
        </linearGradient>
      </defs>
      {/* Outer shield */}
      <path
        d="M24 22H336V322C336 348 318 371 292 379L180 416L68 379C42 371 24 348 24 322V22Z"
        stroke="url(#toty-shield-stroke)"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      {/* Inner offset shield */}
      <path
        d="M40 38H320V316C320 335 307 352 288 358L180 394L72 358C53 352 40 335 40 316V38Z"
        stroke="url(#toty-shield-stroke)"
        strokeWidth="2.4"
        strokeOpacity="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface TotyWordmarkProps {
  size?: 'hero' | 'banner';
}

/**
 * Signature Inter Display + Playfair Display italic "Team of the Year" lockup
 * rendered with the glacier ice-blue metallic gradient.
 */
export function TotyWordmark({ size = 'banner' }: TotyWordmarkProps) {
  const isHero = size === 'hero';
  return (
    <div
      className={`inline-flex items-baseline flex-wrap gap-x-2.5 sm:gap-x-3.5 leading-[0.95] select-none ${
        isHero
          ? 'text-5xl sm:text-6xl xl:text-[4.35rem]'
          : 'text-4xl sm:text-5xl lg:text-[3.65rem]'
      }`}
    >
      <span className="font-display font-semibold italic tracking-[-0.04em] toty-text-ice pr-0.5">
        Team
      </span>
      <span
        className={`inline-flex flex-col items-center justify-center font-editorial toty-text-ice leading-[0.72] self-center ${
          isHero ? 'text-2xl sm:text-3xl xl:text-[2.15rem] -mx-0.5' : 'text-xl sm:text-2xl lg:text-[1.85rem] -mx-0.5'
        }`}
      >
        <span>of</span>
        <span>the</span>
      </span>
      <span className="font-display font-semibold italic tracking-[-0.04em] toty-text-ice pr-1">
        Year
      </span>
    </div>
  );
}
