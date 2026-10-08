import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation } from "react-router-dom";
import { z } from "zod";
import { Button, Card, Input, Label, LinkButton, StatusBadge, Textarea } from "@/components/ui";
import { workflowApi } from "@/features/projects/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import type { Project } from "@/lib/types";

const schema = z.object({
  proposal: z.string().min(20, "Write at least 20 characters"),
  proposed_price: z.coerce.number({ invalid_type_error: "Enter a price" }).gt(0, "Price must be above 0"),
  delivery_days: z.coerce.number({ invalid_type_error: "Enter days" }).int().min(1, "At least 1 day").max(365),
});
type Form = z.infer<typeof schema>;

export function ApplyPanel({ project }: { project: Project }) {
  const { user } = useAuth();
  const loc = useLocation();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const isCreator = user?.role === "CREATOR";
  const mine = useQuery({ queryKey: ["my-applications"], queryFn: workflowApi.myApplications, enabled: isCreator });
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { proposed_price: project.budget } });
  const apply = useMutation({
    mutationFn: (d: Form) => workflowApi.apply({ ...d, project_id: project.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-applications"] }),
    onError: (e) => setError(e.message),
  });
  const withdraw = useMutation({ mutationFn: workflowApi.withdraw, onSuccess: () => qc.invalidateQueries({ queryKey: ["my-applications"] }) });

  if (project.status !== "OPEN") return <Card className="mt-8 p-5 text-sm text-muted">This project is no longer accepting applications.</Card>;
  if (!user) return (
    <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
      <p className="text-sm text-muted">Log in as a creator to apply to this project.</p>
      <div className="flex gap-2"><LinkButton to="/login" state={{ from: loc.pathname }} variant="outline">Log in</LinkButton><LinkButton to="/register?role=creator">Join as a creator</LinkButton></div>
    </Card>
  );
  if (!isCreator) return null;
  const existing = mine.data?.find((a) => a.project_id === project.id);
  if (existing) return (
    <Card className="mt-8 p-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Your application</h2><StatusBadge status={existing.status} /></div>
      <p className="mt-2 text-sm text-muted">You offered {money(existing.proposed_price, existing.currency)} and {existing.delivery_days} days.</p>
      {existing.status === "PENDING" && <Button variant="outline" className="mt-4" loading={withdraw.isPending} onClick={() => withdraw.mutate(existing.id)}>Withdraw application</Button>}
      {existing.status === "ACCEPTED" && <Link to={`/projects/${project.id}/workspace`} className="mt-4 inline-block text-sm font-semibold text-brand">Open project workspace</Link>}
    </Card>
  );
  return (
    <Card className="mt-8 p-6">
      <h2 className="text-xl font-bold">Apply to this project</h2>
      <form className="mt-5 space-y-4" noValidate onSubmit={handleSubmit((d) => { setError(""); apply.mutate(d); })}>
        <div><Label htmlFor="proposal" error={errors.proposal?.message}>Proposal</Label><Textarea id="proposal" rows={5} placeholder="How you would approach this and why you are a fit." {...register("proposal")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="proposed_price" error={errors.proposed_price?.message}>Your price ({project.currency})</Label><Input id="proposed_price" type="number" min={1} {...register("proposed_price")} /></div>
          <div><Label htmlFor="delivery_days" error={errors.delivery_days?.message}>Delivery (days)</Label><Input id="delivery_days" type="number" min={1} {...register("delivery_days")} /></div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" variant="brand" loading={apply.isPending}>Send application</Button>
      </form>
    </Card>
  );
}
