import { api } from "@/lib/api";
import type { ChatMessage, Notification, Page, ReviewItem } from "@/lib/types";

export const commsApi = {
  notifications: (page: number) => api<Page<Notification> & { unread_count: number }>(`/notifications?page=${page}&page_size=20`),
  unreadCount: () => api<{ unread_count: number }>("/notifications/unread-count"),
  markRead: (id: string) => api<null>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => api<null>("/notifications/read-all", { method: "POST" }),
  messages: (projectId: string) => api<ChatMessage[]>(`/messages/project/${projectId}`),
  send: (body: { project_id: string; message: string; attachment_file_id?: string }) => api<ChatMessage>("/messages", { method: "POST", body }),
  review: (body: { project_id: string; rating: number; comment: string }) => api<{ id: string }>("/reviews", { method: "POST", body }),
  creatorReviews: (id: string) => api<{ average: number; total: number; items: ReviewItem[] }>(`/reviews/creator/${id}`),
};
