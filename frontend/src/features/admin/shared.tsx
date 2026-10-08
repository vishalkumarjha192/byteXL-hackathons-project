import { useEffect, useRef, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui";
import { api, qs } from "@/lib/api";
import type { Page } from "@/lib/types";

export const PAGE_SIZE = 15;

export function useAdminList<T>(kind: string, params: Record<string, string | undefined>, page: number) {
  return useQuery({ queryKey: ["admin", kind, params, page], queryFn: () => api<Page<T>>(`/admin/${kind}${qs({ ...params, page, page_size: PAGE_SIZE })}`), placeholderData: (p) => p });
}

export function useAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method = "POST" }: { path: string; body?: unknown; method?: string }) => api(`/admin${path}`, { method, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export interface Col<T> { h: string; c: (r: T) => ReactNode }

export function DataTable<T extends { id: string }>({ q, cols, empty, page, onPage }: { q: UseQueryResult<Page<T>>; cols: Col<T>[]; empty: string; page: number; onPage: (p: number) => void }) {
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (!q.data?.items.length) return <EmptyState title={empty} hint="Try changing the filters." />;
  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr>{cols.map((c) => <th key={c.h} scope="col" className="px-4 py-3 font-medium">{c.h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {q.data.items.map((r) => <tr key={r.id}>{cols.map((c) => <td key={c.h} className="px-4 py-3 align-top">{c.c(r)}</td>)}</tr>)}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} total={q.data.total} pageSize={PAGE_SIZE} onChange={onPage} />
    </>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose; // callers pass a new function every render; the effect below must not re-run (it would steal focus while typing)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); prev?.focus(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-mist"><X className="h-5 w-5" /></button></div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const pretty = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function DetailModal({ kind, id, title, onClose }: { kind: string; id: string; title: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["admin", "detail", kind, id], queryFn: () => api<Record<string, unknown>>(`/admin/${kind}/${id}`) });
  return (
    <Modal title={title} onClose={onClose}>
      {q.isLoading ? <Skeleton className="h-40" /> : q.isError ? <ErrorState message={q.error.message} /> : (
        <dl className="divide-y divide-line text-sm">
          {Object.entries(q.data!).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-2"><dt className="shrink-0 text-muted">{pretty(k)}</dt><dd className="min-w-0 break-words text-right font-medium">{v === null || v === "" ? "-" : String(v)}</dd></div>
          ))}
        </dl>
      )}
      <div className="mt-5 flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}
