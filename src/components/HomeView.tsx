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
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  LOGO_COLOR_SVG,
  LOGO_LIGHT_SVG,
} from '../data/ufroSeed';
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
  onToggleFavoriteTeam,
  onOpenAuth,
}: HomeViewProps) {
  const [matchFilter, setMatchFilter] = useState<'ALL' | DisciplineId>('ALL');

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const activeWindowMatches = useMemo(
    () => state.matches.filter((m) => m.status === 'EN_VIVO'),
    [state.matches]
  );

  const featuredMatch: Match | undefined = activeWindowMatches[0] ?? state.matches[0];

  const visibleMatches = useMemo(() => {
    const filtered =
      matchFilter === 'ALL'
        ? state.matches
        : state.matches.filter((m) => m.disciplineId === matchFilter);
    const ordered = [...filtered].sort((a, b) => {
      const weight = (s: Match['status']) => (s === 'EN_VIVO' ? 0 : s === 'FINALIZADO' ? 1 : 2);
      if (weight(a.status) !== weight(b.status)) return weight(a.status) - weight(b.status);
      return b.fecha.localeCompare(a.fecha);
    });
    return ordered.slice(0, 8);
  }, [state.matches, matchFilter]);

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
    <div className="bg-white text-[#0d0d0d]">
      {/* Section 1: RSC Anderlecht-inspired Editorial Hero */}
      <section className="relative bg-[#0d0d0d] text-white overflow-hidden">
        <div className="absolute inset-0">
          {editorialPhotos?.heroUrl ? (
            <img
              src={editorialPhotos.heroUrl}
              alt={editorialPhotos.heroCaption || 'Fotografía oficial de la Galería 2025 del Campeonato Intercarreras UFRO'}
              className="w-full h-full object-cover object-center opacity-50"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#141522] via-[#0d0d0d] to-[#1a1c2e]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d] via-[#0d0d0d]/85 to-[#0d0d0d]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-transparent" />
        </div>

        <div className="relative max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Hero Headline Column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tracking-widest uppercase text-neutral-300">
                  <img
                    src={LOGO_COLOR_SVG}
                    alt=""
                    aria-hidden="true"
                    className="h-5 w-auto shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span className="whitespace-nowrap">Universidad de La Frontera</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">Temporada {state.temporada}</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">Temuco</span>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.02] text-balance max-w-2xl">
                  Campeonato Intercarreras UFRO
                </h1>

                <p className="text-base text-neutral-300 max-w-xl leading-relaxed">
                  Resultados oficiales al término de cada partido, votación comunitaria de MVP
                  durante el horario programado, archivo fotográfico 2025/2026 y tablas de las{' '}
                  {DISCIPLINES.length} categorías universitarias.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('posiciones')}
                  className="inline-flex items-center gap-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm px-6 py-3.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Ver tablas y playoffs</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('galeria')}
                  className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-[#707ef9] border-b border-white/30 hover:border-[#707ef9] pb-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Galería 2025 & Fotos</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hero Featured Match Card or Season Launch Card */}
            {featuredMatch ? (
              <div className="lg:col-span-5 flex flex-col justify-end min-w-0">
                <div className="bg-[#141418]/95 border border-white/15 p-5 sm:p-7 space-y-5 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 text-xs text-neutral-300 border-b border-white/10 pb-3">
                    <span className="font-medium text-white truncate">
                      {DISCIPLINE_MAP[featuredMatch.disciplineId].nombreCorto}
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap shrink-0 tabular-nums">
                      {canVoteMatchMvp(featuredMatch) && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#707ef9]" aria-hidden="true" />
                      )}
                      <span
                        className={
                          canVoteMatchMvp(featuredMatch)
                            ? 'text-[#707ef9] font-bold uppercase tracking-wider'
                            : 'text-neutral-400'
                        }
                      >
                        {canVoteMatchMvp(featuredMatch)
                          ? `En horario · ${featuredMatch.hora}`
                          : shouldRevealPublicMatchData(featuredMatch)
                          ? 'Resultado Oficial'
                          : `Programado · ${featuredMatch.hora}`}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4 py-2">
                    <div className="text-left min-w-0">
                      <p className="font-display text-base sm:text-xl font-bold uppercase tracking-wide text-white leading-tight break-words">
                        {teamMap.get(featuredMatch.homeTeamId)?.nombre ?? featuredMatch.homeTeamId}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 truncate">
                        {teamMap.get(featuredMatch.homeTeamId)?.carrera}
                      </p>
                    </div>

                    <div className="px-3 sm:px-4 py-2 bg-[#0d0d0d] border border-white/10 text-center shrink-0">
                      {shouldRevealPublicMatchData(featuredMatch) ? (
                        <span className="font-display text-2xl sm:text-4xl font-bold tabular-nums tracking-tight text-white whitespace-nowrap">
                          {featuredMatch.homeScore} — {featuredMatch.awayScore}
                        </span>
                      ) : canVoteMatchMvp(featuredMatch) ? (
                        <div className="px-1">
                          <span className="font-display text-sm sm:text-base font-bold uppercase tracking-wider text-[#707ef9] block whitespace-nowrap">
                            En Juego
                          </span>
                          <span className="text-[10px] text-neutral-400 flex items-center justify-center gap-1 mt-0.5 whitespace-nowrap">
                            <Lock className="w-2.5 h-2.5" />
                            Datos al final
                          </span>
                        </div>
                      ) : (
                        <span className="font-display text-2xl font-bold uppercase text-neutral-400">
                          vs
                        </span>
                      )}
                    </div>

                    <div className="text-right min-w-0">
                      <p className="font-display text-base sm:text-xl font-bold uppercase tracking-wide text-white leading-tight break-words">
                        {teamMap.get(featuredMatch.awayTeamId)?.nombre ?? featuredMatch.awayTeamId}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 truncate">
                        {teamMap.get(featuredMatch.awayTeamId)?.carrera}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs text-neutral-400">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-[#707ef9]" />
                      <span className="truncate">{featuredMatch.cancha}</span>
                    </span>

                    <div className="flex items-center gap-3 shrink-0">
                      {canVoteMatchMvp(featuredMatch) ? (
                        <button
                          type="button"
                          onClick={() => onOpenMatchModal(featuredMatch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-wider text-xs cursor-pointer whitespace-nowrap"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Votar MVP ({featuredVoteCount})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenMatchModal(featuredMatch)}
                          className="text-white hover:text-[#707ef9] font-medium whitespace-nowrap cursor-pointer"
                        >
                          Ver ficha oficial →
                        </button>
                      )}

                      {isOfficial && (
                        <button
                          type="button"
                          onClick={() => onOpenMatchInReferee(featuredMatch.id)}
                          className="text-neutral-300 hover:text-white font-medium whitespace-nowrap cursor-pointer"
                        >
                          Mesa arbitral
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-5 flex flex-col justify-end min-w-0">
                <div className="bg-[#141418]/95 border border-white/15 p-6 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-3 text-xs text-neutral-300 border-b border-white/10 pb-3">
                    <span className="font-bold uppercase tracking-wider text-[#707ef9]">
                      Temporada {state.temporada}
                    </span>
                    <span className="text-emerald-400 font-bold uppercase tracking-wider">
                      Inscripciones Abiertas
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white">
                      Convocatoria Oficial Deportes UFRO
                    </h2>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      La plataforma está lista para recibir las nóminas oficiales de las{' '}
                      {DISCIPLINES.length} disciplinas. Una vez cerradas las inscripciones se
                      publicará el fixture de fase de grupos y las votaciones MVP en vivo.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => onNavigate('inscripciones')}
                      className="px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                    >
                      Inscribir equipo {state.temporada}
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('galeria')}
                      className="px-4 py-2.5 border border-white/20 hover:border-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
                    >
                      Archivo 2025 Drive
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Key Quantitative Proof Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/10">
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">{DISCIPLINES.length}</p>
              <p className="text-xs text-neutral-400 mt-1">Disciplinas oficiales activas</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">{state.teams.length}</p>
              <p className="text-xs text-neutral-400 mt-1">Equipos inscritos en {state.temporada}</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">{activeWindowMatches.length}</p>
              <p className="text-xs text-neutral-400 mt-1">Votaciones MVP abiertas ahora</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold tabular-nums text-white">{state.players.length}</p>
              <p className="text-xs text-neutral-400 mt-1">Estudiantes con ficha verificada</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1B: Noticias del Campeonato (Anuncios Destacados y Sala de Prensa) */}
      <section
        aria-labelledby="home-news-heading"
        className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-neutral-200"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-[#707ef9] uppercase tracking-widest">
              Sala de Prensa UFRO · Comunicados Oficiales
            </p>
            <h2
              id="home-news-heading"
              className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1"
            >
              Noticias del Campeonato
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {publishedNews.length > 0 && (
              <span className="text-xs text-neutral-500 tabular-nums">
                {publishedNews.length}{' '}
                {publishedNews.length === 1 ? 'anuncio publicado' : 'anuncios publicados'}
              </span>
            )}
            {canEditNews && (
              <button
                type="button"
                onClick={onOpenNewsManager}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Gestionar noticias</span>
              </button>
            )}
          </div>
        </div>

        {!leadNews ? (
          <div className="border border-neutral-200 bg-[#f5f6f8] p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-[#707ef9]" />
                <span>Boletín Oficial Temporada {state.temporada}</span>
              </p>
              <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
                Próximos anuncios destacados del campeonato
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Aquí se publicarán los comunicados oficiales de la Dirección de Deportes UFRO,
                crónicas de cada fecha, aperturas de inscripción y novedades de playoffs redactadas
                por Prensa Oficial y Administración.
              </p>
            </div>
            {canEditNews && (
              <button
                type="button"
                onClick={onOpenNewsManager}
                className="px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
              >
                Publicar primer anuncio →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Lead Featured Announcement */}
            {(() => {
              const cat = NEWS_CATEGORY_META[leadNews.category];
              const safeLeadCover = leadNews.coverImageUrl
                ? sanitizeSafeNewsUrl(leadNews.coverImageUrl)
                : null;
              const discLabel =
                leadNews.disciplineId && leadNews.disciplineId !== 'general'
                  ? DISCIPLINE_MAP[leadNews.disciplineId]?.nombreCorto
                  : 'Campeonato General';
              return (
                <article
                  className={`${
                    secondaryNews.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
                  } bg-[#0d0d0d] text-white border border-neutral-900 flex flex-col overflow-hidden group`}
                >
                  {safeLeadCover && (
                    <div className="relative h-56 sm:h-64 w-full overflow-hidden border-b border-white/10">
                      <img
                        src={safeLeadCover}
                        alt={leadNews.title}
                        className="w-full h-full object-cover opacity-85 group-hover:scale-[1.02] transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/30 to-transparent" />
                    </div>
                  )}

                  <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-3.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`px-2.5 py-1 font-display font-bold uppercase tracking-widest ${cat.badgeClass}`}
                        >
                          {cat.label}
                        </span>
                        {leadNews.featured && (
                          <span className="px-2.5 py-1 bg-white/10 text-white font-display font-bold uppercase tracking-widest">
                            Destacado
                          </span>
                        )}
                        <span className="text-neutral-400">{discLabel}</span>
                        <span aria-hidden="true" className="text-neutral-600">
                          ·
                        </span>
                        <span className="text-neutral-400 tabular-nums">
                          {formatNewsDateEs(leadNews.createdAt)}
                        </span>
                      </div>

                      <h3 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight leading-[1.06] text-white">
                        {leadNews.title}
                      </h3>

                      <p className="text-sm sm:text-base text-neutral-300 leading-relaxed line-clamp-3">
                        {leadNews.summary}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                      <span className="text-xs text-neutral-400 flex items-center gap-2">
                        <span>
                          {leadNews.authorName} ·{' '}
                          {leadNews.authorRole === 'prensa' ? 'Prensa Oficial' : 'Dirección UFRO'}
                        </span>
                        {leadNews.aiGenerated && (
                          <span className="inline-flex items-center gap-1 text-[#9ca7ff]">
                            <Sparkles className="w-3 h-3" />
                            <span>Breve</span>
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => onOpenNewsArticle(leadNews)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer"
                      >
                        <span>Leer noticia completa</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })()}

            {/* Secondary Editorial Announcements List */}
            {secondaryNews.length > 0 && (
              <div className="lg:col-span-5 flex flex-col divide-y divide-neutral-200 border border-neutral-200 bg-white">
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
                      className="w-full text-left p-5 hover:bg-[#f5f6f8] transition-colors flex flex-col justify-between gap-2.5 flex-1 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-2 py-0.5 font-display font-bold uppercase tracking-wider shrink-0 ${cat.badgeClass}`}
                          >
                            {cat.label}
                          </span>
                          <span className="text-neutral-500 truncate">{discLabel}</span>
                        </div>
                        <span className="text-neutral-400 tabular-nums shrink-0">
                          {formatNewsDateEs(article.createdAt)}
                        </span>
                      </div>

                      <h3 className="font-display text-xl font-bold uppercase tracking-wide text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors leading-snug">
                        {article.title}
                      </h3>

                      <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>

                      <span className="text-xs font-medium text-[#0d0d0d] group-hover:text-[#707ef9] inline-flex items-center gap-1 pt-1">
                        <span>Leer comunicado</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Match Center (Public Post-Match Results + Live-Hour MVP Voting) */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-neutral-200">
        <div className="space-y-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                Centro de encuentros UFRO
              </p>
              <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1">
                Votación MVP en horario y resultados oficiales
              </h2>
            </div>
            <p className="text-xs text-neutral-500">
              Los marcadores oficiales se revelan al finalizar · Votación MVP abierta para todos los roles durante el encuentro
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMatchFilter('ALL')}
              className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                matchFilter === 'ALL'
                  ? 'bg-[#0d0d0d] text-white'
                  : 'bg-[#f5f6f8] text-neutral-600 hover:text-[#0d0d0d]'
              }`}
            >
              Todas ({activeWindowMatches.length} con MVP abierto)
            </button>
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setMatchFilter(d.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  matchFilter === d.id
                    ? 'bg-[#707ef9] text-white'
                    : 'bg-[#f5f6f8] text-neutral-600 hover:text-[#0d0d0d]'
                }`}
              >
                {d.nombreCorto}
              </button>
            ))}
          </div>
        </div>

        {visibleMatches.length === 0 ? (
          <div className="border border-neutral-200 bg-[#f5f6f8] p-10 text-center space-y-3">
            <p className="font-display text-2xl font-bold uppercase text-[#0d0d0d]">
              Sin encuentros programados todavía
            </p>
            <p className="text-sm text-neutral-600 max-w-xl mx-auto">
              Cuando los equipos completen su inscripción y la Dirección de Deportes genere el
              fixture de la temporada {state.temporada}, aquí aparecerán los partidos programados,
              las encuestas MVP en horario y los resultados oficiales validados.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('inscripciones')}
                className="px-5 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
              >
                Ir a Inscripciones {state.temporada}
              </button>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-neutral-200 border border-neutral-200">
          {visibleMatches.map((match) => {
            const home = teamMap.get(match.homeTeamId);
            const away = teamMap.get(match.awayTeamId);
            const disc = DISCIPLINE_MAP[match.disciplineId];
            const votingOpen = canVoteMatchMvp(match);
            const revealData = shouldRevealPublicMatchData(match);
            const mvpTally = computeMatchMvpStandings(match.id, state.mvpVotes);

            return (
              <div
                key={match.id}
                className="bg-white p-5 flex flex-col justify-between gap-4 hover:bg-[#f9fafb] transition-colors"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium text-[#0d0d0d] truncate">{disc.nombreCorto}</span>
                    <span aria-hidden="true">·</span>
                    <span>{match.groupName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{match.fecha}</span>
                  </div>

                  <span
                    className={`font-medium whitespace-nowrap shrink-0 tabular-nums ${
                      votingOpen ? 'text-[#707ef9] font-bold' : 'text-neutral-500'
                    }`}
                  >
                    {votingOpen
                      ? `EN HORARIO · ${match.hora}`
                      : revealData
                      ? 'Finalizado'
                      : `Prog. · ${match.hora}`}
                  </span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d] break-words">
                      {home?.nombre ?? match.homeTeamId}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">{home?.carrera}</p>
                  </div>

                  <div
                    className={`px-3 py-1.5 text-center tabular-nums whitespace-nowrap shrink-0 ${
                      votingOpen
                        ? 'bg-[#707ef9]/10 border border-[#707ef9]/40 text-[#0d0d0d]'
                        : revealData
                        ? 'bg-[#0d0d0d] text-white'
                        : 'bg-[#f5f6f8] border border-neutral-200 text-neutral-700'
                    }`}
                  >
                    {revealData ? (
                      <span className="font-display text-xl sm:text-2xl font-bold">
                        {match.homeScore} - {match.awayScore}
                      </span>
                    ) : votingOpen ? (
                      <span className="text-[11px] font-display font-bold uppercase tracking-wider text-[#707ef9] flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Al finalizar</span>
                      </span>
                    ) : (
                      <span className="font-display text-lg font-bold uppercase">vs</span>
                    )}
                  </div>

                  <div className="text-right min-w-0">
                    <p className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d] break-words">
                      {away?.nombre ?? match.awayTeamId}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">{away?.carrera}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-neutral-500 pt-2 border-t border-neutral-100">
                  <span className="truncate">
                    {revealData && disc.sportType === 'voleibol' && match.periods.length > 0
                      ? `Sets: ${match.periods.map((p) => `${p.home}-${p.away}`).join(' / ')}`
                      : revealData && mvpTally.winner
                      ? `MVP: ${mvpTally.winner.playerName}`
                      : match.cancha}
                  </span>

                  <div className="flex items-center gap-3 shrink-0">
                    {votingOpen ? (
                      <button
                        type="button"
                        onClick={() => onOpenMatchModal(match)}
                        className="inline-flex items-center gap-1 text-[#707ef9] hover:text-[#0d0d0d] font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Votar MVP ({mvpTally.totalVotes})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenMatchModal(match)}
                        className="text-[#0d0d0d] hover:text-[#707ef9] font-medium whitespace-nowrap cursor-pointer"
                      >
                        {revealData ? 'Ver resumen y MVP →' : 'Ver programación →'}
                      </button>
                    )}

                    {isOfficial && (
                      <button
                        type="button"
                        onClick={() => onOpenMatchInReferee(match.id)}
                        className="text-neutral-500 hover:text-[#0d0d0d] font-medium whitespace-nowrap cursor-pointer"
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
        )}
      </section>

      {/* Section 3: Quick Standings + Individual Leaders Split */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-14 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
              Panorama de competencia
            </p>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1">
              {activeDisciplineMeta.nombre}
            </h2>
          </div>

          <label className="flex items-center gap-3 text-xs font-medium text-neutral-600">
            <span>Disciplina</span>
            <select
              value={selectedDiscipline}
              onChange={(e) => onSelectDiscipline(e.target.value as DisciplineId)}
              className="bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] font-medium focus:outline-none focus:border-[#707ef9]"
            >
              {DISCIPLINES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Top 5 Standings Preview with Favorite Team Toggle */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d]">
                Tabla Grupo A · Top 5
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('posiciones')}
                className="text-xs font-medium text-[#707ef9] hover:text-[#5766eb] cursor-pointer"
              >
                Ver todos los grupos y playoffs →
              </button>
            </div>

            <div className="border border-neutral-200 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f5f6f8] border-b border-neutral-200 text-xs text-neutral-500 uppercase">
                    <th className="py-3 px-3 w-10 font-medium">#</th>
                    <th className="py-3 px-3 font-medium">Equipo</th>
                    <th className="py-3 px-3 text-right font-medium tabular-nums">PJ</th>
                    <th className="py-3 px-3 text-right font-medium tabular-nums">PG</th>
                    <th className="py-3 px-3 text-right font-medium tabular-nums">DIF</th>
                    <th className="py-3 px-3 text-right font-bold text-[#0d0d0d] tabular-nums">PTS</th>
                    <th className="py-3 px-3 text-right font-medium w-10">Fav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {quickStandings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-xs text-neutral-500">
                        Aún no hay equipos inscritos en {activeDisciplineMeta.nombre} para la temporada{' '}
                        {state.temporada}.
                      </td>
                    </tr>
                  ) : (
                  quickStandings.map((row, idx) => {
                    const qualifies = idx < state.configs[selectedDiscipline].clasificadosPorGrupo;
                    const isFav = Boolean(currentUser?.favoriteTeamIds.includes(row.teamId));
                    return (
                      <tr key={row.teamId} className="hover:bg-[#f9fafb]">
                        <td className="py-3 px-3 tabular-nums font-medium">
                          <span className={qualifies ? 'text-[#707ef9] font-bold' : 'text-neutral-500'}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => onInspectTeam(row.teamId)}
                            className="text-left group cursor-pointer"
                          >
                            <p className="font-medium text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors">
                              {row.teamName}
                            </p>
                            <p className="text-xs text-neutral-500">{row.carrera}</p>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-neutral-600">{row.pj}</td>
                        <td className="py-3 px-3 text-right tabular-nums text-neutral-600">{row.pg}</td>
                        <td className="py-3 px-3 text-right tabular-nums text-neutral-600">
                          {row.diferencia > 0 ? `+${row.diferencia}` : row.diferencia}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-bold text-[#0d0d0d]">
                          {row.puntos}
                        </td>
                        <td className="py-3 px-3 text-right">
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
                            className="p-1 text-neutral-400 hover:text-[#707ef9] cursor-pointer"
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

          {/* Individual Statistical Leaders */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d]">
                {activeDisciplineMeta.sportType === 'futbol7'
                  ? 'Goleadores destacados'
                  : 'Líderes de anotación'}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('jugadores')}
                className="text-xs font-medium text-[#707ef9] hover:text-[#5766eb] cursor-pointer"
              >
                Directorio completo →
              </button>
            </div>

            <div className="border border-neutral-200 divide-y divide-neutral-200">
              {topLeaders.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-neutral-500">
                  Las estadísticas individuales aparecerán al comenzar la fase de grupos de{' '}
                  {activeDisciplineMeta.nombreCorto}.
                </div>
              ) : (
              topLeaders.map((player, idx) => {
                const team = teamMap.get(player.teamId);
                const mainStat =
                  activeDisciplineMeta.sportType === 'futbol7'
                    ? `${player.stats.goles} Goles`
                    : `${player.stats.puntos} Pts`;

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => onInspectPlayer(player)}
                    className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-[#f5f6f8] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-display text-lg font-bold tabular-nums text-neutral-400 w-5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0d0d0d] truncate">
                          {player.nombre} {player.apellidoPaterno}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {team?.nombre} · {player.carrera}
                        </p>
                      </div>
                    </div>
                    <span className="font-display text-base font-bold tabular-nums text-[#707ef9] whitespace-nowrap shrink-0">
                      {mainStat}
                    </span>
                  </button>
                );
              })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Editorial Discipline Showcase (8 Official Disciplines) */}
      <section className="bg-[#f5f6f8] py-16">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                Estructura oficial UFRO
              </p>
              <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1">
                Las 8 disciplinas del campeonato
              </h2>
            </div>
            <p className="text-sm text-neutral-600 max-w-md">
              Fase de grupos equitativa todos contra todos con clasificación directa a llave de
              playoffs y mercado de transferencias intermedio.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  className="group bg-white border border-neutral-200 text-left flex flex-col overflow-hidden hover:border-[#707ef9] transition-colors cursor-pointer"
                >
                  <div className="relative h-40 w-full bg-[#0d0d0d] overflow-hidden">
                    {editorialPhotos?.byDiscipline[disc.id]?.url ? (
                      <img
                        src={editorialPhotos.byDiscipline[disc.id].url}
                        alt={`${disc.nombre} — ${editorialPhotos.byDiscipline[disc.id].caption}`}
                        className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#171928] via-[#0d0d0d] to-[#1f2338] flex items-center justify-center">
                        <img
                          src={LOGO_LIGHT_SVG}
                          alt=""
                          aria-hidden="true"
                          className="h-10 w-auto opacity-20"
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d]/85 via-[#0d0d0d]/25 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-neutral-200">
                      <span>{disc.rama}</span>
                      <span className="tabular-nums font-medium">{teamCount} equipos</span>
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d] group-hover:text-[#707ef9] transition-colors">
                        {disc.nombre}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1.5">
                        {cfg.numGrupos} grupos · Clasifican {cfg.clasificadosPorGrupo} por grupo · Top{' '}
                        {cfg.formatoPlayoff}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-600 pt-3 border-t border-neutral-100">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#707ef9]" />
                        <span>Cupos: {teamCount}/{cfg.maxCupos}</span>
                      </span>
                      <span className="font-medium text-[#0d0d0d]">Ver tabla →</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
