/**
 * Pure team crest (escudo) processor:
 * - Sanitizes uploaded SVG files (blocking scripts, event handlers, foreignObject, javascript: URIs).
 * - Removes solid/near-white outer backgrounds using edge-connected BFS flood fill + soft edge feathering
 *   so interior white crest details (stripes, stars, lettering) remain crisp and intact!
 * - Resizes raster crests to <= 256x256 PNG data URIs guaranteed to fit Firestore limits (<= 150 KB).
 */

export const MAX_CREST_DATA_URL_LENGTH = 150000;
export const DEFAULT_WHITE_THRESHOLD = 235;

export interface CrestProcessResult {
  ok: boolean;
  dataUrl?: string;
  format?: 'png' | 'svg';
  removedBackground?: boolean;
  error?: string;
}

/**
 * Strictly sanitizes raw SVG markup and encodes it as a safe data:image/svg+xml;base64 URI.
 */
export function sanitizeSvgMarkup(rawSvg: string): CrestProcessResult {
  const trimmed = rawSvg.trim();
  if (!trimmed || !/<svg[\s>]/i.test(trimmed)) {
    return {
      ok: false,
      error: 'El archivo SVG no contiene una etiqueta <svg> válida.',
    };
  }

  // Strip XML processing instructions, DOCTYPE, comments, scripts, foreignObject, iframe, embed, object
  let cleaned = trimmed
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*\/?>/gi, '');

  // Strip inline event handlers (onclick=, onload=, onerror=, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript: / vbscript: / data:text/html URIs in href or xlink:href
  cleaned = cleaned.replace(
    /\s+(?:xlink:)?href\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi,
    ''
  );

  // Strip url(javascript:...) inside style attributes
  cleaned = cleaned.replace(/javascript\s*:/gi, '');

  if (!/<svg[\s>]/i.test(cleaned) || !/<\/svg>/i.test(cleaned)) {
    return {
      ok: false,
      error: 'El archivo SVG fue rechazado tras la sanitización de seguridad.',
    };
  }

  // Encode UTF-8 safely to base64 (works in both browser and Node)
  let base64 = '';
  try {
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(cleaned, 'utf-8').toString('base64');
    } else {
      const bytes = new TextEncoder().encode(cleaned);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = btoa(binary);
    }
  } catch {
    return {
      ok: false,
      error: 'No se pudo codificar el archivo SVG.',
    };
  }

  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  if (dataUrl.length > MAX_CREST_DATA_URL_LENGTH) {
    return {
      ok: false,
      error: 'El archivo SVG excede el peso máximo permitido (110 KB). Optimízalo o expórtalo como PNG.',
    };
  }

  return {
    ok: true,
    dataUrl,
    format: 'svg',
    removedBackground: false,
  };
}

/**
 * Pure pixel buffer white-background remover using 4-connected BFS flood fill starting from the image border.
 * Preserves interior white regions (such as white stripes, stars, or text enclosed inside a dark shield border),
 * while making the outer white background fully transparent and gently feathering immediate anti-aliased edge pixels.
 */
export function removeWhiteBackgroundFromPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number = DEFAULT_WHITE_THRESHOLD
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  if (width <= 0 || height <= 0 || out.length < width * height * 4) {
    return out;
  }

  const clampedThreshold = Math.max(180, Math.min(254, Math.trunc(threshold)));
  const featherFloor = Math.max(150, clampedThreshold - 32);
  const maxChromaDiff = 28; // White/light-gray neutral pixels have low RGB channel spread

  const isNearWhite = (idx4: number, minLum: number): boolean => {
    const a = out[idx4 + 3];
    if (a === 0) return true;
    const r = out[idx4];
    const g = out[idx4 + 1];
    const b = out[idx4 + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return minC >= minLum && maxC - minC <= maxChromaDiff;
  };

  const total = width * height;
  const visited = new Uint8Array(total);
  const removed = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueueIfBg = (x: number, y: number) => {
    const pos = y * width + x;
    if (visited[pos]) return;
    if (isNearWhite(pos * 4, clampedThreshold)) {
      visited[pos] = 1;
      queue[tail++] = pos;
    }
  };

  // Seed flood-fill from all 4 outer borders
  for (let x = 0; x < width; x++) {
    enqueueIfBg(x, 0);
    enqueueIfBg(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueueIfBg(0, y);
    enqueueIfBg(width - 1, y);
  }

  while (head < tail) {
    const pos = queue[head++];
    removed[pos] = 1;
    out[pos * 4 + 3] = 0; // Make fully transparent

    const x = pos % width;
    const y = (pos - x) / width;

    if (x > 0) enqueueIfBg(x - 1, y);
    if (x < width - 1) enqueueIfBg(x + 1, y);
    if (y > 0) enqueueIfBg(x, y - 1);
    if (y < height - 1) enqueueIfBg(x, y + 1);
  }

  // Soft 1-pixel anti-alias edge feathering on boundary pixels touching removed background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x;
      if (removed[pos]) continue;

      const touchesRemoved =
        (x > 0 && removed[pos - 1]) ||
        (x < width - 1 && removed[pos + 1]) ||
        (y > 0 && removed[pos - width]) ||
        (y < height - 1 && removed[pos + width]);

      if (!touchesRemoved) continue;

      const idx4 = pos * 4;
      const r = out[idx4];
      const g = out[idx4 + 1];
      const b = out[idx4 + 2];
      const a = out[idx4 + 3];
      if (a === 0) continue;

      const minC = Math.min(r, g, b);
      const maxC = Math.max(r, g, b);
      if (minC >= featherFloor && maxC - minC <= maxChromaDiff + 12) {
        const ratio = (clampedThreshold - minC) / Math.max(1, clampedThreshold - featherFloor);
        const clampedRatio = Math.max(0, Math.min(1, ratio));
        out[idx4 + 3] = Math.round(a * clampedRatio);
      }
    }
  }

  return out;
}

/**
 * Browser helper: renders an uploaded raster image (PNG/JPG/WebP) onto an offscreen canvas,
 * optionally strips the outer white background into transparency, and outputs a crisp <= 256x256 PNG.
 */
export async function processCrestImageFile(
  file: File,
  options: { removeWhiteBg: boolean; threshold?: number }
): Promise<CrestProcessResult> {
  if (!file) {
    return { ok: false, error: 'No se seleccionó ningún archivo.' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'El archivo excede el límite de 5 MB.' };
  }

  const lowerName = file.name.toLowerCase();
  const isSvg = file.type === 'image/svg+xml' || lowerName.endsWith('.svg');

  if (isSvg) {
    const rawText = await file.text();
    return sanitizeSvgMarkup(rawText);
  }

  if (!file.type.startsWith('image/')) {
    return {
      ok: false,
      error: 'Formato no soportado. Usa PNG (con o sin transparencia), SVG, JPG o WebP.',
    };
  }

  return new Promise<CrestProcessResult>((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: 'No se pudo leer el archivo de imagen.' });
    reader.onload = () => {
      const srcUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () =>
        resolve({ ok: false, error: 'La imagen está dañada o no se puede decodificar.' });
      img.onload = () => {
        try {
          const tryEncode = (maxDim: number): string => {
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
            const targetW = Math.max(1, Math.round(img.width * scale));
            const targetH = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('Canvas no disponible');

            ctx.clearRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);

            if (options.removeWhiteBg) {
              const imageData = ctx.getImageData(0, 0, targetW, targetH);
              const cleaned = removeWhiteBackgroundFromPixels(
                imageData.data,
                targetW,
                targetH,
                options.threshold ?? DEFAULT_WHITE_THRESHOLD
              );
              imageData.data.set(cleaned);
              ctx.putImageData(imageData, 0, 0);
            }

            return canvas.toDataURL('image/png');
          };

          // Start at 256px max side; step down only if PNG exceeds Firestore 150 KB cap
          let dataUrl = tryEncode(256);
          if (dataUrl.length > MAX_CREST_DATA_URL_LENGTH) {
            dataUrl = tryEncode(192);
          }
          if (dataUrl.length > MAX_CREST_DATA_URL_LENGTH) {
            dataUrl = tryEncode(144);
          }
          if (dataUrl.length > MAX_CREST_DATA_URL_LENGTH) {
            resolve({
              ok: false,
              error: 'El escudo procesado es demasiado pesado. Prueba con un archivo PNG o SVG más liviano.',
            });
            return;
          }

          resolve({
            ok: true,
            dataUrl,
            format: 'png',
            removedBackground: options.removeWhiteBg,
          });
        } catch {
          resolve({ ok: false, error: 'Error al procesar el escudo en el navegador.' });
        }
      };
      img.src = srcUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Re-processes an already loaded data URL (e.g. when the delegate adjusts the white-removal toggle or threshold).
 */
export async function reprocessCrestDataUrl(
  rawDataUrl: string,
  options: { removeWhiteBg: boolean; threshold?: number }
): Promise<CrestProcessResult> {
  if (rawDataUrl.startsWith('data:image/svg+xml')) {
    return {
      ok: true,
      dataUrl: rawDataUrl,
      format: 'svg',
      removedBackground: false,
    };
  }

  return new Promise<CrestProcessResult>((resolve) => {
    const img = new Image();
    img.onerror = () => resolve({ ok: false, error: 'No se pudo reprocesar el escudo.' });
    img.onload = () => {
      try {
        const scale = Math.min(1, 256 / Math.max(img.width, img.height, 1));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ ok: false, error: 'Canvas no disponible.' });
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        if (options.removeWhiteBg) {
          const imageData = ctx.getImageData(0, 0, targetW, targetH);
          const cleaned = removeWhiteBackgroundFromPixels(
            imageData.data,
            targetW,
            targetH,
            options.threshold ?? DEFAULT_WHITE_THRESHOLD
          );
          imageData.data.set(cleaned);
          ctx.putImageData(imageData, 0, 0);
        }

        const dataUrl = canvas.toDataURL('image/png');
        resolve({
          ok: true,
          dataUrl,
          format: 'png',
          removedBackground: options.removeWhiteBg,
        });
      } catch {
        resolve({ ok: false, error: 'Error aplicando transparencia al escudo.' });
      }
    };
    img.src = rawDataUrl;
  });
}
