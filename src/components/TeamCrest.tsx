interface TeamCrestProps {
  escudo?: string;
  sigla: string;
  nombre: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  surface?: 'light' | 'dark';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<TeamCrestProps['size']>, { box: string; text: string }> = {
  xs: { box: 'w-6 h-6', text: 'text-[10px]' },
  sm: { box: 'w-8 h-8', text: 'text-[11px]' },
  md: { box: 'w-11 h-11', text: 'text-xs' },
  lg: { box: 'w-14 h-14', text: 'text-sm' },
  xl: { box: 'w-20 h-20', text: 'text-lg' },
};

export function TeamCrest({
  escudo,
  sigla,
  nombre,
  size = 'md',
  surface = 'light',
  className = '',
}: TeamCrestProps) {
  const dim = SIZE_CLASSES[size];
  const safeSigla = (sigla || nombre.slice(0, 3) || 'EQ').toUpperCase().slice(0, 4);

  if (escudo && (escudo.startsWith('data:image/') || /^https?:\/\//i.test(escudo))) {
    return (
      <div
        className={`${dim.box} shrink-0 flex items-center justify-center overflow-hidden ${className}`}
        title={`Escudo de ${nombre}`}
      >
        <img
          src={escudo}
          alt={`Escudo ${nombre}`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim.box} shrink-0 flex items-center justify-center font-display font-bold uppercase tracking-wider border ${
        surface === 'dark'
          ? 'bg-white/10 text-white border-white/15'
          : 'bg-[#0d0d0d] text-white border-neutral-800'
      } ${dim.text} ${className}`}
      title={nombre}
      aria-label={`Monograma ${nombre}`}
    >
      {safeSigla}
    </div>
  );
}
