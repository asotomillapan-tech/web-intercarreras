import { DISCIPLINE_MAP } from '../data/ufroSeed';
import type { NewsArticle, NewsCategory, TournamentState } from '../types/tournament';

export type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; href: string };

export type RichBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; segments: InlineSegment[] }
  | { type: 'quote'; segments: InlineSegment[] }
  | { type: 'list'; items: InlineSegment[][] };

export type EditorToolbarAction = 'bold' | 'italic' | 'heading' | 'list' | 'quote' | 'link';

export const NEWS_CATEGORY_META: Record<
  NewsCategory,
  { label: string; badgeClass: string }
> = {
  ANUNCIO: {
    label: 'Anuncio Oficial',
    badgeClass: 'bg-[#707ef9] text-white',
  },
  DESTACADO: {
    label: 'Destacado',
    badgeClass: 'bg-[#0d0d0d] text-white',
  },
  RESULTADOS: {
    label: 'Resumen de Jornada',
    badgeClass: 'bg-emerald-700 text-white',
  },
  CONVOCATORIA: {
    label: 'Convocatoria',
    badgeClass: 'bg-amber-600 text-white',
  },
  PLAYOFFS: {
    label: 'Playoffs UFRO',
    badgeClass: 'bg-indigo-800 text-white',
  },
};

/**
 * Validates that a URL is strictly safe for href/src attributes (blocks javascript:, data:, vbscript:, etc.).
 */
export function sanitizeSafeNewsUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parses inline markdown-lite formatting (**bold**, *italic*, [label](https://...)) into safe segments.
 */
export function parseInlineSegments(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const tokenRegex = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: line.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      segments.push({ type: 'bold', text: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: 'italic', text: match[3] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const safeHref = sanitizeSafeNewsUrl(match[5]);
      if (safeHref) {
        segments.push({ type: 'link', text: match[4], href: safeHref });
      } else {
        segments.push({ type: 'text', text: match[4] });
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    segments.push({ type: 'text', text: line.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text: line }];
}

/**
 * Safely parses simple formatted text into typed AST blocks for pure React rendering (zero raw HTML injection).
 */
export function parseSimpleRichText(content: string): RichBlock[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const blocks: RichBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: InlineSegment[][] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const text = paragraphLines.join(' ').trim();
      if (text) {
        blocks.push({ type: 'paragraph', segments: parseInlineSegments(text) });
      }
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      const headingText = trimmed.slice(3).trim();
      if (headingText) {
        blocks.push({ type: 'heading', text: headingText });
      }
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph();
      flushList();
      const quoteText = trimmed.slice(2).trim();
      if (quoteText) {
        blocks.push({ type: 'quote', segments: parseInlineSegments(quoteText) });
      }
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      flushParagraph();
      const itemText = trimmed.slice(2).trim();
      if (itemText) {
        listItems.push(parseInlineSegments(itemText));
      }
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * Applies a simple text editor toolbar action to the current textarea selection.
 */
export function applyToolbarFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: EditorToolbarAction
): { nextValue: string; nextStart: number; nextEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n');

  if (action === 'bold') {
    const inner = selected || 'texto destacado';
    const inserted = `**${inner}**`;
    return {
      nextValue: before + inserted + after,
      nextStart: start + 2,
      nextEnd: start + 2 + inner.length,
    };
  }

  if (action === 'italic') {
    const inner = selected || 'texto en cursiva';
    const inserted = `*${inner}*`;
    return {
      nextValue: before + inserted + after,
      nextStart: start + 1,
      nextEnd: start + 1 + inner.length,
    };
  }

  if (action === 'heading') {
    const prefix = needsLeadingNewline ? '\n\n## ' : '## ';
    const inner = selected || 'Subtítulo de la noticia';
    return {
      nextValue: before + prefix + inner + after,
      nextStart: start + prefix.length,
      nextEnd: start + prefix.length + inner.length,
    };
  }

  if (action === 'quote') {
    const prefix = needsLeadingNewline ? '\n\n> ' : '> ';
    const inner = selected || 'Declaración oficial del campeonato';
    return {
      nextValue: before + prefix + inner + after,
      nextStart: start + prefix.length,
      nextEnd: start + prefix.length + inner.length,
    };
  }

  if (action === 'list') {
    const prefix = needsLeadingNewline ? '\n' : '';
    const lines = selected
      ? selected
          .split('\n')
          .map((l) => (l.trim().startsWith('- ') ? l : `- ${l.trim()}`))
          .join('\n')
      : '- Primer punto clave\n- Segundo punto clave';
    return {
      nextValue: before + prefix + lines + after,
      nextStart: start + prefix.length,
      nextEnd: start + prefix.length + lines.length,
    };
  }

  // link
  const label = selected || 'Ver reglamento oficial';
  const inserted = `[${label}](https://intercarreras.vercel.app/)`;
  return {
    nextValue: before + inserted + after,
    nextStart: start + 1,
    nextEnd: start + 1 + label.length,
  };
}

/**
 * Returns published news sorted with featured announcements first, then newest first.
 */
export function sortNewsForHomepage(articles: NewsArticle[]): {
  primary: NewsArticle | null;
  secondary: NewsArticle[];
  allPublished: NewsArticle[];
} {
  const published = articles
    .filter((a) => a.published)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return {
    primary: published[0] ?? null,
    secondary: published.slice(1, 5),
    allPublished: published,
  };
}

/**
 * Builds a concise, PII-free factual snapshot of the current tournament state for automatic AI news briefs.
 */
export function buildTournamentBriefContext(
  state: TournamentState,
  disciplineFilter: string = 'general'
): string {
  const teamMap = new Map(state.teams.map((t) => [t.id, t]));
  const filteredMatches =
    disciplineFilter === 'general'
      ? state.matches
      : state.matches.filter((m) => m.disciplineId === disciplineFilter);
  const filteredPlayers =
    disciplineFilter === 'general'
      ? state.players
      : state.players.filter((p) => p.disciplineId === disciplineFilter);

  const finalized = filteredMatches
    .filter((m) => m.status === 'FINALIZADO')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

  const upcoming = filteredMatches
    .filter((m) => m.status === 'PROGRAMADO')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);

  const topScorers = [...filteredPlayers]
    .filter((p) => p.stats.goles > 0 || p.stats.puntos > 0)
    .sort((a, b) => b.stats.goles + b.stats.puntos - (a.stats.goles + a.stats.puntos))
    .slice(0, 5);

  const openRegs = Object.values(state.configs)
    .filter((c) => c.inscripcionesAbiertas)
    .map((c) => DISCIPLINE_MAP[c.disciplineId].nombreCorto);

  const openTransfers = Object.values(state.configs)
    .filter((c) => c.transferenciasAbiertas)
    .map((c) => DISCIPLINE_MAP[c.disciplineId].nombreCorto);

  const lines: string[] = [
    `Temporada: ${state.temporada}`,
    `Equipos inscritos totales: ${state.teams.length}`,
    `Jugadores registrados totales: ${state.players.length}`,
    `Partidos registrados: ${filteredMatches.length} (${finalized.length} finalizados recientes)`,
  ];

  if (openRegs.length > 0) {
    lines.push(`Disciplinas con inscripciones abiertas: ${openRegs.join(', ')}`);
  }
  if (openTransfers.length > 0) {
    lines.push(`Disciplinas con transferencias abiertas: ${openTransfers.join(', ')}`);
  }

  if (finalized.length > 0) {
    lines.push('Resultados oficiales recientes:');
    for (const m of finalized) {
      const home = teamMap.get(m.homeTeamId)?.nombre ?? m.homeTeamId;
      const away = teamMap.get(m.awayTeamId)?.nombre ?? m.awayTeamId;
      const disc = DISCIPLINE_MAP[m.disciplineId]?.nombreCorto ?? m.disciplineId;
      lines.push(`- [${disc}] ${home} ${m.homeScore} - ${m.awayScore} ${away} (${m.fecha}, ${m.groupName})`);
    }
  }

  if (upcoming.length > 0) {
    lines.push('Próximos partidos programados:');
    for (const m of upcoming) {
      const home = teamMap.get(m.homeTeamId)?.nombre ?? m.homeTeamId;
      const away = teamMap.get(m.awayTeamId)?.nombre ?? m.awayTeamId;
      const disc = DISCIPLINE_MAP[m.disciplineId]?.nombreCorto ?? m.disciplineId;
      lines.push(`- [${disc}] ${home} vs ${away} el ${m.fecha} a las ${m.hora} en ${m.cancha}`);
    }
  }

  if (topScorers.length > 0) {
    lines.push('Figuras estadísticas destacadas:');
    for (const p of topScorers) {
      const team = teamMap.get(p.teamId)?.nombre ?? p.teamId;
      const stat =
        p.stats.goles > 0 ? `${p.stats.goles} goles` : `${p.stats.puntos} puntos`;
      lines.push(`- ${p.nombre} ${p.apellidoPaterno} (${team}): ${stat}`);
    }
  }

  return lines.join('\n').slice(0, 3500);
}
