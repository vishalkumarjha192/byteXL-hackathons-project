import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, EmptyState, ErrorState, LinkButton, Skeleton } from "@/components/ui";
import { FileLink } from "@/components/FileLink";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { date, money } from "@/lib/format";
import { ReportButton } from "@/features/admin/ReportButton";
import { ApplyPanel } from "./ApplyPanel";
import { jobsApi } from "./api";

export default function JobDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id), retry: false });
  if (job.isLoading) return <div className="mx-auto max-w-3xl px-5 py-10"><Skeleton className="h-72" /></div>;
  if (job.isError) {
    const nf = job.error instanceof ApiError && job.error.status === 404;
    return <div className="mx-auto max-w-xl px-5 py-16">{nf ? <EmptyState title="Project not found" hint="It may have been closed or removed." action={<LinkButton to="/jobs">Browse open projects</LinkButton>} /> : <ErrorState message={job.error.message} onRetry={() => job.refetch()} />}</div>;
  }
  const j = job.data!;
  const rows: [string, string][] = [
    ["Budget", money(j.budget, j.currency)], ["Deadline", date(j.deadline)], ["Content type", j.content_type],
    ["Platform", j.platform ?? "Any"], ["Video length", j.video_duration ? `${j.video_duration} seconds` : "Not specified"], ["Style", j.style ?? "Not specified"], ["Revisions included", String(j.revisions ?? 2)], ["Language", j.language ?? "Any"], ["Target audience", j.target_audience ?? "Not specified"],
  ];
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/jobs" className="text-sm text-muted hover:text-ink">Back to projects</Link>
      <div className="mt-5 flex flex-wrap items-center gap-2"><Badge tone="brand">{j.category}</Badge><Badge>{j.status === "OPEN" ? "Accepting applications" : j.status}</Badge></div>
      <h1 className="mt-3 text-4xl font-bold">{j.title}</h1>
      <p className="mt-6 max-w-prose whitespace-pre-line text-muted">{j.description}</p>
      <Card className="mt-8 divide-y divide-line">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between px-5 py-3 text-sm"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>)}
      </Card>
      {j.deliverables && <div className="mt-6"><h2 className="font-semibold">Deliverables</h2><p className="mt-1 whitespace-pre-line text-sm text-muted">{j.deliverables}</p></div>}
      {j.assets && j.assets.length > 0 && (
        <div className="mt-6"><h2 className="font-semibold">Files from the brand</h2>
          {user ? <ul className="mt-2 space-y-1.5 text-sm">{j.assets.map((a) => <li key={a.id}><FileLink file={a.file} label={`${a.file_type.replace(/_/g, " ").toLowerCase()}: ${a.file.filename}`} /></li>)}</ul>
            : <p className="mt-1 text-sm text-muted">{j.assets.length} file{j.assets.length > 1 ? "s" : ""} attached. Log in to view them.</p>}
        </div>)}
      <ApplyPanel project={j} />
      <div className="mt-8"><ReportButton targetType="PROJECT" targetId={j.id} label="Report this project" /></div>
    </div>
  );
}
