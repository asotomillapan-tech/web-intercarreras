import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import {
  calculateCareerLeaderboardScore,
  computeCreativeLegacyBanner,
  SPORT_CONFIG,
  type LeyendasCareerState,
} from '../domain/leyendasEngine';

interface LeyendasPosterModalProps {
  career: LeyendasCareerState;
  onClose: () => void;
}

async function loadOptionalImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShieldPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const halfW = w / 2;
  const topY = cy - h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + halfW, topY + h * 0.14);
  ctx.lineTo(cx + halfW * 0.92, topY + h * 0.64);
  ctx.quadraticCurveTo(cx + halfW * 0.52, topY + h * 0.9, cx, topY + h);
  ctx.quadraticCurveTo(cx - halfW * 0.52, topY + h * 0.9, cx - halfW * 0.92, topY + h * 0.64);
  ctx.lineTo(cx - halfW, topY + h * 0.14);
  ctx.closePath();
}

function drawMiniCupIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  // Cup bowl
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 16);
  ctx.lineTo(cx + 14, cy - 16);
  ctx.lineTo(cx + 10, cy + 2);
  ctx.quadraticCurveTo(cx, cy + 10, cx - 10, cy + 2);
  ctx.closePath();
  ctx.fill();
  // Stem & base
  ctx.fillRect(cx - 3, cy + 5, 6, 10);
  ctx.fillRect(cx - 11, cy + 14, 22, 4);
  // Handles
  ctx.beginPath();
  ctx.arc(cx - 14, cy - 8, 6, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 14, cy - 8, 6, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawMiniStarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function generatePosterDataUrl(career: LeyendasCareerState): Promise<string> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed cleanly
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const legacy = computeCreativeLegacyBanner(career);
  const score = calculateCareerLeaderboardScore(career);
  const isGoat = legacy.tier === 'GOAT' || career.maxOvr >= 100;
  const isLegend = legacy.tier === 'LEYENDA' || legacy.tier === 'ICONO';

  const primaryAccent = isGoat ? '#f5c84c' : '#707ef9';
  const secondaryAccent = isGoat ? '#f59e0b' : '#a5b4fc';
  const displayFont = '"League Gothic", "Arial Narrow", Impact, sans-serif';
  const bodyFont = '"Roboto", system-ui, -apple-system, sans-serif';

  // 1. Deep Carbon Backdrop with Radial Spotlight
  ctx.fillStyle = '#09090c';
  ctx.fillRect(0, 0, 1080, 1920);

  const spotlight = ctx.createRadialGradient(540, 390, 40, 540, 460, 740);
  if (isGoat) {
    spotlight.addColorStop(0, 'rgba(245, 200, 76, 0.24)');
    spotlight.addColorStop(0.5, 'rgba(245, 158, 11, 0.08)');
    spotlight.addColorStop(1, 'rgba(9, 9, 12, 0)');
  } else {
    spotlight.addColorStop(0, 'rgba(112, 126, 249, 0.28)');
    spotlight.addColorStop(0.5, 'rgba(112, 126, 249, 0.08)');
    spotlight.addColorStop(1, 'rgba(9, 9, 12, 0)');
  }
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, 1080, 1920);

  // Diagonal architectural stadium beams
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 2;
  for (let i = -400; i < 1600; i += 140) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - 360, 1920);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Collector Card Double Frame + Corner Notches
  ctx.strokeStyle = primaryAccent;
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, 1016, 1856);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, 988, 1828);

  // Corner L-accent ticks
  ctx.fillStyle = primaryAccent;
  const cornerLen = 36;
  ctx.fillRect(32, 32, cornerLen, 8);
  ctx.fillRect(32, 32, 8, cornerLen);
  ctx.fillRect(1048 - cornerLen, 32, cornerLen, 8);
  ctx.fillRect(1040, 32, 8, cornerLen);
  ctx.fillRect(32, 1880, cornerLen, 8);
  ctx.fillRect(32, 1888 - cornerLen, 8, cornerLen);
  ctx.fillRect(1048 - cornerLen, 1880, cornerLen, 8);
  ctx.fillRect(1040, 1888 - cornerLen, 8, cornerLen);

  // 3. Top Header Strip
  ctx.fillStyle = primaryAccent;
  ctx.font = `700 22px ${bodyFont}`;
  ctx.fillText('CAMPEONATO INTERCARRERAS UFRO  ·  EDICIÓN LEYENDAS', 84, 106);

  ctx.fillStyle = '#a1a1aa';
  ctx.textAlign = 'right';
  ctx.font = `700 22px ${bodyFont}`;
  ctx.fillText(
    `${SPORT_CONFIG[career.sportKey].name.toUpperCase()} · ${career.branch === 'mujer' ? 'DAMAS' : 'VARONES'} · ${career.pos}`,
    996,
    106
  );
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(84, 128, 912, 2);

  // 4. Hero Shield OVR + Crest Medallion Row
  const shieldCx = 235;
  const shieldCy = 340;
  drawShieldPath(ctx, shieldCx, shieldCy, 250, 290);
  const shieldGrad = ctx.createLinearGradient(shieldCx - 120, shieldCy - 140, shieldCx + 120, shieldCy + 140);
  if (isGoat) {
    shieldGrad.addColorStop(0, '#fde68a');
    shieldGrad.addColorStop(0.5, '#f5c84c');
    shieldGrad.addColorStop(1, '#b45309');
  } else if (isLegend) {
    shieldGrad.addColorStop(0, '#818cf8');
    shieldGrad.addColorStop(0.55, '#5766eb');
    shieldGrad.addColorStop(1, '#1e1b4b');
  } else {
    shieldGrad.addColorStop(0, '#272734');
    shieldGrad.addColorStop(1, '#14141b');
  }
  ctx.fillStyle = shieldGrad;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = isGoat ? '#fffbeb' : primaryAccent;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = isGoat ? '#0d0d0d' : '#ffffff';
  ctx.font = `700 24px ${bodyFont}`;
  ctx.fillText(isGoat ? 'GOAT PEAK OVR' : 'PEAK OVR', shieldCx, shieldCy - 68);

  ctx.font = `400 142px ${displayFont}`;
  ctx.fillText(String(career.maxOvr), shieldCx, shieldCy + 56);

  ctx.font = `700 22px ${bodyFont}`;
  ctx.fillStyle = isGoat ? '#1c1917' : '#e0e7ff';
  ctx.fillText(`TIER ${legacy.tier}`, shieldCx, shieldCy + 98);

  // Right Hero Info + Club Crest Medallion
  const crestImg = await loadOptionalImage(career.team.escudo);
  const rightX = 415;

  // Club Medallion
  const medCx = 485;
  const medCy = 266;
  ctx.beginPath();
  ctx.arc(medCx, medCy, 66, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = primaryAccent;
  ctx.stroke();

  if (crestImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(medCx, medCy, 56, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.min(96 / crestImg.width, 96 / crestImg.height);
    const dw = crestImg.width * scale;
    const dh = crestImg.height * scale;
    ctx.drawImage(crestImg, medCx - dw / 2, medCy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#0d0d0d';
    ctx.textAlign = 'center';
    ctx.font = `400 54px ${displayFont}`;
    ctx.fillText((career.team.sigla || 'UFRO').slice(0, 4).toUpperCase(), medCx, medCy + 19);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = secondaryAccent;
  ctx.font = `700 20px ${bodyFont}`;
  ctx.fillText(`${career.team.div.toUpperCase()} · ${career.startYear} — ${career.year}`, 576, 240);

  ctx.fillStyle = '#ffffff';
  ctx.font = `400 54px ${displayFont}`;
  ctx.fillText(career.team.name.toUpperCase().slice(0, 24), 576, 296);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = `500 22px ${bodyFont}`;
  ctx.fillText(`${career.role} · ${career.semestersPlayed} semestres disputados`, 576, 330);

  // Academic & Honors Badges under club block
  const badges: string[] = [career.postgradStage];
  if (career.hasScholarship) badges.push('BECA DEPORTIVA UFRO');
  if (career.climbedFromThirdToFirst) badges.push('ASCENSO 3ª → 1ª');
  if (career.caps > 0) badges.push(`SEL. UFRO (${career.caps} CAPS)`);

  let bx = rightX;
  let by = 374;
  ctx.font = `700 18px ${bodyFont}`;
  for (const tag of badges.slice(0, 3)) {
    const tw = ctx.measureText(tag).width + 28;
    if (bx + tw > 996) {
      bx = rightX;
      by += 44;
    }
    drawRoundedRect(ctx, bx, by, tw, 36, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tag, bx + 14, by + 24);
    bx += tw + 12;
  }

  // 5. Player Display Name & Career
  const upperName = career.playerName.toUpperCase();
  let nameSize = 114;
  ctx.font = `400 ${nameSize}px ${displayFont}`;
  while (ctx.measureText(upperName).width > 910 && nameSize > 66) {
    nameSize -= 6;
    ctx.font = `400 ${nameSize}px ${displayFont}`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(upperName, 84, 598);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `500 28px ${bodyFont}`;
  ctx.fillText(`${career.career}  ·  ${career.facultad}`.slice(0, 62), 84, 642);

  // 6. Creative Legacy Banner Card
  drawRoundedRect(ctx, 84, 678, 912, 152, 6);
  ctx.fillStyle = isGoat ? 'rgba(245, 200, 76, 0.14)' : 'rgba(112, 126, 249, 0.16)';
  ctx.fill();
  ctx.strokeStyle = primaryAccent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = primaryAccent;
  ctx.font = `700 20px ${bodyFont}`;
  ctx.fillText(`LEGADO UNIVERSITARIO  ·  ${legacy.tier}`, 116, 720);

  ctx.fillStyle = '#ffffff';
  ctx.font = `400 58px ${displayFont}`;
  ctx.fillText(legacy.title.toUpperCase().slice(0, 38), 116, 778);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = `400 21px ${bodyFont}`;
  ctx.fillText(legacy.subtitle.slice(0, 82), 116, 812);

  // 7. 4-Pillar Career Stat Cards (with per-match averages)
  const matchesSafe = Math.max(1, career.stats.m);
  const statPillars =
    career.sportKey === 'futbol'
      ? [
          { label: 'PARTIDOS', val: String(career.stats.m), sub: `${career.semestersPlayed} semestres` },
          { label: 'GOLES', val: String(career.stats.g), sub: `${(career.stats.g / matchesSafe).toFixed(2)} por PJ` },
          { label: 'ASISTENCIAS', val: String(career.stats.a), sub: `${(career.stats.a / matchesSafe).toFixed(2)} por PJ` },
          { label: 'SEL. UFRO', val: String(career.caps), sub: `${career.trophies.length} copas` },
        ]
      : career.sportKey === 'basquet'
      ? [
          { label: 'PARTIDOS', val: String(career.stats.m), sub: `${career.semestersPlayed} semestres` },
          { label: 'PUNTOS', val: String(career.stats.pts), sub: `${(career.stats.pts / matchesSafe).toFixed(1)} PPG` },
          { label: 'REBOTES', val: String(career.stats.reb), sub: `${(career.stats.reb / matchesSafe).toFixed(1)} RPG` },
          { label: 'ASISTENCIAS', val: String(career.stats.ast), sub: `${(career.stats.ast / matchesSafe).toFixed(1)} APG` },
        ]
      : [
          { label: 'PARTIDOS', val: String(career.stats.m), sub: `${career.semestersPlayed} semestres` },
          { label: 'PUNTOS', val: String(career.stats.pts), sub: `${(career.stats.pts / matchesSafe).toFixed(1)} PTS/PJ` },
          { label: 'BLOQUEOS', val: String(career.stats.blk), sub: `${(career.stats.blk / matchesSafe).toFixed(1)} BLQ/PJ` },
          { label: 'ACES / ARM.', val: `${career.stats.ace}/${career.stats.ast}`, sub: `${career.caps} caps UFRO` },
        ];

  const colW = 213;
  const colGap = 20;
  statPillars.forEach((st, idx) => {
    const x = 84 + idx * (colW + colGap);
    const y = 866;
    drawRoundedRect(ctx, x, y, colW, 194, 6);
    ctx.fillStyle = '#14151e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = primaryAccent;
    ctx.fillRect(x, y, colW, 5);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a1a1aa';
    ctx.font = `700 18px ${bodyFont}`;
    ctx.fillText(st.label, x + colW / 2, y + 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = `400 76px ${displayFont}`;
    ctx.fillText(st.val, x + colW / 2, y + 124);

    ctx.fillStyle = secondaryAccent;
    ctx.font = `500 19px ${bodyFont}`;
    ctx.fillText(st.sub, x + colW / 2, y + 166);
  });
  ctx.textAlign = 'left';

  // 8. Visual Trophy & Awards Showcase (2 columns)
  const vitrinaY = 1104;
  // Left Box: Collective Trophies
  drawRoundedRect(ctx, 84, vitrinaY, 442, 336, 6);
  ctx.fillStyle = '#12131b';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 200, 76, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawMiniCupIcon(ctx, 126, vitrinaY + 46, '#f5c84c');
  ctx.fillStyle = '#f5c84c';
  ctx.font = `400 40px ${displayFont}`;
  ctx.fillText(`VITRINA DE TÍTULOS (${career.trophies.length})`, 160, vitrinaY + 58);

  if (career.trophies.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = `400 22px ${bodyFont}`;
    ctx.fillText('Carrera de esfuerzo sin títulos', 112, vitrinaY + 120);
    ctx.fillText('colectivos oficiales.', 112, vitrinaY + 150);
  } else {
    career.trophies.slice(0, 5).forEach((t, idx) => {
      const ty = vitrinaY + 104 + idx * 44;
      ctx.fillStyle = '#f5c84c';
      ctx.font = `700 20px ${bodyFont}`;
      ctx.fillText(`${t.year}`, 112, ty);
      ctx.fillStyle = '#f4f4f5';
      ctx.font = `500 20px ${bodyFont}`;
      ctx.fillText(t.title.slice(0, 29), 174, ty);
    });
    if (career.trophies.length > 5) {
      ctx.fillStyle = '#a1a1aa';
      ctx.font = `600 18px ${bodyFont}`;
      ctx.fillText(`+ ${career.trophies.length - 5} trofeo(s) más en vitrina`, 112, vitrinaY + 318);
    }
  }

  // Right Box: Individual Awards
  drawRoundedRect(ctx, 554, vitrinaY, 442, 336, 6);
  ctx.fillStyle = '#12131b';
  ctx.fill();
  ctx.strokeStyle = 'rgba(112, 126, 249, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawMiniStarIcon(ctx, 594, vitrinaY + 44, 16, '#707ef9');
  ctx.fillStyle = '#a5b4fc';
  ctx.font = `400 40px ${displayFont}`;
  ctx.fillText(`PREMIOS INDIVIDUALES (${career.awards.length})`, 624, vitrinaY + 58);

  if (career.awards.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = `400 22px ${bodyFont}`;
    ctx.fillText('Jugador de equipo enfocado en', 582, vitrinaY + 120);
    ctx.fillText('el rendimiento colectivo.', 582, vitrinaY + 150);
  } else {
    career.awards.slice(0, 5).forEach((a, idx) => {
      const ay = vitrinaY + 104 + idx * 44;
      ctx.fillStyle = '#707ef9';
      ctx.font = `700 20px ${bodyFont}`;
      ctx.fillText(`${a.year}`, 582, ay);
      ctx.fillStyle = '#f4f4f5';
      ctx.font = `500 20px ${bodyFont}`;
      ctx.fillText(a.title.slice(0, 29), 644, ay);
    });
    if (career.awards.length > 5) {
      ctx.fillStyle = '#a1a1aa';
      ctx.font = `600 18px ${bodyFont}`;
      ctx.fillText(`+ ${career.awards.length - 5} distinciones más`, 582, vitrinaY + 318);
    }
  }

  // 9. Club Trajectory Timeline
  const trajY = 1480;
  ctx.fillStyle = '#ffffff';
  ctx.font = `400 38px ${displayFont}`;
  ctx.fillText('TRAYECTORIA DE CLUBES UFRO', 84, trajY);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(84, trajY + 16, 912, 2);

  const visibleStints = career.stints.slice(0, 4);
  visibleStints.forEach((stint, idx) => {
    const sy = trajY + 46 + idx * 54;
    // Sigla square
    ctx.fillStyle = primaryAccent;
    ctx.fillRect(84, sy - 24, 62, 34);
    ctx.fillStyle = isGoat ? '#0d0d0d' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `700 18px ${bodyFont}`;
    ctx.fillText((stint.sigla || stint.team.slice(0, 3)).toUpperCase(), 115, sy - 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px ${bodyFont}`;
    ctx.fillText(stint.team.slice(0, 30), 166, sy);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = `500 20px ${bodyFont}`;
    ctx.fillText(stint.div, 620, sy);

    ctx.textAlign = 'right';
    ctx.fillStyle = secondaryAccent;
    ctx.font = `700 22px ${bodyFont}`;
    ctx.fillText(stint.years, 996, sy);
    ctx.textAlign = 'left';
  });

  // 10. Official Footer Seal & Weekly Score
  drawRoundedRect(ctx, 84, 1732, 912, 114, 6);
  ctx.fillStyle = '#14151e';
  ctx.fill();
  ctx.strokeStyle = primaryAccent;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `700 18px ${bodyFont}`;
  ctx.fillText('PUNTAJE OFICIAL TOP GLOBAL SEMANAL', 116, 1776);

  ctx.fillStyle = '#ffffff';
  ctx.font = `500 21px ${bodyFont}`;
  ctx.fillText('Universidad de La Frontera · Temuco, Chile', 116, 1816);

  ctx.textAlign = 'right';
  ctx.fillStyle = primaryAccent;
  ctx.font = `400 78px ${displayFont}`;
  ctx.fillText(`${score.toLocaleString('es-CL')} PTS`, 966, 1816);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

export function LeyendasPosterModal({ career, onClose }: LeyendasPosterModalProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(true);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGenerating(true);
    generatePosterDataUrl(career)
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setGenerating(false);
        }
      })
      .catch(() => {
        if (!cancelled) setGenerating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [career]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    const safeName = career.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `leyendas-ufro-${safeName || 'jugador'}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'leyendas-ufro.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `LEYENDAS UFRO · ${career.playerName}`,
          text: `Terminé mi carrera en LEYENDAS Intercarreras UFRO con ${career.maxOvr} Max OVR y ${career.trophies.length} títulos.`,
          files: [file],
        });
        setShareNote('Tarjeta compartida con éxito.');
      } else {
        handleDownload();
        setShareNote('Tu navegador no soporta compartir directo; descargamos el PNG 1080×1920.');
      }
    } catch {
      handleDownload();
      setShareNote('Tarjeta descargada en formato PNG lista para subir a Instagram Stories.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leyendas-poster-title"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#0d0d0d] text-white border border-white/15 w-full max-w-2xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
              Tarjeta Oficial de Colección · 1080×1920 PNG
            </p>
            <h3 id="leyendas-poster-title" className="font-display text-2xl font-bold uppercase">
              Legado de {career.playerName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa de tarjeta"
            className="p-2 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-[#14141b] border border-white/10 p-4 flex items-center justify-center min-h-[380px]">
            {generating ? (
              <p className="text-sm text-neutral-400 font-mono">
                Renderizando tarjeta coleccionable 1080×1920...
              </p>
            ) : dataUrl ? (
              <img
                src={dataUrl}
                alt={`Tarjeta final de ${career.playerName} en LEYENDAS UFRO`}
                className="max-h-[540px] w-auto object-contain border border-white/15 shadow-2xl"
              />
            ) : (
              <p className="text-sm text-red-400">
                No se pudo generar la vista previa de la tarjeta.
              </p>
            )}
          </div>

          {shareNote && (
            <p role="status" className="text-xs text-emerald-400 text-center">
              {shareNote}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={!dataUrl}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-display font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir Story</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!dataUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
