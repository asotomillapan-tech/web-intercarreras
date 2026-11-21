import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

interface FirebaseConfigFile {
  projectId: string;
}

function loadFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  const candidatePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
  ];
  for (const configPath of candidatePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw) as FirebaseConfigFile;
        if (parsed.projectId) {
          return parsed.projectId;
        }
      }
    } catch {
      // Fall through to next candidate path
    }
  }
  return 'gen-lang-client-0001236669';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();

// ---------------------------------------------------------------------------
// Cryptographic Firebase ID Token Verification (Zero IAM required)
// ---------------------------------------------------------------------------

interface VerifiedTokenPayload {
  sub: string;
  uid: string;
  email?: string;
  email_verified?: boolean;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

let cachedCerts: Record<string, string> = {};
let cachedCertsExpiresAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < cachedCertsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('No se pudieron obtener las llaves públicas de Firebase Auth.');
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await res.json()) as Record<string, string>;
  cachedCertsExpiresAt = now + maxAgeSec * 1000;
  return cachedCerts;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(padded, 'base64');
  return JSON.parse(buf.toString('utf-8')) as T;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedTokenPayload> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('Firebase projectId no está configurado en el servidor.');
  }
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token de autenticación inválido.');
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Algoritmo o identificador de llave JWT no válido.');
  }

  const certs = await getFirebasePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Certificado de firma Firebase no reconocido.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureBuf = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const isValidSig = verifier.verify(certPem, signatureBuf);
  if (!isValidSig) {
    throw new Error('Firma criptográfica del token Firebase inválida.');
  }

  const payload = decodeBase64UrlJson<VerifiedTokenPayload>(payloadB64);
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('Audiencia de token Firebase no coincide con el proyecto.');
  }
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error('Emisor de token Firebase inválido.');
  }
  if (!payload.sub || payload.sub.length > 128) {
    throw new Error('Identificador de usuario inválido en el token.');
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('La sesión expiró. Vuelve a iniciar sesión con Google.');
  }
  if (payload.email_verified !== true) {
    throw new Error('Se requiere una cuenta Google con correo verificado.');
  }

  return { ...payload, uid: payload.sub };
}

async function requireFirebaseAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Autenticación requerida. Inicia sesión con tu cuenta Google autorizada.',
    });
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const verified = await verifyFirebaseIdToken(token);
    (req as express.Request & { firebaseUser?: VerifiedTokenPayload }).firebaseUser = verified;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token de sesión inválido.';
    res.status(401).json({ error: message });
  }
}

// ---------------------------------------------------------------------------
// Gemini Client & Scoresheet Comparison Helper
// ---------------------------------------------------------------------------

interface AiScoresheetResult {
  homeScoreDetected: number;
  awayScoreDetected: number;
  periodBreakdown: Array<{ home: number; away: number }>;
  detectedEvents: string[];
  confidence: 'alta' | 'media' | 'baja';
  discrepancies: string[];
  requiresManualReview: boolean;
  summary: string;
}

function compareScoresheetWithLive(
  live: { homeScore: number; awayScore: number },
  ai: AiScoresheetResult
): { matchesLive: boolean; discrepancies: string[]; requiresManualReview: boolean } {
  const discrepancies = [...ai.discrepancies];
  const matchesLive =
    live.homeScore === ai.homeScoreDetected && live.awayScore === ai.awayScoreDetected;

  if (!matchesLive) {
    discrepancies.push(
      `Diferencia de marcador: en vivo (${live.homeScore}-${live.awayScore}) vs planilla detectada (${ai.homeScoreDetected}-${ai.awayScoreDetected}).`
    );
  }
  const requiresManualReview =
    !matchesLive || ai.confidence !== 'alta' || discrepancies.length > 0 || ai.requiresManualReview;

  return { matchesLive, discrepancies, requiresManualReview };
}

function createGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está configurada en el entorno del servidor.');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Express API Factory (shared by Vercel Serverless Functions and server.ts)
// ---------------------------------------------------------------------------

export function createApiApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '15mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health check endpoint for Vercel / Cloud Run / hosting probes
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: IS_PRODUCTION ? 'production' : 'development',
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
      projectId: FIREBASE_PROJECT_ID || null,
      timestamp: new Date().toISOString(),
    });
  });

  // Google Drive Public & Authenticated Folder Browser (2025 & 2026 Archives)
  app.get('/api/drive/folder/:folderId', async (req, res) => {
    const folderId = req.params.folderId;
    if (!/^[a-zA-Z0-9_-]{10,80}$/.test(folderId)) {
      res.status(400).json({ error: 'Identificador de carpeta de Google Drive inválido.' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
        const fields = encodeURIComponent(
          'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink)'
        );
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=100&orderBy=folder,name`,
          {
            headers: { Authorization: authHeader },
          }
        );
        if (driveRes.ok) {
          const payload = (await driveRes.json()) as {
            files?: Array<{
              id: string;
              name: string;
              mimeType: string;
              modifiedTime?: string;
              webViewLink?: string;
              thumbnailLink?: string;
            }>;
          };
          const items = (payload.files ?? []).map((f) => {
            const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
            return {
              id: f.id,
              name: f.name,
              isFolder,
              webViewLink:
                f.webViewLink ||
                (isFolder
                  ? `https://drive.google.com/drive/folders/${f.id}`
                  : `https://drive.google.com/file/d/${f.id}/view`),
              thumbnailUrl: isFolder
                ? undefined
                : `https://lh3.googleusercontent.com/d/${f.id}=w600`,
              imageUrl: isFolder
                ? undefined
                : `https://lh3.googleusercontent.com/d/${f.id}=w1600`,
              modifiedDate: f.modifiedTime ? f.modifiedTime.slice(0, 10) : undefined,
            };
          });
          res.json({ folderId, source: 'drive_api_v3', items });
          return;
        }
      } catch (err) {
        console.warn('Drive API v3 fallback to public view:', err);
      }
    }

    try {
      const publicRes = await fetch(
        `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IntercarrerasUFRO/1.0)',
          },
        }
      );
      if (!publicRes.ok) {
        throw new Error(`Google Drive respondió con estado ${publicRes.status}`);
      }
      const html = await publicRes.text();
      const entryRegex =
        /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>(?:[\s\S]*?<div class="flip-entry-last-modified"><div>([^<]*)<\/div>)?/g;

      const items: Array<{
        id: string;
        name: string;
        isFolder: boolean;
        webViewLink: string;
        thumbnailUrl?: string;
        imageUrl?: string;
        modifiedDate?: string;
      }> = [];

      let match: RegExpExecArray | null;
      while ((match = entryRegex.exec(html)) !== null) {
        const [, id, href, rawTitle, rawDate] = match;
        const name = rawTitle
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .trim();
        const isFolder = href.includes('/drive/folders/');
        items.push({
          id,
          name,
          isFolder,
          webViewLink: href,
          thumbnailUrl: isFolder ? undefined : `https://lh3.googleusercontent.com/d/${id}=w600`,
          imageUrl: isFolder ? undefined : `https://lh3.googleusercontent.com/d/${id}=w1600`,
          modifiedDate: rawDate?.trim() || undefined,
        });
      }

      res.json({ folderId, source: 'public_folder', items });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error consultando Google Drive.';
      res.status(502).json({
        error: `No se pudo leer la carpeta de Google Drive: ${message}`,
      });
    }
  });

  // Protected Server-Side Gemini Vision Scoresheet Validation (Requires Verified Firebase Auth ID Token)
  app.post('/api/ai/validate-scoresheet', requireFirebaseAuth, async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType,
        disciplineName,
        sportType,
        homeTeamName,
        awayTeamName,
        liveHomeScore,
        liveAwayScore,
      } = req.body as {
        imageBase64: string;
        mimeType: string;
        disciplineName: string;
        sportType: string;
        homeTeamName: string;
        awayTeamName: string;
        liveHomeScore: number;
        liveAwayScore: number;
      };

      if (!imageBase64 || !mimeType) {
        res.status(400).json({ error: 'Debes adjuntar una fotografía válida de la planilla.' });
        return;
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const ai = createGeminiClient();

      const promptText = [
        'Eres el asistente oficial de validación arbitral del Campeonato Intercarreras de la Universidad de La Frontera (UFRO).',
        'Analiza la fotografía adjunta de la planilla oficial del partido:',
        `- Disciplina: ${disciplineName} (tipo: ${sportType})`,
        `- Equipo Local: ${homeTeamName}`,
        `- Equipo Visitante: ${awayTeamName}`,
        `- Marcador registrado en vivo por el árbitro: ${homeTeamName} ${liveHomeScore} - ${liveAwayScore} ${awayTeamName}`,
        '',
        'Instrucciones estrictas:',
        '1. Lee cuidadosamente los puntajes totales finales (en Voleibol reporta SETS ganados en homeScoreDetected/awayScoreDetected y los puntos de cada set en periodBreakdown).',
        '2. Extrae los parciales (tiempos, cuartos o sets) si aparecen en la imagen.',
        '3. Extrae eventos relevantes visibles (goles, tarjetas amarillas/rojas, triples, faltas, firmas de capitanes o árbitro).',
        '4. Detecta errores aritméticos, tachaduras, firmas faltantes o diferencias entre la planilla y el marcador en vivo.',
        '5. Si la imagen es borrosa, ilegible, incompleta o tiene discrepancias, marca confidence como "media" o "baja" y requiresManualReview en true.',
        '6. Responde exclusivamente en español claro y conciso.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              homeScoreDetected: {
                type: Type.INTEGER,
                description: 'Marcador final del equipo local leído en la planilla.',
              },
              awayScoreDetected: {
                type: Type.INTEGER,
                description: 'Marcador final del equipo visitante leído en la planilla.',
              },
              periodBreakdown: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    home: { type: Type.INTEGER },
                    away: { type: Type.INTEGER },
                  },
                },
              },
              detectedEvents: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              confidence: {
                type: Type.STRING,
                description: 'Nivel de confianza: alta, media o baja.',
              },
              discrepancies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              requiresManualReview: { type: Type.BOOLEAN },
              summary: { type: Type.STRING },
            },
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson) as AiScoresheetResult;

      const normalizedConfidence: 'alta' | 'media' | 'baja' =
        parsed.confidence === 'alta' || parsed.confidence === 'media' || parsed.confidence === 'baja'
          ? parsed.confidence
          : 'media';

      const aiResult: AiScoresheetResult = {
        homeScoreDetected: Number.isFinite(parsed.homeScoreDetected)
          ? parsed.homeScoreDetected
          : liveHomeScore,
        awayScoreDetected: Number.isFinite(parsed.awayScoreDetected)
          ? parsed.awayScoreDetected
          : liveAwayScore,
        periodBreakdown: Array.isArray(parsed.periodBreakdown) ? parsed.periodBreakdown : [],
        detectedEvents: Array.isArray(parsed.detectedEvents) ? parsed.detectedEvents : [],
        confidence: normalizedConfidence,
        discrepancies: Array.isArray(parsed.discrepancies) ? parsed.discrepancies : [],
        requiresManualReview: Boolean(parsed.requiresManualReview),
        summary: parsed.summary || 'Análisis de planilla completado.',
      };

      const comparison = compareScoresheetWithLive(
        { homeScore: liveHomeScore, awayScore: liveAwayScore },
        aiResult
      );

      res.json({
        ...aiResult,
        discrepancies: comparison.discrepancies,
        requiresManualReview: comparison.requiresManualReview,
        matchesLive: comparison.matchesLive,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error inesperado procesando la planilla con IA.';
      console.error('Scoresheet AI validation error:', err);
      res.status(500).json({
        error: `No se pudo procesar la planilla automáticamente: ${message}. Puedes completar la validación manual del árbitro.`,
      });
    }
  });

  // Return clean JSON 404 for unknown /api/* paths
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  return app;
}

const app = createApiApp();
export default app;
