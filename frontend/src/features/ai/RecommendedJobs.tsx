import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { money } from "@/lib/format";
import { aiApi } from "./api";

export function RecommendedJobs() {
  const q = useQuery({ queryKey: ["recommended-jobs"], queryFn: aiApi.recommendedJobs });
  if (q.isError) return null;
  return (
    <section>
      <h2 className="mb-1 mt-10 text-xl font-bold">Recommended for you</h2>
      <p className="mb-3 text-sm text-muted">Open projects that fit your skills, languages and pricing. Complete your profile for better matches.</p>
      {q.isLoading ? <Skeleton className="h-24" /> : q.data!.length === 0
        ? <EmptyState title="No matches right now" hint="New projects that fit your profile will show up here." />
        : <div className="space-y-3">{q.data!.map((j) => (
          <Link key={j.id} to={`/jobs/${j.id}`} className="block">
            <Card className="p-4 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold">{j.title}</p><p className="text-sm text-muted">{j.category} · {money(j.budget, j.currency)}</p></div>
                <Badge tone="brand">{j.match_score}% match</Badge>
              </div>
              {(j.reasons.length > 0 || j.warnings.length > 0) && <div className="mt-3 flex flex-wrap gap-1.5">
                {j.reasons.slice(0, 3).map((r) => <Badge key={r}>{r}</Badge>)}
                {j.warnings.map((w) => <span key={w} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{w}</span>)}
              </div>}
            </Card>
          </Link>))}</div>}
    </section>
  );
}
