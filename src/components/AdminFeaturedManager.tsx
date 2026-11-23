import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  MapPin,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { sortMatchesChronologically } from '../domain/matchFilterEngine';
import type {
  DisciplineId,
  HomeFeaturedConfig,
  HomeFeaturedCtaSection,
  HomeFeaturedMode,
  Match,
  TournamentState,
} from '../types/tournament';

interface AdminFeaturedManagerProps {
  state: TournamentState;
  onSaveHomeFeatured: (config: HomeFeaturedConfig) => Promise<void>;
}

const CTA_SECTION_OPTIONS: Array<{ value: HomeFeaturedCtaSection; label: string }> = [
  { value: 'posiciones', label: 'Tablas y Playoffs' },
  { value: 'votaciones', label: 'Centro de Votaciones' },
  { value: 'equipos', label: 'Equipos Inscritos' },
  { value: 'jugadores', label: 'Directorio de Jugadores' },
  { value: 'galeria', label: 'Galería Fotográfica' },
  { value: 'inscripciones', label: 'Inscripciones' },
  { value: 'noticias', label: 'Noticias del Campeonato' },
];

export function AdminFeaturedManager({
  state,
  onSaveHomeFeatured,
}: AdminFeaturedManagerProps) {
  const initialConfig: HomeFeaturedConfig = state.homeFeatured ?? { mode: 'auto' };

  const [mode, setMode] = useState<HomeFeaturedMode>(initialConfig.mode);
  const [matchId, setMatchId] = useState<string>(initialConfig.matchId ?? '');
  const [badgeLabel, setBadgeLabel] = useState<string>(initialConfig.badgeLabel ?? '');
  const [customTitle, setCustomTitle] = useState<string>(initialConfig.customTitle ?? '');
  const [customSubtitle, setCustomSubtitle] = useState<string>(initialConfig.customSubtitle ?? '');
  const [customDescription, setCustomDescription] = useState<string>(
    initialConfig.customDescription ?? ''
  );
  const [ctaLabel, setCtaLabel] = useState<string>(
    initialConfig.ctaLabel ?? 'Ver programación completa'
  );
  const [ctaSection, setCtaSection] = useState<HomeFeaturedCtaSection>(
    initialConfig.ctaSection ?? 'posiciones'
  );

  // Match picker filters
  const [discFilter, setDiscFilter] = useState<'ALL' | DisciplineId>('ALL');
  const [matchSearch, setMatchSearch] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const cfg = state.homeFeatured ?? { mode: 'auto' };
    setMode(cfg.mode);
    setMatchId(cfg.matchId ?? '');
    setBadgeLabel(cfg.badgeLabel ?? '');
    setCustomTitle(cfg.customTitle ?? '');
    setCustomSubtitle(cfg.customSubtitle ?? '');
    setCustomDescription(cfg.customDescription ?? '');
    setCtaLabel(cfg.ctaLabel ?? 'Ver programación completa');
    setCtaSection(cfg.ctaSection ?? 'posiciones');
  }, [state.homeFeatured]);

  const teamMap = useMemo(() => new Map(state.teams.map((t) => [t.id, t])), [state.teams]);

  const orderedMatches = useMemo(() => {
    const sorted = sortMatchesChronologically(state.matches, 'newest');
    const q = matchSearch.trim().toLowerCase();
    return sorted.filter((m) => {
      if (discFilter !== 'ALL' && m.disciplineId !== discFilter) return false;
      if (!q) return true;
      const home = teamMap.get(m.homeTeamId)?.nombre ?? m.homeTeamId;
      const away = teamMap.get(m.awayTeamId)?.nombre ?? m.awayTeamId;
      const disc = DISCIPLINE_MAP[m.disciplineId]?.nombre ?? '';
      return `${home} ${away} ${disc} ${m.fecha} ${m.fase} ${m.groupName} ${m.cancha}`
        .toLowerCase()
        .includes(q);
    });
  }, [state.matches, discFilter, matchSearch, teamMap]);

  const autoMatch: Match | undefined = useMemo(() => {
    return sortMatchesChronologically(state.matches, 'newest')[0];
  }, [state.matches]);

  const selectedMatch: Match | undefined = useMemo(() => {
    if (mode === 'match' && matchId) {
      return state.matches.find((m) => m.id === matchId);
    }
    return autoMatch;
  }, [mode, matchId, state.matches, autoMatch]);

  const handleSave = async () => {
    setFeedback(null);
    if (mode === 'match' && !matchId) {
      setFeedback({
        type: 'err',
        text: 'Selecciona un partido específico para fijar en la portada.',
      });
      return;
    }
    if (mode === 'custom' && customTitle.trim().length < 3) {
      setFeedback({
        type: 'err',
        text: 'Ingresa un título de al menos 3 caracteres para el anuncio destacado.',
      });
      return;
    }

    const payload: HomeFeaturedConfig = {
      mode,
      updatedAt: new Date().toISOString(),
    };
    if (badgeLabel.trim()) payload.badgeLabel = badgeLabel.trim().slice(0, 80);

    if (mode === 'match') {
      payload.matchId = matchId;
    } else if (mode === 'custom') {
      payload.customTitle = customTitle.trim().slice(0, 140);
      if (customSubtitle.trim()) payload.customSubtitle = customSubtitle.trim().slice(0, 160);
      if (customDescription.trim()) {
        payload.customDescription = customDescription.trim().slice(0, 400);
      }
      if (ctaLabel.trim()) payload.ctaLabel = ctaLabel.trim().slice(0, 60);
      payload.ctaSection = ctaSection;
    }

    setSaving(true);
    try {
      await onSaveHomeFeatured(payload);
      setFeedback({
        type: 'ok',
        text: 'Bloque destacado de la portada guardado y publicado para todos los visitantes.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo guardar la configuración de portada en Firestore.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#707ef9]">
            Administración de Portada · Bloque Hero
          </p>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-[#0d0d0d] mt-1">
            Información Destacada de la Página Principal
          </h2>
          <p className="text-sm text-neutral-600 mt-1.5 max-w-2xl">
            Define exactamente qué aparece en la tarjeta destacada superior del inicio: selección
            automática del partido más reciente o en vivo, un encuentro designado por administración
            o un comunicado personalizado del campeonato.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Star className="w-4 h-4" />
          <span>{saving ? 'Guardando...' : 'Publicar en Portada'}</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 border text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Configuration Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Mode Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block">
              Modo del bloque destacado
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'auto' as const,
                    title: 'Automático',
                    desc: 'Partido en vivo o el más reciente / programado.',
                  },
                  {
                    id: 'match' as const,
                    title: 'Partido Designado',
                    desc: 'Elige manualmente un encuentro específico.',
                  },
                  {
                    id: 'custom' as const,
                    title: 'Anuncio Personalizado',
                    desc: 'Destaca una final, aviso o convocatoria propia.',
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setMode(opt.id);
                    setFeedback(null);
                  }}
                  className={`text-left p-4 border transition-colors cursor-pointer ${
                    mode === opt.id
                      ? 'bg-[#0d0d0d] text-white border-[#0d0d0d]'
                      : 'bg-white text-[#0d0d0d] border-neutral-200 hover:border-[#707ef9]'
                  }`}
                >
                  <p className="font-display text-sm font-bold uppercase tracking-wide">
                    {opt.title}
                  </p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      mode === opt.id ? 'text-neutral-300' : 'text-neutral-600'
                    }`}
                  >
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Kicker Label for Match or Custom */}
          {mode !== 'auto' && (
            <div>
              <label
                htmlFor="featured-badge-label"
                className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5"
              >
                Etiqueta superior (opcional)
              </label>
              <input
                id="featured-badge-label"
                type="text"
                maxLength={80}
                value={badgeLabel}
                onChange={(e) => setBadgeLabel(e.target.value)}
                placeholder={
                  mode === 'match'
                    ? 'Ej. Partido de la Fecha · Clásico Intercarreras'
                    : 'Ej. Aviso Oficial · Fase Final 2026'
                }
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
              />
            </div>
          )}

          {/* MODE: MATCH PICKER */}
          {mode === 'match' && (
            <div className="border border-neutral-200 bg-[#f5f6f8] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Buscar equipo, fecha, cancha o fase..."
                    aria-label="Buscar partido para destacar en portada"
                    className="w-full bg-white border border-neutral-300 pl-9 pr-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <select
                  aria-label="Filtrar partidos por disciplina"
                  value={discFilter}
                  onChange={(e) => setDiscFilter(e.target.value as 'ALL' | DisciplineId)}
                  className="bg-white border border-neutral-300 px-3 py-2 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                >
                  <option value="ALL">Todas las disciplinas</option>
                  {DISCIPLINES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-200 border border-neutral-200 bg-white">
                {orderedMatches.length === 0 ? (
                  <p className="p-6 text-center text-xs text-neutral-500">
                    No se encontraron partidos con ese criterio.
                  </p>
                ) : (
                  orderedMatches.slice(0, 60).map((m) => {
                    const home = teamMap.get(m.homeTeamId)?.nombre ?? m.homeTeamId;
                    const away = teamMap.get(m.awayTeamId)?.nombre ?? m.awayTeamId;
                    const disc = DISCIPLINE_MAP[m.disciplineId];
                    const active = m.id === matchId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMatchId(m.id)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          active ? 'bg-[#707ef9]/10' : 'hover:bg-[#f5f6f8]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-neutral-500 flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#0d0d0d]">{disc.nombreCorto}</span>
                            <span aria-hidden="true">·</span>
                            <span>{m.fase === 'Grupos' ? m.groupName : m.fase}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {m.fecha} {m.hora}
                            </span>
                          </p>
                          <p className="font-display text-sm font-bold uppercase text-[#0d0d0d] mt-0.5 truncate">
                            {home} vs {away}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                            active ? 'text-[#707ef9]' : 'text-neutral-400'
                          }`}
                        >
                          {active
                            ? 'Seleccionado'
                            : m.status === 'EN_VIVO'
                            ? 'En vivo'
                            : m.status === 'FINALIZADO'
                            ? `${m.homeScore}-${m.awayScore}`
                            : 'Prog.'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* MODE: CUSTOM HIGHLIGHT FORM */}
          {mode === 'custom' && (
            <div className="border border-neutral-200 bg-[#f5f6f8] p-5 space-y-4">
              <div>
                <label
                  htmlFor="featured-custom-title"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5"
                >
                  Título principal *
                </label>
                <input
                  id="featured-custom-title"
                  type="text"
                  maxLength={140}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej. Gran Jornada de Semifinales Intercarreras 2026"
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                />
              </div>

              <div>
                <label
                  htmlFor="featured-custom-subtitle"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5"
                >
                  Subtítulo o fecha/lugar (opcional)
                </label>
                <input
                  id="featured-custom-subtitle"
                  type="text"
                  maxLength={160}
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                  placeholder="Ej. Sábado 28 de Noviembre · Gimnasio Olímpico y Canchas UFRO"
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                />
              </div>

              <div>
                <label
                  htmlFor="featured-custom-desc"
                  className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5"
                >
                  Descripción breve
                </label>
                <textarea
                  id="featured-custom-desc"
                  rows={3}
                  maxLength={400}
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Detalle clave para los estudiantes, horarios, votaciones abiertas o acceso..."
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="featured-cta-label"
                    className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5"
                  >
                    Texto del botón
                  </label>
                  <input
                    id="featured-cta-label"
                    type="text"
                    maxLength={60}
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="Ver programación"
                    className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="featured-cta-section"
                    className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5"
                  >
                    Sección de destino
                  </label>
                  <select
                    id="featured-cta-section"
                    value={ctaSection}
                    onChange={(e) => setCtaSection(e.target.value as HomeFeaturedCtaSection)}
                    className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-[#0d0d0d] focus:outline-none focus:border-[#707ef9]"
                  >
                    {CTA_SECTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {mode === 'auto' && (
            <div className="border border-neutral-200 bg-[#f5f6f8] p-5 text-xs text-neutral-600 leading-relaxed space-y-1.5">
              <p className="font-semibold text-[#0d0d0d]">Selección automática inteligente</p>
              <p>
                Cuando está activo el modo Automático, la portada muestra primero cualquier partido
                en horario en vivo y, si no hay partidos en curso, el encuentro más reciente o
                próximo programado del torneo.
              </p>
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Vista previa en tiempo real (Hero Portada)
          </p>

          <div className="bg-[#0d0d0d] p-5">
            {mode === 'custom' ? (
              <div className="bg-[#141418] border border-white/15 p-6 space-y-4 text-white">
                <div className="flex items-center justify-between gap-2 text-xs text-neutral-300 border-b border-white/10 pb-3">
                  <span className="font-bold uppercase tracking-wider text-[#707ef9]">
                    {badgeLabel.trim() || `Destacado · Temporada ${state.temporada}`}
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-[#707ef9] shrink-0" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-2xl font-bold uppercase tracking-tight leading-tight text-white">
                    {customTitle.trim() || 'Título del anuncio destacado'}
                  </h3>
                  {customSubtitle.trim() && (
                    <p className="text-xs text-neutral-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#707ef9] shrink-0" />
                      <span>{customSubtitle.trim()}</span>
                    </p>
                  )}
                  <p className="text-xs text-neutral-300 leading-relaxed pt-1">
                    {customDescription.trim() ||
                      'Aquí se mostrará el mensaje informativo designado por la administración.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs">
                    <span>{ctaLabel.trim() || 'Explorar sección'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ) : selectedMatch ? (
              <div className="bg-[#141418] border border-white/15 p-6 space-y-5 text-white">
                <div className="flex items-center justify-between gap-3 text-xs text-neutral-300 border-b border-white/10 pb-3">
                  <span className="font-medium text-white truncate">
                    {badgeLabel.trim()
                      ? `${badgeLabel.trim()} · ${DISCIPLINE_MAP[selectedMatch.disciplineId].nombreCorto}`
                      : DISCIPLINE_MAP[selectedMatch.disciplineId].nombreCorto}
                  </span>
                  <span className="text-neutral-400 tabular-nums whitespace-nowrap shrink-0">
                    {selectedMatch.fecha} · {selectedMatch.hora}
                  </span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-1">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold uppercase text-white leading-tight break-words">
                      {teamMap.get(selectedMatch.homeTeamId)?.nombre ?? selectedMatch.homeTeamId}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5 truncate">
                      {teamMap.get(selectedMatch.homeTeamId)?.carrera}
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-[#0d0d0d] border border-white/10 font-display text-xl font-bold tabular-nums">
                    {selectedMatch.status === 'FINALIZADO'
                      ? `${selectedMatch.homeScore} — ${selectedMatch.awayScore}`
                      : 'vs'}
                  </div>
                  <div className="text-right min-w-0">
                    <p className="font-display text-lg font-bold uppercase text-white leading-tight break-words">
                      {teamMap.get(selectedMatch.awayTeamId)?.nombre ?? selectedMatch.awayTeamId}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5 truncate">
                      {teamMap.get(selectedMatch.awayTeamId)?.carrera}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10 text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#707ef9] shrink-0" />
                    <span className="truncate">{selectedMatch.cancha}</span>
                  </span>
                  <span className="text-white whitespace-nowrap">Ver ficha oficial →</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#141418] border border-white/15 p-6 text-xs text-neutral-400">
                No hay partidos registrados aún. Puedes usar el modo Anuncio Personalizado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
