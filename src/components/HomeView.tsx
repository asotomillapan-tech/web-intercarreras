import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  ChevronRight,
  Lock,
  MapPin,
  Newspaper,
  Sparkles,
  Star,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  LOGO_COLOR_SVG,
  LOGO_LIGHT_SVG,
} from '../data/ufroSeed';
import {
  filterMatchesByOrg,
  groupMatchesByOrg,
  sortMatchesChronologically,
  type MatchGroupByMode,
  type MatchSortOrder,
} from '../domain/matchFilterEngine';
import {
  NEWS_CATEGORY_META,
  sanitizeSafeNewsUrl,
  sortNewsForHomepage,
} from '../domain/newsFormatter';
import {
  canManageNews,
  canRefereeMatches,
  canVoteMatchMvp,
  computeMatchMvpStandings,
  shouldRevealPublicMatchData,
} from '../domain/rbacEngine';
import { computeStandings } from '../domain/tournamentEngine';
import type { Editorial2025Photos } from '../services/googleDrive';
import type {
  AppUserProfile,
  DisciplineId,
  Match,
  NewsArticle,
  Player,
  TournamentState,
} from '../types/tournament';
import { HomeMatchCalendar } from './HomeMatchCalendar';
import { HomeTransfersSection } from './HomeTransfersSection';
import { MatchFilterBar } from './MatchFilterBar';
import { EDITORIAL_EASE, RevealSection, SectionKicker } from './MotionPrimitives';
import type { NavSection } from './Navbar';

interface HomeViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  selectedDiscipline: DisciplineId;
  editorialPhotos: Editorial2025Photos | null;
  onSelectDiscipline: (id: DisciplineId) => void;
  onNavigate: (section: NavSection) => void;
  onInspectPlayer: (player: Player) => void;
  onInspectTeam: (teamId: string) => void;
  onOpenMatchModal: (match: Match) => void;
  onOpenMatchInReferee: (matchId: string) => void;
  onOpenNewsArticle: (article: NewsArticle) => void;
  onOpenNewsManager: () => void;
  onOpenFeaturedManager?: () => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onOpenAuth: () => void;
}

function formatNewsDateEs(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function HomeView({
  state,
  currentUser,
  selectedDiscipline,
  editorialPhotos,
  onSelectDiscipline,
  onNavigate,
  onInspectPlayer,
  onInspectTeam,
  onOpenMatchModal,
  onOpenMatchInReferee,
  onOpenNewsArticle,
  onOpenNewsManager,
  onOpenFeaturedManager,
  onToggleFavoriteTeam,
  onOpenAuth,
}: HomeViewProps) {
  const [matchFilter, setMatchFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [matchGroupFilter, setMatchGroupFilter] = useState<'ALL' | string>('ALL');
  const [matchStageFilter, setMatchStageFilter] = useState<'ALL' | Match['fase']>('ALL');
  const [matchGroupBy, setMatchGroupBy] = useState<MatchGroupByMode>('none');
  const [matchSortOrder, setMatchSortOrder] = useState<MatchSortOrder>('newest');

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const activeWindowMatches = useMemo(
    () => state.matches.filter((m) => m.status === 'EN_VIVO'),
    [state.matches]
  );

  const chronologicallyNewestMatches = useMemo(
    () => sortMatchesChronologically(state.matches, 'newest'),
    [state.matches]
  );

  const homeFeaturedConfig = state.homeFeatured;
  const isCustomHeroFeatured =
    homeFeaturedConfig?.mode === 'custom' && Boolean(homeFeaturedConfig.customTitle?.trim());

  const featuredMatch: Match | undefined = useMemo(() => {
    if (isCustomHeroFeatured) return undefined;
    if (homeFeaturedConfig?.mode === 'match' && homeFeaturedConfig.matchId) {
      const explicit = state.matches.find((m) => m.id === homeFeaturedConfig.matchId);
      if (explicit) return explicit;
    }
    return activeWindowMatches[0] ?? chronologicallyNewestMatches[0];
  }, [
    isCustomHeroFeatured,
    homeFeaturedConfig,
    state.matches,
    activeWindowMatches,
    chronologicallyNewestMatches,
  ]);

  const visibleMatches = useMemo(() => {
    const filtered = filterMatchesByOrg(state.matches, {
      disciplineId: matchFilter,
      groupName: matchGroupFilter,
      fase: matchStageFilter,
    });
    const ordered = sortMatchesChronologically(filtered, matchSortOrder);
    return ordered.slice(0, matchGroupBy === 'none' ? 8 : 24);
  }, [state.matches, matchFilter, matchGroupFilter, matchStageFilter, matchGroupBy, matchSortOrder]);

  const visibleMatchSections = useMemo(() => {
    const labels = Object.fromEntries(DISCIPLINES.map((d) => [d.id, d.nombre])) as Record<
      DisciplineId,
      string
    >;
    return groupMatchesByOrg(
      visibleMatches,
      matchGroupBy,
      labels,
      DISCIPLINES.map((d) => d.id)
    );
  }, [visibleMatches, matchGroupBy]);

  const activeDisciplineMeta = DISCIPLINE_MAP[selectedDiscipline];

  const quickStandings = useMemo(() => {
    const groupATeams = state.teams.filter(
      (t) => t.disciplineId === selectedDiscipline && t.groupName === 'Grupo A'
    );
    const groupAMatches = state.matches.filter(
      (m) => m.disciplineId === selectedDiscipline && m.groupName === 'Grupo A'
    );
    return computeStandings(activeDisciplineMeta.sportType, groupATeams, groupAMatches).slice(0, 5);
  }, [state.teams, state.matches, selectedDiscipline, activeDisciplineMeta.sportType]);

  const topLeaders = useMemo(() => {
    const discPlayers = state.players.filter((p) => p.disciplineId === selectedDiscipline);
    const sorted = [...discPlayers].sort((a, b) => {
      if (activeDisciplineMeta.sportType === 'futbol7') {
        if (b.stats.goles !== a.stats.goles) return b.stats.goles - a.stats.goles;
        return b.stats.asistencias - a.stats.asistencias;
      }
      return b.stats.puntos - a.stats.puntos;
    });
    return sorted.slice(0, 5);
  }, [state.players, selectedDiscipline, activeDisciplineMeta.sportType]);

  const isOfficial = canRefereeMatches(currentUser);
  const canEditNews = canManageNews(currentUser);
  const featuredVoteCount = featuredMatch
    ? computeMatchMvpStandings(featuredMatch.id, state.mvpVotes).totalVotes
    : 0;

  const {
    primary: leadNews,
    secondary: secondaryNews,
    allPublished: publishedNews,
  } = useMemo(() => sortNewsForHomepage(state.news), [state.news]);

  return (
    <div className="bg-[#050507] text-zinc-100">
      {/* (01) Editorial Obsidian Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 pointer-events-none">
          {editorialPhotos?.heroUrl ? (
            <img
              src={editorialPhotos.heroUrl}
              alt={editorialPhotos.heroCaption || 'Fotografía oficial del Campeonato Intercarreras UFRO'}
              className="w-full h-full object-cover object-center opacity-45 scale-[1.02]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0e101d] via-[#050507] to-[#0a0b12]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050507] via-[#050507]/82 to-[#050507]/38" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-transparent to-[#050507]/55" />
          <div
            className="absolute -top-24 right-[10%] w-[520px] h-[520px] rounded-full opacity-[0.09] blur-[120px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, #707ef9 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-22 lg:py-26">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
            {/* Editorial Headline */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.52, ease: EDITORIAL_EASE }}
              className="lg:col-span-7 flex flex-col justify-between space-y-8"
            >
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2.5 text-xs text-zinc-400">
                  <img
                    src={LOGO_COLOR_SVG}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-auto shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-zinc-500">(01)</span>
                  <span>UFRO · Temporada {state.temporada}</span>
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-[68px] font-medium tracking-[-0.038em] leading-[1.01] text-white text-balance max-w-2xl">
                  Campeonato{' '}
                  <span className="font-editorial text-[#c8ceff] font-normal">Intercarreras</span>{' '}
                  UFRO
                </h1>

                <p className="text-base text-zinc-400 max-w-lg leading-relaxed">
                  Resultados oficiales, tablas, votación MVP y archivo fotográfico de las{' '}
                  {DISCIPLINES.length} categorías universitarias.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('posiciones')}
                  className="inline-flex items-center gap-2.5 rounded-full bg-white hover:bg-zinc-200 text-[#050507] font-medium text-sm px-6 py-3 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Tablas y playoffs</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('galeria')}
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.12] hover:border-white/25 text-zinc-100 text-sm font-normal px-5 py-3 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Galería oficial</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </motion.div>

            {/* Featured Match / Highlight Glass Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.56, delay: 0.08, ease: EDITORIAL_EASE }}
              className="lg:col-span-5 min-w-0"
            >
              {isCustomHeroFeatured && homeFeaturedConfig ? (
                <div className="rounded-3xl bg-[#0e0e14]/88 backdrop-blur-xl border border-white/[0.1] p-6 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-3 text-xs border-b border-white/[0.08] pb-3.5">
                    <span className="font-medium text-[#a5b0ff] truncate">
                      {homeFeaturedConfig.badgeLabel?.trim() || `Destacado ${state.temporada}`}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />
                  </div>

                  <div className="space-y-2.5">
                    <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] leading-tight text-white">
                      {homeFeaturedConfig.customTitle}
                    </h2>
                    {homeFeaturedConfig.customSubtitle && (
                      <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#9aa5ff] shrink-0" />
                        <span>{homeFeaturedConfig.customSubtitle}</span>
                      </p>
                    )}
                    {homeFeaturedConfig.customDescription && (
                      <p className="text-sm text-zinc-400 leading-relaxed pt-1">
                        {homeFeaturedConfig.customDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => {
                        if (homeFeaturedConfig.ctaSection === 'noticias') {
                          document.getElementById('home-news-heading')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          onNavigate(homeFeaturedConfig.ctaSection ?? 'posiciones');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <span>{homeFeaturedConfig.ctaLabel || 'Ver más'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {currentUser?.role === 'admin' && onOpenFeaturedManager && (
                      <button
                        type="button"
                        onClick={onOpenFeaturedManager}
                        className="text-xs text-zinc-400 hover:text-white whitespace-nowrap cursor-pointer"
                      >
                        Configurar
                      </button>
                    )}
                  </div>
                </div>
              ) : featuredMatch ? (
                <div className="rounded-3xl bg-[#0e0e14]/88 backdrop-blur-xl border border-white/[0.1] p-6 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-3 text-xs border-b border-white/[0.08] pb-3.5">
                    <span className="font-medium text-zinc-200 truncate">
                      {homeFeaturedConfig?.mode === 'match' && homeFeaturedConfig.badgeLabel?.trim()
                        ? `${homeFeaturedConfig.badgeLabel.trim()} · ${DISCIPLINE_MAP[featuredMatch.disciplineId].nombreCorto}`
                        : DISCIPLINE_MAP[featuredMatch.disciplineId].nombreCorto}
                    </span>
                    <span className="whitespace-nowrap shrink-0 tabular-nums">
                      <span
                        className={
                          canVoteMatchMvp(featuredMatch)
                            ? 'text-[#a5b0ff] font-medium'
                            : 'text-zinc-500'
                        }
                      >
                        {canVoteMatchMvp(featuredMatch)
                          ? `En juego · ${featuredMatch.hora}`
                          : shouldRevealPublicMatchData(featuredMatch)
                          ? `Final · ${featuredMatch.fecha}`
                          : `${featuredMatch.fecha} · ${featuredMatch.hora}`}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4 py-2">
                    <div className="text-left min-w-0">
                      <p className="text-base sm:text-lg font-medium text-white leading-tight break-words">
                        {teamMap.get(featuredMatch.homeTeamId)?.nombre ?? featuredMatch.homeTeamId}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1 truncate">
                        {teamMap.get(featuredMatch.homeTeamId)?.carrera}
                      </p>
                    </div>

                    <div className="px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.09] text-center shrink-0">
                      {shouldRevealPublicMatchData(featuredMatch) ? (
                        <span className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight text-white whitespace-nowrap">
                          {featuredMatch.homeScore} — {featuredMatch.awayScore}
                        </span>
                      ) : canVoteMatchMvp(featuredMatch) ? (
                        <div className="px-1">
                          <span className="text-xs font-medium text-[#a5b0ff] block whitespace-nowrap">
                            En juego
                          </span>
                          <span className="text-[10px] text-zinc-500 flex items-center justify-center gap-1 mt-0.5 whitespace-nowrap">
                            <Lock className="w-2.5 h-2.5" />
                            Al final
                          </span>
                        </div>
                      ) : (
                        <span className="font-editorial text-xl text-zinc-400">vs</span>
                      )}
                    </div>

                    <div className="text-right min-w-0">
                      <p className="text-base sm:text-lg font-medium text-white leading-tight break-words">
                        {teamMap.get(featuredMatch.awayTeamId)?.nombre ?? featuredMatch.awayTeamId}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1 truncate">
                        {teamMap.get(featuredMatch.awayTeamId)?.carrera}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-white/[0.08] text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-[#9aa5ff]" />
                      <span className="truncate">{featuredMatch.cancha}</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      {canVoteMatchMvp(featuredMatch) ? (
                        <button
                          type="button"
                          onClick={() => onOpenMatchModal(featuredMatch)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#707ef9] hover:bg-[#5f6ef5] text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Votar MVP ({featuredVoteCount})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenMatchModal(featuredMatch)}
                          className="text-zinc-200 hover:text-white font-medium whitespace-nowrap cursor-pointer transition-colors"
                        >
                          Ver ficha →
                        </button>
                      )}

                      {isOfficial && (
                        <button
                          type="button"
                          onClick={() => onOpenMatchInReferee(featuredMatch.id)}
                          className="text-zinc-400 hover:text-white whitespace-nowrap cursor-pointer"
                        >
                          Arbitrar
                        </button>
                      )}

                      {currentUser?.role === 'admin' && onOpenFeaturedManager && (
                        <button
                          type="button"
                          onClick={onOpenFeaturedManager}
                          className="text-zinc-500 hover:text-white whitespace-nowrap cursor-pointer"
                        >
                          Configurar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-[#0e0e14]/88 backdrop-blur-xl border border-white/[0.1] p-6 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-3 text-xs border-b border-white/[0.08] pb-3.5">
                    <span className="text-[#a5b0ff] font-medium">Temporada {state.temporada}</span>
                    <span className="text-emerald-400 font-medium">Inscripciones abiertas</span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium tracking-[-0.025em] text-white">
                      Convocatoria <span className="font-editorial text-zinc-300">oficial</span>
                    </h2>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Inscribe tu nómina en cualquiera de las {DISCIPLINES.length} disciplinas universitarias.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => onNavigate('inscripciones')}
                      className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer"
                    >
                      Inscribir equipo
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('galeria')}
                      className="px-4 py-2 rounded-full border border-white/[0.14] hover:border-white/30 text-zinc-200 text-xs cursor-pointer"
                    >
                      Galería 2025
                    </button>
                    {currentUser?.role === 'admin' && onOpenFeaturedManager && (
                      <button
                        type="button"
                        onClick={onOpenFeaturedManager}
                        className="text-xs text-zinc-500 hover:text-white whitespace-nowrap cursor-pointer"
                      >
                        Configurar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Minimalist Quantitative Proof Strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.16, ease: EDITORIAL_EASE }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-8 border-t border-white/[0.08]"
          >
            <div>
              <p className="text-3xl sm:text-4xl font-light tracking-[-0.03em] tabular-nums text-white">
                {DISCIPLINES.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Disciplinas activas</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-light tracking-[-0.03em] tabular-nums text-white">
                {state.teams.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Equipos inscritos</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-light tracking-[-0.03em] tabular-nums text-white">
                {activeWindowMatches.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">MVP abiertos hoy</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-light tracking-[-0.03em] tabular-nums text-white">
                {state.players.length}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Jugadores registrados</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* (02) Noticias del Campeonato */}
      <section
        aria-labelledby="home-news-heading"
        className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/[0.06]"
      >
        <RevealSection>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="space-y-2.5">
              <SectionKicker index="02" label="Sala de Prensa" />
              <h2
                id="home-news-heading"
                className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white"
              >
                Noticias del <span className="font-editorial text-[#c8ceff]">campeonato</span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {publishedNews.length > 0 && (
                <span className="text-xs text-zinc-500 tabular-nums">
                  {publishedNews.length}{' '}
                  {publishedNews.length === 1 ? 'publicación' : 'publicaciones'}
                </span>
              )}
              {canEditNews && (
                <button
                  type="button"
                  onClick={onOpenNewsManager}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.12] text-zinc-100 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Newspaper className="w-3.5 h-3.5 text-[#9aa5ff]" />
                  <span>Gestionar</span>
                </button>
              )}
            </div>
          </div>

          {!leadNews ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <p className="text-xs text-zinc-500 flex items-center gap-2">
                  <Newspaper className="w-3.5 h-3.5 text-[#9aa5ff]" />
                  <span>Boletín {state.temporada}</span>
                </p>
                <h3 className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                  Próximos comunicados oficiales
                </h3>
                <p className="text-sm text-zinc-400">
                  Crónicas de cada fecha, aperturas y novedades de playoffs.
                </p>
              </div>
              {canEditNews && (
                <button
                  type="button"
                  onClick={onOpenNewsManager}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
                >
                  Publicar anuncio →
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Artfolio-inspired Editorial Lead Card */}
              {(() => {
                const cat = NEWS_CATEGORY_META[leadNews.category];
                const safeLeadCover = leadNews.coverImageUrl
                  ? sanitizeSafeNewsUrl(leadNews.coverImageUrl)
                  : null;
                const discLabel =
                  leadNews.disciplineId && leadNews.disciplineId !== 'general'
                    ? DISCIPLINE_MAP[leadNews.disciplineId]?.nombreCorto
                    : 'General';
                return (
                  <article
                    className={`${
                      secondaryNews.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                    } relative rounded-3xl bg-[#0c0c10] border border-white/[0.09] hover:border-white/[0.2] flex flex-col overflow-hidden group transition-colors`}
                  >
                    {safeLeadCover && (
                      <div className="relative h-64 sm:h-72 w-full overflow-hidden border-b border-white/[0.06]">
                        <img
                          src={safeLeadCover}
                          alt={leadNews.title}
                          className="w-full h-full object-cover opacity-85 group-hover:scale-[1.03] transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-[#0c0c10]/25 to-transparent" />
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-xs text-zinc-100">
                            {cat.label}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-xs text-zinc-300">
                            {discLabel}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                      <div className="space-y-3.5">
                        {!safeLeadCover && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-3 py-1 rounded-full bg-white/[0.08] text-zinc-100">
                              {cat.label}
                            </span>
                            <span className="text-zinc-500">{discLabel}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-500 tabular-nums">
                              {formatNewsDateEs(leadNews.createdAt)}
                            </span>
                          </div>
                        )}

                        <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] leading-[1.12] text-white">
                          {leadNews.title}
                        </h3>

                        <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
                          {leadNews.summary}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.07]">
                        <span className="text-xs text-zinc-500 flex items-center gap-2">
                          <span>{leadNews.authorName}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formatNewsDateEs(leadNews.createdAt)}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => onOpenNewsArticle(leadNews)}
                          className="inline-flex items-center gap-2.5 pl-4 pr-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.12] text-zinc-100 text-xs font-medium transition-colors cursor-pointer"
                        >
                          <span>Leer más</span>
                          <span className="w-6 h-6 rounded-full bg-white/[0.1] inline-flex items-center justify-center">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })()}

              {/* Secondary News List */}
              {secondaryNews.length > 0 && (
                <div className="lg:col-span-5 rounded-3xl border border-white/[0.08] bg-[#0c0c10] flex flex-col divide-y divide-white/[0.06] overflow-hidden">
                  {secondaryNews.map((article) => {
                    const cat = NEWS_CATEGORY_META[article.category];
                    const discLabel =
                      article.disciplineId && article.disciplineId !== 'general'
                        ? DISCIPLINE_MAP[article.disciplineId]?.nombreCorto
                        : 'General';
                    return (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => onOpenNewsArticle(article)}
                        className="w-full text-left p-5 sm:p-6 hover:bg-white/[0.03] transition-colors flex flex-col justify-between gap-2.5 flex-1 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] text-zinc-200 shrink-0">
                              {cat.label}
                            </span>
                            <span className="text-zinc-500 truncate">{discLabel}</span>
                          </div>
                          <span className="text-zinc-600 tabular-nums shrink-0">
                            {formatNewsDateEs(article.createdAt)}
                          </span>
                        </div>

                        <h3 className="text-lg font-medium tracking-[-0.02em] text-white group-hover:text-[#c8ceff] transition-colors leading-snug">
                          {article.title}
                        </h3>

                        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                          {article.summary}
                        </p>

                        <span className="text-xs text-zinc-400 group-hover:text-white inline-flex items-center gap-1 pt-0.5 transition-colors">
                          <span>Leer</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </RevealSection>
      </section>

      {/* (03) Calendario de Partidos */}
      <HomeMatchCalendar
        matches={state.matches}
        teams={state.teams}
        temporada={state.temporada}
        currentUser={currentUser}
        onOpenMatchModal={onOpenMatchModal}
        onOpenMatchInReferee={onOpenMatchInReferee}
      />

      {/* (04) Últimas Transferencias */}
      <HomeTransfersSection
        transfers={state.transfers}
        temporada={state.temporada}
        currentUser={currentUser}
        onInspectTeam={onInspectTeam}
        onNavigate={onNavigate}
      />

      {/* (05) Centro de Encuentros */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/[0.06]">
        <RevealSection>
          <div className="space-y-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="space-y-2.5">
                <SectionKicker index="05" label="Centro de Encuentros" />
                <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white">
                  Resultados y <span className="font-editorial text-[#c8ceff]">votación MVP</span>
                </h2>
              </div>
              <p className="text-xs text-zinc-500 max-w-xs sm:text-right">
                Marcadores al finalizar · Votación MVP abierta durante el partido.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMatchFilter('ALL');
                  setMatchGroupFilter('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  matchFilter === 'ALL'
                    ? 'bg-white text-[#050507]'
                    : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
                }`}
              >
                Todas ({activeWindowMatches.length} en vivo)
              </button>
              {DISCIPLINES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setMatchFilter(d.id);
                    setMatchGroupFilter('ALL');
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    matchFilter === d.id
                      ? 'bg-[#707ef9] text-white'
                      : 'bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  {d.nombreCorto}
                </button>
              ))}
            </div>

            <MatchFilterBar
              idPrefix="home-center"
              matches={state.matches}
              disciplineFilter={matchFilter}
              onDisciplineChange={(value) => {
                setMatchFilter(value);
                setMatchGroupFilter('ALL');
              }}
              groupFilter={matchGroupFilter}
              onGroupChange={setMatchGroupFilter}
              stageFilter={matchStageFilter}
              onStageChange={setMatchStageFilter}
              sortOrder={matchSortOrder}
              onSortOrderChange={setMatchSortOrder}
              groupBy={matchGroupBy}
              onGroupByChange={setMatchGroupBy}
              filteredCount={visibleMatches.length}
              totalCount={state.matches.length}
              onReset={() => {
                setMatchFilter('ALL');
                setMatchGroupFilter('ALL');
                setMatchStageFilter('ALL');
                setMatchGroupBy('none');
                setMatchSortOrder('newest');
              }}
              compact
            />
          </div>

          {visibleMatches.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-10 text-center space-y-3">
              <p className="text-lg font-medium text-white">Sin encuentros para esta selección</p>
              <p className="text-xs text-zinc-500">Ajusta los filtros para ver otros partidos.</p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMatchFilter('ALL');
                    setMatchGroupFilter('ALL');
                    setMatchStageFilter('ALL');
                    setMatchGroupBy('none');
                    setMatchSortOrder('newest');
                  }}
                  className="px-4 py-2 rounded-full bg-white text-[#050507] text-xs font-medium cursor-pointer"
                >
                  Restablecer filtros
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {visibleMatchSections.map((section) => (
                <div key={section.key} className="space-y-3">
                  {matchGroupBy !== 'none' && (
                    <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                      <h3 className="text-base font-medium text-white">{section.label}</h3>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {section.matches.length}{' '}
                        {section.matches.length === 1 ? 'partido' : 'partidos'}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.matches.map((match) => {
                      const home = teamMap.get(match.homeTeamId);
                      const away = teamMap.get(match.awayTeamId);
                      const disc = DISCIPLINE_MAP[match.disciplineId];
                      const votingOpen = canVoteMatchMvp(match);
                      const revealData = shouldRevealPublicMatchData(match);
                      const mvpTally = computeMatchMvpStandings(match.id, state.mvpVotes);

                      return (
                        <div
                          key={match.id}
                          className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] hover:border-white/[0.18] p-5 flex flex-col justify-between gap-4 transition-all duration-200 hover:-translate-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-medium text-zinc-200 truncate">
                                {disc.nombreCorto}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{match.fase !== 'Grupos' ? match.fase : match.groupName}</span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{match.fecha}</span>
                            </div>

                            <span
                              className={`whitespace-nowrap shrink-0 tabular-nums ${
                                votingOpen ? 'text-[#a5b0ff] font-medium' : 'text-zinc-500'
                              }`}
                            >
                              {votingOpen
                                ? `En juego · ${match.hora}`
                                : revealData
                                ? 'Final'
                                : match.hora}
                            </span>
                          </div>

                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                            <div className="min-w-0">
                              <p className="text-sm sm:text-base font-medium text-white break-words">
                                {home?.nombre ?? match.homeTeamId}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">{home?.carrera}</p>
                            </div>

                            <div
                              className={`px-3.5 py-1.5 rounded-xl text-center tabular-nums whitespace-nowrap shrink-0 ${
                                votingOpen
                                  ? 'bg-[#707ef9]/15 border border-[#707ef9]/35 text-[#c7ceff]'
                                  : revealData
                                  ? 'bg-white/[0.08] border border-white/[0.1] text-white'
                                  : 'bg-white/[0.03] border border-white/[0.07] text-zinc-400'
                              }`}
                            >
                              {revealData ? (
                                <span className="text-lg sm:text-xl font-semibold">
                                  {match.homeScore} — {match.awayScore}
                                </span>
                              ) : votingOpen ? (
                                <span className="text-[11px] font-medium flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>Al final</span>
                                </span>
                              ) : (
                                <span className="font-editorial text-base">vs</span>
                              )}
                            </div>

                            <div className="text-right min-w-0">
                              <p className="text-sm sm:text-base font-medium text-white break-words">
                                {away?.nombre ?? match.awayTeamId}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">{away?.carrera}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 pt-3 border-t border-white/[0.06]">
                            <span className="truncate tabular-nums">
                              {revealData && disc.sportType === 'voleibol' && match.periods.length > 0
                                ? `Sets: ${match.periods.map((p) => `${p.home}-${p.away}`).join(' / ')}`
                                : revealData && disc.sportType === 'basquetbol' && match.periods.length > 0
                                ? `Cuartos: ${match.periods.map((p) => `${p.home}-${p.away}`).join(' · ')}`
                                : revealData && disc.sportType === 'basquetbol3x3'
                                ? `3x3${mvpTally.winner ? ` · MVP: ${mvpTally.winner.playerName}` : ''}`
                                : revealData && disc.sportType === 'futbol7' && match.periods.length > 0
                                ? `Tiempos: ${match.periods.map((p) => `${p.home}-${p.away}`).join(' / ')}`
                                : revealData && mvpTally.winner
                                ? `MVP: ${mvpTally.winner.playerName}`
                                : match.cancha}
                            </span>

                            <div className="flex items-center gap-3 shrink-0">
                              {votingOpen ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(match)}
                                  className="inline-flex items-center gap-1 text-[#a5b0ff] hover:text-white font-medium text-xs whitespace-nowrap cursor-pointer"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>Votar MVP ({mvpTally.totalVotes})</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchModal(match)}
                                  className="text-zinc-300 hover:text-white font-medium whitespace-nowrap cursor-pointer transition-colors"
                                >
                                  {revealData ? 'Resumen →' : 'Ficha →'}
                                </button>
                              )}

                              {isOfficial && (
                                <button
                                  type="button"
                                  onClick={() => onOpenMatchInReferee(match.id)}
                                  className="text-zinc-500 hover:text-white whitespace-nowrap cursor-pointer"
                                >
                                  Arbitrar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </RevealSection>
      </section>

      {/* (06) Panorama: Quick Standings + Individual Leaders */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-b border-white/[0.06]">
        <RevealSection>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="space-y-2.5">
              <SectionKicker index="06" label="Panorama" />
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white">
                {activeDisciplineMeta.nombre}
              </h2>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-zinc-400">
              <span>Disciplina</span>
              <select
                value={selectedDiscipline}
                onChange={(e) => onSelectDiscipline(e.target.value as DisciplineId)}
                className="rounded-full bg-[#111117] border border-white/[0.12] px-4 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Top 5 Standings */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Grupo A · Top 5</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('posiciones')}
                  className="text-xs text-[#a5b0ff] hover:text-white transition-colors cursor-pointer"
                >
                  Ver tablas completas →
                </button>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-[11px] text-zinc-500">
                      <th className="py-3 px-4 w-10 font-medium">#</th>
                      <th className="py-3 px-3 font-medium">Equipo</th>
                      <th className="py-3 px-3 text-right font-medium tabular-nums">PJ</th>
                      <th className="py-3 px-3 text-right font-medium tabular-nums">PG</th>
                      <th className="py-3 px-3 text-right font-medium tabular-nums">DIF</th>
                      <th className="py-3 px-3 text-right font-medium text-zinc-200 tabular-nums">PTS</th>
                      <th className="py-3 px-4 text-right font-medium w-10">Fav</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {quickStandings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 px-4 text-center text-xs text-zinc-500">
                          Sin equipos registrados aún en {activeDisciplineMeta.nombre}.
                        </td>
                      </tr>
                    ) : (
                      quickStandings.map((row, idx) => {
                        const qualifies = idx < state.configs[selectedDiscipline].clasificadosPorGrupo;
                        const isFav = Boolean(currentUser?.favoriteTeamIds.includes(row.teamId));
                        return (
                          <tr key={row.teamId} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3.5 px-4 tabular-nums font-medium">
                              <span className={qualifies ? 'text-[#9aa5ff]' : 'text-zinc-500'}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <button
                                type="button"
                                onClick={() => onInspectTeam(row.teamId)}
                                className="text-left group cursor-pointer"
                              >
                                <p className="font-medium text-zinc-100 group-hover:text-[#c8ceff] transition-colors">
                                  {row.teamName}
                                </p>
                                <p className="text-xs text-zinc-500">{row.carrera}</p>
                              </button>
                            </td>
                            <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                              {row.pj}
                            </td>
                            <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                              {row.pg}
                            </td>
                            <td className="py-3.5 px-3 text-right tabular-nums text-zinc-400">
                              {row.diferencia > 0 ? `+${row.diferencia}` : row.diferencia}
                            </td>
                            <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-white">
                              {row.puntos}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  currentUser ? onToggleFavoriteTeam(row.teamId) : onOpenAuth()
                                }
                                aria-label={
                                  isFav
                                    ? `Quitar ${row.teamName} de favoritos`
                                    : `Guardar ${row.teamName} en favoritos`
                                }
                                className="p-1 text-zinc-600 hover:text-[#9aa5ff] cursor-pointer transition-colors"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    isFav ? 'fill-[#707ef9] text-[#707ef9]' : ''
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Leaders */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">
                  {activeDisciplineMeta.sportType === 'futbol7'
                    ? 'Goleadores'
                    : 'Líderes de anotación'}
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('jugadores')}
                  className="text-xs text-[#a5b0ff] hover:text-white transition-colors cursor-pointer"
                >
                  Directorio →
                </button>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] divide-y divide-white/[0.05] overflow-hidden">
                {topLeaders.length === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-zinc-500">
                    Sin registros individuales todavía.
                  </div>
                ) : (
                  topLeaders.map((player, idx) => {
                    const team = teamMap.get(player.teamId);
                    const mainStat =
                      activeDisciplineMeta.sportType === 'futbol7'
                        ? `${player.stats.goles} G`
                        : `${player.stats.puntos} Pts`;

                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => onInspectPlayer(player)}
                        className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-sm font-medium tabular-nums text-zinc-600 w-5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {player.nombre} {player.apellidoPaterno}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {team?.nombre} · {player.carrera}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-[#a5b0ff] whitespace-nowrap shrink-0">
                          {mainStat}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* (07) Artfolio-style Editorial Discipline Collections */}
      <section className="py-16 sm:py-22">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          <RevealSection>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div className="space-y-2.5">
                <SectionKicker index="07" label="Categorías" />
                <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white">
                  Las 8 <span className="font-editorial text-[#c8ceff]">disciplinas</span>
                </h2>
              </div>
              <p className="text-sm text-zinc-500 max-w-sm">
                Fase de grupos todos contra todos y llave directa de playoffs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {DISCIPLINES.map((disc) => {
                const teamCount = state.teams.filter((t) => t.disciplineId === disc.id).length;
                const cfg = state.configs[disc.id];
                return (
                  <button
                    key={disc.id}
                    type="button"
                    onClick={() => {
                      onSelectDiscipline(disc.id);
                      onNavigate('posiciones');
                    }}
                    className="group relative h-72 rounded-3xl bg-[#0e0e14] border border-white/[0.08] hover:border-white/[0.22] text-left overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
                  >
                    {editorialPhotos?.byDiscipline[disc.id]?.url ? (
                      <img
                        src={editorialPhotos.byDiscipline[disc.id].url}
                        alt={`${disc.nombre} — ${editorialPhotos.byDiscipline[disc.id].caption}`}
                        className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#161829] via-[#0c0c12] to-[#08080c] flex items-center justify-center">
                        <img
                          src={LOGO_LIGHT_SVG}
                          alt=""
                          aria-hidden="true"
                          className="h-12 w-auto opacity-15"
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />

                    {/* Top glass badge (Artfolio reference card detail) */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                      <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[11px] text-zinc-200">
                        {disc.rama}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[11px] text-zinc-300 tabular-nums">
                        {teamCount}/{cfg.maxCupos}
                      </span>
                    </div>

                    {/* Bottom editorial title + glass button */}
                    <div className="absolute inset-x-4 bottom-4 space-y-3">
                      <div>
                        <h3 className="text-lg font-medium tracking-[-0.02em] text-white leading-snug">
                          {disc.nombre}
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                          {cfg.numGrupos} grupos · Top {cfg.formatoPlayoff}
                        </p>
                      </div>

                      <div className="flex items-center justify-between px-3.5 py-2 rounded-full bg-white/[0.1] backdrop-blur-md border border-white/[0.16] group-hover:bg-white/[0.18] transition-colors text-xs text-white">
                        <span>Ver tabla</span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-200 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
