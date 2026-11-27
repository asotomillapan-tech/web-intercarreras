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
      setFeedback({ type: 'err', text: 'Selecciona un partido para fijar en portada.' });
      return;
    }
    if (mode === 'custom' && customTitle.trim().length < 3) {
      setFeedback({ type: 'err', text: 'Ingresa un título de al menos 3 caracteres.' });
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
      setFeedback({ type: 'ok', text: 'Bloque destacado de portada actualizado.' });
    } catch (err: unknown) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
      });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            Portada · Bloque Hero
          </p>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Contenido{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">destacado</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Define qué aparece en la tarjeta destacada superior de la página principal.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0 self-start md:self-auto"
        >
          <Star className="w-4 h-4" />
          <span>{saving ? 'Guardando...' : 'Publicar en portada'}</span>
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`px-4 py-3 rounded-2xl border text-xs flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          <div className="space-y-2.5">
            <span className="text-xs text-zinc-400 block">Modo del bloque</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'auto' as const, title: 'Automático', desc: 'Partido más reciente o en juego.' },
                  { id: 'match' as const, title: 'Partido fijado', desc: 'Elige un encuentro específico.' },
                  { id: 'custom' as const, title: 'Anuncio libre', desc: 'Comunicado o aviso propio.' },
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setMode(opt.id);
                    setFeedback(null);
                  }}
                  className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                    mode === opt.id
                      ? 'bg-white text-[#050507] border-white'
                      : 'bg-[#101016] text-white border-white/[0.08] hover:border-white/[0.22]'
                  }`}
                >
                  <p className="text-sm font-medium">{opt.title}</p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      mode === opt.id ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  >
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {mode !== 'auto' && (
            <div>
              <label htmlFor="featured-badge-label" className="text-xs text-zinc-400 block mb-1.5">
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
                    ? 'Ej. Partido de la Fecha'
                    : 'Ej. Aviso Oficial · Fase Final'
                }
                className={inputCls}
              />
            </div>
          )}

          {mode === 'match' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Buscar equipo, fecha o fase..."
                    aria-label="Buscar partido para destacar en portada"
                    className="w-full rounded-xl bg-[#050507] border border-white/[0.1] pl-10 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
                <select
                  aria-label="Filtrar partidos por disciplina"
                  value={discFilter}
                  onChange={(e) => setDiscFilter(e.target.value as 'ALL' | DisciplineId)}
                  className="rounded-xl bg-[#050507] border border-white/[0.1] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9]"
                >
                  <option value="ALL">Todas las disciplinas</option>
                  {DISCIPLINES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#050507]">
                {orderedMatches.length === 0 ? (
                  <p className="p-6 text-center text-xs text-zinc-500">
                    No se encontraron partidos.
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
                          active ? 'bg-[#707ef9]/15' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-1.5">
                            <span className="text-[#a5b0ff] font-medium">{disc.nombreCorto}</span>
                            <span>·</span>
                            <span>{m.fase === 'Grupos' ? m.groupName : m.fase}</span>
                            <span>·</span>
                            <span className="tabular-nums">
                              {m.fecha} {m.hora}
                            </span>
                          </p>
                          <p className="text-sm font-medium text-white mt-0.5 truncate">
                            {home} vs {away}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] font-medium shrink-0 ${
                            active ? 'text-[#c8ceff]' : 'text-zinc-500'
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

          {mode === 'custom' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-5 space-y-4">
              <div>
                <label htmlFor="featured-custom-title" className="text-xs text-zinc-400 block mb-1.5">
                  Título principal *
                </label>
                <input
                  id="featured-custom-title"
                  type="text"
                  maxLength={140}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej. Semifinales Intercarreras UFRO"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="featured-custom-subtitle" className="text-xs text-zinc-400 block mb-1.5">
                  Subtítulo o fecha/lugar
                </label>
                <input
                  id="featured-custom-subtitle"
                  type="text"
                  maxLength={160}
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                  placeholder="Ej. Sábado · Gimnasio Olímpico UFRO"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="featured-custom-desc" className="text-xs text-zinc-400 block mb-1.5">
                  Descripción breve
                </label>
                <textarea
                  id="featured-custom-desc"
                  rows={3}
                  maxLength={400}
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Detalle clave para visitantes..."
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="featured-cta-label" className="text-xs text-zinc-400 block mb-1.5">
                    Texto del botón
                  </label>
                  <input
                    id="featured-cta-label"
                    type="text"
                    maxLength={60}
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="Ver programación"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="featured-cta-section" className="text-xs text-zinc-400 block mb-1.5">
                    Destino
                  </label>
                  <select
                    id="featured-cta-section"
                    value={ctaSection}
                    onChange={(e) => setCtaSection(e.target.value as HomeFeaturedCtaSection)}
                    className={inputCls}
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
            <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-5 text-xs text-zinc-400 leading-relaxed">
              Muestra automáticamente el encuentro en curso o el partido más reciente/próximo del
              campeonato.
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-2.5">
          <p className="text-xs text-zinc-400">Vista previa en portada</p>
          <div className="rounded-3xl border border-white/[0.1] bg-[#050507] p-5">
            {mode === 'custom' ? (
              <div className="rounded-2xl bg-[#101016] border border-white/[0.1] p-6 space-y-4 text-white">
                <div className="flex items-center justify-between gap-2 text-xs border-b border-white/[0.08] pb-3">
                  <span className="text-[#a5b0ff] font-medium">
                    {badgeLabel.trim() || `Destacado · ${state.temporada}`}
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-[#a5b0ff] shrink-0" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-medium tracking-tight text-white">
                    {customTitle.trim() || 'Título del anuncio destacado'}
                  </h3>
                  {customSubtitle.trim() && (
                    <p className="text-xs text-zinc-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#a5b0ff] shrink-0" />
                      <span>{customSubtitle.trim()}</span>
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {customDescription.trim() || 'Mensaje informativo destacado en portada.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.08]">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#050507] text-xs font-medium">
                    <span>{ctaLabel.trim() || 'Explorar'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ) : selectedMatch ? (
              <div className="rounded-2xl bg-[#101016] border border-white/[0.1] p-6 space-y-5 text-white">
                <div className="flex items-center justify-between gap-3 text-xs border-b border-white/[0.08] pb-3">
                  <span className="font-medium text-white truncate">
                    {badgeLabel.trim()
                      ? `${badgeLabel.trim()} · ${DISCIPLINE_MAP[selectedMatch.disciplineId].nombreCorto}`
                      : DISCIPLINE_MAP[selectedMatch.disciplineId].nombreCorto}
                  </span>
                  <span className="text-zinc-500 tabular-nums shrink-0">
                    {selectedMatch.fecha} · {selectedMatch.hora}
                  </span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white leading-tight break-words">
                      {teamMap.get(selectedMatch.homeTeamId)?.nombre ?? selectedMatch.homeTeamId}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {teamMap.get(selectedMatch.homeTeamId)?.carrera}
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-[#050507] border border-white/[0.1] text-base font-mono tabular-nums">
                    {selectedMatch.status === 'FINALIZADO'
                      ? `${selectedMatch.homeScore} — ${selectedMatch.awayScore}`
                      : 'vs'}
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-sm font-medium text-white leading-tight break-words">
                      {teamMap.get(selectedMatch.awayTeamId)?.nombre ?? selectedMatch.awayTeamId}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {teamMap.get(selectedMatch.awayTeamId)?.carrera}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.08] text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#a5b0ff] shrink-0" />
                    <span className="truncate">{selectedMatch.cancha}</span>
                  </span>
                  <span className="text-white whitespace-nowrap">Ver ficha →</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#101016] border border-white/[0.08] p-6 text-xs text-zinc-500">
                Sin partidos registrados. Puedes usar el modo Anuncio libre.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
