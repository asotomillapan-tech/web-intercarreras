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
  const isGoat = legacy.tier === 'GOAT' || career.maxOvr >= 100;
  const accent = isGoat ? '#f5c84c' : '#707ef9';
  const displayFont = '"League Gothic", "Arial Narrow", Impact, sans-serif';
  const bodyFont = '"Roboto", system-ui, -apple-system, sans-serif';

  // 1. Clean Carbon Editorial Backdrop
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, 1080, 1920);

  // Solid Top Accent Bar & Single Minimal Hairline Frame
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 1080, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 984, 1824);

  // 2. Minimal Header Row
  ctx.fillStyle = accent;
  ctx.font = `700 22px ${bodyFont}`;
  ctx.textAlign = 'left';
  ctx.fillText('INTERCARRERAS UFRO · LEYENDAS', 92, 118);

  ctx.fillStyle = '#a1a1aa';
  ctx.textAlign = 'right';
  ctx.fillText(
    `${SPORT_CONFIG[career.sportKey].shortName.toUpperCase()} · ${career.pos}`,
    988,
    118
  );

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(92, 148, 896, 1.5);

  // 3. Centered Club Crest Medallion
  const crestImg = await loadOptionalImage(career.team.escudo);
  const centerX = 540;
  const crestY = 300;
  ctx.beginPath();
  ctx.arc(centerX, crestY, 84, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 5;
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
    ctx.fillStyle = '#0d0d0d';
    ctx.textAlign = 'center';
    ctx.font = `400 66px ${displayFont}`;
    ctx.fillText((career.team.sigla || 'UFRO').slice(0, 4).toUpperCase(), centerX, crestY + 23);
  }

  // 4. Giant Peak OVR Focal Number
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = `700 22px ${bodyFont}`;
  ctx.fillText(isGoat ? 'GOAT · PEAK OVR' : 'PEAK OVR', centerX, 456);

  ctx.fillStyle = accent;
  ctx.font = `400 220px ${displayFont}`;
  ctx.fillText(String(career.maxOvr), centerX, 650);

  // 5. Player Name + Single Clean Career/Club Line + Legacy Title
  const upperName = career.playerName.toUpperCase();
  let nameSize = 112;
  ctx.font = `400 ${nameSize}px ${displayFont}`;
  while (ctx.measureText(upperName).width > 860 && nameSize > 62) {
    nameSize -= 6;
    ctx.font = `400 ${nameSize}px ${displayFont}`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(upperName, centerX, 774);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = `500 28px ${bodyFont}`;
  ctx.fillText(
    `${career.career} · ${career.team.name}`.slice(0, 56),
    centerX,
    828
  );

  ctx.fillStyle = accent;
  ctx.font = `700 24px ${bodyFont}`;
  ctx.fillText(
    `${legacy.title.toUpperCase()} · ${career.startYear}–${career.year}`.slice(0, 54),
    centerX,
    880
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
    ctx.font = `400 104px ${displayFont}`;
    ctx.fillText(st.val, cx, statsY + 126);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = `700 20px ${bodyFont}`;
    ctx.fillText(st.label, cx, statsY + 168);
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
  ctx.font = `400 96px ${displayFont}`;
  ctx.fillText(`${score.toLocaleString('es-CL')} PTS`, 988, 1778);

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
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-[#0d0d0d] text-white border border-white/15 w-full max-w-2xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
              Tarjeta Final · 1080×1920 PNG
            </p>
            <h3 id="leyendas-poster-title" className="font-display text-2xl font-bold uppercase">
              {career.playerName}
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
                Generando tarjeta 1080×1920...
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
