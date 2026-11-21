import type { DriveNode } from '../types/tournament';

export const UFRO_DRIVE_2025_FOLDER_ID = '1whj-oFN-nWPOhZ3CT3tCyftRnJrwktU6';
export const UFRO_DRIVE_2025_URL =
  'https://drive.google.com/drive/folders/1whj-oFN-nWPOhZ3CT3tCyftRnJrwktU6?usp=drive_link';

/**
 * Exact discipline folder naming convention matching the official 2025 UFRO Drive archive.
 */
export const DRIVE_DISCIPLINE_FOLDER_MAP: Record<string, string> = {
  'f7-h-1': 'F7 Hombres Primera Div.',
  'f7-h-2': 'F7 Hombres Segunda Div.',
  'f7-h-3': 'F7 Hombres Tercera Div.',
  'f7-m': 'F7 Mujeres',
  'basquet-h': 'Básquet 5x5 Hombres',
  'basquet-3x3-m': 'Básquet 3x3 Mujeres',
  'voley-m': 'Voley Mujeres',
  'voley-h': 'Voley Hombres',
  'premiacion-futbol': 'Premiación Fútbol',
  'premiacion-basquet': 'Premiación Básquet',
  'premiacion-voley': 'Premiación Voleibol',
};

/**
 * Exact tournament stage subfolder naming matching the official 2025 UFRO Drive archive.
 */
export const DRIVE_STAGE_FOLDERS: string[] = [
  '1. FASE DE GRUPOS',
  '2. OCTAVOS DE FINAL',
  '3. CUARTOS DE FINAL',
  '4. SEMIFINAL',
  '5.- TERCER Y CUARTO',
  '5.- FINAL',
];

export interface DriveFolderResponse {
  folderId: string;
  source: 'drive_api_v3' | 'public_folder';
  items: DriveNode[];
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  imageUrl: string;
  thumbnailUrl: string;
  folderPath: string;
}

export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,80})/);
  if (urlMatch) return urlMatch[1];
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,80})/);
  if (idParam) return idParam[1];
  if (/^[a-zA-Z0-9_-]{10,80}$/.test(trimmed)) return trimmed;
  return null;
}

export async function fetchDriveFolderContents(
  folderId: string,
  accessToken?: string | null
): Promise<DriveFolderResponse> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`/api/drive/folder/${encodeURIComponent(folderId)}`, {
    headers,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo cargar la carpeta de Google Drive.');
  }
  return data as DriveFolderResponse;
}

function escapeDriveQueryValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function setPublicReadPermission(accessToken: string, fileId: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  ).catch(() => {
    // Non-fatal if organizational policy already inherits folder permissions
  });
}

export async function findOrCreateDriveSubfolder(
  accessToken: string,
  parentId: string | null,
  folderName: string
): Promise<{ id: string; name: string }> {
  const cleanName = folderName.trim().slice(0, 120);
  const qParts = [
    `name = '${escapeDriveQueryValue(cleanName)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ];
  if (parentId) {
    qParts.push(`'${escapeDriveQueryValue(parentId)}' in parents`);
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qParts.join(' and '))}&fields=files(id,name)&pageSize=5`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`No se pudo consultar Google Drive (${searchRes.status}): ${errText.slice(0, 180)}`);
  }
  const searchData = (await searchRes.json()) as { files?: Array<{ id: string; name: string }> };
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0];
  }

  const createBody: Record<string, unknown> = {
    name: cleanName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    createBody.parents = [parentId];
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    }
  );
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`No se pudo crear la carpeta «${cleanName}» en Google Drive (${createRes.status}): ${errText.slice(0, 180)}`);
  }
  const created = (await createRes.json()) as { id: string; name: string };
  await setPublicReadPermission(accessToken, created.id);
  return created;
}

export async function createDriveSeasonRootFolder(
  accessToken: string,
  season: string
): Promise<{ id: string; name: string }> {
  const folderName = `Campeonato Intercarreras UFRO ${season}`;
  return findOrCreateDriveSubfolder(accessToken, null, folderName);
}

/**
 * Uploads a photo directly to Google Drive under the exact 2025 hierarchy:
 * Root Folder -> Discipline Folder -> Stage Folder -> Match Folder -> Image File.
 */
export async function uploadPhotoToDriveHierarchy(params: {
  accessToken: string;
  rootFolderId: string;
  disciplineId: string;
  stageLabel: string;
  matchLabel: string;
  title: string;
  file: File;
}): Promise<DriveUploadResult> {
  const disciplineFolderName =
    DRIVE_DISCIPLINE_FOLDER_MAP[params.disciplineId] || params.disciplineId;
  const isPremiacion = params.disciplineId.startsWith('premiacion-');

  // 1. Discipline folder inside Root
  const discFolder = await findOrCreateDriveSubfolder(
    params.accessToken,
    params.rootFolderId,
    disciplineFolderName
  );

  // 2. Stage folder (skip stage subfolder for Premiación categories, matching 2025 Drive layout)
  let targetParent = discFolder;
  const pathParts = [disciplineFolderName];

  if (!isPremiacion && params.stageLabel.trim()) {
    const stageFolder = await findOrCreateDriveSubfolder(
      params.accessToken,
      discFolder.id,
      params.stageLabel.trim()
    );
    targetParent = stageFolder;
    pathParts.push(stageFolder.name);
  }

  // 3. Match / jornada folder
  const matchFolderName = params.matchLabel.trim().slice(0, 100);
  if (matchFolderName) {
    const matchFolder = await findOrCreateDriveSubfolder(
      params.accessToken,
      targetParent.id,
      matchFolderName
    );
    targetParent = matchFolder;
    pathParts.push(matchFolder.name);
  }

  // 4. Multipart upload of full-resolution image directly into targetParent
  const ext = params.file.name.includes('.')
    ? params.file.name.slice(params.file.name.lastIndexOf('.'))
    : '.jpg';
  const safeBaseName = params.title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 90);
  const finalFileName = `${safeBaseName}${ext}`;

  const metadata = {
    name: finalFileName,
    parents: [targetParent.id],
    description: `${pathParts.join(' / ')} — Campeonato Intercarreras UFRO`,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
  );
  form.append('file', params.file);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(
      `Google Drive rechazó la subida (${uploadRes.status}). Verifica que tu cuenta Google tenga permiso de editor en la carpeta destino. ${errText.slice(0, 160)}`
    );
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
  };

  await setPublicReadPermission(params.accessToken, uploaded.id);

  return {
    fileId: uploaded.id,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    imageUrl: `https://lh3.googleusercontent.com/d/${uploaded.id}=w1600`,
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${uploaded.id}=w600`,
    folderPath: pathParts.join(' / '),
  };
}

/**
 * Moves a file in Google Drive to trash. Must ONLY be called after explicit user confirmation.
 */
export async function trashDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`No se pudo enviar el archivo a la papelera de Google Drive (${res.status}).`);
  }
}

/**
 * Compresses an uploaded image file on a client-side canvas (used for player profile portraits).
 */
export function compressImageToDataUrl(
  file: File,
  maxDimension = 1000,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el compresor de imágenes.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
