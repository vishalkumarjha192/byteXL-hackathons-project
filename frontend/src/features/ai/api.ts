import { api } from "@/lib/api";

export interface Brief {
  title: string; hook: string; script: string; cta: string; deliverables: string[]; source: "template" | "ai";
  scenes: { time: string; visual: string; voiceover: string }[];
  suggested: { category: string; content_type: string; platform: string; language: string };
}
export interface CreatorMatch {
  id: string; display_name: string; avatar: string | null; verified: boolean; rating: number; review_count: number;
  starting_price: number | null; delivery_days: number | null; niches: string[]; languages: string[];
  match_score: number; reasons: string[]; warnings: string[];
}
export interface JobMatch {
  id: string; title: string; category: string; content_type: string; budget: number; currency: string; deadline: string | null;
  language: string | null; match_score: number; reasons: string[]; warnings: string[];
}

export const aiApi = {
  brief: (prompt: string) => api<Brief>("/ai/brief", { method: "POST", body: { prompt } }),
  matchCreators: (projectId: string) => api<CreatorMatch[]>(`/ai/match/${projectId}?limit=5`),
  recommendedJobs: () => api<JobMatch[]>("/ai/recommendations/projects?limit=5"),
};
