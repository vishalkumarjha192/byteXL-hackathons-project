import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { commsApi } from "./api";
import type { Notification } from "@/lib/types";

const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", page], queryFn: () => commsApi.notifications(page), placeholderData: (p) => p });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["unread-count"] }); };
  const settings = useQuery({ queryKey: ["me-settings"], queryFn: () => api<{ email_notifications: boolean }>("/users/me") });
  const toggle = useMutation({ mutationFn: (v: boolean) => api("/users/me", { method: "PATCH", body: { email_notifications: v } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["me-settings"] }) });
  const readAll = useMutation({ mutationFn: commsApi.markAllRead, onSuccess: refresh });
  const open = async (n: Notification) => {
    if (!n.is_read) { await commsApi.markRead(n.id).catch(() => undefined); refresh(); }
    if (n.link) nav(n.link);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <Button variant="outline" disabled={!q.data?.unread_count} loading={readAll.isPending} onClick={() => readAll.mutate()}>Mark all as read</Button>
      </div>
      {settings.data && (
        <label className="mt-4 flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="h-4 w-4" checked={settings.data.email_notifications} onChange={(e) => toggle.mutate(e.target.checked)} />Also email me about important updates</label>
      )}
      <div className="mt-6 space-y-2">
        {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
          : q.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          : q.data?.items.length === 0 ? <EmptyState title="You are all caught up" hint="Applications, messages, revisions and reviews will show up here." />
          : q.data?.items.map((n) => (
            <button key={n.id} onClick={() => open(n)} className="block w-full text-left">
              <Card className={`flex items-start gap-3 p-4 hover:bg-mist ${n.is_read ? "" : "border-brand/40"}`}>
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-brand"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-3"><span className={n.is_read ? "font-medium" : "font-semibold"}>{n.title}{!n.is_read && <span className="sr-only"> (unread)</span>}</span><span className="shrink-0 text-xs text-muted">{when(n.created_at)}</span></span>
                  <span className="mt-0.5 block text-sm text-muted">{n.message}</span>
                </span>
              </Card>
            </button>
          ))}
      </div>
      <Pagination page={page} total={q.data?.total ?? 0} pageSize={20} onChange={setPage} />
    </div>
  );
}
