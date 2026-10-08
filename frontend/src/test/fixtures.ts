import type { Creator, Lookups, Project, Workspace } from "@/lib/types";

const named = (...names: string[]) => names.map((name, i) => ({ id: i + 1, name }));
export const lookups: Lookups = {
  skills: named("AI UGC", "AI Video", "Product Ads"), niches: named("Beauty", "SaaS", "Fashion"),
  languages: named("English", "Hindi"), ai_tools: named("HeyGen", "Runway"),
};
export const page = <T,>(items: T[]) => ({ items, page: 1, page_size: 12, total: items.length });

export const creator = (o: Partial<Creator> = {}): Creator => ({
  id: "c1", display_name: "Aisha Verma", avatar: null, bio: "I make skincare UGC with HeyGen.", location: "Mumbai", starting_price: 3000, hourly_rate: 800,
  delivery_days: 3, rating: 4.8, review_count: 12, completed_projects: 15, verified: true, featured: false,
  skills: named("AI UGC"), niches: named("Beauty"), languages: named("English", "Hindi"), ai_tools: named("HeyGen"), ...o,
});

export const project = (o: Partial<Project> = {}): Project => ({
  id: "p1", brand_id: "b1", title: "30s skincare Reel", description: "Instagram reel for our serum launch", category: "AI UGC", content_type: "Reel",
  budget: 5000, currency: "INR", deadline: null, target_audience: null, language: "English", platform: "Instagram", status: "OPEN",
  created_at: "2026-10-01T10:00:00Z", video_duration: 30, style: null, deliverables: null, revisions: 2, assets: [], ...o,
});

export const workspace = (o: Partial<Omit<Workspace, "payment">> & { status?: string; payment?: string | null } = {}): Workspace => {
  const { status = "IN_PROGRESS", payment = "HELD", ...rest } = o;
  return {
    role: "BRAND", project: project({ status }), brand: { id: "b1", company_name: "Acme" }, creator: { id: "c1", display_name: "Aisha Verma", avatar: null },
    contract: { agreed_price: 5000, platform_fee: 1000, creator_amount: 4000, status: "ACTIVE" }, deliverables: [], revisions: [], reviews: [], can_review: false,
    brand_rating: { average: 0, total: 0 },
    payment: payment ? { status: payment, amount: 5000, platform_fee: 1000, creator_amount: 4000, currency: "INR" } : null, ...rest,
  };
};

export const emptyPayments = (role: "BRAND" | "CREATOR") => ({ role, items: [], payouts: [], summary: [], monthly: [] });
