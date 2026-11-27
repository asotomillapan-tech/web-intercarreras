interface TeamCrestProps {
  escudo?: string;
  sigla: string;
  nombre: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  surface?: 'light' | 'dark';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<TeamCrestProps['size']>, { box: string; text: string }> = {
  xs: { box: 'w-6 h-6 rounded-lg', text: 'text-[10px]' },
  sm: { box: 'w-8 h-8 rounded-lg', text: 'text-[11px]' },
  md: { box: 'w-11 h-11 rounded-xl', text: 'text-xs' },
  lg: { box: 'w-14 h-14 rounded-2xl', text: 'text-sm' },
  xl: { box: 'w-20 h-20 rounded-2xl', text: 'text-lg' },
};

export function TeamCrest({
  escudo,
  sigla,
  nombre,
  size = 'md',
  surface = 'dark',
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
      className={`${dim.box} shrink-0 flex items-center justify-center font-semibold tracking-tight border ${
        surface === 'light'
          ? 'bg-zinc-900 text-white border-zinc-800'
          : 'bg-white/[0.06] text-zinc-100 border-white/[0.12]'
      } ${dim.text} ${className}`}
      title={nombre}
      aria-label={`Monograma ${nombre}`}
    >
      {safeSigla}
    </div>
  );
}
