import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyDocumentSeoMetadata,
  BASE_SITE_DESCRIPTION,
  BASE_SITE_TITLE,
  getEntityPath,
  getSectionPath,
  getSectionTitle,
  normalizePathname,
  resolveRouteFromPath,
  type NavSection,
} from '../domain/navigationRoutes';
import type { Match, NewsArticle, Player, Team, TournamentState } from '../types/tournament';

export function useTournamentRouting(state: TournamentState) {
  const initialRoute = useMemo(() => {
    if (typeof window === 'undefined') {
      return { section: 'inicio' as NavSection, entity: null };
    }
    return resolveRouteFromPath(window.location.pathname);
  }, []);

  const [activeSection, setActiveSection] = useState<NavSection>(() => initialRoute.section);
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [inspectedTeamId, setInspectedTeamId] = useState<string | null>(
    () => (initialRoute.entity?.type === 'team' ? initialRoute.entity.id : null)
  );
  const [activeMatchModalId, setActiveMatchModalId] = useState<string | null>(
    () => (initialRoute.entity?.type === 'match' ? initialRoute.entity.id : null)
  );
  const [activeNewsArticleId, setActiveNewsArticleId] = useState<string | null>(
    () => (initialRoute.entity?.type === 'news' ? initialRoute.entity.id : null)
  );
  const [directNewsArticleFallback, setDirectNewsArticleFallback] = useState<NewsArticle | null>(
    null
  );

  const activeModalMatch: Match | null = useMemo(() => {
    if (!activeMatchModalId) return null;
    return state.matches.find((m) => m.id === activeMatchModalId) ?? null;
  }, [activeMatchModalId, state.matches]);

  const inspectedTeam: Team | null = useMemo(() => {
    if (!inspectedTeamId) return null;
    return state.teams.find((t) => t.id === inspectedTeamId) ?? null;
  }, [inspectedTeamId, state.teams]);

  const activeNewsArticle: NewsArticle | null = useMemo(() => {
    if (!activeNewsArticleId) return null;
    const fromState = state.news.find((n) => n.id === activeNewsArticleId);
    if (fromState) return fromState;
    if (directNewsArticleFallback?.id === activeNewsArticleId) {
      return directNewsArticleFallback;
    }
    return null;
  }, [activeNewsArticleId, state.news, directNewsArticleFallback]);

  const pushOrReplacePath = useCallback((targetPath: string, replace = false) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({}, '', targetPath);
      } else {
        window.history.pushState({}, '', targetPath);
      }
    }
  }, []);

  const syncBrowserUrlForSection = useCallback(
    (section: NavSection, replace = false) => {
      if (typeof window === 'undefined') return;
      const targetPath = getSectionPath(section);
      const currentPath = normalizePathname(window.location.pathname);
      if (currentPath !== targetPath || window.location.pathname !== targetPath) {
        pushOrReplacePath(targetPath, replace);
      }
    },
    [pushOrReplacePath]
  );

  const openTeamModal = useCallback(
    (teamId: string | null) => {
      if (!teamId) {
        setInspectedTeamId(null);
        syncBrowserUrlForSection(activeSection);
        return;
      }
      setActiveMatchModalId(null);
      setActiveNewsArticleId(null);
      setDirectNewsArticleFallback(null);
      setInspectedTeamId(teamId);
      pushOrReplacePath(getEntityPath('team', teamId));
    },
    [activeSection, pushOrReplacePath, syncBrowserUrlForSection]
  );

  const openMatchModal = useCallback(
    (matchId: string | null) => {
      if (!matchId) {
        setActiveMatchModalId(null);
        if (inspectedTeamId) {
          pushOrReplacePath(getEntityPath('team', inspectedTeamId));
        } else {
          syncBrowserUrlForSection(activeSection);
        }
        return;
      }
      setActiveNewsArticleId(null);
      setDirectNewsArticleFallback(null);
      setActiveMatchModalId(matchId);
      pushOrReplacePath(getEntityPath('match', matchId));
    },
    [activeSection, inspectedTeamId, pushOrReplacePath, syncBrowserUrlForSection]
  );

  const openNewsArticle = useCallback(
    (article: NewsArticle | null) => {
      if (!article) {
        setActiveNewsArticleId(null);
        setDirectNewsArticleFallback(null);
        syncBrowserUrlForSection(activeSection);
        return;
      }
      setInspectedTeamId(null);
      setActiveMatchModalId(null);
      setDirectNewsArticleFallback(article);
      setActiveNewsArticleId(article.id);
      pushOrReplacePath(getEntityPath('news', article.id));
    },
    [activeSection, pushOrReplacePath, syncBrowserUrlForSection]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Normalize section aliases without clobbering direct entity URLs
    const resolved = resolveRouteFromPath(window.location.pathname);
    const canonicalPath = resolved.entity
      ? getEntityPath(resolved.entity.type, resolved.entity.id)
      : getSectionPath(resolved.section);
    if (window.location.pathname !== canonicalPath) {
      const searchAndHash = `${window.location.search}${window.location.hash}`;
      window.history.replaceState({}, '', `${canonicalPath}${searchAndHash}`);
    }

    const onPopState = () => {
      const next = resolveRouteFromPath(window.location.pathname);
      setActiveSection(next.section);
      if (next.section !== 'jugadores') {
        setInspectedPlayer(null);
      }
      setInspectedTeamId(next.entity?.type === 'team' ? next.entity.id : null);
      setActiveMatchModalId(next.entity?.type === 'match' ? next.entity.id : null);
      setActiveNewsArticleId(next.entity?.type === 'news' ? next.entity.id : null);
      if (next.entity?.type !== 'news') {
        setDirectNewsArticleFallback(null);
      }
      if (!next.entity) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Dynamically update document.title, canonical URL, and OpenGraph meta tags
  useEffect(() => {
    if (activeNewsArticle) {
      applyDocumentSeoMetadata({
        title: `${activeNewsArticle.title} · ${BASE_SITE_TITLE}`,
        description: activeNewsArticle.summary || BASE_SITE_DESCRIPTION,
        pathname: getEntityPath('news', activeNewsArticle.id),
        imageUrl: activeNewsArticle.coverImageUrl || undefined,
        ogType: 'article',
      });
      return;
    }

    if (activeModalMatch) {
      const home = state.teams.find((t) => t.id === activeModalMatch.homeTeamId)?.nombre ?? 'Local';
      const away = state.teams.find((t) => t.id === activeModalMatch.awayTeamId)?.nombre ?? 'Visita';
      const scorePart =
        activeModalMatch.status === 'FINALIZADO' || activeModalMatch.status === 'EN_VIVO'
          ? `${activeModalMatch.homeScore} - ${activeModalMatch.awayScore}`
          : 'vs';
      applyDocumentSeoMetadata({
        title: `${home} ${scorePart} ${away} · ${BASE_SITE_TITLE}`,
        description: `Ficha oficial del partido ${home} vs ${away} (${activeModalMatch.fecha} · ${activeModalMatch.hora} · ${activeModalMatch.cancha}).`,
        pathname: getEntityPath('match', activeModalMatch.id),
      });
      return;
    }

    if (inspectedTeam) {
      applyDocumentSeoMetadata({
        title: `${inspectedTeam.nombre} · ${BASE_SITE_TITLE}`,
        description: `Perfil oficial de ${inspectedTeam.nombre} (${inspectedTeam.carrera}): plantel, resultados y estadísticas en el Campeonato Intercarreras UFRO.`,
        pathname: getEntityPath('team', inspectedTeam.id),
      });
      return;
    }

    applyDocumentSeoMetadata({
      title: getSectionTitle(activeSection),
      description: BASE_SITE_DESCRIPTION,
      pathname: getSectionPath(activeSection),
    });
  }, [activeSection, activeNewsArticle, activeModalMatch, inspectedTeam, state.teams]);

  const handleNavigate = useCallback(
    (section: NavSection) => {
      setActiveSection(section);
      setInspectedTeamId(null);
      setActiveMatchModalId(null);
      setActiveNewsArticleId(null);
      setDirectNewsArticleFallback(null);
      if (section !== 'jugadores') {
        setInspectedPlayer(null);
      }
      syncBrowserUrlForSection(section);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [syncBrowserUrlForSection]
  );

  return {
    activeSection,
    setActiveSection,
    inspectedPlayer,
    setInspectedPlayer,
    inspectedTeamId,
    inspectedTeam,
    openTeamModal,
    activeMatchModalId,
    activeModalMatch,
    openMatchModal,
    activeNewsArticleId,
    activeNewsArticle,
    openNewsArticle,
    syncBrowserUrlForSection,
    handleNavigate,
  };
}
