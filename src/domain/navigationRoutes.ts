export type NavSection =
  | 'inicio'
  | 'posiciones'
  | 'equipos'
  | 'jugadores'
  | 'votaciones'
  | 'minijuegos'
  | 'galeria'
  | 'inscripciones'
  | 'transferencias'
  | 'transferencias-publicas'
  | 'cuenta'
  | 'panel'
  | 'privacidad';

export const BASE_SITE_TITLE = 'Campeonato Intercarreras UFRO';

export const SECTION_ROUTE_PATHS: Record<NavSection, string> = {
  inicio: '/',
  posiciones: '/tabla-posiciones',
  equipos: '/equipos',
  jugadores: '/jugadores',
  votaciones: '/votaciones',
  minijuegos: '/minijuegos',
  galeria: '/galeria',
  inscripciones: '/inscripciones',
  transferencias: '/transferencias',
  'transferencias-publicas': '/transferencias-oficiales',
  cuenta: '/mi-cuenta',
  panel: '/panel',
  privacidad: '/privacidad',
};

export const SECTION_PAGE_TITLES: Record<NavSection, string> = {
  inicio: BASE_SITE_TITLE,
  posiciones: `Tabla de Posiciones · ${BASE_SITE_TITLE}`,
  equipos: `Equipos · ${BASE_SITE_TITLE}`,
  jugadores: `Jugadores · ${BASE_SITE_TITLE}`,
  votaciones: `Votaciones · ${BASE_SITE_TITLE}`,
  minijuegos: `Minijuegos · ${BASE_SITE_TITLE}`,
  galeria: `Galería · ${BASE_SITE_TITLE}`,
  inscripciones: `Inscripciones · ${BASE_SITE_TITLE}`,
  transferencias: `Transferencias · ${BASE_SITE_TITLE}`,
  'transferencias-publicas': `Transferencias Oficiales · ${BASE_SITE_TITLE}`,
  cuenta: `Mi Cuenta · ${BASE_SITE_TITLE}`,
  panel: `Panel Oficial · ${BASE_SITE_TITLE}`,
  privacidad: `Política de Privacidad · ${BASE_SITE_TITLE}`,
};

/**
 * Primary navigation links shown in the top header.
 * "Inicio" is intentionally omitted because "/" is the main site accessible via the brand logo.
 */
export const HEADER_NAV_ITEMS: ReadonlyArray<{ id: NavSection; label: string; href: string }> = [
  { id: 'posiciones', label: 'Posiciones', href: SECTION_ROUTE_PATHS.posiciones },
  { id: 'equipos', label: 'Equipos', href: SECTION_ROUTE_PATHS.equipos },
  { id: 'jugadores', label: 'Jugadores', href: SECTION_ROUTE_PATHS.jugadores },
  { id: 'votaciones', label: 'Votaciones', href: SECTION_ROUTE_PATHS.votaciones },
  { id: 'minijuegos', label: 'Minijuegos', href: SECTION_ROUTE_PATHS.minijuegos },
  { id: 'galeria', label: 'Galería', href: SECTION_ROUTE_PATHS.galeria },
  { id: 'inscripciones', label: 'Inscripciones', href: SECTION_ROUTE_PATHS.inscripciones },
];

const PATH_TO_SECTION_MAP: Readonly<Record<string, NavSection>> = {
  '/': 'inicio',
  '/inicio': 'inicio',
  '/tabla-posiciones': 'posiciones',
  '/posiciones': 'posiciones',
  '/equipos': 'equipos',
  '/jugadores': 'jugadores',
  '/votaciones': 'votaciones',
  '/minijuegos': 'minijuegos',
  '/galeria': 'galeria',
  '/inscripciones': 'inscripciones',
  '/transferencias': 'transferencias',
  '/transferencias-oficiales': 'transferencias-publicas',
  '/mi-cuenta': 'cuenta',
  '/cuenta': 'cuenta',
  '/panel': 'panel',
  '/privacidad': 'privacidad',
  '/politica-de-privacidad': 'privacidad',
  '/privacy': 'privacidad',
  '/privacy-policy': 'privacidad',
};

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const withoutQueryOrHash = pathname.split(/[?#]/)[0] || '/';
  const collapsed = withoutQueryOrHash.replace(/\/+/g, '/');
  const trimmed = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
  return (trimmed || '/').toLowerCase();
}

export function getSectionPath(section: NavSection): string {
  return SECTION_ROUTE_PATHS[section] ?? '/';
}

export function getSectionTitle(section: NavSection): string {
  return SECTION_PAGE_TITLES[section] ?? BASE_SITE_TITLE;
}

export function resolveSectionFromPath(pathname: string): NavSection {
  const normalized = normalizePathname(pathname);
  return PATH_TO_SECTION_MAP[normalized] ?? 'inicio';
}

export function isPrimarySpaNavigationClick(event: {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
