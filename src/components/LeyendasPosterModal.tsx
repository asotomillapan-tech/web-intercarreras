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
  const isGoat = legacy.tier === 'GOAT' || career.maxOvr >= 99;
  const accent = isGoat ? '#f5c84c' : '#707ef9';
  const displayFont = '"Inter", system-ui, -apple-system, sans-serif';
  const editorialFont = '"Playfair Display", Georgia, serif';
  const bodyFont = '"Inter", system-ui, -apple-system, sans-serif';

  // 1. Clean Obsidian Editorial Backdrop
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle Top Glow Wash
  const topGlow = ctx.createRadialGradient(540, 220, 40, 540, 220, 620);
  topGlow.addColorStop(0, isGoat ? 'rgba(245,200,76,0.16)' : 'rgba(112,126,249,0.18)');
  topGlow.addColorStop(1, 'rgba(5,5,7,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, 1080, 960);

  // Minimal Hairline Frame
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 984, 1824);

  // 2. Minimal Header Row
  ctx.fillStyle = '#a5b0ff';
  ctx.font = `500 22px ${bodyFont}`;
  ctx.textAlign = 'left';
  ctx.fillText('Intercarreras UFRO · Leyendas', 92, 118);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'right';
  ctx.fillText(
    `${SPORT_CONFIG[career.sportKey].shortName} · ${career.pos}`,
    988,
    118
  );

  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(92, 148, 896, 1.5);

  // 3. Centered Club Crest Medallion
  const crestImg = await loadOptionalImage(career.team.escudo);
  const centerX = 540;
  const crestY = 300;
  ctx.beginPath();
  ctx.arc(centerX, crestY, 84, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.stroke();

  if (crestImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, crestY, 72, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.min(126 / crestImg.width, 126 / crestImg.height);
    const dw = crestImg.width * scale;
    const dh = crestImg.height * scale;
    ctx.drawImage(crestImg, centerX - dw / 2, crestY - dh / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#050507';
    ctx.textAlign = 'center';
    ctx.font = `600 54px ${displayFont}`;
    ctx.fillText((career.team.sigla || 'UFRO').slice(0, 4).toUpperCase(), centerX, crestY + 18);
  }

  // 4. Giant Peak OVR Focal Number
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.52)';
  ctx.font = `500 22px ${bodyFont}`;
  ctx.fillText(isGoat ? 'Leyenda Absoluta · Peak OVR' : 'Peak OVR', centerX, 456);

  ctx.fillStyle = accent;
  ctx.font = `600 210px ${displayFont}`;
  ctx.fillText(String(career.maxOvr), centerX, 646);

  // 5. Player Name + Career/Club Line + Editorial Legacy Title
  const cleanName = career.playerName.trim() || 'Leyenda UFRO';
  let nameSize = 84;
  ctx.font = `500 ${nameSize}px ${displayFont}`;
  while (ctx.measureText(cleanName).width > 860 && nameSize > 48) {
    nameSize -= 4;
    ctx.font = `500 ${nameSize}px ${displayFont}`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cleanName, centerX, 766);

  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = `400 28px ${bodyFont}`;
  ctx.fillText(
    `${career.career} · ${career.team.name}`.slice(0, 56),
    centerX,
    822
  );

  ctx.fillStyle = isGoat ? '#f5c84c' : '#c8ceff';
  ctx.font = `italic 400 32px ${editorialFont}`;
  ctx.fillText(
    `${legacy.title} · ${career.startYear}–${career.year}`.slice(0, 52),
    centerX,
    878
  );

  // 6. Simple 4-Stat Horizontal Strip (no heavy boxes)
  const statsY = 980;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(92, statsY, 896, 1.5);

  const coreStats =
    career.sportKey === 'futbol'
      ? [
          { label: 'PARTIDOS', val: String(career.stats.m) },
          { label: 'GOLES', val: String(career.stats.g) },
          { label: 'ASISTENCIAS', val: String(career.stats.a) },
          { label: 'TÍTULOS', val: String(career.trophies.length) },
        ]
      : career.sportKey === 'basquet'
      ? [
          { label: 'PARTIDOS', val: String(career.stats.m) },
          { label: 'PUNTOS', val: String(career.stats.pts) },
          { label: 'REBOTES', val: String(career.stats.reb) },
          { label: 'TÍTULOS', val: String(career.trophies.length) },
        ]
      : [
          { label: 'PARTIDOS', val: String(career.stats.m) },
          { label: 'PUNTOS', val: String(career.stats.pts) },
          { label: 'BLOQUEOS', val: String(career.stats.blk) },
          { label: 'TÍTULOS', val: String(career.trophies.length) },
        ];

  const colW = 896 / 4;
  coreStats.forEach((st, idx) => {
    const cx = 92 + colW * idx + colW / 2;
    if (idx > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(92 + colW * idx, statsY + 34, 1.5, 134);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 84px ${displayFont}`;
    ctx.fillText(st.val, cx, statsY + 122);

    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.font = `500 20px ${bodyFont}`;
    ctx.fillText(st.label, cx, statsY + 166);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(92, statsY + 210, 896, 1.5);

  // 7. Minimal Palmarés & Club Path (2 clean blocks, no text walls)
  const summaryY = 1280;
  ctx.textAlign = 'center';

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `700 20px ${bodyFont}`;
  ctx.fillText('RESUMEN DE CARRERA', centerX, summaryY);

  ctx.fillStyle = '#ffffff';
  ctx.font = `500 30px ${bodyFont}`;
  const honorsLine = `${career.trophies.length} Títulos  ·  ${career.awards.length} Premios  ·  ${career.caps} Sel. UFRO`;
  ctx.fillText(honorsLine, centerX, summaryY + 56);

  if (career.trophies.length > 0) {
    const highlightTrophy = career.trophies[0];
    ctx.fillStyle = '#d4d4d8';
    ctx.font = `400 24px ${bodyFont}`;
    const extra = career.trophies.length > 1 ? ` (+${career.trophies.length - 1} más)` : '';
    ctx.fillText(
      `Destacado: ${highlightTrophy.title} (${highlightTrophy.year})${extra}`.slice(0, 62),
      centerX,
      summaryY + 104
    );
  }

  // Single-line club trajectory
  const uniqueClubNames: string[] = [];
  for (const s of career.stints) {
    if (!uniqueClubNames.includes(s.team)) uniqueClubNames.push(s.team);
  }
  const clubPath = uniqueClubNames.slice(0, 4).join('  →  ');

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `700 20px ${bodyFont}`;
  ctx.fillText('CLUBES DEFENDIDOS', centerX, summaryY + 200);

  ctx.fillStyle = '#f4f4f5';
  ctx.font = `500 26px ${bodyFont}`;
  ctx.fillText(clubPath.slice(0, 58), centerX, summaryY + 250);

  // 8. Clean Official Weekly Score Footer
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(92, 1656, 896, 1.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `700 20px ${bodyFont}`;
  ctx.fillText('PUNTAJE OFICIAL SEMANAL', 92, 1732);

  ctx.fillStyle = '#ffffff';
  ctx.font = `400 22px ${bodyFont}`;
  ctx.fillText('Universidad de La Frontera · Temuco', 92, 1774);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = `600 82px ${displayFont}`;
  ctx.fillText(`${score.toLocaleString('es-CL')} pts`, 988, 1776);

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
        setShareNote('Descargamos tu tarjeta PNG 1080×1920 lista para compartir.');
      }
    } catch {
      handleDownload();
      setShareNote('Tarjeta descargada en formato PNG lista para subir a Stories.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leyendas-poster-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="rounded-3xl bg-[#0c0c10] text-white border border-white/[0.1] w-full max-w-2xl overflow-hidden my-6">
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#a5b0ff]">
              Tarjeta final · 1080×1920 PNG
            </p>
            <h3 id="leyendas-poster-title" className="text-2xl font-medium tracking-[-0.03em] text-white">
              {career.playerName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa de tarjeta"
            className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl bg-[#050507] border border-white/[0.08] p-4 flex items-center justify-center min-h-[380px]">
            {generating ? (
              <p className="text-sm text-white/55">
                Generando tarjeta 1080×1920...
              </p>
            ) : dataUrl ? (
              <img
                src={dataUrl}
                alt={`Tarjeta final de ${career.playerName} en Leyendas UFRO`}
                className="max-h-[540px] w-auto object-contain rounded-xl border border-white/[0.12] shadow-2xl"
              />
            ) : (
              <p className="text-sm text-rose-400">
                No se pudo generar la vista previa de la tarjeta.
              </p>
            )}
          </div>

          {shareNote && (
            <p role="status" className="text-xs text-emerald-300 text-center">
              {shareNote}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleShare}
              disabled={!dataUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir Story</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!dataUrl}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5e6df5] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
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
