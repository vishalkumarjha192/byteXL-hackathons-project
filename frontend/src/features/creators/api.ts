import { api, qs } from "@/lib/api";
import type { Creator, Lookups, Page, PortfolioItem } from "@/lib/types";

export const creatorsApi = {
  search: (p: Record<string, string | undefined>) => api<Page<Creator>>(`/creators${qs(p)}`),
  get: (id: string) => api<Creator>(`/creators/${id}`),
  portfolio: (id: string) => api<PortfolioItem[]>(`/creators/${id}/portfolio`),
  lookups: () => api<Lookups>("/creators/lookups"),
  me: () => api<Creator>("/creators/me"),
  update: (body: Record<string, unknown>) => api<Creator>("/creators/me", { method: "PATCH", body }),
  addPortfolio: (body: Record<string, unknown>) => api<PortfolioItem>("/creators/me/portfolio", { method: "POST", body }),
  deletePortfolio: (id: string) => api<null>(`/creators/me/portfolio/${id}`, { method: "DELETE" }),
};
