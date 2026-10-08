import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "@/App";
import { AuthProvider } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { lookups, page } from "./fixtures";

export interface Call { method: string; path: string; query: URLSearchParams; body: any }
type Result = unknown | { __status: number; error: { code: string; message: string } };
type Handler = (call: Call) => Result;
export const failure = (status: number, code: string, message: string) => ({ __status: status, error: { code, message } });

/** Replaces fetch with an in-memory API. Unmocked requests fail the test loudly instead of silently passing. */
export function mockApi(routes: Record<string, Handler | Result> = {}) {
  const calls: Call[] = [];
  const table: Record<string, Handler | Result> = {
    "GET /notifications/unread-count": { unread_count: 0 },
    "GET /creators": page([]),
    "GET /creators/lookups": lookups,
    ...routes,
  };
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, "http://localhost");
    const method = init.method ?? "GET";
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const call: Call = { method, path, query: url.searchParams, body: init.body ? JSON.parse(init.body as string) : undefined };
    calls.push(call);
    const entry = table[`${method} ${path}`];
    if (entry === undefined) throw new Error(`Unmocked request: ${method} ${path}`);
    const out = typeof entry === "function" ? (entry as Handler)(call) : entry;
    if (out && typeof out === "object" && "__status" in (out as object)) {
      const f = out as { __status: number; error: object };
      return { ok: false, status: f.__status, json: async () => ({ success: false, error: f.error }) };
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data: out, message: "OK" }) };
  }));
  return { calls, find: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path) };
}

export function renderApp(route: string, opts: { as?: Role } = {}) {
  if (opts.as) localStorage.setItem("access_token", "test-token");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const user = userEvent.setup();
  const ui = (el: ReactElement) => (
    <QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}><AuthProvider>{el}</AuthProvider></MemoryRouter></QueryClientProvider>
  );
  return { user, ...render(ui(<App />)) };
}

export const me = (role: Role) => ({ id: `u-${role}`, email: `${role.toLowerCase()}@x.com`, role, is_verified: false });

export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) { FakeWebSocket.instances.push(this); setTimeout(() => this.onopen?.(), 0); }
  close() { this.onclose?.(); }
}
