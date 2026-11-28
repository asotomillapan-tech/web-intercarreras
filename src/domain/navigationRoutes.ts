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

export type EntityDeepLinkType = 'team' | 'match' | 'news';

export interface EntityDeepLink {
  type: EntityDeepLinkType;
  id: string;
}

export interface ResolvedAppRoute {
  section: NavSection;
  entity: EntityDeepLink | null;
}

export const BASE_SITE_TITLE = 'Campeonato Intercarreras UFRO';
export const BASE_SITE_DESCRIPTION =
  'Marcadores en vivo, tablas de posiciones, planteles, votaciones TOTY y noticias oficiales del Campeonato Intercarreras de la Universidad de La Frontera.';
export const DEFAULT_OG_IMAGE_PATH = '/og-intercarreras.png';

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
  '/partidos': 'posiciones',
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
  '/noticias': 'inicio',
  '/privacidad': 'privacidad',
  '/politica-de-privacidad': 'privacidad',
  '/privacy': 'privacidad',
  '/privacy-policy': 'privacidad',
};

const ENTITY_PREFIX_TO_CONFIG: Readonly<
  Record<string, { type: EntityDeepLinkType; section: NavSection }>
> = {
  equipos: { type: 'team', section: 'equipos' },
  equipo: { type: 'team', section: 'equipos' },
  partidos: { type: 'match', section: 'posiciones' },
  partido: { type: 'match', section: 'posiciones' },
  noticias: { type: 'news', section: 'inicio' },
  noticia: { type: 'news', section: 'inicio' },
};

function cleanRawPathname(pathname: string): string {
  if (!pathname) return '/';
  const withoutQueryOrHash = pathname.split(/[?#]/)[0] || '/';
  const collapsed = withoutQueryOrHash.replace(/\/+/g, '/');
  const trimmed = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
  return trimmed || '/';
}

export function normalizePathname(pathname: string): string {
  return cleanRawPathname(pathname).toLowerCase();
}

export function getSectionPath(section: NavSection): string {
  return SECTION_ROUTE_PATHS[section] ?? '/';
}

export function getEntityPath(type: EntityDeepLinkType, id: string): string {
  const safeId = encodeURIComponent(id.trim());
  switch (type) {
    case 'team':
      return `/equipos/${safeId}`;
    case 'match':
      return `/partidos/${safeId}`;
    case 'news':
      return `/noticias/${safeId}`;
  }
}

export function buildShareUrl(origin: string, type: EntityDeepLinkType, id: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}${getEntityPath(type, id)}`;
}

export function getSectionTitle(section: NavSection): string {
  return SECTION_PAGE_TITLES[section] ?? BASE_SITE_TITLE;
}

export function resolveRouteFromPath(pathname: string): ResolvedAppRoute {
  const rawClean = cleanRawPathname(pathname);
  const segments = rawClean.split('/').filter(Boolean);

  if (segments.length >= 2) {
    const prefix = segments[0].toLowerCase();
    const config = ENTITY_PREFIX_TO_CONFIG[prefix];
    if (config) {
      let decodedId = segments[1];
      try {
        decodedId = decodeURIComponent(segments[1]);
      } catch {
        decodedId = segments[1];
      }
      const trimmedId = decodedId.trim();
      if (trimmedId) {
        return {
          section: config.section,
          entity: { type: config.type, id: trimmedId },
        };
      }
    }
  }

  const normalized = rawClean.toLowerCase();
  return {
    section: PATH_TO_SECTION_MAP[normalized] ?? 'inicio',
    entity: null,
  };
}

export function resolveSectionFromPath(pathname: string): NavSection {
  return resolveRouteFromPath(pathname).section;
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

export interface ClientSeoMetaInput {
  title: string;
  description?: string;
  pathname?: string;
  imageUrl?: string;
  ogType?: 'website' | 'article';
}

function upsertHeadMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function applyDocumentSeoMetadata(input: ClientSeoMetaInput): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const title = input.title || BASE_SITE_TITLE;
  const description = input.description || BASE_SITE_DESCRIPTION;
  const origin = window.location.origin;
  const path = input.pathname ?? window.location.pathname;
  const canonicalUrl = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  const rawImage = input.imageUrl || DEFAULT_OG_IMAGE_PATH;
  const absoluteImage = /^https?:\/\//i.test(rawImage)
    ? rawImage
    : `${origin}${rawImage.startsWith('/') ? rawImage : `/${rawImage}`}`;

  document.title = title;
  upsertHeadMeta('name', 'description', description);
  upsertHeadMeta('property', 'og:type', input.ogType ?? 'website');
  upsertHeadMeta('property', 'og:title', title);
  upsertHeadMeta('property', 'og:description', description);
  upsertHeadMeta('property', 'og:url', canonicalUrl);
  upsertHeadMeta('property', 'og:image', absoluteImage);
  upsertHeadMeta('name', 'twitter:title', title);
  upsertHeadMeta('name', 'twitter:description', description);
  upsertHeadMeta('name', 'twitter:image', absoluteImage);

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);
}
