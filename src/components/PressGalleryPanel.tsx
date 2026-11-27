import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  ImagePlus,
  Link2,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { canDeletePhoto, isAdminOrModerator } from '../domain/rbacEngine';
import { compressImageToDataUrl } from '../services/googleDrive';
import type { AppUserProfile, PhotoEntry, TournamentState } from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';

interface PressGalleryPanelProps {
  state: TournamentState;
  currentUser: AppUserProfile;
  onAddPhoto: (photo: PhotoEntry) => void;
  onDeletePhoto: (photoId: string) => void;
  onSaveDriveRootFolder?: (folderId: string, folderName: string) => void;
}

const STAGE_OPTIONS = [
  'Fase de Grupos',
  'Octavos de Final',
  'Cuartos de Final',
  'Semifinales',
  'Finales',
  'Premiación',
  'Ambiente y Público',
];

function extractDriveFileId(input: string): string | null {
  const trimmed = input.trim();
  const byPath = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (byPath?.[1]) return byPath[1];
  const byQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (byQuery?.[1]) return byQuery[1];
  return null;
}

function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  return match?.[1] ?? trimmed;
}

export function PressGalleryPanel({
  state,
  currentUser,
  onAddPhoto,
  onDeletePhoto,
  onSaveDriveRootFolder,
}: PressGalleryPanelProps) {
  const [sourceMode, setSourceMode] = useState<'upload' | 'drive'>('upload');
  const [title, setTitle] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('f7-h-1');
  const [stageLabel, setStageLabel] = useState<string>('Fase de Grupos');
  const [matchLabel, setMatchLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [compressing, setCompressing] = useState(false);

  const [search, setSearch] = useState('');
  const [filterDisc, setFilterDisc] = useState<string>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PhotoEntry | null>(null);

  const [driveFolderInput, setDriveFolderInput] = useState(state.driveUploadRootFolderId ?? '');
  const [driveFolderName, setDriveFolderName] = useState(
    state.driveUploadRootFolderName ?? 'Galería Oficial Intercarreras UFRO'
  );

  const filteredPhotos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.photos
      .filter((p) => {
        if (filterDisc !== 'ALL' && p.disciplineId !== filterDisc) return false;
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          p.matchLabel.toLowerCase().includes(q) ||
          (p.stageLabel ?? '').toLowerCase().includes(q) ||
          p.photographerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.photos, search, filterDisc]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setErrorMsg(null);
    try {
      let dataUrl = await compressImageToDataUrl(file, 960, 0.72);
      if (dataUrl.length > 185_000) {
        dataUrl = await compressImageToDataUrl(file, 720, 0.58);
      }
      if (dataUrl.length > 195_000) {
        dataUrl = await compressImageToDataUrl(file, 560, 0.5);
      }
      setImageUrl(dataUrl);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo procesar la fotografía.');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setErrorMsg('Ingresa un título descriptivo de al menos 3 caracteres.');
      return;
    }

    let finalImageUrl = imageUrl.trim();
    let driveFileId: string | undefined;
    let driveWebViewLink: string | undefined;

    if (sourceMode === 'drive') {
      const rawUrl = driveUrlInput.trim();
      if (!rawUrl.startsWith('https://')) {
        setErrorMsg('Ingresa un enlace HTTPS válido de Google Drive o imagen pública.');
        return;
      }
      const extracted = extractDriveFileId(rawUrl);
      if (extracted) {
        driveFileId = extracted;
        driveWebViewLink = rawUrl;
        finalImageUrl = `https://drive.google.com/thumbnail?id=${extracted}&sz=w1400`;
      } else {
        finalImageUrl = rawUrl;
      }
    } else if (!finalImageUrl) {
      setErrorMsg('Selecciona una fotografía desde tu dispositivo para subirla.');
      return;
    }

    const entry: PhotoEntry = {
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: trimmedTitle.slice(0, 120),
      disciplineId,
      stageLabel: stageLabel.trim() || undefined,
      matchLabel: matchLabel.trim() || 'Cobertura Oficial UFRO',
      season: state.temporada,
      source: sourceMode,
      imageUrl: finalImageUrl,
      thumbnailUrl: finalImageUrl,
      driveFileId,
      driveWebViewLink,
      photographerUid: currentUser.uid,
      photographerName: currentUser.displayName || currentUser.email,
      createdAt: new Date().toISOString(),
    };

    onAddPhoto(entry);
    setTitle('');
    setMatchLabel('');
    setImageUrl('');
    setDriveUrlInput('');
    setStatusMsg(`Fotografía "${entry.title}" publicada en la galería oficial.`);
  };

  const handleSaveDriveConfig = (e: FormEvent) => {
    e.preventDefault();
    if (!onSaveDriveRootFolder) return;
    const cleanId = extractDriveFolderId(driveFolderInput);
    onSaveDriveRootFolder(cleanId, driveFolderName.trim() || 'Galería Oficial UFRO');
    setStatusMsg('Carpeta raíz de Google Drive actualizada.');
  };

  return (
    <div className="space-y-6" data-testid="press-gallery-panel">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#a5b0ff]">
            <Camera className="w-3.5 h-3.5" />
            <span>Panel de Prensa · Fotografía</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.025em] text-white">
            Galería y{' '}
            <span className="font-editorial italic font-normal text-[#c8ceff]">fotografía</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Sube fotografías oficiales optimizadas o enlaza capturas de Google Drive para la galería
            pública del campeonato.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#101016] px-4 py-2.5 text-center self-start lg:self-auto">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Publicadas</p>
          <p className="text-xl font-medium tabular-nums text-white mt-0.5">
            {state.photos.length}
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            aria-label="Cerrar notificación"
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/[0.08] bg-[#101016] p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <ImagePlus className="w-4 h-4 text-[#a5b0ff]" />
            <h3 className="text-base font-medium text-white">Subir nueva fotografía</h3>
          </div>

          <div className="inline-flex rounded-full bg-[#050507] border border-white/[0.08] p-1">
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                sourceMode === 'upload'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Archivo local
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('drive')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                sourceMode === 'drive'
                  ? 'bg-white text-[#050507]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Enlace Drive / URL
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="press-photo-title" className="block text-xs text-zinc-400 mb-1.5">
              Título de la fotografía *
            </label>
            <input
              id="press-photo-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Gol decisivo de Ingeniería Civil en Fecha 4"
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
            />
          </div>

          <div>
            <label htmlFor="press-photo-disc" className="block text-xs text-zinc-400 mb-1.5">
              Disciplina
            </label>
            <select
              id="press-photo-disc"
              value={disciplineId}
              onChange={(e) => setDisciplineId(e.target.value)}
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
            >
              <option value="general">General / Ceremonias</option>
              {DISCIPLINES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="press-photo-stage" className="block text-xs text-zinc-400 mb-1.5">
              Etapa
            </label>
            <select
              id="press-photo-stage"
              value={stageLabel}
              onChange={(e) => setStageLabel(e.target.value)}
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#707ef9]"
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="press-photo-match" className="block text-xs text-zinc-400 mb-1.5">
              Partido o contexto (opcional)
            </label>
            <input
              id="press-photo-match"
              type="text"
              value={matchLabel}
              onChange={(e) => setMatchLabel(e.target.value)}
              placeholder="Ej: Fecha 4 · Cancha 1 UFRO"
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
            />
          </div>

          <div className="sm:col-span-2">
            {sourceMode === 'upload' ? (
              <div>
                <span className="block text-xs text-zinc-400 mb-1.5">
                  Archivo de imagen (compresión automática)
                </span>
                <label
                  htmlFor="press-photo-file"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#050507] border border-dashed border-white/[0.2] hover:border-[#707ef9] px-4 py-2.5 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#a5b0ff]" />
                  <span>
                    {compressing
                      ? 'Optimizando imagen...'
                      : imageUrl
                      ? 'Cambiar fotografía seleccionada'
                      : 'Seleccionar fotografía (JPG / PNG / WebP)'}
                  </span>
                </label>
                <input
                  id="press-photo-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleFileChange(e)}
                  className="sr-only"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="press-photo-url" className="block text-xs text-zinc-400 mb-1.5">
                  Enlace de Google Drive o imagen HTTPS
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="press-photo-url"
                    type="url"
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-xl bg-[#050507] border border-white/[0.1] pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {sourceMode === 'upload' && imageUrl && (
          <div className="flex items-center gap-4 pt-2">
            <img
              src={imageUrl}
              alt="Vista previa"
              className="w-28 h-20 object-cover rounded-xl border border-white/[0.12]"
            />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="text-xs text-zinc-400 hover:text-red-300 cursor-pointer"
            >
              Quitar selección
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={compressing}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] disabled:opacity-50 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Publicar en galería</span>
          </button>
        </div>
      </form>

      {/* Drive Root Folder Config (Admin / Moderator) */}
      {isAdminOrModerator(currentUser) && onSaveDriveRootFolder && (
        <form
          onSubmit={handleSaveDriveConfig}
          className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-5 flex flex-col lg:flex-row lg:items-end gap-3"
        >
          <div className="flex-1 min-w-0">
            <label htmlFor="press-drive-folder" className="block text-xs text-zinc-400 mb-1.5">
              <FolderOpen className="w-3.5 h-3.5 inline mr-1.5 text-[#a5b0ff]" />
              Carpeta raíz pública de Google Drive (ID o enlace)
            </label>
            <input
              id="press-drive-folder"
              type="text"
              value={driveFolderInput}
              onChange={(e) => setDriveFolderInput(e.target.value)}
              placeholder="ID o URL de carpeta compartida de Google Drive"
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
            />
          </div>
          <div className="lg:w-64">
            <label htmlFor="press-drive-name" className="block text-xs text-zinc-400 mb-1.5">
              Nombre visible
            </label>
            <input
              id="press-drive-name"
              type="text"
              value={driveFolderName}
              onChange={(e) => setDriveFolderName(e.target.value)}
              className="w-full rounded-xl bg-[#050507] border border-white/[0.1] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            Guardar carpeta
          </button>
        </form>
      )}

      {/* Existing Photos Catalog */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, etapa o fotógrafo..."
              aria-label="Buscar fotografías en galería"
              className="w-full rounded-xl bg-[#101016] border border-white/[0.1] pl-10 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
            />
          </div>
          <select
            value={filterDisc}
            onChange={(e) => setFilterDisc(e.target.value)}
            aria-label="Filtrar fotografías por disciplina"
            className="rounded-xl bg-[#101016] border border-white/[0.1] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#707ef9]"
          >
            <option value="ALL">Todas las disciplinas ({state.photos.length})</option>
            <option value="general">General / Ceremonias</option>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        {filteredPhotos.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#101016] p-10 text-center space-y-1.5">
            <p className="text-sm font-medium text-white">Sin fotografías registradas</p>
            <p className="text-xs text-zinc-400">
              Usa el formulario superior para publicar la primera fotografía oficial.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPhotos.map((photo) => {
              const discLabel =
                photo.disciplineId === 'general'
                  ? 'General'
                  : DISCIPLINE_MAP[photo.disciplineId as keyof typeof DISCIPLINE_MAP]?.nombreCorto ??
                    photo.disciplineId;
              const allowDel = canDeletePhoto(currentUser, photo.photographerUid);

              return (
                <article
                  key={photo.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] overflow-hidden flex flex-col"
                >
                  <div className="aspect-[16/10] bg-[#050507] relative overflow-hidden">
                    <img
                      src={photo.thumbnailUrl || photo.imageUrl}
                      alt={photo.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/[0.12] text-[10px] font-medium text-zinc-200">
                      {discLabel}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium text-white line-clamp-1">{photo.title}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                        {photo.matchLabel}
                        {photo.stageLabel ? ` · ${photo.stageLabel}` : ''}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Por {photo.photographerName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                      {photo.driveWebViewLink ? (
                        <a
                          href={photo.driveWebViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#a5b0ff] hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Drive</span>
                        </a>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {photo.source === 'drive' ? 'Drive' : 'Directa'}
                        </span>
                      )}

                      {allowDel && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(photo)}
                          aria-label={`Eliminar fotografía ${photo.title}`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-[11px] text-red-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Eliminar "${pendingDelete.title}"` : 'Eliminar fotografía'}
        description="Esta fotografía se retirará permanentemente de la galería oficial del campeonato."
        confirmLabel="Eliminar fotografía"
        onConfirm={() => {
          if (pendingDelete) {
            onDeletePhoto(pendingDelete.id);
            setStatusMsg(`Fotografía "${pendingDelete.title}" eliminada.`);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
