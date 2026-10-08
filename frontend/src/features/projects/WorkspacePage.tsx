import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Label, LinkButton, Select, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { date, money } from "@/lib/format";
import { ChatWindow } from "@/features/comms/ChatWindow";
import { FileLink } from "@/components/FileLink";
import { FileUploader } from "@/components/FileUploader";
import { ReviewSection } from "@/features/reviews/ReviewSection";
import { paymentsApi } from "@/features/payments/api";
import { workflowApi } from "./api";

const CREATOR_CAN_SUBMIT = ["IN_PROGRESS", "REVISION_REQUESTED", "DRAFT_SUBMITTED"];

export default function WorkspacePage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const ws = useQuery({ queryKey: ["workspace", id], queryFn: () => workflowApi.workspace(id), retry: false });
  const [url, setUrl] = useState(""); const [kind, setKind] = useState("DRAFT"); const [note, setNote] = useState(""); const [upload, setUpload] = useState<{ id: string; name: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["workspace", id] }); qc.invalidateQueries({ queryKey: ["my-projects"] }); };
  const submit = useMutation({ mutationFn: () => workflowApi.submitDeliverable({ project_id: id, ...(upload ? { file_id: upload.id } : { file_url: url }), kind, note: note || null }), onSuccess: () => { setUrl(""); setNote(""); setUpload(null); refresh(); } });
  const revise = useMutation({ mutationFn: () => workflowApi.requestRevision({ project_id: id, description: feedback }), onSuccess: () => { setFeedback(""); refresh(); } });
  const approve = useMutation({ mutationFn: () => workflowApi.approve(id), onSuccess: refresh });
  const complete = useMutation({ mutationFn: () => workflowApi.complete(id), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: () => workflowApi.cancel(id), onSuccess: refresh });
  const fund = useMutation({ mutationFn: () => paymentsApi.fund(id), onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["payments"] }); } });
  const actionError = [submit, revise, approve, complete, cancel, fund].find((m) => m.isError)?.error?.message;

  if (ws.isLoading) return <div className="mx-auto max-w-4xl space-y-4 px-5 py-10"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  if (ws.isError) {
    const denied = ws.error instanceof ApiError && [403, 404].includes(ws.error.status);
    return <div className="mx-auto max-w-xl px-5 py-16">{denied ? <EmptyState title="Workspace unavailable" hint="It does not exist, or you are not part of this project." action={<LinkButton to="/">Go home</LinkButton>} /> : <ErrorState message={ws.error.message} onRetry={() => ws.refetch()} />}</div>;
  }
  const w = ws.data!; const p = w.project; const isBrand = w.role === "BRAND";
  const dash = isBrand ? "/dashboard/brand" : "/dashboard/creator";
  const canCancel = isBrand && !["APPROVED", "COMPLETED", "CANCELLED"].includes(p.status);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link to={dash} className="text-sm text-muted hover:text-ink">Back to dashboard</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{p.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>{w.brand.company_name}{w.brand_rating.total > 0 && ` (${w.brand_rating.average.toFixed(1)} stars, ${w.brand_rating.total} reviews)`}</span>
            {w.creator && <span className="flex items-center gap-2"><Avatar name={w.creator.display_name} src={w.creator.avatar} size={22} />{w.creator.display_name}</span>}
            <span>Due {date(p.deadline)}</span>
          </p>
        </div>
        <StatusBadge status={p.status} />
      </div>
      {actionError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card className="p-6"><h2 className="text-lg font-bold">Brief</h2><p className="mt-3 whitespace-pre-line text-sm text-muted">{p.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5"><Badge tone="brand">{p.category}</Badge><Badge>{p.content_type}</Badge>{p.platform && <Badge>{p.platform}</Badge>}{p.language && <Badge>{p.language}</Badge>}</div></Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold">Deliverables</h2>
            {w.deliverables.length === 0 ? <p className="mt-3 text-sm text-muted">{isBrand ? "The creator has not submitted anything yet." : "Submit your first draft when it is ready."}</p>
              : <ul className="mt-3 divide-y divide-line">{w.deliverables.map((d) => (
                <li key={d.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    {d.file ? <FileLink file={d.file} label={`Version ${d.version} (${d.kind === "FINAL" ? "final" : "draft"}): ${d.file.filename}`} /> : <a href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-semibold text-brand"><ExternalLink className="h-4 w-4" aria-hidden />Version {d.version} ({d.kind === "FINAL" ? "final" : "draft"})</a>}
                    <span className="text-muted">{date(d.created_at)}{d.status === "APPROVED" && " · Approved"}</span>
                  </div>
                  {d.note && <p className="mt-1 text-muted">{d.note}</p>}
                </li>))}</ul>}
            {!isBrand && CREATOR_CAN_SUBMIT.includes(p.status) && (
              <form className="mt-5 space-y-4 border-t border-line pt-5" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <div className="space-y-3">
                    {upload ? <p className="flex items-center gap-2 text-sm"><span className="font-medium">{upload.name}</span><button type="button" className="text-brand" onClick={() => setUpload(null)}>Remove</button></p>
                      : <><FileUploader purpose="DELIVERABLE" projectId={id} accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.pdf,.zip" maxMB={100} label="Upload your file" onUploaded={(f) => setUpload({ id: f.id, name: f.filename })} />
                        <div><Label htmlFor="url">Or paste a link</Label><Input id="url" type="url" required={!upload} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></div></>}
                  </div>
                  <div><Label htmlFor="kind">Type</Label><Select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="DRAFT">Draft</option><option value="FINAL">Final</option></Select></div>
                </div>
                <div><Label htmlFor="note">Note for the brand (optional)</Label><Input id="note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <Button type="submit" variant="brand" loading={submit.isPending}>Submit {kind === "FINAL" ? "final files" : "draft"}</Button>
              </form>)}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold">Revisions</h2>
            {w.revisions.length === 0 ? <p className="mt-3 text-sm text-muted">No revisions requested.</p>
              : <ul className="mt-3 space-y-3">{w.revisions.map((r) => (
                <li key={r.id} className="rounded-lg bg-mist p-3 text-sm"><div className="flex justify-between"><span className="font-medium">{r.status === "OPEN" ? "Open" : "Resolved"}</span><span className="text-muted">{date(r.created_at)}</span></div><p className="mt-1 text-muted">{r.description}</p></li>))}</ul>}
            {isBrand && ["DRAFT_SUBMITTED", "FINAL_SUBMITTED"].includes(p.status) && (
              <form className="mt-5 space-y-3 border-t border-line pt-5" onSubmit={(e) => { e.preventDefault(); revise.mutate(); }}>
                <Label htmlFor="fb">What should change?</Label>
                <Textarea id="fb" rows={3} required minLength={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <Button type="submit" variant="outline" loading={revise.isPending}>Request revision</Button>
              </form>)}
          </Card>

          <ChatWindow projectId={id} />
          {p.status === "COMPLETED" && <ReviewSection projectId={id} reviews={w.reviews} canReview={w.can_review} otherParty={isBrand ? w.creator?.display_name ?? "the creator" : w.brand.company_name} />}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="text-lg font-bold">Payment</h2>
            {w.contract && <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Agreed price</dt><dd className="font-semibold">{money(w.contract.agreed_price, p.currency)}</dd></div>
              {!isBrand && <>
                <div className="flex justify-between"><dt className="text-muted">Platform fee</dt><dd>{money(w.contract.platform_fee, p.currency)}</dd></div>
                <div className="flex justify-between border-t border-line pt-2"><dt className="text-muted">You receive</dt><dd className="font-semibold">{money(w.contract.creator_amount, p.currency)}</dd></div></>}
            </dl>}
            {w.payment && (() => {
              const s = w.payment.status;
              const hint: Record<string, string> = {
                PENDING: isBrand ? "Fund the project to secure the payment. The creator is paid only when you complete it." : "Waiting for the brand to fund the project.",
                HELD: "Funds are held securely and released when the project is completed.",
                RELEASED: isBrand ? "Released to the creator." : "Released to your balance.",
                REFUNDED: "Refunded to the brand.",
                CANCELLED: "Cancelled before funding.",
              };
              return (
                <div className="mt-4 border-t border-line pt-4 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted">Status</span><StatusBadge status={s} /></div>
                  <p className="mt-2 text-muted">{hint[s]}</p>
                  {isBrand && s === "PENDING" && p.status !== "CANCELLED" && <Button variant="brand" className="mt-3 w-full" loading={fund.isPending} onClick={() => fund.mutate()}>Fund project ({money(w.payment.amount, w.payment.currency)})</Button>}
                  {s === "RELEASED" && <Link to="/dashboard/payments" className="mt-2 inline-block font-semibold text-brand">View payments</Link>}
                </div>
              );
            })()}
          </Card>
          {isBrand && (p.status === "FINAL_SUBMITTED" || p.status === "APPROVED") && (
            <Card className="space-y-3 p-5">
              {p.status === "FINAL_SUBMITTED" && <Button variant="brand" className="w-full" loading={approve.isPending} onClick={() => approve.mutate()}>Approve final files</Button>}
              {p.status === "APPROVED" && <>
                <Button variant="brand" className="w-full" loading={complete.isPending} disabled={w.payment?.status !== "HELD"} onClick={() => complete.mutate()}>Complete and release payment</Button>
                {w.payment?.status === "PENDING" && <p className="text-xs text-muted">Fund the project first so the creator can be paid.</p>}
              </>}
            </Card>)}
          {canCancel && <Button variant="ghost" className="w-full text-red-700" loading={cancel.isPending} onClick={() => window.confirm("Cancel this project? This cannot be undone.") && cancel.mutate()}>Cancel project</Button>}
        </aside>
      </div>
    </div>
  );
}
