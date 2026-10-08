export type Role = "BRAND" | "CREATOR" | "ADMIN";
export interface User { id: string; email: string; role: Role; is_verified: boolean }
export interface Named { id: number; name: string }
export interface Creator {
  id: string; display_name: string; avatar: string | null; bio: string | null; location: string | null;
  starting_price: number | null; hourly_rate: number | null; delivery_days: number | null;
  rating: number; review_count: number; completed_projects: number; verified: boolean; featured: boolean; verification_requested?: boolean;
  skills: Named[]; niches: Named[]; languages: Named[]; ai_tools: Named[];
}
export interface PortfolioItem {
  id: string; title: string; description: string | null; media_url: string;
  media_type: "IMAGE" | "VIDEO" | "LINK"; thumbnail_url: string | null; created_at: string;
}
export interface UploadedFile { id: string; filename: string; content_type: string; size: number; purpose: string; url: string | null; created_at: string }
export interface Project {
  id: string; brand_id: string; title: string; description: string; category: string; content_type: string;
  budget: number; currency: string; deadline: string | null; target_audience: string | null;
  language: string | null; platform: string | null; status: string; created_at: string;
  video_duration?: number | null; style?: string | null; deliverables?: string | null; revisions?: number;
  assets?: { id: string; file_type: string; file: UploadedFile }[];
}
export interface Page<T> { items: T[]; page: number; page_size: number; total: number }
export interface Lookups { skills: Named[]; niches: Named[]; languages: Named[]; ai_tools: Named[] }

export interface Application {
  id: string; project_id: string; proposal: string; proposed_price: number; delivery_days: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN"; created_at: string;
  project_title: string; project_status: string; currency: string;
  creator: { id: string; display_name: string; avatar: string | null; rating: number; verified: boolean; completed_projects: number };
}
export interface MyProject extends Project { pending_applications?: number }
export interface Workspace {
  role: "BRAND" | "CREATOR";
  project: Project;
  brand: { id: string; company_name: string };
  creator: { id: string; display_name: string; avatar: string | null } | null;
  contract: { agreed_price: number; platform_fee: number; creator_amount: number; status: string } | null;
  deliverables: { id: string; file_url: string; file: UploadedFile | null; kind: "DRAFT" | "FINAL"; note: string | null; version: number; status: string; created_at: string }[];
  revisions: { id: string; description: string; status: string; created_at: string }[];
  reviews: ReviewItem[];
  can_review: boolean;
  brand_rating: { average: number; total: number };
  payment: WorkspacePayment | null;
}

export interface Notification { id: string; type: string; title: string; message: string; link: string | null; is_read: boolean; created_at: string }
export interface ChatMessage { id: string; sender_id: string; sender_name: string; mine: boolean; message: string; attachment_url: string | null; attachment_file: UploadedFile | null; created_at: string; read_at: string | null }
export interface ReviewItem { id: string; rating: number; comment: string; created_at: string; reviewer_name: string; mine: boolean }

export interface PaymentSummary { currency: string; spent: number; in_escrow: number; earned: number; withdrawn: number; available: number }
export interface PaymentItem {
  id: string; project_id: string; project_title: string; amount: number; platform_fee: number; creator_amount: number;
  currency: string; status: string; created_at: string; released_at: string | null;
}
export interface PaymentsMine {
  role: "BRAND" | "CREATOR"; items: PaymentItem[]; summary: PaymentSummary[];
  payouts: { id: string; amount: number; currency: string; status: string; created_at: string }[];
  monthly: { month: string; currency: string; earned: number }[];
}
export interface WorkspacePayment { status: string; amount: number; platform_fee: number; creator_amount: number; currency: string }
