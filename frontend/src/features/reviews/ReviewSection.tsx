import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Button, Card, Label, Stars, Textarea } from "@/components/ui";
import { commsApi } from "@/features/comms/api";
import { ReportButton } from "@/features/admin/ReportButton";
import { date } from "@/lib/format";
import type { ReviewItem } from "@/lib/types";

export const ReviewCard = ({ r, reportable }: { r: ReviewItem; reportable?: boolean }) => (
  <li className="rounded-lg bg-mist p-4 text-sm">
    <div className="flex items-center justify-between gap-3"><span className="font-semibold">{r.mine ? "You" : r.reviewer_name}</span><Stars value={r.rating} /></div>
    <p className="mt-2 text-muted">{r.comment}</p>
    <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{date(r.created_at)}</span>{reportable && <ReportButton targetType="REVIEW" targetId={r.id} />}</div>
  </li>
);

export function ReviewSection({ projectId, reviews, canReview, otherParty }: { projectId: string; reviews: ReviewItem[]; canReview: boolean; otherParty: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const submit = useMutation({
    mutationFn: () => commsApi.review({ project_id: projectId, rating, comment }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workspace", projectId] }); qc.invalidateQueries({ queryKey: ["creator"] }); },
  });
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold">Reviews</h2>
      {reviews.length > 0 && <ul className="mt-3 space-y-3">{reviews.map((r) => <ReviewCard key={r.id} r={r} />)}</ul>}
      {canReview ? (
        <form className="mt-4 space-y-4 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); if (rating) submit.mutate(); }}>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">How was working with {otherParty}?</legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="rounded p-1 hover:bg-mist"><Star width={26} height={26} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-line"} aria-hidden /></button>
              ))}
            </div>
          </fieldset>
          <div><Label htmlFor="rv">Your review</Label><Textarea id="rv" rows={3} required minLength={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          {submit.isError && <p role="alert" className="text-sm text-red-700">{submit.error.message}</p>}
          <Button type="submit" variant="brand" loading={submit.isPending} disabled={!rating}>Submit review</Button>
        </form>
      ) : reviews.length === 0 && <p className="mt-3 text-sm text-muted">No reviews yet.</p>}
    </Card>
  );
}
