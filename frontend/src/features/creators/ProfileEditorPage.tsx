import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Input, Label, Select, Skeleton, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { Named } from "@/lib/types";
import { AvatarUpload } from "./AvatarUpload";
import { PortfolioFileUpload } from "./PortfolioManager";
import { creatorsApi } from "./api";

type Tags = { skills: string[]; niches: string[]; languages: string[]; ai_tools: string[] };
type Fields = { display_name: string; bio: string; location: string; starting_price: string; hourly_rate: string; delivery_days: string };

export function Chips({ label, options, value, onChange }: { label: string; options: Named[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.name);
          return (
            <button type="button" key={o.id} aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.name) : [...value, o.name])}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line text-muted hover:bg-mist"}`}>{o.name}</button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ProfileEditorPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me-creator"], queryFn: creatorsApi.me });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: creatorsApi.lookups, staleTime: Infinity });
  const portfolio = useQuery({ queryKey: ["portfolio", me.data?.id], queryFn: () => creatorsApi.portfolio(me.data!.id), enabled: !!me.data });
  const { register, reset, handleSubmit } = useForm<Fields>();
  const [tags, setTags] = useState<Tags>({ skills: [], niches: [], languages: [], ai_tools: [] });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = me.data;
    if (!c) return;
    reset({ display_name: c.display_name, bio: c.bio ?? "", location: c.location ?? "", starting_price: c.starting_price?.toString() ?? "", hourly_rate: c.hourly_rate?.toString() ?? "", delivery_days: c.delivery_days?.toString() ?? "" });
    setTags({ skills: c.skills.map((x) => x.name), niches: c.niches.map((x) => x.name), languages: c.languages.map((x) => x.name), ai_tools: c.ai_tools.map((x) => x.name) });
  }, [me.data, reset]);

  const save = useMutation({
    mutationFn: (f: Fields) => creatorsApi.update({
      display_name: f.display_name, bio: f.bio || null, location: f.location || null,
      starting_price: f.starting_price ? Number(f.starting_price) : null, hourly_rate: f.hourly_rate ? Number(f.hourly_rate) : null,
      delivery_days: f.delivery_days ? Number(f.delivery_days) : null, ...tags,
    }),
    onSuccess: () => { setSaved(true); qc.invalidateQueries({ queryKey: ["me-creator"] }); },
  });

  const [p, setP] = useState({ title: "", media_url: "", media_type: "VIDEO" });
  const add = useMutation({
    mutationFn: () => creatorsApi.addPortfolio(p),
    onSuccess: () => { setP({ title: "", media_url: "", media_type: "VIDEO" }); qc.invalidateQueries({ queryKey: ["portfolio"] }); },
  });
  const verify = useMutation({ mutationFn: () => api("/creators/me/verification-request", { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["me-creator"] }) });
  const del = useMutation({ mutationFn: creatorsApi.deletePortfolio, onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }) });

  if (me.isLoading || lookups.isLoading) return <div className="mx-auto max-w-3xl px-5 py-10"><Skeleton className="h-96" /></div>;
  if (me.isError) return <div className="mx-auto max-w-xl px-5 py-16"><ErrorState message={me.error.message} onRetry={() => me.refetch()} /></div>;
  const L = lookups.data!;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold">Your creator profile</h1>
      <p className="mt-1 text-muted">Brands see this when they search. Complete profiles get hired more often.</p>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-semibold">Verified badge</p>
          <p className="text-sm text-muted">{me.data?.verified ? "Your profile is verified." : me.data?.verification_requested ? "Your request is with our team. We will notify you." : "Verified creators are shown first and win more work. Add a bio and portfolio, then request a review."}</p>
        </div>
        {!me.data?.verified && !me.data?.verification_requested && <Button variant="outline" loading={verify.isPending} onClick={() => verify.mutate()}>Request verification</Button>}
        {verify.isError && <p role="alert" className="w-full text-sm text-red-700">{verify.error.message}</p>}
      </Card>

      <form onSubmit={handleSubmit((f) => { setSaved(false); save.mutate(f); })} className="mt-8 space-y-6">
        <Card className="space-y-5 p-6">
          <AvatarUpload name={me.data?.display_name ?? ""} src={me.data?.avatar} onChange={(avatar) => creatorsApi.update({ avatar }).then(() => qc.invalidateQueries({ queryKey: ["me-creator"] }))} />
          <div><Label htmlFor="display_name">Display name</Label><Input id="display_name" {...register("display_name", { required: true })} /></div>
          <div><Label htmlFor="bio">Bio</Label><Textarea id="bio" maxLength={2000} placeholder="What you make, who you make it for, and how you work." {...register("bio")} /></div>
          <div><Label htmlFor="location">Location</Label><Input id="location" {...register("location")} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="starting_price">Starting price (INR)</Label><Input id="starting_price" type="number" min={0} {...register("starting_price")} /></div>
            <div><Label htmlFor="hourly_rate">Hourly rate (INR)</Label><Input id="hourly_rate" type="number" min={0} {...register("hourly_rate")} /></div>
            <div><Label htmlFor="delivery_days">Delivery (days)</Label><Input id="delivery_days" type="number" min={1} max={365} {...register("delivery_days")} /></div>
          </div>
        </Card>
        <Card className="space-y-6 p-6">
          <Chips label="Content types" options={L.skills} value={tags.skills} onChange={(skills) => setTags({ ...tags, skills })} />
          <Chips label="Niches" options={L.niches} value={tags.niches} onChange={(niches) => setTags({ ...tags, niches })} />
          <Chips label="Languages" options={L.languages} value={tags.languages} onChange={(languages) => setTags({ ...tags, languages })} />
          <Chips label="AI tools you use" options={L.ai_tools} value={tags.ai_tools} onChange={(ai_tools) => setTags({ ...tags, ai_tools })} />
        </Card>
        {save.isError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{save.error.message}</p>}
        <div className="flex items-center gap-4">
          <Button type="submit" variant="brand" loading={save.isPending}>Save profile</Button>
          {saved && <span role="status" className="text-sm text-green-700">Profile saved</span>}
        </div>
      </form>

      <h2 className="mb-4 mt-14 text-2xl font-bold">Portfolio</h2>
      <PortfolioFileUpload />
      <Card className="p-6">
        <form className="grid gap-4 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div><Label htmlFor="pt">Title</Label><Input id="pt" required minLength={2} value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></div>
          <div><Label htmlFor="pu">Link to the work</Label><Input id="pu" type="url" required placeholder="https://" value={p.media_url} onChange={(e) => setP({ ...p, media_url: e.target.value })} /></div>
          <div><Label htmlFor="pm">Type</Label><Select id="pm" value={p.media_type} onChange={(e) => setP({ ...p, media_type: e.target.value })}><option value="VIDEO">Video</option><option value="IMAGE">Image</option><option value="LINK">Link</option></Select></div>
          <Button type="submit" variant="outline" loading={add.isPending}>Add work</Button>
        </form>
        {add.isError && <p role="alert" className="mt-3 text-sm text-red-700">{add.error.message}</p>}
      </Card>
      <div className="mt-4 space-y-2">
        {portfolio.data?.length === 0 && <EmptyState title="Nothing here yet" hint="Add links to your best videos, images or external portfolio pages." />}
        {portfolio.data?.map((i) => (
          <Card key={i.id} className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0"><p className="font-medium">{i.title}</p><a href={i.media_url} target="_blank" rel="noreferrer" className="block truncate text-sm text-brand">{i.media_url}</a></div>
            <Button variant="ghost" aria-label={`Delete ${i.title}`} onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
