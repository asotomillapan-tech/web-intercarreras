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
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const legacy = computeCreativeLegacyBanner(career);
  const score = calculateCareerLeaderboardScore(career);
  const isGoat = career.maxOvr >= 100;

  // Carbon Background
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle geometric editorial grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let x = 90; x < 1080; x += 180) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1920);
    ctx.stroke();
  }

  // Top Accent Bar
  ctx.fillStyle = isGoat ? '#f59e0b' : '#707ef9';
  ctx.fillRect(0, 0, 1080, 22);

  // Header Branding
  ctx.fillStyle = '#707ef9';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('CAMPEONATO INTERCARRERAS UFRO · MINIJUEGO OFICIAL', 80, 108);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('LEYENDAS', 80, 212);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 248);
  ctx.lineTo(1000, 248);
  ctx.stroke();

  // Player Card Block
  ctx.fillStyle = '#16161d';
  ctx.fillRect(80, 288, 920, 420);
  ctx.strokeStyle = isGoat ? '#f59e0b' : '#707ef9';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 288, 920, 420);

  // OVR Badge Box
  ctx.fillStyle = isGoat ? '#f59e0b' : '#707ef9';
  ctx.fillRect(120, 330, 210, 210);
  ctx.fillStyle = isGoat ? '#0d0d0d' : '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isGoat ? 'GOAT MAX' : 'MAX OVR', 225, 376);
  ctx.font = 'bold 116px sans-serif';
  ctx.fillText(String(career.maxOvr), 225, 495);

  // Position & Sport under OVR
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`${career.pos} · ${SPORT_CONFIG[career.sportKey].shortName.toUpperCase()}`, 225, 595);
  ctx.fillStyle = '#a3a3a3';
  ctx.font = '24px sans-serif';
  ctx.fillText(career.branch === 'mujer' ? 'RAMA FEMENINA' : 'RAMA MASCULINA', 225, 636);

  // Player Name & Career
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 62px sans-serif';
  const nameLine = career.playerName.toUpperCase().slice(0, 22);
  ctx.fillText(nameLine, 370, 400);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = '32px sans-serif';
  ctx.fillText(career.career.slice(0, 34), 370, 456);

  ctx.fillStyle = '#707ef9';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(
    `${career.team.name.slice(0, 30)} · ${career.team.div}`,
    370,
    514
  );

  // Optional Real Team Crest
  const crestImg = await loadOptionalImage(career.team.escudo);
  if (crestImg) {
    ctx.drawImage(crestImg, 845, 540, 120, 120);
  }

  // Legacy Banner
  ctx.fillStyle = isGoat ? '#f59e0b' : '#ffffff';
  ctx.fillRect(80, 748, 920, 175);
  ctx.fillStyle = '#0d0d0d';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`LEGADO UNIVERSITARIO · ${legacy.tier}`, 120, 804);
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(legacy.title.toUpperCase().slice(0, 32), 120, 868);

  // Score + Key Metrics Grid (4 boxes)
  const metrics = [
    { label: 'PUNTAJE GLOBAL', val: score.toLocaleString('es-CL') },
    { label: 'TÍTULOS', val: String(career.trophies.length) },
    { label: 'PREMIOS IND.', val: String(career.awards.length) },
    { label: 'CAPS SEL. UFRO', val: String(career.caps) },
  ];

  metrics.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 80 + col * 475;
    const y = 964 + row * 165;
    ctx.fillStyle = '#16161d';
    ctx.fillRect(x, y, 445, 140);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 445, 140);

    ctx.fillStyle = '#a3a3a3';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(m.label, x + 32, y + 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(m.val, x + 32, y + 115);
  });

  // Sport Stats Strip
  ctx.fillStyle = '#16161d';
  ctx.fillRect(80, 1315, 920, 170);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.strokeRect(80, 1315, 920, 170);

  ctx.fillStyle = '#707ef9';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('ESTADÍSTICAS ACUMULADAS DE CARRERA', 120, 1368);

  const statSummary =
    career.sportKey === 'futbol'
      ? `${career.stats.m} PJ   ·   ${career.stats.g} GOLES   ·   ${career.stats.a} ASISTENCIAS`
      : career.sportKey === 'basquet'
      ? `${career.stats.m} PJ   ·   ${career.stats.pts} PTS   ·   ${career.stats.reb} REB   ·   ${career.stats.ast} AST`
      : `${career.stats.m} PJ   ·   ${career.stats.pts} PTS   ·   ${career.stats.blk} BLQ   ·   ${career.stats.ace} ACES`;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(statSummary, 120, 1442);

  // Career Trajectory Stints
  ctx.fillStyle = '#a3a3a3';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('TRAYECTORIA DE CLUBES', 80, 1555);

  const stintsToShow = career.stints.slice(0, 5);
  stintsToShow.forEach((stint, idx) => {
    const y = 1608 + idx * 46;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${stint.years}`, 80, y);
    ctx.fillStyle = '#d4d4d8';
    ctx.font = '28px sans-serif';
    ctx.fillText(`${stint.team.slice(0, 32)} (${stint.div})`, 250, y);
  });

  // Footer
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(80, 1840);
  ctx.lineTo(1000, 1840);
  ctx.stroke();

  ctx.fillStyle = '#a3a3a3';
  ctx.font = '24px sans-serif';
  ctx.fillText('UNIVERSIDAD DE LA FRONTERA · TEMUCO, CHILE', 80, 1882);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#707ef9';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('INTERCARRERAS UFRO', 1000, 1882);

  return canvas.toDataURL('image/png');
}

export function LeyendasPosterModal({ career, onClose }: LeyendasPosterModalProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    generatePosterDataUrl(career).then((url) => {
      if (active) setDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [career]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    const slug = career.playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `leyendas-ufro-${slug || 'carrera'}.png`;
    link.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'leyendas-ufro.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `LEYENDAS UFRO — ${career.playerName}`,
          text: `Terminé mi carrera en LEYENDAS Intercarreras UFRO con ${career.maxOvr} OVR y ${career.trophies.length} títulos.`,
          files: [file],
        });
        setShareMsg('Tarjeta compartida.');
      } else {
        handleDownload();
        setShareMsg('Tu navegador no soporta compartir archivos directo; descargamos el PNG.');
      }
    } catch {
      setShareMsg('Descarga el PNG para compartirlo en tus historias.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tarjeta Final de Leyenda"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-neutral-300 max-w-lg w-full overflow-hidden my-auto">
        <div className="bg-[#0d0d0d] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#707ef9]">
              Formato Historia · 1080 × 1920 PNG
            </p>
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide">
              Tarjeta Final de Leyenda
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tarjeta final"
            className="p-2 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 bg-[#f5f6f8] flex flex-col items-center gap-4">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`Tarjeta final de ${career.playerName}`}
              className="max-h-[58vh] w-auto border border-neutral-300 shadow-sm"
            />
          ) : (
            <div className="w-64 h-96 bg-[#0d0d0d] text-white flex items-center justify-center text-xs font-mono">
              Generando tarjeta oficial...
            </div>
          )}

          {shareMsg && (
            <p className="text-xs text-neutral-600 text-center">{shareMsg}</p>
          )}

          <div className="w-full grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!dataUrl}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#0d0d0d] hover:bg-[#707ef9] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PNG</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={!dataUrl}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs transition-colors cursor-pointer disabled:opacity-40"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
