import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorState, LinkButton, Skeleton, StatusBadge } from "@/components/ui";
import { creatorsApi } from "@/features/creators/api";
import { date, money } from "@/lib/format";
import { paymentsApi } from "@/features/payments/api";
import { RecommendedJobs } from "@/features/ai/RecommendedJobs";
import { workflowApi } from "./api";

export default function CreatorDashboard() {
  const projects = useQuery({ queryKey: ["my-projects"], queryFn: workflowApi.myProjects });
  const apps = useQuery({ queryKey: ["my-applications"], queryFn: workflowApi.myApplications });
  const me = useQuery({ queryKey: ["me-creator"], queryFn: creatorsApi.me });
  const pay = useQuery({ queryKey: ["payments"], queryFn: paymentsApi.mine });
  const items = projects.data?.items ?? [];
  const earned = pay.data?.summary.filter((s) => s.earned > 0).map((s) => money(s.earned, s.currency)).join(" + ") || money(0);
  const active = items.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status));
  const c = me.data;
  const checks = c ? [!!c.bio, !!c.starting_price, !!c.delivery_days, c.skills.length > 0, c.niches.length > 0, c.languages.length > 0, c.ai_tools.length > 0] : [];
  const complete = checks.length ? Math.round((checks.filter(Boolean).length / checks.length) * 100) : 0;
  const stats = [
    ["Active projects", active.length],
    ["Pending applications", apps.data?.filter((a) => a.status === "PENDING").length ?? 0],
    ["Completed projects", c?.completed_projects ?? 0],
    ["Total earnings", pay.isLoading ? "-" : earned],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Your work</h1>
        <div className="flex gap-2"><LinkButton to="/jobs" variant="brand">Browse jobs</LinkButton><LinkButton to="/dashboard/payments" variant="outline">Earnings</LinkButton><LinkButton to="/dashboard/creator/profile" variant="outline">Edit profile</LinkButton></div>
      </div>
      {c && complete < 100 && (
        <Card className="mt-6 p-5">
          <div className="flex items-center justify-between text-sm"><span className="font-semibold">Profile {complete}% complete</span><Link to="/dashboard/creator/onboarding" className="font-semibold text-brand">Finish your profile</Link></div>
          <div className="mt-3 h-2 rounded-full bg-mist" role="progressbar" aria-valuenow={complete} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-2 rounded-full bg-brand" style={{ width: `${complete}%` }} /></div>
        </Card>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([k, v]) => <Card key={k} className="p-5"><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-bold">{v}</p></Card>)}
      </div>

      <RecommendedJobs />

      <h2 className="mb-3 mt-10 text-xl font-bold">Projects you are hired on</h2>
      {projects.isError ? <ErrorState message={projects.error.message} onRetry={() => projects.refetch()} />
        : projects.isLoading ? <Skeleton className="h-24" />
        : items.length === 0 ? <EmptyState title="No active projects" hint="When a brand hires you, the project appears here." action={<LinkButton to="/jobs" variant="outline">Browse jobs</LinkButton>} />
        : <div className="space-y-3">{items.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="font-semibold">{p.title}</p><p className="mt-1 text-sm text-muted">Due {date(p.deadline)}</p></div>
            <div className="flex items-center gap-3"><StatusBadge status={p.status} /><LinkButton to={`/projects/${p.id}/workspace`} variant="outline">Open workspace</LinkButton></div>
          </Card>))}</div>}

      <h2 className="mb-3 mt-10 text-xl font-bold">Your applications</h2>
      {apps.isError ? <ErrorState message={apps.error.message} onRetry={() => apps.refetch()} />
        : apps.isLoading ? <Skeleton className="h-24" />
        : apps.data?.length === 0 ? <EmptyState title="No applications yet" hint="Apply to an open project and track it here." action={<LinkButton to="/jobs" variant="outline">Browse jobs</LinkButton>} />
        : <div className="space-y-3">{apps.data?.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><Link to={`/jobs/${a.project_id}`} className="font-semibold hover:text-brand">{a.project_title}</Link><p className="mt-1 text-sm text-muted">You offered {money(a.proposed_price, a.currency)} in {a.delivery_days} days</p></div>
            <StatusBadge status={a.status} />
          </Card>))}</div>}
    </div>
  );
}
