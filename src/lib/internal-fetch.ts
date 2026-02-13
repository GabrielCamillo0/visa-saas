// src/lib/internal-fetch.ts
type Opts = { timeoutMs?: number; headers?: Record<string,string>; body?: any };

export async function postJSON(path: string, opts: Opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  try {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opts.headers ?? {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      // Important in Next dev: don't mix both cache controls
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || res.statusText || "Request failed";
      throw new Error(`${res.status} ${msg}`);
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}
