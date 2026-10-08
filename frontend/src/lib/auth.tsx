import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokens } from "./api";
import type { Role, User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (d: { email: string; password: string; role: Role; name: string }) => Promise<User>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokens.access);

  useEffect(() => {
    if (!tokens.access) return;
    api<User>("/auth/me").then(setUser).catch(() => tokens.clear()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const t = await api<{ access_token: string; refresh_token: string }>("/auth/login", { method: "POST", body: { email, password } });
    tokens.set(t.access_token, t.refresh_token);
    const me = await api<User>("/auth/me");
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (d: { email: string; password: string; role: Role; name: string }) => {
    await api("/auth/register", { method: "POST", body: d });
    return login(d.email, d.password);
  }, [login]);

  const logout = useCallback(() => { tokens.clear(); setUser(null); }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};
