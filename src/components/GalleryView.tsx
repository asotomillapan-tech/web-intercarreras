import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
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
    { id: UFRO_DRIVE_2025_FOLDER_ID, name: 'Archivo Intercarreras 2025 (Google Drive)' },
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

  // Mandatory Delete Confirmation Dialog State (Drive + Firestore)
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
      setBreadcrumbs([
        { id: UFRO_DRIVE_2025_FOLDER_ID, name: 'Archivo Intercarreras 2025 (Google Drive)' },
      ]);
    } else if (state.driveUploadRootFolderId) {
      setBreadcrumbs([
        {
          id: state.driveUploadRootFolderId,
          name: state.driveUploadRootFolderName || `Archivo Intercarreras ${state.temporada} (Google Drive)`,
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
      setFolderConfigSuccess(`Carpeta raíz de Google Drive guardada: ${cleanName} (${extracted}).`);
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
        `Carpeta oficial «${folder.name}» creada en Google Drive y vinculada al campeonato. Recuerda compartirla como Editor con tus fotógrafos acreditados.`
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
    parts.push(matchLabel.trim() || '[Nombre del encuentro]');
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
      setUploadError(
        'Un Administrador UFRO debe vincular primero la Carpeta Raíz de Google Drive 2026 antes de subir fotografías.'
      );
      return;
    }
    if (title.trim().length < 3) {
      setUploadError('Ingresa un título descriptivo para la fotografía (mínimo 3 caracteres).');
      return;
    }
    if (matchLabel.trim().length < 3) {
      setUploadError(
        'Indica el nombre de la subcarpeta del encuentro (ej: Fecha 1 · Medicina vs Ingeniería).'
      );
      return;
    }
    if (!selectedFile) {
      setUploadError('Selecciona una fotografía real (JPG, PNG o WebP) desde tu dispositivo.');
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
            : 'Debes autorizar Google Drive para subir fotografías directamente a la carpeta oficial.'
        );
        return;
      }
    }

    if (!token) {
      setUploadError('No se obtuvo un token de Google Drive activo. Haz clic en Conectar Google Drive.');
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
      setUploadSuccess(
        `Fotografía «${newPhoto.title}» subida a Google Drive (${uploaded.folderPath}) e indexada en Firestore.`
      );
      setActiveTab('webdb');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo subir la fotografía a Google Drive.');
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
          await trashDriveFile(token, pendingDeletePhoto.driveFileId).catch(() => {
            // Non-fatal if file was already removed or owned by another user in Drive
          });
        }
      }
      await onDeletePhoto(pendingDeletePhoto.id);
      setUploadSuccess(`Fotografía «${pendingDeletePhoto.title}» eliminada del índice oficial.`);
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
    <div className="bg-white min-h-[75vh]">
      {/* Carbon Editorial Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Base de Datos Fotográfica Oficial · Prensa Deportes UFRO
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mt-2">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">
                Galería y Archivo Fotográfico
              </h1>
              <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
                Explora el archivo histórico 2025 en Google Drive y las capturas oficiales de la
                temporada {state.temporada} subidas directamente a Google Drive bajo el mismo orden
                por disciplina, fase y encuentro.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('drive')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap ${
                  activeTab === 'drive'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Archivo Google Drive
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('webdb')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap ${
                  activeTab === 'webdb'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Índice Web {state.temporada} ({state.photos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap ${
                  activeTab === 'studio'
                    ? 'bg-[#707ef9] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                Estudio Fotógrafo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {uploadSuccess && (
          <div
            role="status"
            className="bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-950 flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{uploadSuccess}</span>
            </span>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-emerald-800 hover:underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* TAB 1: REAL GOOGLE DRIVE ARCHIVE (2025 + 2026) */}
        {activeTab === 'drive' && (
          <div className="space-y-6">
            {/* Season Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchArchiveSeason('2025')}
                  className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider cursor-pointer ${
                    archiveSeason === '2025'
                      ? 'bg-[#0d0d0d] text-white'
                      : 'bg-[#f5f6f8] text-neutral-700 hover:text-[#0d0d0d]'
                  }`}
                >
                  Temporada 2025 (Archivo Histórico)
                </button>
                {state.driveUploadRootFolderId && (
                  <button
                    type="button"
                    onClick={() => switchArchiveSeason('2026')}
                    className={`px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider cursor-pointer ${
                      archiveSeason === '2026'
                        ? 'bg-[#707ef9] text-white'
                        : 'bg-[#f5f6f8] text-neutral-700 hover:text-[#0d0d0d]'
                    }`}
                  >
                    Temporada {state.temporada} (Carpeta Oficial Drive)
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                {driveSource && (
                  <span className="text-neutral-500">
                    Fuente:{' '}
                    <strong className="text-[#0d0d0d]">
                      {driveSource === 'drive_api_v3' ? 'Google Drive API v3' : 'Carpeta Pública Drive'}
                    </strong>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void loadDriveFolder(currentDriveFolder.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 hover:border-[#707ef9] text-[#0d0d0d] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
                <a
                  href={activeDriveExternalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d0d0d] text-white hover:bg-[#707ef9] transition-colors"
                >
                  <span>Abrir en Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Breadcrumbs */}
            <nav aria-label="Ruta en Google Drive" className="flex flex-wrap items-center gap-1.5 text-sm">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1.5">
                  {idx > 0 && <ChevronRight className="w-4 h-4 text-neutral-400" />}
                  <button
                    type="button"
                    onClick={() => handleJumpBreadcrumb(idx)}
                    className={`cursor-pointer ${
                      idx === breadcrumbs.length - 1
                        ? 'font-bold text-[#0d0d0d]'
                        : 'text-[#707ef9] hover:underline'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </nav>

            {driveError && (
              <div role="alert" className="bg-red-50 border border-red-300 p-4 text-xs text-red-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{driveError}</span>
              </div>
            )}

            {driveLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 bg-[#f5f6f8] border border-neutral-200 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Subfolders (Disciplines / Stages / Matches) */}
                {driveFolders.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Carpetas por Disciplina / Fase / Encuentro ({driveFolders.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {driveFolders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => handleOpenDriveFolder(folder)}
                          className="group text-left p-4 border border-neutral-200 bg-white hover:border-[#707ef9] hover:bg-[#f9fafb] transition-colors flex items-start gap-3 cursor-pointer"
                        >
                          <Folder className="w-5 h-5 text-[#707ef9] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-display text-base font-bold uppercase tracking-wide text-[#0d0d0d] group-hover:text-[#707ef9] break-words">
                              {folder.name}
                            </p>
                            {folder.modifiedDate && (
                              <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                                Actualizado: {folder.modifiedDate}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Photos inside current folder */}
                {driveFiles.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Fotografías del encuentro ({driveFiles.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                          className="group text-left border border-neutral-200 bg-white overflow-hidden hover:border-[#707ef9] transition-colors cursor-pointer"
                        >
                          <div className="h-48 w-full bg-[#0d0d0d] overflow-hidden">
                            <img
                              src={file.thumbnailUrl}
                              alt={file.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="p-3">
                            <p className="text-xs font-medium text-[#0d0d0d] truncate">{file.name}</p>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              Google Drive · {archiveSeason}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {driveFolders.length === 0 && driveFiles.length === 0 && !driveError && (
                  <div className="border border-neutral-200 p-10 text-center text-sm text-neutral-600">
                    Esta carpeta aún no contiene elementos visibles.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEB PHOTOGRAPHY INDEX (FIRESTORE + DRIVE LINKS) */}
        {activeTab === 'webdb' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDiscFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    discFilter === 'ALL'
                      ? 'bg-[#0d0d0d] text-white'
                      : 'bg-[#f5f6f8] text-neutral-700 hover:text-[#0d0d0d]'
                  }`}
                >
                  Todas ({state.photos.length})
                </button>
                {DISCIPLINES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDiscFilter(d.id)}
                    className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                      discFilter === d.id
                        ? 'bg-[#707ef9] text-white'
                        : 'bg-[#f5f6f8] text-neutral-700 hover:text-[#0d0d0d]'
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer self-start sm:self-auto"
                >
                  <Camera className="w-4 h-4" />
                  <span>Subir a Google Drive</span>
                </button>
              )}
            </div>

            {filteredWebPhotos.length === 0 ? (
              <div className="border border-neutral-200 bg-[#f5f6f8] p-12 text-center space-y-3">
                <ImageIcon className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="font-display text-xl uppercase text-[#0d0d0d]">
                  Sin fotografías indexadas en la temporada {state.temporada}
                </p>
                <p className="text-xs text-neutral-600 max-w-md mx-auto">
                  Cuando los fotógrafos acreditados suban cobertura desde el Estudio Fotógrafo, cada
                  imagen se guardará automáticamente en Google Drive y aparecerá aquí.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('drive')}
                    className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                  >
                    Explorar Archivo 2025 en Drive
                  </button>
                  {isPhotographerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className="px-4 py-2 border border-neutral-300 bg-white hover:border-[#707ef9] text-[#0d0d0d] text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                    >
                      Abrir Estudio Fotógrafo
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
                      className="border border-neutral-200 bg-white overflow-hidden flex flex-col"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            title: photo.title,
                            subtitle: `${photo.driveFolderPath || `${discName} · ${photo.matchLabel}`} · Foto: ${photo.photographerName}`,
                            imageUrl: photo.imageUrl,
                            externalUrl: photo.driveWebViewLink,
                          })
                        }
                        className="h-56 w-full bg-[#0d0d0d] overflow-hidden cursor-pointer block"
                      >
                        <img
                          src={photo.thumbnailUrl || photo.imageUrl}
                          alt={photo.title}
                          loading="lazy"
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 uppercase">
                            <span className="text-[#707ef9] font-bold">{discName}</span>
                            <span className="tabular-nums">Temporada {photo.season}</span>
                          </div>
                          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-[#0d0d0d] mt-1">
                            {photo.title}
                          </h3>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {photo.stageLabel ? `${photo.stageLabel} · ` : ''}
                            {photo.matchLabel}
                          </p>
                          {photo.driveFolderPath && (
                            <p className="text-[11px] text-neutral-400 mt-1 truncate font-mono">
                              Drive: {photo.driveFolderPath}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-neutral-100 text-xs text-neutral-500">
                          <span className="truncate">Por {photo.photographerName}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            {photo.driveWebViewLink && (
                              <a
                                href={photo.driveWebViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#707ef9] hover:text-[#0d0d0d]"
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
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 cursor-pointer"
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

        {/* TAB 3: PHOTOGRAPHER DIRECT GOOGLE DRIVE UPLOAD STUDIO */}
        {activeTab === 'studio' && (
          <div className="max-w-3xl space-y-8">
            {!isPhotographerOrAdmin ? (
              <div className="border border-neutral-200 bg-[#f5f6f8] p-8 space-y-4">
                <div className="flex items-center gap-2 text-[#0d0d0d]">
                  <Lock className="w-5 h-5 text-[#707ef9]" />
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                    Acceso exclusivo para Fotógrafos Acreditados
                  </h2>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Solo las cuentas con rol <strong>Fotógrafo Oficial</strong> o{' '}
                  <strong>Administrador</strong> pueden subir fotografías directamente a la carpeta
                  oficial de Google Drive del campeonato. Un Administrador UFRO puede promover una
                  cuenta tradicional al rol de Fotógrafo desde{' '}
                  <strong>Panel Oficial → Usuarios y Roles</strong>.
                </p>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-5 py-2.5 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer"
                >
                  Iniciar sesión con Google
                </button>
              </div>
            ) : (
              <>
                {/* Admin Drive Root Folder Configuration Box */}
                <div className="border border-neutral-200 bg-[#f5f6f8] p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#707ef9]">
                        Destino Google Drive · Temporada {state.temporada}
                      </p>
                      <h2 className="font-display text-xl font-bold uppercase text-[#0d0d0d] mt-0.5">
                        {state.driveUploadRootFolderId
                          ? state.driveUploadRootFolderName || 'Carpeta Raíz Conectada'
                          : 'Carpeta Raíz Google Drive pendiente de vincular'}
                      </h2>
                    </div>
                    {state.driveUploadRootFolderId && (
                      <a
                        href={`https://drive.google.com/drive/folders/${state.driveUploadRootFolderId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d0d0d] text-white hover:bg-[#707ef9] text-xs font-medium self-start sm:self-auto"
                      >
                        <span>Ver carpeta raíz</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {state.driveUploadRootFolderId ? (
                    <p className="text-xs text-neutral-600">
                      ID de carpeta activa:{' '}
                      <code className="bg-white border border-neutral-200 px-1.5 py-0.5 text-[#0d0d0d]">
                        {state.driveUploadRootFolderId}
                      </code>
                      . Las fotografías se organizan automáticamente en subcarpetas con el mismo
                      esquema del archivo 2025: <strong>Disciplina / Fase / Encuentro</strong>.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-3">
                      {isAdmin
                        ? 'Aún no hay una Carpeta Raíz de Google Drive configurada para 2026. Crea una automáticamente en tu Google Drive o pega el enlace de una carpeta compartida abajo.'
                        : 'Un Administrador UFRO debe vincular la Carpeta Raíz de Google Drive 2026 y compartirla contigo como Editor para habilitar las subidas.'}
                    </p>
                  )}

                  {isAdmin && (
                    <div className="space-y-3 pt-2 border-t border-neutral-200">
                      {folderConfigError && (
                        <div role="alert" className="bg-red-50 border border-red-300 p-3 text-xs text-red-900">
                          {folderConfigError}
                        </div>
                      )}
                      {folderConfigSuccess && (
                        <div role="status" className="bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-950">
                          {folderConfigSuccess}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={savingFolderConfig}
                          onClick={() => void handleAutoCreateDriveRoot()}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#707ef9] hover:bg-[#5766eb] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span>
                            {savingFolderConfig
                              ? 'Creando...'
                              : `Crear carpeta oficial ${state.temporada} en mi Google Drive`}
                          </span>
                        </button>
                      </div>

                      <form onSubmit={handleSaveManualDriveRoot} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <input
                          type="text"
                          value={driveFolderInput}
                          onChange={(e) => setDriveFolderInput(e.target.value)}
                          placeholder="O pega URL / ID de carpeta Google Drive compartida..."
                          aria-label="URL o ID de carpeta raíz Google Drive"
                          className="sm:col-span-6 bg-white border border-neutral-300 px-3 py-2 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={driveFolderNameInput}
                          onChange={(e) => setDriveFolderNameInput(e.target.value)}
                          placeholder="Nombre visible (ej: Intercarreras UFRO 2026)"
                          aria-label="Nombre de la carpeta raíz"
                          className="sm:col-span-4 bg-white border border-neutral-300 px-3 py-2 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={savingFolderConfig}
                          className="sm:col-span-2 px-3 py-2 bg-[#0d0d0d] hover:bg-neutral-800 text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                        >
                          Vincular
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {/* Direct Google Drive Upload Form */}
                <form
                  onSubmit={handleUploadSubmit}
                  className="border border-neutral-200 p-6 sm:p-8 space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
                        Estudio de Fotógrafo · {currentUser?.displayName}
                      </p>
                      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d] mt-1">
                        Subir Fotografía Directo a Google Drive
                      </h2>
                    </div>

                    {!driveTokenReady && (
                      <button
                        type="button"
                        onClick={() => void handleConnectGoogleDrive()}
                        disabled={connectingDrive}
                        className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#707ef9] text-white text-xs font-display font-bold uppercase tracking-widest cursor-pointer self-start sm:self-auto"
                      >
                        {connectingDrive ? 'Conectando...' : 'Conectar Google Drive'}
                      </button>
                    )}
                  </div>

                  {uploadError && (
                    <div
                      role="alert"
                      className="bg-red-50 border border-red-300 p-3.5 text-xs text-red-900 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="photo-title" className="block text-xs font-medium text-neutral-700 mb-1">
                        Título de la fotografía *
                      </label>
                      <input
                        id="photo-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Gol de tiro libre en Semifinal Fútbol 7 1ª División"
                        className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                      />
                    </div>

                    <div>
                      <label htmlFor="photo-disc" className="block text-xs font-medium text-neutral-700 mb-1">
                        Carpeta de Disciplina (Estructura 2025) *
                      </label>
                      <select
                        id="photo-disc"
                        value={disciplineId}
                        onChange={(e) => setDisciplineId(e.target.value)}
                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
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
                      <label htmlFor="photo-stage" className="block text-xs font-medium text-neutral-700 mb-1">
                        Subcarpeta de Fase / Etapa
                      </label>
                      <select
                        id="photo-stage"
                        disabled={isPremiacion}
                        value={stageLabel}
                        onChange={(e) => setStageLabel(e.target.value)}
                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9] disabled:bg-neutral-100 disabled:text-neutral-400"
                      >
                        {DRIVE_STAGE_FOLDERS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="photo-match" className="block text-xs font-medium text-neutral-700 mb-1">
                        Subcarpeta de Encuentro / Jornada *
                      </label>
                      <input
                        id="photo-match"
                        type="text"
                        value={matchLabel}
                        onChange={(e) => setMatchLabel(e.target.value)}
                        placeholder="Ej: Fecha 1 · Medicina vs Kinesiología"
                        className="w-full border border-neutral-300 px-3 py-2.5 text-sm focus:outline-none focus:border-[#707ef9]"
                      />
                    </div>

                    <div>
                      <label htmlFor="photo-season" className="block text-xs font-medium text-neutral-700 mb-1">
                        Temporada
                      </label>
                      <input
                        id="photo-season"
                        type="text"
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                        placeholder="2026"
                        className="w-full border border-neutral-300 px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:border-[#707ef9]"
                      />
                    </div>
                  </div>

                  {/* Live Drive Folder Path Preview */}
                  <div className="bg-[#f5f6f8] border border-neutral-200 px-4 py-3 text-xs">
                    <span className="text-neutral-500 uppercase tracking-wider font-bold block mb-1">
                      Ruta destino automática en Google Drive:
                    </span>
                    <span className="font-mono text-[#0d0d0d] break-all">{computedDrivePath}</span>
                  </div>

                  {/* Real Image File Picker */}
                  <div className="space-y-3">
                    <label
                      htmlFor="photo-file-input"
                      className="flex flex-col items-center justify-center border border-dashed border-neutral-400 bg-[#f5f6f8] p-6 text-center cursor-pointer hover:border-[#707ef9]"
                    >
                      <Upload className="w-6 h-6 text-[#707ef9] mb-2" />
                      <span className="text-sm font-medium text-[#0d0d0d]">
                        {selectedFile
                          ? `Archivo listo: ${selectedFile.name}`
                          : 'Seleccionar fotografía original (JPG / PNG / WebP)'}
                      </span>
                      <span className="text-xs text-neutral-500 mt-1">
                        Se sube en resolución original a Google Drive y se indexa automáticamente en
                        la galería oficial
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
                      <div className="border border-neutral-200 overflow-hidden bg-[#0d0d0d]">
                        <img
                          src={previewObjectUrl}
                          alt="Vista previa de fotografía a subir a Google Drive"
                          className="w-full max-h-72 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t border-neutral-200">
                    <button
                      type="submit"
                      disabled={uploading || !state.driveUploadRootFolderId}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-sm cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>
                        {uploading
                          ? 'Subiendo a Google Drive...'
                          : 'Subir a Google Drive y publicar'}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de fotografía"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <div className="max-w-4xl w-full bg-[#0d0d0d] border border-white/15 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/10 text-white">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold uppercase truncate">
                  {lightboxPhoto.title}
                </p>
                <p className="text-xs text-neutral-400 truncate">{lightboxPhoto.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lightboxPhoto.externalUrl && (
                  <a
                    href={lightboxPhoto.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-[#707ef9] text-xs text-white"
                  >
                    <span>Ver original</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  aria-label="Cerrar vista ampliada"
                  className="p-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
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
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Dialog before Deleting from Google Drive + Firestore */}
      <ConfirmDialog
        open={pendingDeletePhoto !== null}
        title="Eliminar fotografía del archivo oficial"
        description={
          pendingDeletePhoto?.driveFileId
            ? `Esta acción eliminará «${pendingDeletePhoto.title}» del índice web y enviará el archivo a la papelera de Google Drive.`
            : `Esta acción eliminará «${pendingDeletePhoto?.title ?? ''}» del índice web oficial.`
        }
        details={
          pendingDeletePhoto
            ? [
                `Título: ${pendingDeletePhoto.title}`,
                `Ruta / Encuentro: ${pendingDeletePhoto.driveFolderPath || pendingDeletePhoto.matchLabel}`,
                `Autor: ${pendingDeletePhoto.photographerName}`,
              ]
            : []
        }
        confirmLabel="Confirmar eliminación"
        loading={deletingPhoto}
        onConfirm={() => void confirmAndDeletePhoto()}
        onCancel={() => setPendingDeletePhoto(null)}
      />
    </div>
  );
}
