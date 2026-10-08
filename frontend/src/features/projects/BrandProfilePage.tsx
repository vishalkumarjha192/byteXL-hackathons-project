import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, ErrorState, Input, Label, Select, Skeleton, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { creatorsApi } from "@/features/creators/api";
import { AvatarUpload } from "@/features/creators/AvatarUpload";

interface Brand { id: string; logo?: string | null; company_name: string; description: string | null; website: string | null; industry: string | null; location: string | null }
type Fields = { company_name: string; description: string; website: string; industry: string; location: string };

export default function BrandProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me-brand"], queryFn: () => api<Brand>("/brands/me") });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: creatorsApi.lookups, staleTime: Infinity });
  const { register, reset, handleSubmit } = useForm<Fields>();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const b = me.data;
    if (b) reset({ company_name: b.company_name, description: b.description ?? "", website: b.website ?? "", industry: b.industry ?? "", location: b.location ?? "" });
  }, [me.data, reset]);
  const save = useMutation({
    mutationFn: (f: Fields) => api<Brand>("/brands/me", { method: "PATCH", body: { ...f, description: f.description || null, website: f.website || null, industry: f.industry || null, location: f.location || null } }),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ["me-brand"] }); qc.invalidateQueries({ queryKey: ["match"] }); },
  });

  if (me.isLoading) return <div className="mx-auto max-w-2xl px-5 py-10"><Skeleton className="h-80" /></div>;
  if (me.isError) return <div className="mx-auto max-w-xl px-5 py-16"><ErrorState message={me.error.message} onRetry={() => me.refetch()} /></div>;
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-bold">Company profile</h1>
      <p className="mt-1 text-muted">Creators see this on your projects. Your industry also improves creator recommendations.</p>
      <form className="mt-8" onSubmit={handleSubmit((f) => { setSaved(false); save.mutate(f); })}>
        <Card className="space-y-5 p-6">
          <AvatarUpload purpose="LOGO" name={me.data?.company_name ?? ""} src={me.data?.logo} onChange={(logo) => api("/brands/me", { method: "PATCH", body: { logo } }).then(() => qc.invalidateQueries({ queryKey: ["me-brand"] }))} />
          <div><Label htmlFor="company_name">Company name</Label><Input id="company_name" required minLength={2} {...register("company_name")} /></div>
          <div><Label htmlFor="industry">Industry</Label><Select id="industry" {...register("industry")}><option value="">Not set</option>{lookups.data?.niches.map((n) => <option key={n.id}>{n.name}</option>)}</Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="website">Website</Label><Input id="website" placeholder="https://" {...register("website")} /></div>
            <div><Label htmlFor="location">Location</Label><Input id="location" {...register("location")} /></div>
          </div>
          <div><Label htmlFor="description">About your brand</Label><Textarea id="description" maxLength={2000} {...register("description")} /></div>
        </Card>
        {save.isError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{save.error.message}</p>}
        <div className="mt-6 flex items-center gap-4"><Button type="submit" variant="brand" loading={save.isPending}>Save profile</Button>{saved && <span role="status" className="text-sm text-green-700">Profile saved</span>}</div>
      </form>
    </div>
  );
}
