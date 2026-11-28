import {
  BASE_SITE_DESCRIPTION,
  BASE_SITE_TITLE,
  DEFAULT_OG_IMAGE_PATH,
  getSectionTitle,
  resolveRouteFromPath,
} from '../src/domain/navigationRoutes.ts';
import { getTursoClient, isTursoConfigured } from './tursoClient.ts';

export interface ServerSeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  ogType: 'website' | 'article';
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function resolvePublicOrigin(params: {
  envAppUrl?: string;
  protocol?: string;
  host?: string;
}): string {
  const envUrl = (params.envAppUrl || '').trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, '');
  }
  const host = (params.host || '').trim();
  if (host) {
    const proto = (params.protocol || 'https').split(',')[0].trim() || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function toAbsoluteImageUrl(origin: string, rawUrl?: string | null): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return `${cleanOrigin}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${cleanOrigin}${trimmed}`;
  return `${cleanOrigin}${DEFAULT_OG_IMAGE_PATH}`;
}

export function injectOpenGraphMetadata(html: string, meta: ServerSeoMetadata): string {
  const safeTitle = escapeHtmlAttr(meta.title);
  const safeDesc = escapeHtmlAttr(meta.description);
  const safeCanonical = escapeHtmlAttr(meta.canonicalUrl);
  const safeImage = escapeHtmlAttr(meta.imageUrl);
  const safeType = escapeHtmlAttr(meta.ogType);

  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);

  const replaceOrAppendMeta = (attr: 'name' | 'property', key: string, value: string) => {
    const pattern = new RegExp(
      `<meta\\s+[^>]*${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
      'i'
    );
    const replacement = `<meta ${attr}="${key}" content="${value}" />`;
    if (pattern.test(out)) {
      out = out.replace(pattern, replacement);
    } else {
      out = out.replace('</head>', `    ${replacement}\n  </head>`);
    }
  };

  replaceOrAppendMeta('name', 'description', safeDesc);
  replaceOrAppendMeta('property', 'og:type', safeType);
  replaceOrAppendMeta('property', 'og:title', safeTitle);
  replaceOrAppendMeta('property', 'og:description', safeDesc);
  replaceOrAppendMeta('property', 'og:url', safeCanonical);
  replaceOrAppendMeta('property', 'og:image', safeImage);
  replaceOrAppendMeta('name', 'twitter:title', safeTitle);
  replaceOrAppendMeta('name', 'twitter:description', safeDesc);
  replaceOrAppendMeta('name', 'twitter:image', safeImage);

  const canonicalRegex = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  const canonicalTag = `<link rel="canonical" href="${safeCanonical}" />`;
  if (canonicalRegex.test(out)) {
    out = out.replace(canonicalRegex, canonicalTag);
  } else {
    out = out.replace('</head>', `    ${canonicalTag}\n  </head>`);
  }

  return out;
}

function safeParseObj<T>(raw: unknown): T | null {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function resolveServerSeoMetadata(
  pathname: string,
  origin: string
): Promise<ServerSeoMetadata> {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const route = resolveRouteFromPath(pathname);
  const cleanPath = pathname.split(/[?#]/)[0] || '/';
  const fallback: ServerSeoMetadata = {
    title: getSectionTitle(route.section),
    description: BASE_SITE_DESCRIPTION,
    canonicalUrl: `${cleanOrigin}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`,
    imageUrl: toAbsoluteImageUrl(cleanOrigin, DEFAULT_OG_IMAGE_PATH),
    ogType: 'website',
  };

  if (!route.entity || !isTursoConfigured()) {
    return fallback;
  }

  try {
    const client = getTursoClient();

    if (route.entity.type === 'team') {
      const rs = await client.execute({
        sql: 'SELECT nombre, data_json FROM teams WHERE id = ? LIMIT 1',
        args: [route.entity.id],
      });
      if (rs.rows.length > 0) {
        const team = safeParseObj<{
          nombre?: string;
          carrera?: string;
          facultad?: string;
          groupName?: string;
        }>(rs.rows[0].data_json);
        const teamName = team?.nombre || String(rs.rows[0].nombre || '').trim();
        if (teamName) {
          const detailParts = [team?.carrera, team?.facultad, team?.groupName].filter(Boolean);
          return {
            ...fallback,
            title: `${teamName} · ${BASE_SITE_TITLE}`,
            description:
              detailParts.length > 0
                ? `Perfil oficial de ${teamName} (${detailParts.join(' · ')}): plantel, estadísticas y próximos partidos en el Campeonato Intercarreras UFRO.`
                : `Perfil oficial de ${teamName}: plantel, estadísticas y calendario en el Campeonato Intercarreras UFRO.`,
          };
        }
      }
    }

    if (route.entity.type === 'match') {
      const rs = await client.execute({
        sql: 'SELECT data_json FROM matches WHERE id = ? LIMIT 1',
        args: [route.entity.id],
      });
      if (rs.rows.length > 0) {
        const match = safeParseObj<{
          homeTeamId?: string;
          awayTeamId?: string;
          homeScore?: number;
          awayScore?: number;
          status?: string;
          fecha?: string;
          hora?: string;
          cancha?: string;
          fase?: string;
        }>(rs.rows[0].data_json);
        if (match?.homeTeamId && match?.awayTeamId) {
          const teamsRs = await client.execute({
            sql: 'SELECT id, nombre FROM teams WHERE id IN (?, ?)',
            args: [match.homeTeamId, match.awayTeamId],
          });
          const names = new Map<string, string>();
          for (const row of teamsRs.rows) {
            names.set(String(row.id), String(row.nombre));
          }
          const homeName = names.get(match.homeTeamId) || 'Local';
          const awayName = names.get(match.awayTeamId) || 'Visita';
          const hasScore = match.status === 'FINALIZADO' || match.status === 'EN_VIVO';
          const scoreLabel = hasScore
            ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
            : 'vs';
          const venueParts = [match.fase, match.fecha, match.hora, match.cancha].filter(Boolean);
          return {
            ...fallback,
            title: `${homeName} ${scoreLabel} ${awayName} · ${BASE_SITE_TITLE}`,
            description:
              venueParts.length > 0
                ? `Ficha oficial del partido ${homeName} vs ${awayName} (${venueParts.join(' · ')}). Revisa marcador, planilla y votación POTM.`
                : `Ficha oficial del partido ${homeName} vs ${awayName} en el Campeonato Intercarreras UFRO.`,
          };
        }
      }
    }

    if (route.entity.type === 'news') {
      const rs = await client.execute({
        sql: "SELECT data_json FROM news WHERE id = ? AND status = 'PUBLICADA' LIMIT 1",
        args: [route.entity.id],
      });
      if (rs.rows.length > 0) {
        const article = safeParseObj<{
          title?: string;
          summary?: string;
          coverImageUrl?: string;
        }>(rs.rows[0].data_json);
        if (article?.title) {
          return {
            ...fallback,
            title: `${article.title} · ${BASE_SITE_TITLE}`,
            description: article.summary?.trim() || BASE_SITE_DESCRIPTION,
            imageUrl: toAbsoluteImageUrl(cleanOrigin, article.coverImageUrl),
            ogType: 'article',
          };
        }
      }
    }
  } catch {
    // Graceful fallback to static championship card if DB lookup fails
  }

  return fallback;
}
