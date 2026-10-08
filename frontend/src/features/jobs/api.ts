import { api, qs } from "@/lib/api";
import type { Page, Project } from "@/lib/types";

export const jobsApi = {
  list: (p: Record<string, string | undefined>) => api<Page<Project>>(`/projects${qs(p)}`),
  get: (id: string) => api<Project>(`/projects/${id}`),
  create: (body: Record<string, unknown>) => api<Project>("/projects", { method: "POST", body }),
};
