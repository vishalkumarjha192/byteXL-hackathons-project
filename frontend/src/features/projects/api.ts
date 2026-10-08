import { api } from "@/lib/api";
import type { Application, MyProject, Workspace } from "@/lib/types";

const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: "POST", body });

export const workflowApi = {
  myProjects: () => api<{ role: string; items: MyProject[] }>("/projects/mine"),
  myApplications: () => api<Application[]>("/applications/mine"),
  projectApplications: (id: string) => api<Application[]>(`/applications/project/${id}`),
  apply: (body: Record<string, unknown>) => post("/applications", body),
  accept: (id: string) => post(`/applications/${id}/accept`),
  reject: (id: string) => post(`/applications/${id}/reject`),
  withdraw: (id: string) => post(`/applications/${id}/withdraw`),
  workspace: (id: string) => api<Workspace>(`/projects/${id}/workspace`),
  submitDeliverable: (body: Record<string, unknown>) => post("/deliverables", body),
  requestRevision: (body: Record<string, unknown>) => post("/revisions", body),
  approve: (id: string) => post(`/projects/${id}/approve`),
  complete: (id: string) => post(`/projects/${id}/complete`),
  cancel: (id: string) => post(`/projects/${id}/cancel`),
};
