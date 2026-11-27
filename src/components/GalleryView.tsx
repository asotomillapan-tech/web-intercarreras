import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Lock,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DISCIPLINES, DISCIPLINE_MAP } from '../data/ufroSeed';
import { canDeletePhoto, canUploadPhotos } from '../domain/rbacEngine';
import { getGoogleAccessToken, signInWithGoogleWorkspace } from '../services/firebaseAuth';
import {
  createDriveSeasonRootFolder,
  DRIVE_DISCIPLINE_FOLDER_MAP,
  DRIVE_STAGE_FOLDERS,
  extractDriveFolderId,
  fetchDriveFolderContents,
  trashDriveFile,
  UFRO_DRIVE_2025_FOLDER_ID,
  UFRO_DRIVE_2025_URL,
  uploadPhotoToDriveHierarchy,
} from '../services/googleDrive';
import type { AppUserProfile, DriveNode, PhotoEntry, TournamentState } from '../types/tournament';
import { ConfirmDialog } from './ConfirmDialog';
import { EDITORIAL_EASE, RevealSection, SectionKicker } from './MotionPrimitives';

interface GalleryViewProps {
  state: TournamentState;
  currentUser: AppUserProfile | null;
  onAddPhoto: (photo: PhotoEntry) => Promise<void> | void;
  onDeletePhoto: (photoId: string) => Promise<void> | void;
  onSaveDriveRootFolder: (folderId: string, folderName: string) => Promise<void> | void;
  onOpenAuth: () => void;
}

interface BreadcrumbNode {
  id: string;
  name: string;
}

export function GalleryView({
  state,
  currentUser,
  onAddPhoto,
  onDeletePhoto,
  onSaveDriveRootFolder,
  onOpenAuth,
}: GalleryViewProps) {
  const [activeTab, setActiveTab] = useState<'drive' | 'webdb' | 'studio'>('drive');
  const [archiveSeason, setArchiveSeason] = useState<'2025' | '2026'>('2025');

  // Google Drive Archive Explorer State
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbNode[]>([
    { id: UFRO_DRIVE_2025_FOLDER_ID, name: 'Archivo 2025' },
  ]);
  const [driveItems, setDriveItems] = useState<DriveNode[]>([]);
  const [driveSource, setDriveSource] = useState<'drive_api_v3' | 'public_folder' | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Web Photo Index Filter & Lightbox
  const [discFilter, setDiscFilter] = useState<string>('ALL');
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    externalUrl?: string;
  } | null>(null);

  // Delete Confirmation Dialog State
  const [pendingDeletePhoto, setPendingDeletePhoto] = useState<PhotoEntry | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  // Admin 2026 Drive Root Folder Config State
  const [driveFolderInput, setDriveFolderInput] = useState(state.driveUploadRootFolderId ?? '');
  const [driveFolderNameInput, setDriveFolderNameInput] = useState(
    state.driveUploadRootFolderName ?? `Campeonato Intercarreras UFRO ${state.temporada}`
  );
  const [savingFolderConfig, setSavingFolderConfig] = useState(false);
  const [folderConfigError, setFolderConfigError] = useState<string | null>(null);
  const [folderConfigSuccess, setFolderConfigSuccess] = useState<string | null>(null);

  // Photographer Direct Google Drive Upload Studio State
  const [title, setTitle] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('f7-h-1');
  const [stageLabel, setStageLabel] = useState<string>(DRIVE_STAGE_FOLDERS[0]);
  const [matchLabel, setMatchLabel] = useState('');
  const [season, setSeason] = useState(state.temporada);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string>('');
  const [driveTokenReady, setDriveTokenReady] = useState<boolean>(() => Boolean(getGoogleAccessToken()));
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isPhotographerOrAdmin = canUploadPhotos(currentUser);
  const isAdmin = currentUser?.role === 'admin';
  const currentDriveFolder = breadcrumbs[breadcrumbs.length - 1];

  useEffect(() => {
    setDriveTokenReady(Boolean(getGoogleAccessToken()));
  }, [currentUser?.uid, activeTab]);

  useEffect(() => {
    if (state.driveUploadRootFolderId) {
      setDriveFolderInput(state.driveUploadRootFolderId);
    }
    if (state.driveUploadRootFolderName) {
      setDriveFolderNameInput(state.driveUploadRootFolderName);
    }
  }, [state.driveUploadRootFolderId, state.driveUploadRootFolderName]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const switchArchiveSeason = (nextSeason: '2025' | '2026') => {
    setArchiveSeason(nextSeason);
    if (nextSeason === '2025') {
      setBreadcrumbs([{ id: UFRO_DRIVE_2025_FOLDER_ID, name: 'Archivo 2025' }]);
    } else if (state.driveUploadRootFolderId) {
      setBreadcrumbs([
        {
          id: state.driveUploadRootFolderId,
          name: state.driveUploadRootFolderName || `Archivo ${state.temporada}`,
        },
      ]);
    }
  };

  const loadDriveFolder = async (folderId: string) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const token = getGoogleAccessToken();
      const res = await fetchDriveFolderContents(folderId, token);
      setDriveItems(res.items);
      setDriveSource(res.source);
    } catch (err: unknown) {
      setDriveError(
        err instanceof Error ? err.message : 'No se pudo cargar la carpeta de Google Drive.'
      );
      setDriveItems([]);
    } finally {
      setDriveLoading(false);
    }
  };

  useEffect(() => {
    void loadDriveFolder(currentDriveFolder.id);
  }, [currentDriveFolder.id]);

  const handleOpenDriveFolder = (node: DriveNode) => {
    setBreadcrumbs((prev) => [...prev, { id: node.id, name: node.name }]);
  };

  const handleJumpBreadcrumb = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const filteredWebPhotos = useMemo(() => {
    return state.photos.filter((p) => {
      if (discFilter === 'ALL') return true;
      return p.disciplineId === discFilter;
    });
  }, [state.photos, discFilter]);

  const handleConnectGoogleDrive = async () => {
    setConnectingDrive(true);
    setUploadError(null);
    setFolderConfigError(null);
    try {
      await signInWithGoogleWorkspace();
      setDriveTokenReady(Boolean(getGoogleAccessToken()));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con Google Drive. Habilita ventanas emergentes e intenta nuevamente.';
      setUploadError(msg);
      setFolderConfigError(msg);
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleSaveManualDriveRoot = async (e: FormEvent) => {
    e.preventDefault();
    setFolderConfigError(null);
    setFolderConfigSuccess(null);
    const extracted = extractDriveFolderId(driveFolderInput);
    if (!extracted) {
      setFolderConfigError(
        'Ingresa un enlace válido de carpeta de Google Drive (https://drive.google.com/drive/folders/...) o su ID.'
      );
      return;
    }
    const cleanName =
      driveFolderNameInput.trim() || `Campeonato Intercarreras UFRO ${state.temporada}`;
    setSavingFolderConfig(true);
    try {
      await onSaveDriveRootFolder(extracted, cleanName);
      setFolderConfigSuccess(`Carpeta raíz guardada: ${cleanName} (${extracted}).`);
    } catch (err: unknown) {
      setFolderConfigError(
        err instanceof Error ? err.message : 'No se pudo guardar la configuración de Drive.'
      );
    } finally {
      setSavingFolderConfig(false);
    }
  };

  const handleAutoCreateDriveRoot = async () => {
    setFolderConfigError(null);
    setFolderConfigSuccess(null);
    let token = getGoogleAccessToken();
    if (!token) {
      try {
        const res = await signInWithGoogleWorkspace();
        token = res.accessToken;
        setDriveTokenReady(Boolean(token));
      } catch (err: unknown) {
        setFolderConfigError(
          err instanceof Error
            ? err.message
            : 'Debes conectar tu cuenta Google con permiso de Drive para crear la carpeta.'
        );
        return;
      }
    }
    if (!token) {
      setFolderConfigError('No se obtuvo permiso de acceso a Google Drive.');
      return;
    }
    setSavingFolderConfig(true);
    try {
      const folder = await createDriveSeasonRootFolder(token, state.temporada);
      await onSaveDriveRootFolder(folder.id, folder.name);
      setDriveFolderInput(folder.id);
      setDriveFolderNameInput(folder.name);
      setFolderConfigSuccess(
        `Carpeta «${folder.name}» creada en Google Drive y vinculada al campeonato.`
      );
    } catch (err: unknown) {
      setFolderConfigError(
        err instanceof Error ? err.message : 'No se pudo crear la carpeta oficial en Google Drive.'
      );
    } finally {
      setSavingFolderConfig(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Selecciona un archivo de imagen válido (JPG, PNG o WebP).');
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }
    setPreviewObjectUrl(URL.createObjectURL(file));
  };

  const isPremiacion = disciplineId.startsWith('premiacion-');
  const computedDrivePath = useMemo(() => {
    const rootLabel =
      state.driveUploadRootFolderName || `Campeonato Intercarreras UFRO ${season || state.temporada}`;
    const discFolder = DRIVE_DISCIPLINE_FOLDER_MAP[disciplineId] || disciplineId;
    const parts = [rootLabel, discFolder];
    if (!isPremiacion && stageLabel) {
      parts.push(stageLabel);
    }
    parts.push(matchLabel.trim() || '[Encuentro]');
    return parts.join(' / ');
  }, [state.driveUploadRootFolderName, season, state.temporada, disciplineId, isPremiacion, stageLabel, matchLabel]);

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUploadSuccess(null);

    if (!currentUser || !isPhotographerOrAdmin) {
      setUploadError('Solo cuentas con rol Fotógrafo o Administrador pueden subir fotografías.');
      return;
    }
    if (!state.driveUploadRootFolderId) {
      setUploadError('Un Administrador debe vincular primero la Carpeta Raíz de Google Drive.');
      return;
    }
    if (title.trim().length < 3) {
      setUploadError('Ingresa un título descriptivo (mínimo 3 caracteres).');
      return;
    }
    if (matchLabel.trim().length < 3) {
      setUploadError('Indica la subcarpeta del encuentro (ej: Fecha 1 · Medicina vs Ingeniería).');
      return;
    }
    if (!selectedFile) {
      setUploadError('Selecciona una fotografía (JPG, PNG o WebP).');
      return;
    }

    let token = getGoogleAccessToken();
    if (!token) {
      try {
        const res = await signInWithGoogleWorkspace();
        token = res.accessToken;
        setDriveTokenReady(Boolean(token));
      } catch (err: unknown) {
        setUploadError(
          err instanceof Error
            ? err.message
            : 'Autoriza Google Drive para subir fotografías a la carpeta oficial.'
        );
        return;
      }
    }

    if (!token) {
      setUploadError('No se obtuvo un token de Google Drive activo.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadPhotoToDriveHierarchy({
        accessToken: token,
        rootFolderId: state.driveUploadRootFolderId,
        disciplineId,
        stageLabel: isPremiacion ? '' : stageLabel,
        matchLabel: matchLabel.trim(),
        title: title.trim(),
        file: selectedFile,
      });

      const newPhoto: PhotoEntry = {
        id: `ph-${Date.now()}`,
        title: title.trim(),
        disciplineId,
        stageLabel: isPremiacion ? undefined : stageLabel,
        matchLabel: matchLabel.trim(),
        season: season.trim() || state.temporada,
        source: 'drive',
        imageUrl: uploaded.imageUrl,
        thumbnailUrl: uploaded.thumbnailUrl,
        driveFileId: uploaded.fileId,
        driveWebViewLink: uploaded.webViewLink,
        driveFolderPath: uploaded.folderPath,
        photographerUid: currentUser.uid,
        photographerName: currentUser.displayName,
        createdAt: new Date().toISOString(),
      };

      await onAddPhoto(newPhoto);
      setTitle('');
      setMatchLabel('');
      setSelectedFile(null);
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        setPreviewObjectUrl('');
      }
      setUploadSuccess(`Fotografía «${newPhoto.title}» subida a Google Drive e indexada.`);
      setActiveTab('webdb');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo subir la fotografía.');
    } finally {
      setUploading(false);
    }
  };

  const confirmAndDeletePhoto = async () => {
    if (!pendingDeletePhoto) return;
    setDeletingPhoto(true);
    setUploadError(null);
    try {
      if (pendingDeletePhoto.driveFileId) {
        const token = getGoogleAccessToken();
        if (token) {
          await trashDriveFile(token, pendingDeletePhoto.driveFileId).catch(() => {});
        }
      }
      await onDeletePhoto(pendingDeletePhoto.id);
      setUploadSuccess(`Fotografía «${pendingDeletePhoto.title}» eliminada.`);
      setPendingDeletePhoto(null);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo eliminar la fotografía.');
      setPendingDeletePhoto(null);
    } finally {
      setDeletingPhoto(false);
    }
  };

  const driveFolders = driveItems.filter((i) => i.isFolder);
  const driveFiles = driveItems.filter((i) => !i.isFolder);

  const activeDriveExternalUrl =
    archiveSeason === '2026' && state.driveUploadRootFolderId
      ? `https://drive.google.com/drive/folders/${state.driveUploadRootFolderId}`
      : UFRO_DRIVE_2025_URL;

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[80vh]">
      {/* Obsidian Editorial Header */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SectionKicker index="01" label="Archivo Visual · Prensa Deportes UFRO" />
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
                Galería <span className="font-editorial text-[#c8ceff]">fotográfica</span>
              </h1>
              <p className="text-sm text-zinc-400 mt-3 max-w-xl">
                Cobertura oficial y archivo histórico por disciplina, fase y encuentro.
              </p>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-white/[0.03] border border-white/[0.08] p-1 self-start lg:self-auto">
              {[
                { id: 'drive' as const, label: 'Archivo Drive' },
                { id: 'webdb' as const, label: `Temporada ${state.temporada} (${state.photos.length})` },
                { id: 'studio' as const, label: 'Estudio' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-white text-[#050507]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <RevealSection className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {uploadSuccess && (
          <div
            role="status"
            className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-xs text-emerald-200 flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{uploadSuccess}</span>
            </span>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* TAB 1: GOOGLE DRIVE ARCHIVE */}
        {activeTab === 'drive' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchArchiveSeason('2025')}
                  className={`px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                    archiveSeason === '2025'
                      ? 'bg-white text-[#050507] border-white'
                      : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                  }`}
                >
                  Temporada 2025
                </button>
                {state.driveUploadRootFolderId && (
                  <button
                    type="button"
                    onClick={() => switchArchiveSeason('2026')}
                    className={`px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                      archiveSeason === '2026'
                        ? 'bg-[#707ef9] text-white border-[#707ef9]'
                        : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                    }`}
                  >
                    Temporada {state.temporada}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {driveSource && (
                  <span className="text-zinc-500 hidden sm:inline">
                    {driveSource === 'drive_api_v3' ? 'Drive API v3' : 'Carpeta pública'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void loadDriveFolder(currentDriveFolder.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-200 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
                <a
                  href={activeDriveExternalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 font-medium transition-colors"
                >
                  <span>Abrir Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Breadcrumbs */}
            <nav aria-label="Ruta en Google Drive" className="flex flex-wrap items-center gap-1.5 text-xs">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1.5">
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
                  <button
                    type="button"
                    onClick={() => handleJumpBreadcrumb(idx)}
                    className={`cursor-pointer transition-colors ${
                      idx === breadcrumbs.length - 1
                        ? 'font-medium text-white'
                        : 'text-[#a5b0ff] hover:text-white'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </nav>

            {driveError && (
              <div
                role="alert"
                className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4 text-xs text-red-200 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{driveError}</span>
              </div>
            )}

            {driveLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-2xl bg-[#0c0c10] border border-white/[0.06] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {driveFolders.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Carpetas ({driveFolders.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {driveFolders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => handleOpenDriveFolder(folder)}
                          className="group text-left p-5 rounded-2xl border border-white/[0.08] bg-[#0c0c10] hover:border-white/[0.2] hover:bg-[#111118] transition-all flex items-start gap-3.5 cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#707ef9]/15 border border-[#707ef9]/25 flex items-center justify-center shrink-0">
                            <Folder className="w-4 h-4 text-[#a5b0ff]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white group-hover:text-[#c8ceff] transition-colors break-words">
                              {folder.name}
                            </p>
                            {folder.modifiedDate && (
                              <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">
                                {folder.modifiedDate}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artfolio-inspired Editorial Photo Grid */}
                {driveFiles.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Fotografías ({driveFiles.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {driveFiles.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              title: file.name,
                              subtitle: breadcrumbs.map((b) => b.name).join(' / '),
                              imageUrl: file.imageUrl || file.thumbnailUrl || '',
                              externalUrl: file.webViewLink,
                            })
                          }
                          className="group relative text-left rounded-3xl overflow-hidden border border-white/[0.08] hover:border-white/[0.22] bg-[#0c0c10] aspect-[4/5] transition-all cursor-pointer"
                        >
                          <img
                            src={file.thumbnailUrl}
                            alt={file.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 pt-12">
                            <p className="text-xs font-medium text-white truncate">{file.name}</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Drive · {archiveSeason}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {driveFolders.length === 0 && driveFiles.length === 0 && !driveError && (
                  <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center text-sm text-zinc-500">
                    Esta carpeta aún no contiene elementos visibles.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEB PHOTOGRAPHY INDEX */}
        {activeTab === 'webdb' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDiscFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                    discFilter === 'ALL'
                      ? 'bg-white text-[#050507] border-white'
                      : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                  }`}
                >
                  Todas ({state.photos.length})
                </button>
                {DISCIPLINES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDiscFilter(d.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                      discFilter === d.id
                        ? 'bg-[#707ef9] text-white border-[#707ef9]'
                        : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {d.nombreCorto}
                  </button>
                ))}
              </div>

              {isPhotographerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('studio')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer self-start sm:self-auto transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Subir fotografía</span>
                </button>
              )}
            </div>

            {filteredWebPhotos.length === 0 ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-12 text-center space-y-3">
                <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xl font-medium text-white">
                  Sin fotografías en la temporada {state.temporada}
                </p>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Las capturas subidas desde el Estudio Fotógrafo aparecen aquí automáticamente.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('drive')}
                    className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Explorar Archivo 2025
                  </button>
                  {isPhotographerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className="px-4 py-2 rounded-full border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-100 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Abrir Estudio
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWebPhotos.map((photo) => {
                  const discName =
                    DISCIPLINE_MAP[photo.disciplineId as keyof typeof DISCIPLINE_MAP]?.nombreCorto ??
                    DRIVE_DISCIPLINE_FOLDER_MAP[photo.disciplineId] ??
                    photo.disciplineId;
                  const canDelete = canDeletePhoto(currentUser, photo.photographerUid);
                  return (
                    <article
                      key={photo.id}
                      className="group rounded-3xl border border-white/[0.08] hover:border-white/[0.18] bg-[#0c0c10] overflow-hidden flex flex-col transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            title: photo.title,
                            subtitle: `${photo.driveFolderPath || `${discName} · ${photo.matchLabel}`} · ${photo.photographerName}`,
                            imageUrl: photo.imageUrl,
                            externalUrl: photo.driveWebViewLink,
                          })
                        }
                        className="relative h-64 w-full bg-[#08080c] overflow-hidden cursor-pointer block"
                      >
                        <img
                          src={photo.thumbnailUrl || photo.imageUrl}
                          alt={photo.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.14] text-[11px] font-medium text-white">
                          {discName}
                        </span>
                      </button>

                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                            <span>{photo.stageLabel || 'Cobertura oficial'}</span>
                            <span className="tabular-nums">{photo.season}</span>
                          </div>
                          <h3 className="text-base font-medium text-white mt-1 leading-snug">
                            {photo.title}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5">{photo.matchLabel}</p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06] text-xs text-zinc-500">
                          <span className="truncate">{photo.photographerName}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            {photo.driveWebViewLink && (
                              <a
                                href={photo.driveWebViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#a5b0ff] hover:text-white transition-colors"
                              >
                                <span>Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setPendingDeletePhoto(photo)}
                                aria-label={`Eliminar fotografía ${photo.title}`}
                                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PHOTOGRAPHER DIRECT GOOGLE DRIVE STUDIO */}
        {activeTab === 'studio' && (
          <div className="max-w-3xl space-y-6">
            {!isPhotographerOrAdmin ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-8 space-y-4">
                <div className="flex items-center gap-2.5 text-white">
                  <Lock className="w-5 h-5 text-[#9aa5ff]" />
                  <h2 className="text-xl font-medium tracking-[-0.02em]">
                    Acceso para <span className="font-editorial text-[#c8ceff]">fotógrafos acreditados</span>
                  </h2>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Solo cuentas con rol Fotógrafo Oficial o Administrador pueden subir fotografías
                  directamente a la carpeta de Google Drive del campeonato.
                </p>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-5 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                >
                  Iniciar sesión
                </button>
              </div>
            ) : (
              <>
                {/* Admin Drive Root Folder Config */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <p className="text-xs text-[#9aa5ff] font-medium">
                        Destino Google Drive · {state.temporada}
                      </p>
                      <h2 className="text-lg font-medium text-white mt-0.5">
                        {state.driveUploadRootFolderId
                          ? state.driveUploadRootFolderName || 'Carpeta raíz conectada'
                          : 'Carpeta raíz pendiente de vincular'}
                      </h2>
                    </div>
                    {state.driveUploadRootFolderId && (
                      <a
                        href={`https://drive.google.com/drive/folders/${state.driveUploadRootFolderId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs self-start sm:self-auto transition-colors"
                      >
                        <span>Ver carpeta</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {state.driveUploadRootFolderId ? (
                    <p className="text-xs text-zinc-400">
                      ID activo:{' '}
                      <code className="bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 text-zinc-200">
                        {state.driveUploadRootFolderId}
                      </code>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-200 rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5">
                      {isAdmin
                        ? 'Crea una carpeta oficial en tu Drive o pega el enlace de una carpeta compartida.'
                        : 'Un Administrador debe vincular la Carpeta Raíz 2026 para habilitar subidas.'}
                    </p>
                  )}

                  {isAdmin && (
                    <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                      {folderConfigError && (
                        <div
                          role="alert"
                          className="rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-200"
                        >
                          {folderConfigError}
                        </div>
                      )}
                      {folderConfigSuccess && (
                        <div
                          role="status"
                          className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-200"
                        >
                          {folderConfigSuccess}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={savingFolderConfig}
                        onClick={() => void handleAutoCreateDriveRoot()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-medium cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        <FolderPlus className="w-4 h-4" />
                        <span>
                          {savingFolderConfig
                            ? 'Creando...'
                            : `Crear carpeta ${state.temporada} en Drive`}
                        </span>
                      </button>

                      <form
                        onSubmit={handleSaveManualDriveRoot}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
                      >
                        <input
                          type="text"
                          value={driveFolderInput}
                          onChange={(e) => setDriveFolderInput(e.target.value)}
                          placeholder="URL o ID de carpeta compartida..."
                          aria-label="URL o ID de carpeta raíz Google Drive"
                          className="sm:col-span-6 rounded-xl bg-[#111117] border border-white/[0.1] px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                        />
                        <input
                          type="text"
                          value={driveFolderNameInput}
                          onChange={(e) => setDriveFolderNameInput(e.target.value)}
                          placeholder="Nombre visible"
                          aria-label="Nombre de la carpeta raíz"
                          className="sm:col-span-4 rounded-xl bg-[#111117] border border-white/[0.1] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                        />
                        <button
                          type="submit"
                          disabled={savingFolderConfig}
                          className="sm:col-span-2 px-3 py-2 rounded-xl bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          Vincular
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Upload Form */}
                <form
                  onSubmit={handleUploadSubmit}
                  className="rounded-3xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div>
                      <p className="text-xs text-[#9aa5ff] font-medium">
                        Estudio · {currentUser?.displayName}
                      </p>
                      <h2 className="text-xl font-medium text-white mt-0.5">
                        Subir fotografía a <span className="font-editorial text-[#c8ceff]">Drive</span>
                      </h2>
                    </div>

                    {!driveTokenReady && (
                      <button
                        type="button"
                        onClick={() => void handleConnectGoogleDrive()}
                        disabled={connectingDrive}
                        className="px-4 py-2 rounded-full bg-white text-[#050507] hover:bg-zinc-200 text-xs font-medium cursor-pointer self-start sm:self-auto transition-colors"
                      >
                        {connectingDrive ? 'Conectando...' : 'Conectar Drive'}
                      </button>
                    )}
                  </div>

                  {uploadError && (
                    <div
                      role="alert"
                      className="rounded-2xl bg-red-500/10 border border-red-500/25 p-3.5 text-xs text-red-200 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="photo-title" className="block text-xs text-zinc-400 mb-1.5">
                        Título *
                      </label>
                      <input
                        id="photo-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Gol de tiro libre en Semifinal Fútbol 7"
                        className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                      />
                    </div>

                    <div>
                      <label htmlFor="photo-disc" className="block text-xs text-zinc-400 mb-1.5">
                        Disciplina *
                      </label>
                      <select
                        id="photo-disc"
                        value={disciplineId}
                        onChange={(e) => setDisciplineId(e.target.value)}
                        className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9]"
                      >
                        {DISCIPLINES.map((d) => (
                          <option key={d.id} value={d.id}>
                            {DRIVE_DISCIPLINE_FOLDER_MAP[d.id] || d.nombre}
                          </option>
                        ))}
                        <option value="premiacion-futbol">Premiación Fútbol</option>
                        <option value="premiacion-basquet">Premiación Básquet</option>
                        <option value="premiacion-voley">Premiación Voleibol</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="photo-stage" className="block text-xs text-zinc-400 mb-1.5">
                        Fase
                      </label>
                      <select
                        id="photo-stage"
                        disabled={isPremiacion}
                        value={stageLabel}
                        onChange={(e) => setStageLabel(e.target.value)}
                        className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#707ef9] disabled:opacity-40"
                      >
                        {DRIVE_STAGE_FOLDERS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="photo-match" className="block text-xs text-zinc-400 mb-1.5">
                        Encuentro / Jornada *
                      </label>
                      <input
                        id="photo-match"
                        type="text"
                        value={matchLabel}
                        onChange={(e) => setMatchLabel(e.target.value)}
                        placeholder="Ej: Fecha 1 · Medicina vs Kinesiología"
                        className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#707ef9]"
                      />
                    </div>

                    <div>
                      <label htmlFor="photo-season" className="block text-xs text-zinc-400 mb-1.5">
                        Temporada
                      </label>
                      <input
                        id="photo-season"
                        type="text"
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                        placeholder="2026"
                        className="w-full rounded-xl bg-[#111117] border border-white/[0.1] px-3.5 py-2.5 text-sm tabular-nums text-zinc-100 focus:outline-none focus:border-[#707ef9]"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#101016] border border-white/[0.08] px-4 py-3 text-xs">
                    <span className="text-zinc-500 block mb-1">Ruta destino en Drive</span>
                    <span className="font-mono text-zinc-200 break-all">{computedDrivePath}</span>
                  </div>

                  <div className="space-y-3">
                    <label
                      htmlFor="photo-file-input"
                      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.18] bg-[#101016] p-7 text-center cursor-pointer hover:border-[#707ef9] transition-colors"
                    >
                      <Upload className="w-6 h-6 text-[#9aa5ff] mb-2" />
                      <span className="text-sm font-medium text-white">
                        {selectedFile
                          ? selectedFile.name
                          : 'Seleccionar fotografía (JPG / PNG / WebP)'}
                      </span>
                      <span className="text-xs text-zinc-500 mt-1">
                        Resolución original subida a Drive e indexada automáticamente
                      </span>
                      <input
                        id="photo-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>

                    {previewObjectUrl && (
                      <div className="rounded-2xl border border-white/[0.1] overflow-hidden bg-black">
                        <img
                          src={previewObjectUrl}
                          alt="Vista previa de fotografía"
                          className="w-full max-h-72 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-3 border-t border-white/[0.08]">
                    <button
                      type="submit"
                      disabled={uploading || !state.driveUploadRootFolderId}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#707ef9] hover:bg-[#5c6bf0] text-white text-xs font-medium cursor-pointer disabled:opacity-45 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{uploading ? 'Subiendo...' : 'Subir y publicar'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </RevealSection>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de fotografía"
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full rounded-3xl bg-[#0a0a0e] border border-white/[0.12] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.08] text-white">
              <div className="min-w-0">
                <p className="text-base font-medium truncate">{lightboxPhoto.title}</p>
                <p className="text-xs text-zinc-500 truncate">{lightboxPhoto.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lightboxPhoto.externalUrl && (
                  <a
                    href={lightboxPhoto.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-xs text-white transition-colors"
                  >
                    <span>Original</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  aria-label="Cerrar vista ampliada"
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDeletePhoto !== null}
        title="Eliminar fotografía"
        description={
          pendingDeletePhoto?.driveFileId
            ? `Se eliminará «${pendingDeletePhoto.title}» del índice web y se enviará a la papelera de Google Drive.`
            : `Se eliminará «${pendingDeletePhoto?.title ?? ''}» del índice web oficial.`
        }
        details={
          pendingDeletePhoto
            ? [
                `Título: ${pendingDeletePhoto.title}`,
                `Encuentro: ${pendingDeletePhoto.driveFolderPath || pendingDeletePhoto.matchLabel}`,
                `Autor: ${pendingDeletePhoto.photographerName}`,
              ]
            : []
        }
        confirmLabel="Eliminar"
        loading={deletingPhoto}
        onConfirm={() => void confirmAndDeletePhoto()}
        onCancel={() => setPendingDeletePhoto(null)}
      />
    </div>
  );
}
