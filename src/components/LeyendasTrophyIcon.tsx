interface LeyendasTrophyIconProps {
  title: string;
  kind?: 'trophy' | 'award';
  size?: 'sm' | 'md' | 'lg';
}

export function LeyendasTrophyIcon({
  title,
  kind = 'trophy',
  size = 'md',
}: LeyendasTrophyIconProps) {
  const dim = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-11 h-11' : 'w-8 h-8';
  const lower = title.toLowerCase();

  if (kind === 'award') {
    const isMvp = lower.includes('mvp');
    const isGlove = lower.includes('guante');
    const isScorer = lower.includes('goleador') || lower.includes('anotador');

    if (isMvp) {
      return (
        <svg viewBox="0 0 36 36" className={`${dim} shrink-0`} aria-hidden="true">
          <rect x="2" y="2" width="32" height="32" fill="#0d0d0d" />
          <polygon
            points="18,6 21.5,13.5 29.5,14.5 23.5,20 25,28 18,24 11,28 12.5,20 6.5,14.5 14.5,13.5"
            fill="#f59e0b"
          />
          <circle cx="18" cy="18" r="3.2" fill="#0d0d0d" />
        </svg>
      );
    }

    if (isGlove) {
      return (
        <svg viewBox="0 0 36 36" className={`${dim} shrink-0`} aria-hidden="true">
          <rect x="2" y="2" width="32" height="32" fill="#0d0d0d" />
          <path
            d="M11 26V14a2 2 0 0 1 4 0v4h1v-6a2 2 0 0 1 4 0v6h1v-5a2 2 0 0 1 4 0v10c0 3-2.5 5-6 5h-4c-2.5 0-4-1.5-4-2z"
            fill="#707ef9"
          />
        </svg>
      );
    }

    if (isScorer) {
      return (
        <svg viewBox="0 0 36 36" className={`${dim} shrink-0`} aria-hidden="true">
          <rect x="2" y="2" width="32" height="32" fill="#0d0d0d" />
          <circle cx="18" cy="16" r="7.5" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
          <circle cx="18" cy="16" r="2.8" fill="#ffffff" />
          <rect x="11" y="26" width="14" height="3" fill="#707ef9" />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 36 36" className={`${dim} shrink-0`} aria-hidden="true">
        <rect x="2" y="2" width="32" height="32" fill="#0d0d0d" />
        <circle cx="18" cy="15" r="7" fill="#707ef9" />
        <polygon points="14,22 18,30 22,22" fill="#f59e0b" />
        <circle cx="18" cy="15" r="3" fill="#ffffff" />
      </svg>
    );
  }

  // Trophies
  const isSeleccion = lower.includes('selección') || lower.includes('fenaude') || lower.includes('ldes') || lower.includes('cnu');
  const isInterfac = lower.includes('interfacultades');
  const isCopaFac = lower.includes('copa facultad');

  const cupColor = isSeleccion
    ? '#707ef9'
    : isInterfac
    ? '#10b981'
    : isCopaFac
    ? '#cbd5e1'
    : '#f59e0b';

  return (
    <svg viewBox="0 0 36 36" className={`${dim} shrink-0`} aria-hidden="true">
      <rect x="2" y="2" width="32" height="32" fill="#0d0d0d" />
      <path
        d="M11 8h14v7a7 7 0 0 1-14 0V8z"
        fill={cupColor}
      />
      <path
        d="M11 10H7.5a3.5 3.5 0 0 0 3.5 5M25 10h3.5a3.5 3.5 0 0 1-3.5 5"
        fill="none"
        stroke={cupColor}
        strokeWidth="2"
      />
      <rect x="16" y="21" width="4" height="5" fill={cupColor} />
      <rect x="11" y="26" width="14" height="3.2" fill="#ffffff" />
    </svg>
  );
}
