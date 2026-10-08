import { useQuery } from "@tanstack/react-query";
import { EmptyState, Skeleton, Stars } from "@/components/ui";
import { commsApi } from "@/features/comms/api";
import { ReviewCard } from "./ReviewSection";

export function CreatorReviews({ creatorId }: { creatorId: string }) {
  const q = useQuery({ queryKey: ["creator-reviews", creatorId], queryFn: () => commsApi.creatorReviews(creatorId) });
  return (
    <section>
      <div className="mb-4 mt-12 flex items-center gap-4">
        <h2 className="text-2xl font-bold">Reviews</h2>
        {q.data && q.data.total > 0 && <span className="flex items-center gap-2 text-sm text-muted"><Stars value={q.data.average} /><span><b className="text-ink">{q.data.average.toFixed(1)}</b> from {q.data.total} {q.data.total === 1 ? "review" : "reviews"}</span></span>}
      </div>
      {q.isLoading ? <Skeleton className="h-24" /> : q.isError ? <p className="text-sm text-red-700">Could not load reviews.</p>
        : q.data!.items.length === 0 ? <EmptyState title="No reviews yet" hint="Reviews appear here after a brand completes a project with this creator." />
        : <ul className="space-y-3">{q.data!.items.map((r) => <ReviewCard key={r.id} r={r} reportable />)}</ul>}
    </section>
  );
}
