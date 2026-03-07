const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...rest } = options ?? {};

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  const json = await res.json();

  if (!json.success) {
    const err = new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
    (err as any).status = res.status;
    throw err;
  }

  return json.data as T;
}
