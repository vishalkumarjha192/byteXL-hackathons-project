const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

const store = {
  get access() { return localStorage.getItem("access_token"); },
  get refresh() { return localStorage.getItem("refresh_token"); },
  set(a: string, r: string) { localStorage.setItem("access_token", a); localStorage.setItem("refresh_token", r); },
  clear() { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); },
};
export const tokens = store;

async function raw(path: string, method: string, body?: unknown, token?: string | null) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { throw new ApiError("NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.", 0); });
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function tryRefresh(): Promise<boolean> {
  if (!store.refresh) return false;
  const { res, json } = await raw("/auth/refresh", "POST", { refresh_token: store.refresh });
  if (!res.ok) { store.clear(); return false; }
  store.set(json.data.access_token, json.data.refresh_token);
  return true;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  let { res, json } = await raw(path, method, opts.body, store.access);
  if (res.status === 401 && store.refresh && (await tryRefresh())) {
    ({ res, json } = await raw(path, method, opts.body, store.access));
  }
  if (!res.ok || !json?.success) {
    const e = json?.error;
    const detail = e?.details?.[0] ? `${e.details[0].field}: ${e.details[0].message}` : e?.message;
    throw new ApiError(e?.code ?? "UNKNOWN", detail ?? "Something went wrong", res.status);
  }
  return json.data as T;
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && u.set(k, String(v)));
  const s = u.toString();
  return s ? `?${s}` : "";
};

/** Browsers cannot report upload progress with fetch, so uploads use XMLHttpRequest. Same refresh-on-401 behaviour as api(). */
export function uploadFile(file: File, opts: { purpose: string; projectId?: string; onProgress?: (pct: number) => void }): Promise<import("./types").UploadedFile> {
  const send = (token: string | null) => new Promise<{ status: number; json: any }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/files`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => { let json = null; try { json = JSON.parse(xhr.responseText); } catch { /* not json */ } resolve({ status: xhr.status, json }); };
    xhr.onerror = () => reject(new ApiError("NETWORK_ERROR", "Upload failed. Check your connection and try again.", 0));
    const form = new FormData();
    form.append("purpose", opts.purpose);
    if (opts.projectId) form.append("project_id", opts.projectId);
    form.append("file", file);
    xhr.send(form);
  });
  return (async () => {
    let r = await send(store.access);
    if (r.status === 401 && store.refresh && (await tryRefresh())) r = await send(store.access);
    if (r.status >= 300 || !r.json?.success) {
      const e = r.json?.error;
      throw new ApiError(e?.code ?? "UNKNOWN", e?.details?.[0]?.message ?? e?.message ?? "Upload failed", r.status);
    }
    return r.json.data;
  })();
}

export const wsUrl = (path: string) => (BASE.startsWith("http") ? BASE.replace(/^http/, "ws") : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${BASE}`) + path;
