import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "CREATOR" | "PROJECT" | "REVIEW" | "PORTFOLIO"; targetId: string; label?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const send = useMutation({ mutationFn: () => api("/reports", { method: "POST", body: { target_type: targetType, target_id: targetId, reason, details: details || null } }) });
  const trigger = "inline-flex items-center gap-1 text-xs text-muted hover:text-red-700";
  if (!user) return <Link to="/login" className={trigger}><Flag className="h-3 w-3" aria-hidden />{label}</Link>;
  if (send.isSuccess) return <span role="status" className="text-xs text-green-700">Thanks. Our team will review it.</span>;
  if (!open) return <button type="button" className={trigger} onClick={() => setOpen(true)}><Flag className="h-3 w-3" aria-hidden />{label}</button>;
  return (
    <form className="mt-2 space-y-2 rounded-lg border border-line bg-white p-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
      <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="SPAM">Spam or fake</option><option value="INAPPROPRIATE">Inappropriate</option><option value="FRAUD">Fraud or scam</option><option value="OTHER">Something else</option>
      </Select>
      <Textarea aria-label="Details (optional)" rows={2} maxLength={1000} placeholder="Tell us more (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      {send.isError && <p role="alert" className="text-xs text-red-700">{send.error.message}</p>}
      <div className="flex gap-2"><Button type="submit" variant="primary" className="px-3 py-1.5" loading={send.isPending}>Send report</Button><Button type="button" variant="ghost" className="px-3 py-1.5" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  );
}
