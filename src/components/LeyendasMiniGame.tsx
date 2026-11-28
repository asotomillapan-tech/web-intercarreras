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
  embedded?: boolean;
  kickerOverride?: string;
  continueLabelOverride?: string;
  extraXpBonus?: number;
}

type AimZone = 'LEFT' | 'CENTER' | 'RIGHT';

function playSynthFeedback(tier: 'PERFECT' | 'GOOD' | 'MISS', muted: boolean) {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      start: number,
      dur: number,
      type: OscillatorType = 'triangle',
      gainVal = 0.08
    ) => {
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

export function LeyendasMiniGame({
  scenario,
  onComplete,
  embedded = false,
  kickerOverride,
  continueLabelOverride,
  extraXpBonus = 0,
}: LeyendasMiniGameProps) {
  const [aimZone, setAimZone] = useState<AimZone>('RIGHT');
  const [cursor, setCursor] = useState<number>(12); // 0..100
  const [motionPos, setMotionPos] = useState<number>(50); // 20..80
  const [phase, setPhase] = useState<'AIM' | 'RESOLVED'>('AIM');
  const [outcome, setOutcome] = useState<LeyendasMiniGameOutcome | null>(null);
  const [rivalReactZone, setRivalReactZone] = useState<AimZone>('CENTER');
  const [muted, setMuted] = useState<boolean>(false);

  const cursorRef = useRef<number>(12);
  const dirRef = useRef<number>(1);
  const motionDirRef = useRef<number>(1);
  const motionRef = useRef<number>(50);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Sweet spot centered at 50
  const perfectHalf = scenario.sweetSpotWidth / 2;
  const goodHalf = scenario.goodZoneWidth / 2;

  // Reset cleanly if scenario changes
  useEffect(() => {
    setAimZone('RIGHT');
    setCursor(12);
    setMotionPos(50);
    setPhase('AIM');
    setOutcome(null);
    cursorRef.current = 12;
    dirRef.current = 1;
    motionRef.current = 50;
    motionDirRef.current = 1;
  }, [scenario.id]);

  useEffect(() => {
    if (phase !== 'AIM') return;
    lastTsRef.current = null;

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const barSpeed = 104 * scenario.speedMultiplier;
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

      const actorSpeed = 44 * scenario.speedMultiplier;
      let nextMotion = motionRef.current + motionDirRef.current * actorSpeed * dt;
      if (nextMotion >= 76) {
        nextMotion = 76;
        motionDirRef.current = -1;
      } else if (nextMotion <= 24) {
        nextMotion = 24;
        motionDirRef.current = 1;
      }
      motionRef.current = nextMotion;
      setMotionPos(nextMotion);

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

    const isDefensive =
      scenario.kind === 'penalty_save' ||
      scenario.kind === 'keeper_reflex' ||
      scenario.kind === 'goal_line_tackle' ||
      scenario.kind === 'volleyball_block';

    if ((tier === 'MISS' && !isDefensive) || (tier !== 'MISS' && isDefensive)) {
      setRivalReactZone(aimZone);
    } else {
      const otherZones: AimZone[] = (['LEFT', 'CENTER', 'RIGHT'] as AimZone[]).filter(
        (z) => z !== aimZone
      );
      setRivalReactZone(otherZones[Math.floor(Math.random() * otherZones.length)]);
    }

    const res = evaluateVisualMiniGameOutcome(scenario, tier);
    playSynthFeedback(tier, muted);
    setOutcome(res);
    setPhase('RESOLVED');
  }, [phase, perfectHalf, goodHalf, aimZone, scenario, muted]);

  // Keyboard support: Space/Enter executes, Left/Right/1/2/3 switches aim choice
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'AIM') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (scenario.actionChoices && scenario.actionChoices.length === 3) {
        if (e.key === '1') setAimZone('LEFT');
        else if (e.key === '2') setAimZone('CENTER');
        else if (e.key === '3') setAimZone('RIGHT');
        else if (e.code === 'ArrowLeft') {
          setAimZone((prev) => (prev === 'RIGHT' ? 'CENTER' : 'LEFT'));
        } else if (e.code === 'ArrowRight') {
          setAimZone((prev) => (prev === 'LEFT' ? 'CENTER' : 'RIGHT'));
        }
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleExecuteAction();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, scenario.actionChoices, handleExecuteAction]);

  const aimX = aimZone === 'LEFT' ? 118 : aimZone === 'CENTER' ? 240 : 362;
  const aimY = outcome?.tier === 'PERFECT' ? 64 : outcome?.tier === 'GOOD' ? 102 : 90;
  const reactX =
    phase === 'RESOLVED'
      ? rivalReactZone === 'LEFT'
        ? 130
        : rivalReactZone === 'CENTER'
        ? 240
        : 350
      : 100 + (motionPos / 100) * 280;

  const totalDisplayXp = outcome
    ? outcome.success
      ? outcome.ovrXpDelta + extraXpBonus
      : outcome.ovrXpDelta
    : 0;

  return (
    <div className="space-y-5 leyendas-card-deal" data-minigame-kind={scenario.kind}>
      <div
        className={
          embedded
            ? 'text-white space-y-5'
            : 'rounded-3xl bg-[#0c0c10] text-white p-5 sm:p-7 border border-white/[0.08] space-y-5'
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#a5b0ff]">
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {kickerOverride ?? `Jugada decisiva · ${scenario.venue}`}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white leading-tight">
              {scenario.title}
            </h3>
            <p className="text-sm text-white/65 leading-relaxed">{scenario.context}</p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Activar sonido del minijuego' : 'Silenciar sonido del minijuego'}
            className="p-2.5 rounded-full bg-white/[0.04] border border-white/[0.1] text-white/70 hover:text-white hover:border-[#707ef9]/60 transition-colors cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Visual Interactive SVG Stage */}
        <div
          className={`relative rounded-2xl bg-[#09090d] border border-white/[0.08] overflow-hidden ${
            phase === 'RESOLVED' && outcome && !outcome.success ? 'leyendas-shake' : ''
          }`}
        >
          {/* 1. FOOTBALL: PENALTY KICK & PENALTY SAVE */}
          {(scenario.kind === 'penalty_kick' || scenario.kind === 'penalty_save') && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Arco de Fútbol 7 UFRO"
            >
              <rect x="0" y="0" width="480" height="156" fill="#0f1119" />
              <rect x="0" y="156" width="480" height="74" fill="#164e31" />
              <line x1="0" y1="156" x2="480" y2="156" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" />
              <polygon points="45,156 435,156 465,230 15,230" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
              <circle cx="90" cy="24" r="46" fill="#707ef9" fillOpacity="0.14" />
              <circle cx="390" cy="24" r="46" fill="#707ef9" fillOpacity="0.14" />

              <rect x="76" y="42" width="328" height="114" fill="#181c28" fillOpacity="0.65" />
              {[108, 140, 172, 204, 236, 268, 300, 332, 364].map((x) => (
                <line key={x} x1={x} y1="42" x2={x} y2="156" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
              ))}
              {[65, 88, 111, 134].map((y) => (
                <line key={y} x1="76" y1={y} x2="404" y2={y} stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
              ))}

              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, x: 82, w: 102, label: 'IZQ' },
                  { id: 'CENTER' as AimZone, x: 189, w: 102, label: 'CENTRO' },
                  { id: 'RIGHT' as AimZone, x: 296, w: 102, label: 'DER' },
                ]).map((z) => {
                  const selected = aimZone === z.id;
                  return (
                    <g key={z.id} onClick={() => setAimZone(z.id)} className="cursor-pointer">
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

              <path d="M74 156 L74 40 L406 40 L406 156" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="square" />

              <g
                style={{
                  transform: `translate(${reactX}px, ${phase === 'RESOLVED' ? 124 : 118}px)`,
                  transition: phase === 'RESOLVED' ? 'transform 340ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="-16" r="10" fill="#f59e0b" stroke="#0d0d0d" strokeWidth="2" />
                <rect x="-13" y="-4" width="26" height="28" rx="4" fill="#f59e0b" />
                <line x1="-26" y1="4" x2="26" y2="4" stroke="#fde68a" strokeWidth="6" strokeLinecap="round" />
                <line x1="-7" y1="24" x2="-11" y2="38" stroke="#0d0d0d" strokeWidth="5" strokeLinecap="round" />
                <line x1="7" y1="24" x2="11" y2="38" stroke="#0d0d0d" strokeWidth="5" strokeLinecap="round" />
              </g>

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

          {/* 2. FOOTBALL: FREE KICK OVER DEFENSIVE WALL */}
          {scenario.kind === 'free_kick' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Tiro Libre con Barrera en Cancha 1 UFRO"
            >
              <rect x="0" y="0" width="480" height="142" fill="#0f1119" />
              <rect x="0" y="142" width="480" height="88" fill="#154d30" />
              <line x1="0" y1="142" x2="480" y2="142" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" />
              {/* Free kick distance arc */}
              <path d="M 110 198 Q 240 164 370 198" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="6 6" />

              {/* Goal */}
              <rect x="92" y="42" width="296" height="100" fill="#181c28" fillOpacity="0.7" />
              {[124, 156, 188, 220, 252, 284, 316, 348].map((x) => (
                <line key={x} x1={x} y1="42" x2={x} y2="142" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
              ))}
              <path d="M90 142 L90 40 L390 40 L390 142" fill="none" stroke="#ffffff" strokeWidth="5" />

              {/* Target corner indicators */}
              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, cx: 122, cy: 64, label: 'COMBA' },
                  { id: 'CENTER' as AimZone, cx: 238, cy: 58, label: 'ARRIBA' },
                  { id: 'RIGHT' as AimZone, cx: 356, cy: 66, label: 'PALO' },
                ]).map((t) => {
                  const selected = aimZone === t.id;
                  return (
                    <g key={t.id} onClick={() => setAimZone(t.id)} className="cursor-pointer">
                      <circle
                        cx={t.cx}
                        cy={t.cy}
                        r={selected ? 20 : 15}
                        fill={selected ? '#707ef9' : '#ffffff'}
                        fillOpacity={selected ? 0.32 : 0.08}
                        stroke={selected ? '#707ef9' : '#ffffff'}
                        strokeWidth={selected ? 2.5 : 1}
                      />
                      <text x={t.cx} y={t.cy + 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700">
                        {t.label}
                      </text>
                    </g>
                  );
                })}

              {/* Goalkeeper positioned toward far post */}
              <g
                style={{
                  transform: `translate(${phase === 'RESOLVED' ? reactX : 295 + (motionPos - 50) * 0.6}px, 114px)`,
                  transition: phase === 'RESOLVED' ? 'transform 360ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="-14" r="8" fill="#f59e0b" />
                <rect x="-10" y="-4" width="20" height="24" rx="3" fill="#f59e0b" />
                <line x1="-20" y1="3" x2="20" y2="3" stroke="#fde68a" strokeWidth="5" strokeLinecap="round" />
              </g>

              {/* 3-Player Defensive Wall */}
              {[156, 184, 212].map((wx, idx) => (
                <g
                  key={wx}
                  style={{
                    transform: `translate(${wx}px, ${phase === 'RESOLVED' ? 148 : 156}px)`,
                    transition: 'transform 260ms ease-out',
                  }}
                >
                  <circle cx="0" cy="-24" r="8" fill="#ef4444" stroke="#0d0d0d" strokeWidth="1.5" />
                  <rect x="-10" y="-14" width="20" height="28" rx="3" fill="#dc2626" />
                  <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700">
                    {idx + 4}
                  </text>
                </g>
              ))}

              {/* Curved Free-Kick Preview / Result Arc */}
              <path
                d={
                  aimZone === 'LEFT'
                    ? 'M 238 206 Q 112 104 122 64'
                    : aimZone === 'CENTER'
                    ? 'M 238 206 Q 196 48 238 58'
                    : 'M 238 206 Q 348 118 356 66'
                }
                fill="none"
                stroke={
                  phase === 'RESOLVED'
                    ? outcome?.success
                      ? '#10b981'
                      : '#ef4444'
                    : '#707ef9'
                }
                strokeWidth="2.5"
                strokeDasharray="6 5"
                strokeOpacity="0.85"
              />

              {/* Ball */}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? outcome?.success
                        ? `translate(${aimZone === 'LEFT' ? 122 : aimZone === 'CENTER' ? 238 : 356}px, 64px) scale(0.72)`
                        : 'translate(184px, 144px) scale(0.9)'
                      : 'translate(238px, 206px) scale(1)',
                  transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#0d0d0d" strokeWidth="2" />
                <polygon points="0,-5 4,-1 3,4 -3,4 -4,-1" fill="#0d0d0d" />
              </g>
            </svg>
          )}

          {/* 3. FOOTBALL: 1v1 VS GOALKEEPER & KEEPER REFLEX */}
          {(scenario.kind === 'one_on_one' || scenario.kind === 'keeper_reflex') && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Mano a Mano contra el Arquero en Cancha UFRO"
            >
              <rect x="0" y="0" width="480" height="72" fill="#0f1119" />
              <rect x="0" y="72" width="480" height="158" fill="#165032" />
              {/* Pitch perspective stripes */}
              <rect x="0" y="106" width="480" height="32" fill="#1b5e3b" />
              <rect x="0" y="170" width="480" height="34" fill="#1b5e3b" />
              <polygon points="105,72 375,72 440,230 40,230" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" />

              {/* Goal at top */}
              <rect x="136" y="24" width="208" height="48" fill="#181c28" fillOpacity="0.8" />
              <path d="M134 72 L134 24 L346 24 L346 72" fill="none" stroke="#ffffff" strokeWidth="5" />

              {/* 3 Attacking / Saving Lanes */}
              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, d: 'M 240 198 L 154 64', cx: 158, cy: 66, label: 'IZQ' },
                  { id: 'CENTER' as AimZone, d: 'M 240 198 Q 240 112 240 52', cx: 240, cy: 52, label: 'CENTRO' },
                  { id: 'RIGHT' as AimZone, d: 'M 240 198 L 326 64', cx: 322, cy: 66, label: 'DER' },
                ]).map((lane) => {
                  const selected = aimZone === lane.id;
                  return (
                    <g key={lane.id} onClick={() => setAimZone(lane.id)} className="cursor-pointer">
                      <path
                        d={lane.d}
                        fill="none"
                        stroke={selected ? '#707ef9' : '#ffffff'}
                        strokeOpacity={selected ? 0.9 : 0.2}
                        strokeWidth={selected ? 3 : 1.5}
                        strokeDasharray="6 5"
                      />
                      <circle
                        cx={lane.cx}
                        cy={lane.cy}
                        r={selected ? 16 : 12}
                        fill={selected ? '#707ef9' : '#0d0d0d'}
                        fillOpacity={selected ? 0.85 : 0.5}
                        stroke="#ffffff"
                        strokeOpacity="0.6"
                      />
                      <text x={lane.cx} y={lane.cy + 3} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="700">
                        {lane.label}
                      </text>
                    </g>
                  );
                })}

              {/* Rushing Goalkeeper closing distance */}
              <g
                style={{
                  transform: `translate(${phase === 'RESOLVED' ? reactX : 240 + (motionPos - 50) * 1.4}px, ${
                    phase === 'RESOLVED' ? 128 : 96 + (cursor / 100) * 36
                  }px)`,
                  transition: phase === 'RESOLVED' ? 'transform 320ms ease-out' : 'none',
                }}
              >
                <circle cx="0" cy="-12" r="9" fill="#f59e0b" stroke="#0d0d0d" strokeWidth="2" />
                <rect x="-12" y="-2" width="24" height="22" rx="4" fill="#f59e0b" />
                <line x1="-22" y1="6" x2="22" y2="6" stroke="#fde68a" strokeWidth="5" strokeLinecap="round" />
              </g>

              {/* Attacker + Ball */}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? `translate(${aimZone === 'LEFT' ? 164 : aimZone === 'CENTER' ? 240 : 316}px, ${
                          outcome?.success && scenario.kind === 'one_on_one' ? 46 : 124
                        }px) scale(0.8)`
                      : 'translate(240px, 198px) scale(1)',
                  transition: 'transform 380ms cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#0d0d0d" strokeWidth="2" />
                <polygon points="0,-5 4,-1 3,4 -3,4 -4,-1" fill="#0d0d0d" />
              </g>
              <circle cx="240" cy="214" r="11" fill="#707ef9" stroke="#ffffff" strokeWidth="2" />
            </svg>
          )}

          {/* 4. FOOTBALL: GOAL-LINE DEFENSIVE TACKLE */}
          {scenario.kind === 'goal_line_tackle' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Cruce Defensivo en el Área UFRO"
            >
              <rect x="0" y="0" width="480" height="230" fill="#14492d" />
              <rect x="0" y="45" width="480" height="45" fill="#185535" />
              <rect x="0" y="135" width="480" height="45" fill="#185535" />
              {/* Own goal line at bottom */}
              <line x1="0" y1="196" x2="480" y2="196" stroke="#ffffff" strokeWidth="3" strokeOpacity="0.65" />
              <rect x="148" y="196" width="184" height="28" fill="#0f1119" stroke="#ffffff" strokeWidth="3" />
              <text x="240" y="215" textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
                TU ARCO · LÍNEA DE GOL
              </text>

              {/* 3 Defensive Interception Corridors */}
              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, x: 74, w: 102, label: 'BANDA IZQ' },
                  { id: 'CENTER' as AimZone, x: 189, w: 102, label: 'FRENTE' },
                  { id: 'RIGHT' as AimZone, x: 304, w: 102, label: 'BANDA DER' },
                ]).map((z) => {
                  const selected = aimZone === z.id;
                  return (
                    <g key={z.id} onClick={() => setAimZone(z.id)} className="cursor-pointer">
                      <rect
                        x={z.x}
                        y="32"
                        width={z.w}
                        height="148"
                        fill={selected ? '#707ef9' : '#ffffff'}
                        fillOpacity={selected ? 0.22 : 0.04}
                        stroke={selected ? '#707ef9' : '#ffffff'}
                        strokeOpacity={selected ? 0.95 : 0.2}
                        strokeWidth={selected ? 2.5 : 1}
                        strokeDasharray={selected ? '0' : '5 5'}
                      />
                      <text x={z.x + z.w / 2} y="54" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="700">
                        {z.label}
                      </text>
                    </g>
                  );
                })}

              {/* Rival Striker charging down */}
              <g
                style={{
                  transform: `translate(${phase === 'RESOLVED' ? reactX : 120 + (motionPos / 100) * 240}px, ${
                    phase === 'RESOLVED' ? (outcome?.success ? 124 : 182) : 64 + (cursor / 100) * 68
                  }px)`,
                  transition: phase === 'RESOLVED' ? 'transform 320ms ease-out' : 'none',
                }}
              >
                <circle cx="0" cy="0" r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700">
                  9
                </text>
                <circle cx="14" cy="10" r="6" fill="#ffffff" stroke="#0d0d0d" strokeWidth="1.5" />
              </g>

              {/* Player Defender Sweeping In */}
              <g
                style={{
                  transform: `translate(${phase === 'RESOLVED' ? aimX : 240}px, ${
                    phase === 'RESOLVED' ? 136 : 168
                  }px)`,
                  transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                <circle cx="0" cy="0" r="13" fill="#707ef9" stroke="#ffffff" strokeWidth="2.5" />
                <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700">
                  TÚ
                </text>
              </g>
            </svg>
          )}

          {/* 5. BASKETBALL: BUZZER BEATER */}
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

              <rect x="332" y="14" width="68" height="28" fill="#0d0d0d" stroke="#ef4444" strokeWidth="2" />
              <text x="366" y="33" textAnchor="middle" fill="#ef4444" fontSize="15" fontWeight="700" fontFamily="monospace">
                {phase === 'RESOLVED' ? '00:00' : '00:02'}
              </text>

              <rect x="378" y="48" width="12" height="72" fill="#e5e7eb" stroke="#0d0d0d" strokeWidth="2" />
              <line x1="384" y1="120" x2="384" y2="175" stroke="#52525b" strokeWidth="8" />
              <line x1="334" y1="98" x2="378" y2="98" stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
              <path d="M338 100 L345 128 L368 128 L374 100" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" />

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

              <circle cx="76" cy="140" r="10" fill="#707ef9" />
              <rect x="66" y="152" width="20" height="32" rx="4" fill="#707ef9" />

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

          {/* 6. BASKETBALL: FREE THROW CLUTCH (FRONT HOOP VIEW) */}
          {scenario.kind === 'free_throw_clutch' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Tiros Libres Decisivos en el Gimnasio Olímpico UFRO"
            >
              <rect x="0" y="0" width="480" height="176" fill="#10131e" />
              <rect x="0" y="176" width="480" height="54" fill="#7c4d25" />

              {/* Shot Clock */}
              <rect x="206" y="8" width="68" height="24" fill="#0d0d0d" stroke="#ef4444" strokeWidth="2" />
              <text x="240" y="25" textAnchor="middle" fill="#ef4444" fontSize="13" fontWeight="700" fontFamily="monospace">
                {phase === 'RESOLVED' ? '00:00' : '00:01'}
              </text>

              {/* Front-facing Glass Backboard */}
              <rect x="164" y="40" width="152" height="92" fill="#e5e7eb" fillOpacity="0.12" stroke="#ffffff" strokeWidth="3" />
              <rect x="210" y="78" width="60" height="44" fill="none" stroke="#f97316" strokeWidth="2.5" />
              {/* Orange Rim & Net */}
              <ellipse cx="240" cy="116" rx="28" ry="6" fill="none" stroke="#f97316" strokeWidth="5" />
              <path d="M 215 118 L 224 152 L 256 152 L 265 118" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" />

              {/* Release Guide */}
              <path
                d={`M 240 206 Q ${aimZone === 'LEFT' ? 210 : aimZone === 'RIGHT' ? 270 : 240} 118 240 112`}
                fill="none"
                stroke={
                  phase === 'RESOLVED'
                    ? outcome?.success
                      ? '#10b981'
                      : '#ef4444'
                    : '#707ef9'
                }
                strokeWidth="2.5"
                strokeDasharray="5 5"
              />

              {/* Ball */}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? outcome?.success
                        ? 'translate(240px, 134px) scale(0.75)'
                        : 'translate(274px, 108px) scale(0.82)'
                      : `translate(${240 + (cursor - 50) * 0.4}px, 200px) scale(1)`,
                  transition: phase === 'RESOLVED' ? 'transform 420ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="0" r="14" fill="#ea580c" stroke="#0d0d0d" strokeWidth="2" />
                <line x1="-14" y1="0" x2="14" y2="0" stroke="#0d0d0d" strokeWidth="1.5" />
                <line x1="0" y1="-14" x2="0" y2="14" stroke="#0d0d0d" strokeWidth="1.5" />
              </g>
            </svg>
          )}

          {/* 7. BASKETBALL: FASTBREAK DRIVE VS RIM PROTECTOR */}
          {scenario.kind === 'fastbreak_dunk' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Contragolpe al Aro en el Gimnasio Olímpico UFRO"
            >
              <rect x="0" y="0" width="480" height="170" fill="#10131e" />
              <rect x="0" y="170" width="480" height="60" fill="#855126" />
              {/* Paint lane */}
              <polygon points="150,170 330,170 380,230 100,230" fill="#707ef9" fillOpacity="0.22" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />

              {/* Hoop on Right */}
              <rect x="392" y="42" width="12" height="72" fill="#e5e7eb" stroke="#0d0d0d" strokeWidth="2" />
              <line x1="398" y1="114" x2="398" y2="170" stroke="#52525b" strokeWidth="8" />
              <line x1="348" y1="92" x2="392" y2="92" stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
              <path d="M352 94 L359 122 L382 122 L388 94" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" />

              {/* Rim Protector Defender */}
              <g
                style={{
                  transform: `translate(${phase === 'RESOLVED' ? 326 : 310 + (motionPos - 50) * 0.45}px, ${
                    phase === 'RESOLVED' ? 116 : 132
                  }px)`,
                  transition: 'transform 300ms ease-out',
                }}
              >
                <circle cx="0" cy="-16" r="10" fill="#ef4444" />
                <rect x="-11" y="-4" width="22" height="34" rx="4" fill="#dc2626" />
                <line x1="-10" y1="-8" x2="-22" y2="-32" stroke="#fca5a5" strokeWidth="5" strokeLinecap="round" />
                <line x1="10" y1="-8" x2="22" y2="-32" stroke="#fca5a5" strokeWidth="5" strokeLinecap="round" />
              </g>

              {/* Drive Path */}
              <path
                d={
                  aimZone === 'CENTER'
                    ? 'M 110 156 Q 235 40 370 92'
                    : aimZone === 'LEFT'
                    ? 'M 110 156 Q 250 86 370 92'
                    : 'M 110 156 Q 260 124 370 92'
                }
                fill="none"
                stroke={
                  phase === 'RESOLVED'
                    ? outcome?.success
                      ? '#10b981'
                      : '#ef4444'
                    : '#707ef9'
                }
                strokeWidth="2.5"
                strokeDasharray="6 5"
              />

              {/* Driving Player + Ball */}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? outcome?.success
                        ? 'translate(370px, 108px) scale(0.88)'
                        : 'translate(322px, 98px) scale(0.95)'
                      : `translate(${110 + (cursor / 100) * 145}px, ${156 - (cursor / 100) * 28}px)`,
                  transition: phase === 'RESOLVED' ? 'transform 360ms cubic-bezier(0.22,1,0.36,1)' : 'none',
                }}
              >
                <circle cx="0" cy="0" r="12" fill="#ea580c" stroke="#0d0d0d" strokeWidth="2" />
                <line x1="-12" y1="0" x2="12" y2="0" stroke="#0d0d0d" strokeWidth="1.5" />
              </g>
            </svg>
          )}

          {/* 8. VOLLEYBALL: SPIKE */}
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

              <line x1="240" y1="74" x2="240" y2="176" stroke="#ffffff" strokeWidth="5" />
              <rect x="234" y="74" width="12" height="52" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.5" />
              <line x1="240" y1="54" x2="240" y2="74" stroke="#ef4444" strokeWidth="3" strokeDasharray="4 3" />

              <circle cx="196" cy="66" r="22" fill="#10b981" fillOpacity="0.16" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
              <text x="196" y="36" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontFamily="monospace">
                PUNTO ÓPTIMO
              </text>

              <rect x="256" y="88" width="20" height="52" rx="4" fill="#f59e0b" fillOpacity="0.85" />
              <circle cx="266" cy="78" r="9" fill="#f59e0b" />

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

          {/* 9. VOLLEYBALL: DOUBLE BLOCK AT THE NET */}
          {scenario.kind === 'volleyball_block' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Bloqueo en la Red de Voleibol UFRO"
            >
              <rect x="0" y="0" width="480" height="172" fill="#0f1320" />
              <rect x="0" y="172" width="480" height="58" fill="#1e3a8a" fillOpacity="0.55" />

              {/* Full-width Net */}
              <rect x="36" y="76" width="408" height="72" fill="#181c28" fillOpacity="0.6" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
              <line x1="36" y1="76" x2="444" y2="76" stroke="#ffffff" strokeWidth="5" />
              {/* Red Antennae */}
              <line x1="42" y1="36" x2="42" y2="76" stroke="#ef4444" strokeWidth="3" strokeDasharray="5 4" />
              <line x1="438" y1="36" x2="438" y2="76" stroke="#ef4444" strokeWidth="3" strokeDasharray="5 4" />

              {/* 3 Attack Lanes over Net */}
              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, x: 56, w: 112, label: 'PUNTA IZQ' },
                  { id: 'CENTER' as AimZone, x: 184, w: 112, label: 'CENTRO' },
                  { id: 'RIGHT' as AimZone, x: 312, w: 112, label: 'OPUESTO' },
                ]).map((z) => {
                  const selected = aimZone === z.id;
                  return (
                    <g key={z.id} onClick={() => setAimZone(z.id)} className="cursor-pointer">
                      <rect
                        x={z.x}
                        y="26"
                        width={z.w}
                        height="48"
                        fill={selected ? '#707ef9' : '#ffffff'}
                        fillOpacity={selected ? 0.28 : 0.05}
                        stroke={selected ? '#707ef9' : '#ffffff'}
                        strokeOpacity={selected ? 0.95 : 0.25}
                        strokeWidth={selected ? 2.5 : 1}
                      />
                      <text x={z.x + z.w / 2} y="54" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="700">
                        {z.label}
                      </text>
                    </g>
                  );
                })}

              {/* Player Double-Block Hands rising at selected lane */}
              <g
                style={{
                  transform: `translate(${aimX}px, ${phase === 'RESOLVED' ? 62 : 112}px)`,
                  transition: 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                <rect x="-26" y="-8" width="20" height="44" rx="5" fill="#707ef9" stroke="#ffffff" strokeWidth="2" />
                <rect x="6" y="-8" width="20" height="44" rx="5" fill="#707ef9" stroke="#ffffff" strokeWidth="2" />
              </g>

              {/* Incoming Volleyball */}
              <g
                style={{
                  transform: `translate(${phase === 'RESOLVED' ? reactX : 110 + (motionPos / 100) * 260}px, ${
                    phase === 'RESOLVED' ? (outcome?.success ? 56 : 164) : 44
                  }px)`,
                  transition: phase === 'RESOLVED' ? 'transform 320ms ease-out' : 'none',
                }}
              >
                <circle cx="0" cy="0" r="12" fill="#fef08a" stroke="#1e3a8a" strokeWidth="2" />
              </g>
            </svg>
          )}

          {/* 10. VOLLEYBALL: CLUTCH ACE SERVE */}
          {scenario.kind === 'volleyball_serve' && (
            <svg
              viewBox="0 0 480 230"
              className="w-full h-[210px] sm:h-[240px] block select-none"
              role="img"
              aria-label="Saque Ace de Voleibol UFRO"
            >
              <rect x="0" y="0" width="480" height="230" fill="#0f172a" />
              {/* Perspective Volleyball Court */}
              <polygon points="104,26 376,26 436,208 44,208" fill="#1d4ed8" fillOpacity="0.48" stroke="#ffffff" strokeWidth="2.5" />
              {/* Center Net Line */}
              <line x1="74" y1="118" x2="406" y2="118" stroke="#ffffff" strokeWidth="4" strokeDasharray="6 4" />
              <line x1="90" y1="74" x2="390" y2="74" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.5" />

              {/* 3 Rival Court Target Zones */}
              {phase === 'AIM' &&
                ([
                  { id: 'LEFT' as AimZone, cx: 148, cy: 52, label: 'LÍNEA' },
                  { id: 'CENTER' as AimZone, cx: 240, cy: 94, label: 'CORTO' },
                  { id: 'RIGHT' as AimZone, cx: 332, cy: 52, label: 'ZONA 5' },
                ]).map((z) => {
                  const selected = aimZone === z.id;
                  return (
                    <g key={z.id} onClick={() => setAimZone(z.id)} className="cursor-pointer">
                      <circle
                        cx={z.cx}
                        cy={z.cy}
                        r={selected ? 24 : 18}
                        fill={selected ? '#707ef9' : '#ffffff'}
                        fillOpacity={selected ? 0.34 : 0.08}
                        stroke={selected ? '#707ef9' : '#ffffff'}
                        strokeWidth={selected ? 2.5 : 1}
                      />
                      <text x={z.cx} y={z.cy + 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700">
                        {z.label}
                      </text>
                    </g>
                  );
                })}

              {/* Serve Trajectory */}
              <path
                d={`M 240 202 Q 240 120 ${aimZone === 'LEFT' ? 148 : aimZone === 'CENTER' ? 240 : 332} ${
                  aimZone === 'CENTER' ? 94 : 52
                }`}
                fill="none"
                stroke={
                  phase === 'RESOLVED'
                    ? outcome?.success
                      ? '#10b981'
                      : '#ef4444'
                    : '#707ef9'
                }
                strokeWidth="2.5"
                strokeDasharray="6 5"
              />

              {/* Serve Ball */}
              <g
                style={{
                  transform:
                    phase === 'RESOLVED'
                      ? outcome?.success
                        ? `translate(${aimZone === 'LEFT' ? 148 : aimZone === 'CENTER' ? 240 : 332}px, ${
                            aimZone === 'CENTER' ? 94 : 52
                          }px) scale(0.75)`
                        : 'translate(240px, 118px) scale(0.9)'
                      : 'translate(240px, 202px) scale(1)',
                  transition: 'transform 380ms cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <circle cx="0" cy="0" r="12" fill="#fef08a" stroke="#1e3a8a" strokeWidth="2" />
              </g>
            </svg>
          )}
        </div>

        {/* Dynamic Choice Buttons for Aim / Move / Lane */}
        {scenario.actionChoices && scenario.actionChoices.length > 0 && phase === 'AIM' && (
          <div className="grid grid-cols-3 gap-2.5">
            {scenario.actionChoices.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAimZone(opt.id)}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                  aimZone === opt.id
                    ? 'bg-[#707ef9] text-white border-[#707ef9] shadow-[0_0_20px_rgba(112,126,249,0.28)]'
                    : 'bg-[#111117] text-white/75 border-white/[0.08] hover:border-white/25 hover:text-white'
                }`}
              >
                <span className="text-[11px] opacity-60 mr-1.5 tabular-nums">{idx + 1}</span>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Timing Precision Meter */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-white/65">{scenario.subtitle}</span>
            <span className="text-[#c8ceff] font-medium shrink-0 tabular-nums">
              {phase === 'AIM'
                ? 'Espacio / Clic'
                : outcome?.tier === 'PERFECT'
                ? 'Ejecución perfecta'
                : outcome?.tier === 'GOOD'
                ? 'Buena ejecución'
                : 'Fallado'}
            </span>
          </div>

          <div className="relative h-8 rounded-full bg-[#13131b] border border-white/[0.1] overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-[#707ef9]/35"
              style={{
                left: `${50 - goodHalf}%`,
                width: `${scenario.goodZoneWidth}%`,
              }}
            />
            <div
              className="absolute top-0 bottom-0 bg-emerald-400/80 border-x border-emerald-200/90"
              style={{
                left: `${50 - perfectHalf}%`,
                width: `${scenario.sweetSpotWidth}%`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#050507]">
                Punto óptimo
              </span>
            </div>

            <div
              className="absolute top-0.5 bottom-0.5 w-2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.95)]"
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
            id="btn-minigame-execute"
            onClick={handleExecuteAction}
            className="w-full py-3.5 px-6 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>{scenario.actionButtonLabel}</span>
          </button>
        ) : (
          outcome && (
            <div
              className={`rounded-2xl p-5 border space-y-3.5 ${
                outcome.success
                  ? 'bg-emerald-500/[0.08] border-emerald-400/35'
                  : 'bg-rose-500/[0.08] border-rose-400/35'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xl sm:text-2xl font-medium tracking-[-0.02em] text-white">
                  {outcome.headline}
                </p>
                <span
                  className={`text-xs font-medium tabular-nums ${
                    totalDisplayXp > 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {totalDisplayXp > 0 ? `+${totalDisplayXp}` : totalDisplayXp} XP OVR
                </span>
              </div>
              <p className="text-sm text-white/75 leading-relaxed">{outcome.narrative}</p>
              <button
                type="button"
                id="btn-minigame-continue"
                onClick={() => onComplete(outcome)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-[#c8ceff] text-[#050507] text-sm font-medium transition-colors cursor-pointer"
              >
                <span>{continueLabelOverride ?? 'Ver balance del semestre'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

