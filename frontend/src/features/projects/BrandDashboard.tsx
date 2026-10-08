import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorState, LinkButton, Skeleton, StatusBadge } from "@/components/ui";
import { date, money } from "@/lib/format";
import { paymentsApi } from "@/features/payments/api";
import { workflowApi } from "./api";

export default function BrandDashboard() {
  const q = useQuery({ queryKey: ["my-projects"], queryFn: workflowApi.myProjects });
  const pay = useQuery({ queryKey: ["payments"], queryFn: paymentsApi.mine });
  const items = q.data?.items ?? [];
  const spent = pay.data?.summary.filter((s) => s.spent > 0).map((s) => money(s.spent, s.currency)).join(" + ") || money(0);
  const count = (f: (s: string) => boolean) => items.filter((p) => f(p.status)).length;
  const stats = [
    ["Active projects", count((s) => ["IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "FINAL_SUBMITTED", "APPROVED"].includes(s))],
    ["Pending applications", items.reduce((n, p) => n + (p.pending_applications ?? 0), 0)],
    ["Completed projects", count((s) => s === "COMPLETED")],
    ["Total spent", pay.isLoading ? "-" : spent],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Your projects</h1>
        <div className="flex gap-2"><LinkButton to="/creators" variant="outline">Find creators</LinkButton><LinkButton to="/dashboard/payments" variant="outline">Payments</LinkButton><LinkButton to="/dashboard/brand/profile" variant="outline">Company profile</LinkButton><LinkButton to="/dashboard/brand/projects/new" variant="brand">Post a project</LinkButton></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([k, v]) => <Card key={k} className="p-5"><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-bold">{q.isLoading ? "-" : v}</p></Card>)}
      </div>
      <div className="mt-8 space-y-3">
        {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
          : q.isLoading ? <Skeleton className="h-32" />
          : items.length === 0 ? <EmptyState title="No projects yet" hint="Post your first brief and creators can start applying." action={<LinkButton to="/dashboard/brand/projects/new" variant="brand">Post a project</LinkButton>} />
          : items.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div><Link to={`/jobs/${p.id}`} className="font-semibold hover:text-brand">{p.title}</Link>
                <p className="mt-1 text-sm text-muted">{money(p.budget, p.currency)} · Due {date(p.deadline)}</p></div>
              <div className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                {p.status === "OPEN" && <LinkButton to={`/dashboard/brand/projects/${p.id}/applications`} variant="outline">{p.pending_applications ? `${p.pending_applications} applications` : "No applications yet"}</LinkButton>}
                {!["OPEN", "CANCELLED"].includes(p.status) && <LinkButton to={`/projects/${p.id}/workspace`} variant="outline">Open workspace</LinkButton>}
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
