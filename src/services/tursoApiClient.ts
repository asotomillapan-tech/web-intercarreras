import { getFirebaseIdToken } from './firebaseAuth';

async function buildHeaders(requiresAuth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getFirebaseIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (requiresAuth) {
    throw new Error('Debes iniciar sesión con tu cuenta Google para realizar esta acción.');
  }
  return headers;
}

export async function tursoRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    requiresAuth?: boolean;
  } = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = await buildHeaders(Boolean(options.requiresAuth));

  const res = await fetch(`/api/db${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const errMsg =
      (parsed && typeof parsed.error === 'string' && parsed.error) ||
      `Error de base de datos Turso (${res.status})`;
    throw new Error(errMsg);
  }

  return (parsed ?? {}) as T;
}
