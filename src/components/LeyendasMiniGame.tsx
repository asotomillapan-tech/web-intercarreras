import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Flame, Volume2, VolumeX, Zap } from 'lucide-react';
import {
  evaluateVisualMiniGameOutcome,
  type LeyendasMiniGameOutcome,
  type LeyendasMiniGameScenario,
} from '../domain/leyendasEngine';

interface LeyendasMiniGameProps {
  scenario: LeyendasMiniGameScenario;
  onComplete: (outcome: LeyendasMiniGameOutcome) => void;
}

type AimZone = 'LEFT' | 'CENTER' | 'RIGHT';

function playSynthFeedback(tier: 'PERFECT' | 'GOOD' | 'MISS', muted: boolean) {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number, type: OscillatorType = 'triangle', gainVal = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(gainVal, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };

    if (tier === 'PERFECT') {
      playTone(523.25, 0, 0.14);
      playTone(659.25, 0.09, 0.16);
      playTone(783.99, 0.18, 0.28);
    } else if (tier === 'GOOD') {
      playTone(440, 0, 0.14);
      playTone(587.33, 0.1, 0.22);
    } else {
      playTone(220, 0, 0.18, 'sawtooth', 0.06);
      playTone(174.6, 0.14, 0.25, 'sawtooth', 0.05);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
  } catch {
    // Audio optional
  }
}

export function LeyendasMiniGame({ scenario, onComplete }: LeyendasMiniGameProps) {
  const [aimZone, setAimZone] = useState<AimZone>('RIGHT');
  const [cursor, setCursor] = useState<number>(12); // 0..100
  const [keeperPos, setKeeperPos] = useState<number>(50); // 20..80
  const [phase, setPhase] = useState<'AIM' | 'RESOLVED'>('AIM');
  const [outcome, setOutcome] = useState<LeyendasMiniGameOutcome | null>(null);
  const [keeperDive, setKeeperDive] = useState<AimZone>('CENTER');
  const [muted, setMuted] = useState<boolean>(false);

  const cursorRef = useRef<number>(12);
  const dirRef = useRef<number>(1);
  const keeperDirRef = useRef<number>(1);
  const keeperRef = useRef<number>(50);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Sweet spot centered at 50
  const perfectHalf = scenario.sweetSpotWidth / 2;
  const goodHalf = scenario.goodZoneWidth / 2;

  useEffect(() => {
    if (phase !== 'AIM') return;
    lastTsRef.current = null;

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      // Oscillate precision bar smoothly
      const barSpeed = 105 * scenario.speedMultiplier;
      let nextCursor = cursorRef.current + dirRef.current * barSpeed * dt;
      if (nextCursor >= 98) {
        nextCursor = 98;
        dirRef.current = -1;
      } else if (nextCursor <= 2) {
        nextCursor = 2;
        dirRef.current = 1;
      }
      cursorRef.current = nextCursor;
      setCursor(nextCursor);

      // Subtle goalkeeper / ball motion
      const keeperSpeed = 42 * scenario.speedMultiplier;
      let nextKeeper = keeperRef.current + keeperDirRef.current * keeperSpeed * dt;
      if (nextKeeper >= 76) {
        nextKeeper = 76;
        keeperDirRef.current = -1;
      } else if (nextKeeper <= 24) {
        nextKeeper = 24;
        keeperDirRef.current = 1;
      }
      keeperRef.current = nextKeeper;
      setKeeperPos(nextKeeper);

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [phase, scenario.speedMultiplier]);

  const handleExecuteAction = useCallback(() => {
    if (phase !== 'AIM') return;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const dist = Math.abs(cursorRef.current - 50);
    let tier: 'PERFECT' | 'GOOD' | 'MISS' = 'MISS';
    if (dist <= perfectHalf) {
      tier = 'PERFECT';
    } else if (dist <= goodHalf) {
      tier = 'GOOD';
    }

    // Visual keeper dive reacts realistically to outcome
    if (tier === 'MISS') {
      setKeeperDive(aimZone);
    } else {
      const otherZones: AimZone[] = (['LEFT', 'CENTER', 'RIGHT'] as AimZone[]).filter(
        (z) => z !== aimZone
      );
      setKeeperDive(otherZones[Math.floor(Math.random() * otherZones.length)]);
    }

    const res = evaluateVisualMiniGameOutcome(scenario, tier);
    playSynthFeedback(tier, muted);
    setOutcome(res);
    setPhase('RESOLVED');
  }, [phase, perfectHalf, goodHalf, aimZone, scenario, muted]);

  // Keyboard support: Space or Enter triggers the shot cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'AIM') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        handleExecuteAction();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleExecuteAction]);

  const actionButtonLabel =
    scenario.kind === 'penalty_kick'
      ? 'Patear Penal'
      : scenario.kind === 'penalty_save'
      ? 'Lanzarse a Atajar'
      : scenario.kind === 'buzzer_beater'
      ? 'Soltar Lanzamiento'
      : 'Ejecutar Remache';

  // Visual coordinates for resolved ball animation
  const aimX = aimZone === 'LEFT' ? 118 : aimZone === 'CENTER' ? 240 : 362;
  const aimY = outcome?.tier === 'PERFECT' ? 68 : outcome?.tier === 'GOOD' ? 105 : 88;
  const keeperVisualX =
    phase === 'RESOLVED'
      ? keeperDive === 'LEFT'
        ? 130
        : keeperDive === 'CENTER'
        ? 240
        : 350
      : 100 + (keeperPos / 100) * 280;

  return (
    <div className="space-y-5 leyendas-card-deal">
      {/* Dark Arena Header */}
      <div className="bg-[#0d0d0d] text-white p-5 sm:p-6 border border-white/10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400">
              <Flame className="w-3.5 h-3.5" />
              <span>Minijuego Decisivo · {scenario.venue}</span>
            </div>
            <h3 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
              {scenario.title}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300">{scenario.context}</p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Activar sonido del minijuego' : 'Silenciar sonido del minijuego'}
            className="p-2 border border-white/15 text-neutral-300 hover:text-white hover:border-[#707ef9] cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Visual Interactive SVG Stage */}
        <div
          className={`relative bg-[#13151d] border border-white/15 overflow-hidden ${
            phase === 'RESOLVED' && outcome && !outcome.success ? 'leyendas-shake' : ''
          }`}
        >
          {(scenario.kind === 'penalty_kick' || scenario.kind === 'penalty_save') && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Arco de Fútbol 7 UFRO"
            >
              {/* Night Sky & Pitch */}
              <rect x="0" y="0" width="480" height="156" fill="#0f1119" />
              <rect x="0" y="156" width="480" height="74" fill="#164e31" />
              <line x1="0" y1="156" x2="480" y2="156" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" />
              {/* Penalty box lines */}
              <polygon points="45,156 435,156 465,230 15,230" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />

              {/* Stadium Floodlight glow */}
              <circle cx="90" cy="24" r="46" fill="#707ef9" fillOpacity="0.14" />
              <circle cx="390" cy="24" r="46" fill="#707ef9" fillOpacity="0.14" />

              {/* Goal Net Grid */}
              <rect x="76" y="42" width="328" height="114" fill="#181c28" fillOpacity="0.65" />
              {[108, 140, 172, 204, 236, 268, 300, 332, 364].map((x) => (
                <line key={x} x1={x} y1="42" x2={x} y2="156" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
              ))}
              {[65, 88, 111, 134].map((y) => (
                <line key={y} x1="76" y1={y} x2="404" y2={y} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
              ))}

              {/* Clickable Target Zones when AIMING */}
              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, x: 82, w: 102, label: 'IZQ' },
                  { id: 'CENTER' as AimZone, x: 189, w: 102, label: 'CENTRO' },
                  { id: 'RIGHT' as AimZone, x: 296, w: 102, label: 'DER' },
                ]).map((z) => {
                  const selected = aimZone === z.id;
                  return (
                    <g
                      key={z.id}
                      onClick={() => setAimZone(z.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={z.x}
                        y="48"
                        width={z.w}
                        height="102"
                        fill={selected ? '#707ef9' : '#ffffff'}
                        fillOpacity={selected ? 0.24 : 0.04}
                        stroke={selected ? '#707ef9' : '#ffffff'}
                        strokeOpacity={selected ? 0.95 : 0.2}
                        strokeWidth={selected ? 2.5 : 1}
                        strokeDasharray={selected ? '0' : '4 4'}
                      />
                      <text
                        x={z.x + z.w / 2}
                        y="102"
                        textAnchor="middle"
                        fill={selected ? '#ffffff' : '#a3a3a3'}
                        fontSize="12"
                        fontWeight="700"
                        letterSpacing="1.5"
                      >
                        {selected ? `◎ ${z.label}` : z.label}
                      </text>
                    </g>
                  );
                })}

              {/* Goal Posts */}
              <path
                d="M74 156 L74 40 L406 40 L406 156"
                fill="none"
                stroke="#ffffff"
                strokeWidth="6"
                strokeLinecap="square"
              />

              {/* Goalkeeper Figure */}
              <g
                style={{
                  transform: `translate(${keeperVisualX}px, ${phase === 'RESOLVED' ? 124 : 118}px)`,
                  transition: phase === 'RESOLVED' ? 'transform 340ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="-16" r="10" fill="#f59e0b" stroke="#0d0d0d" strokeWidth="2" />
                <rect x="-13" y="-4" width="26" height="28" rx="4" fill="#f59e0b" />
                <line x1="-26" y1="4" x2="26" y2="4" stroke="#fde68a" strokeWidth="6" strokeLinecap="round" />
                <line x1="-7" y1="24" x2="-11" y2="38" stroke="#0d0d0d" strokeWidth="5" strokeLinecap="round" />
                <line x1="7" y1="24" x2="11" y2="38" stroke="#0d0d0d" strokeWidth="5" strokeLinecap="round" />
              </g>

              {/* Penalty Spot & Animated Ball */}
              <ellipse cx="240" cy="202" rx="8" ry="3" fill="#ffffff" fillOpacity="0.6" />
              {phase === 'RESOLVED' && (
                <path
                  d={`M 240 200 Q ${(240 + aimX) / 2} 120 ${aimX} ${aimY}`}
                  fill="none"
                  stroke={outcome?.success ? '#10b981' : '#ef4444'}
                  strokeWidth="2.5"
                  strokeDasharray="5 5"
                  strokeOpacity="0.85"
                />
              )}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? `translate(${aimX}px, ${aimY}px) scale(0.76)`
                      : 'translate(240px, 198px) scale(1)',
                  transition: 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <circle cx="0" cy="0" r="12" fill="#ffffff" stroke="#0d0d0d" strokeWidth="2" />
                <polygon points="0,-6 5,-1 3,5 -3,5 -5,-1" fill="#0d0d0d" />
              </g>
            </svg>
          )}

          {scenario.kind === 'buzzer_beater' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Aro de Básquetbol Gimnasio Olímpico UFRO"
            >
              <rect x="0" y="0" width="480" height="175" fill="#10131e" />
              <rect x="0" y="175" width="480" height="55" fill="#7c4d25" />
              <line x1="0" y1="175" x2="480" y2="175" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />

              {/* Shot Clock */}
              <rect x="332" y="14" width="68" height="28" fill="#0d0d0d" stroke="#ef4444" strokeWidth="2" />
              <text x="366" y="33" textAnchor="middle" fill="#ef4444" fontSize="15" fontWeight="700" fontFamily="monospace">
                {phase === 'RESOLVED' ? '00:00' : '00:02'}
              </text>

              {/* Backboard & Rim */}
              <rect x="378" y="48" width="12" height="72" fill="#e5e7eb" stroke="#0d0d0d" strokeWidth="2" />
              <line x1="384" y1="120" x2="384" y2="175" stroke="#52525b" strokeWidth="8" />
              <line x1="334" y1="98" x2="378" y2="98" stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
              {/* Net */}
              <path d="M338 100 L345 128 L368 128 L374 100" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" />

              {/* Shot Arc Preview */}
              <path
                d="M 88 164 Q 230 10 356 96"
                fill="none"
                stroke={
                  phase === 'RESOLVED'
                    ? outcome?.success
                      ? '#10b981'
                      : '#ef4444'
                    : '#707ef9'
                }
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeOpacity="0.7"
              />

              {/* Shooter silhouette */}
              <circle cx="76" cy="140" r="10" fill="#707ef9" />
              <rect x="66" y="152" width="20" height="32" rx="4" fill="#707ef9" />

              {/* Basketball */}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? outcome?.success
                        ? 'translate(356px, 114px) scale(0.9)'
                        : 'translate(324px, 84px) scale(0.95)'
                      : `translate(${88 + (cursor / 100) * 32}px, ${152 - Math.sin((cursor / 100) * Math.PI) * 18}px)`,
                  transition: phase === 'RESOLVED' ? 'transform 420ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="0" r="13" fill="#ea580c" stroke="#0d0d0d" strokeWidth="2" />
                <line x1="-13" y1="0" x2="13" y2="0" stroke="#0d0d0d" strokeWidth="1.5" />
                <line x1="0" y1="-13" x2="0" y2="13" stroke="#0d0d0d" strokeWidth="1.5" />
              </g>
            </svg>
          )}

          {scenario.kind === 'volleyball_spike' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Red de Voleibol Gimnasio Olímpico UFRO"
            >
              <rect x="0" y="0" width="480" height="176" fill="#0f1320" />
              <rect x="0" y="176" width="480" height="54" fill="#1d4ed8" fillOpacity="0.45" />
              <line x1="0" y1="176" x2="480" y2="176" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.5" />

              {/* Net Center */}
              <line x1="240" y1="74" x2="240" y2="176" stroke="#ffffff" strokeWidth="5" />
              <rect x="234" y="74" width="12" height="52" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.5" />
              <line x1="240" y1="54" x2="240" y2="74" stroke="#ef4444" strokeWidth="3" strokeDasharray="4 3" />

              {/* Ideal Spike Contact Ring */}
              <circle
                cx="196"
                cy="66"
                r="22"
                fill="#10b981"
                fillOpacity="0.16"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <text x="196" y="36" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontFamily="monospace">
                PUNTO ÓPTIMO
              </text>

              {/* Opponent Blocker */}
              <rect x="256" y="88" width="20" height="52" rx="4" fill="#f59e0b" fillOpacity="0.85" />
              <circle cx="266" cy="78" r="9" fill="#f59e0b" />

              {/* Volleyball moving dynamically */}
              {phase === 'RESOLVED' && (
                <line
                  x1="196"
                  y1="66"
                  x2={outcome?.success ? 404 : 254}
                  y2={outcome?.success ? 172 : 96}
                  stroke={outcome?.success ? '#10b981' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray="5 5"
                />
              )}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? outcome?.success
                        ? 'translate(404px, 166px)'
                        : 'translate(254px, 96px)'
                      : `translate(196px, ${34 + (cursor / 100) * 64}px)`,
                  transition: phase === 'RESOLVED' ? 'transform 340ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="0" r="13" fill="#fef08a" stroke="#1e3a8a" strokeWidth="2" />
                <path d="M-11 -4 Q0 6 11 -4" fill="none" stroke="#1e3a8a" strokeWidth="1.5" />
              </g>
            </svg>
          )}
        </div>

        {/* Aim Selector Buttons for Football Penalty */}
        {(scenario.kind === 'penalty_kick' || scenario.kind === 'penalty_save') && phase === 'AIM' && (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'LEFT', label: scenario.kind === 'penalty_save' ? 'Volar Izquierda' : 'Palo Izquierdo' },
                { id: 'CENTER', label: scenario.kind === 'penalty_save' ? 'Aguantar Centro' : 'Al Centro' },
                { id: 'RIGHT', label: scenario.kind === 'penalty_save' ? 'Volar Derecha' : 'Palo Derecho' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAimZone(opt.id)}
                className={`py-2 px-3 text-xs font-display font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                  aimZone === opt.id
                    ? 'bg-[#707ef9] text-white border-[#707ef9]'
                    : 'bg-white/5 text-neutral-300 border-white/15 hover:border-white/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Timing Precision Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider">
            <span className="text-neutral-300">{scenario.subtitle}</span>
            <span className="text-amber-300 font-bold">
              {phase === 'AIM' ? 'Espacio / Clic' : outcome?.tier}
            </span>
          </div>

          <div className="relative h-7 bg-[#1d202b] border border-white/20 overflow-hidden">
            {/* Good zone */}
            <div
              className="absolute top-0 bottom-0 bg-[#707ef9]/45"
              style={{
                left: `${50 - goodHalf}%`,
                width: `${scenario.goodZoneWidth}%`,
              }}
            />
            {/* Perfect zone */}
            <div
              className="absolute top-0 bottom-0 bg-emerald-400/80 border-x border-emerald-200"
              style={{
                left: `${50 - perfectHalf}%`,
                width: `${scenario.sweetSpotWidth}%`,
              }}
            />
            {/* Zone labels */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#0d0d0d]">
                PERFECTO
              </span>
            </div>

            {/* Moving Cursor Needle */}
            <div
              className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]"
              style={{
                left: `calc(${cursor}% - 4px)`,
              }}
            />
          </div>
        </div>

        {/* Action CTA or Result Reveal */}
        {phase === 'AIM' ? (
          <button
            type="button"
            onClick={handleExecuteAction}
            className="w-full py-3.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display text-lg font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-5 h-5" />
            <span>{actionButtonLabel}</span>
          </button>
        ) : (
          outcome && (
            <div
              className={`p-4 border space-y-3 ${
                outcome.success
                  ? 'bg-emerald-500/15 border-emerald-400/60'
                  : 'bg-red-500/15 border-red-400/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-2xl sm:text-3xl font-bold uppercase text-white">
                  {outcome.headline}
                </p>
                <span
                  className={`font-mono text-xs font-bold uppercase px-2.5 py-1 ${
                    outcome.ovrDelta > 0
                      ? 'bg-emerald-400 text-[#0d0d0d]'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {outcome.ovrDelta > 0 ? `+${outcome.ovrDelta}` : outcome.ovrDelta} OVR
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                {outcome.narrative}
              </p>
              <button
                type="button"
                onClick={() => onComplete(outcome)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-[#707ef9] text-[#0d0d0d] hover:text-white font-display font-bold uppercase tracking-widest text-sm transition-colors cursor-pointer"
              >
                <span>Ver Balance del Semestre</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
