import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge, VerifiedBadge } from "@/components/ui";
import { money } from "@/lib/format";
import { RecommendedCreators } from "@/features/ai/RecommendedCreators";
import { workflowApi } from "./api";

export default function ApplicationsPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["project-applications", id], queryFn: () => workflowApi.projectApplications(id) });
  const done = () => { qc.invalidateQueries({ queryKey: ["project-applications", id] }); qc.invalidateQueries({ queryKey: ["my-projects"] }); };
  const accept = useMutation({ mutationFn: workflowApi.accept, onSuccess: () => { done(); nav(`/projects/${id}/workspace`); } });
  const reject = useMutation({ mutationFn: workflowApi.reject, onSuccess: done });
  const err = (accept.error ?? reject.error)?.message;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/dashboard/brand" className="text-sm text-muted hover:text-ink">Back to your projects</Link>
      <h1 className="mt-4 text-3xl font-bold">Applications</h1>
      {err && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-6 space-y-4">
        {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
          : q.isLoading ? <Skeleton className="h-40" />
          : q.data?.length === 0 ? <EmptyState title="No applications yet" hint="Creators will appear here as they apply." />
          : q.data?.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={a.creator.display_name} src={a.creator.avatar} />
                  <div>
                    <Link to={`/creators/${a.creator.id}`} className="flex items-center gap-1.5 font-semibold hover:text-brand">{a.creator.display_name}{a.creator.verified && <VerifiedBadge />}</Link>
                    <p className="text-sm text-muted">{a.creator.completed_projects} projects completed</p>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-4 whitespace-pre-line text-sm text-muted">{a.proposal}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-sm"><span className="font-display text-lg font-bold">{money(a.proposed_price, a.currency)}</span> <span className="text-muted">in {a.delivery_days} days</span></p>
                {a.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button variant="outline" loading={reject.isPending && reject.variables === a.id} onClick={() => reject.mutate(a.id)}>Reject</Button>
                    <Button variant="brand" loading={accept.isPending && accept.variables === a.id} onClick={() => accept.mutate(a.id)}>Hire creator</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
      </div>
      <RecommendedCreators projectId={id} />
    </div>
  );
}
