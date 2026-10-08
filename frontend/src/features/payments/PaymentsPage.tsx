import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, ErrorState, Input, Label, Select, Skeleton, StatusBadge } from "@/components/ui";
import { date, money } from "@/lib/format";
import type { PaymentsMine } from "@/lib/types";
import { paymentsApi } from "./api";

function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function EarningsChart({ data, currency }: { data: PaymentsMine["monthly"]; currency: string }) {
  const months = lastMonths(6);
  const values = months.map((m) => data.find((d) => d.month === m && d.currency === currency)?.earned ?? 0);
  const max = Math.max(...values, 1);
  const label = (m: string) => new Date(`${m}-01`).toLocaleDateString("en-IN", { month: "short" });
  return (
    <div role="img" aria-label={`Earnings in ${currency} for the last 6 months: ${months.map((m, i) => `${label(m)} ${values[i]}`).join(", ")}`}>
      <div className="flex h-36 items-end gap-3">
        {values.map((v, i) => (
          <div key={months[i]} className="flex h-full flex-1 flex-col justify-end">
            <div className="rounded-t bg-brand" style={{ height: `${Math.max((v / max) * 100, v ? 4 : 1)}%`, opacity: v ? 1 : 0.15 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-center text-xs text-muted">
        {months.map((m, i) => <div key={m} className="flex-1"><div>{label(m)}</div><div className="font-medium text-ink">{values[i] ? money(values[i], currency) : "-"}</div></div>)}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payments"], queryFn: paymentsApi.mine });
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState("");
  const [done, setDone] = useState("");
  const withdraw = useMutation({
    mutationFn: () => paymentsApi.withdraw({ amount: Number(amount), currency: currency }),
    onSuccess: () => { setDone(`Withdrawal of ${money(Number(amount), currency)} sent`); setAmount(""); qc.invalidateQueries({ queryKey: ["payments"] }); },
  });
  const d = q.data;
  const isBrand = d?.role === "BRAND";
  const currency = cur || d?.summary[0]?.currency || "INR";
  const sel = d?.summary.find((s) => s.currency === currency);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl font-bold">{isBrand ? "Payments" : "Earnings"}</h1>
      <p className="mt-1 text-muted">{isBrand ? "Funds are held securely when you fund a project and released to the creator when you complete it." : "Payments are released to your balance when a brand completes the project."}</p>

      {q.isError ? <div className="mt-6"><ErrorState message={q.error.message} onRetry={() => q.refetch()} /></div>
        : q.isLoading ? <div className="mt-6 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>
        : d!.items.length === 0 && d!.summary.length === 0 ? <div className="mt-6"><EmptyState title="No payments yet" hint={isBrand ? "A payment is created when you hire a creator." : "Your first payment appears when a brand hires you."} /></div>
        : <>
          {d!.summary.length > 1 && (
            <div className="mt-6 max-w-[160px]"><Label htmlFor="cur">Currency</Label><Select id="cur" value={currency} onChange={(e) => setCur(e.target.value)}>{d!.summary.map((s) => <option key={s.currency}>{s.currency}</option>)}</Select></div>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(isBrand
              ? [["Total spent", sel?.spent], ["In escrow", sel?.in_escrow]]
              : [["Available to withdraw", sel?.available], ["In escrow", sel?.in_escrow], ["Total earned", sel?.earned], ["Withdrawn", sel?.withdrawn]]
            ).map(([k, v]) => <Card key={k as string} className="p-5"><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-3xl font-bold">{money((v as number) ?? 0, currency)}</p></Card>)}
          </div>

          {!isBrand && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              <Card className="p-6"><h2 className="mb-4 text-lg font-bold">Earnings, last 6 months</h2><EarningsChart data={d!.monthly} currency={currency} /></Card>
              <Card className="p-6">
                <h2 className="text-lg font-bold">Withdraw</h2>
                <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); setDone(""); withdraw.mutate(); }}>
                  <div><Label htmlFor="wa">Amount ({currency})</Label><Input id="wa" type="number" min={1} step="0.01" max={sel?.available ?? 0} required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  {withdraw.isError && <p role="alert" className="text-sm text-red-700">{withdraw.error.message}</p>}
                  {done && <p role="status" className="text-sm text-green-700">{done}</p>}
                  <Button type="submit" variant="brand" className="w-full" loading={withdraw.isPending} disabled={!sel?.available}>Withdraw</Button>
                  {!sel?.available && <p className="text-xs text-muted">Nothing to withdraw yet.</p>}
                </form>
              </Card>
            </div>
          )}

          <h2 className="mb-3 mt-10 text-xl font-bold">Payment history</h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line text-muted"><tr><th className="px-4 py-3 font-medium">Project</th><th className="px-4 py-3 font-medium">{isBrand ? "Amount" : "You receive"}</th>{!isBrand && <th className="px-4 py-3 font-medium">Platform fee</th>}<th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th></tr></thead>
              <tbody className="divide-y divide-line">
                {d!.items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3"><Link to={`/projects/${p.project_id}/workspace`} className="font-medium hover:text-brand">{p.project_title}</Link></td>
                    <td className="px-4 py-3">{money(isBrand ? p.amount : p.creator_amount, p.currency)}</td>
                    {!isBrand && <td className="px-4 py-3 text-muted">{money(p.platform_fee, p.currency)}</td>}
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-muted">{date(p.released_at ?? p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {!isBrand && d!.payouts.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 text-xl font-bold">Withdrawals</h2>
              <div className="space-y-2">{d!.payouts.map((o) => <Card key={o.id} className="flex justify-between px-4 py-3 text-sm"><span>{date(o.created_at)}</span><span className="font-semibold">{money(o.amount, o.currency)}</span></Card>)}</div>
            </>
          )}
        </>}
    </div>
  );
}
