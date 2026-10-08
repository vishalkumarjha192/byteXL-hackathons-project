import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar, Badge, Card, Skeleton, VerifiedBadge } from "@/components/ui";
import { money } from "@/lib/format";
import { aiApi } from "./api";

export function RecommendedCreators({ projectId }: { projectId: string }) {
  const q = useQuery({ queryKey: ["match", projectId], queryFn: () => aiApi.matchCreators(projectId) });
  if (q.isError || (q.data && q.data.length === 0)) return null;
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold">Recommended creators</h2>
      <p className="mt-1 text-sm text-muted">Ranked by skills, language, niche, budget, rating and deadline fit.</p>
      <div className="mt-4 space-y-3">
        {q.isLoading ? <Skeleton className="h-24" /> : q.data!.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/creators/${c.id}`} className="flex min-w-0 items-center gap-3">
                <Avatar name={c.display_name} src={c.avatar} size={40} />
                <span className="min-w-0"><span className="flex items-center gap-1.5 font-semibold"><span className="truncate">{c.display_name}</span>{c.verified && <VerifiedBadge />}</span>
                  <span className="text-sm text-muted">From {money(c.starting_price)}{c.delivery_days ? ` · ${c.delivery_days} days` : ""}</span></span>
              </Link>
              <Badge tone="brand">{c.match_score}% match</Badge>
            </div>
            {(c.reasons.length > 0 || c.warnings.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.reasons.slice(0, 4).map((r) => <Badge key={r}>{r}</Badge>)}
                {c.warnings.map((w) => <span key={w} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{w}</span>)}
              </div>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
