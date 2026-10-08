import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorState, Input, Label, Skeleton, Textarea } from "@/components/ui";
import { Stepper } from "@/components/Stepper";
import { AvatarUpload } from "./AvatarUpload";
import { PortfolioManager } from "./PortfolioManager";
import { Chips } from "./ProfileEditorPage";
import { creatorsApi } from "./api";

const STEPS = ["About you", "Skills", "Niches", "Languages", "AI tools", "Pricing", "Portfolio"];

export default function OnboardingPage() {
  const nav = useNavigate();
  const me = useQuery({ queryKey: ["me-creator"], queryFn: creatorsApi.me });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: creatorsApi.lookups, staleTime: Infinity });
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [f, setF] = useState({ display_name: "", bio: "", location: "", avatar: "", starting_price: "", hourly_rate: "", delivery_days: "" });
  const [tags, setTags] = useState({ skills: [] as string[], niches: [] as string[], languages: [] as string[], ai_tools: [] as string[] });

  useEffect(() => {
    const c = me.data;
    if (!c) return;
    setF({ display_name: c.display_name, bio: c.bio ?? "", location: c.location ?? "", avatar: c.avatar ?? "", starting_price: c.starting_price?.toString() ?? "", hourly_rate: c.hourly_rate?.toString() ?? "", delivery_days: c.delivery_days?.toString() ?? "" });
    setTags({ skills: c.skills.map((x) => x.name), niches: c.niches.map((x) => x.name), languages: c.languages.map((x) => x.name), ai_tools: c.ai_tools.map((x) => x.name) });
  }, [me.data]);

  // Each step saves as you go, so closing the tab never loses progress.
  const save = useMutation({ mutationFn: (body: Record<string, unknown>) => creatorsApi.update(body) });
  const tagKey = ["", "skills", "niches", "languages", "ai_tools"][step] as keyof typeof tags | "";
  const valid = (): string => {
    if (step === 0 && f.display_name.trim().length < 2) return "Enter your name";
    if (tagKey && tags[tagKey].length === 0) return "Choose at least one";
    if (step === 5 && !(Number(f.starting_price) > 0)) return "Enter your starting price";
    if (step === 5 && !(Number(f.delivery_days) >= 1)) return "Enter your usual delivery time in days";
    return "";
  };
  const body = (): Record<string, unknown> | null => {
    if (step === 0) return { display_name: f.display_name.trim(), bio: f.bio || null, location: f.location || null };
    if (tagKey) return { [tagKey]: tags[tagKey] };
    if (step === 5) return { starting_price: Number(f.starting_price), hourly_rate: f.hourly_rate ? Number(f.hourly_rate) : null, delivery_days: Number(f.delivery_days) };
    return null;
  };
  const next = async () => {
    const problem = valid();
    if (problem) return setError(problem);
    setError("");
    const b = body();
    try {
      if (b) await save.mutateAsync(b);
      if (step === STEPS.length - 1) nav("/dashboard/creator");
      else { setStep(step + 1); window.scrollTo({ top: 0 }); }
    } catch (e) { setError((e as Error).message); }
  };

  if (me.isLoading || lookups.isLoading) return <div className="mx-auto max-w-2xl px-5 py-10"><Skeleton className="h-80" /></div>;
  if (me.isError) return <div className="mx-auto max-w-xl px-5 py-16"><ErrorState message={me.error.message} onRetry={() => me.refetch()} /></div>;
  const L = lookups.data!;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const chips = [null, ["Content types you make", L.skills, "skills"], ["Niches you know best", L.niches, "niches"], ["Languages you work in", L.languages, "languages"], ["AI tools you use", L.ai_tools, "ai_tools"]] as const;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-bold">Set up your creator profile</h1>
      <p className="mt-1 text-muted">Brands search by these details. It takes about three minutes and saves as you go.</p>
      <div className="mt-5"><Stepper steps={STEPS} current={step} /></div>
      <form className="mt-6" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <Card className="space-y-5 p-6">
          {step === 0 && <>
            <AvatarUpload name={f.display_name} src={f.avatar} onChange={(avatar) => { setF({ ...f, avatar }); creatorsApi.update({ avatar }); }} />
            <div><Label htmlFor="ob-name">Display name</Label><Input id="ob-name" value={f.display_name} onChange={set("display_name")} /></div>
            <div><Label htmlFor="ob-bio">Bio</Label><Textarea id="ob-bio" maxLength={2000} placeholder="What you make, who you make it for, and how you work." value={f.bio} onChange={set("bio")} /></div>
            <div><Label htmlFor="ob-loc">Location</Label><Input id="ob-loc" value={f.location} onChange={set("location")} /></div>
          </>}
          {tagKey && (() => { const [label, options] = chips[step] as readonly [string, typeof L.skills, string]; return <Chips label={label} options={options} value={tags[tagKey]} onChange={(v) => setTags({ ...tags, [tagKey]: v })} />; })()}
          {step === 5 && <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="ob-sp">Starting price (INR)</Label><Input id="ob-sp" type="number" min={1} value={f.starting_price} onChange={set("starting_price")} /></div>
            <div><Label htmlFor="ob-hr">Hourly rate (INR)</Label><Input id="ob-hr" type="number" min={0} value={f.hourly_rate} onChange={set("hourly_rate")} /></div>
            <div><Label htmlFor="ob-dd">Delivery (days)</Label><Input id="ob-dd" type="number" min={1} max={365} value={f.delivery_days} onChange={set("delivery_days")} /></div>
          </div>}
          {step === 6 && me.data && <PortfolioManager creatorId={me.data.id} />}
        </Card>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-between">
          <Button type="button" variant="outline" disabled={step === 0} onClick={() => { setError(""); setStep(step - 1); }}>Back</Button>
          <Button type="submit" variant="brand" loading={save.isPending}>{step === STEPS.length - 1 ? "Finish" : "Save and continue"}</Button>
        </div>
      </form>
    </div>
  );
}
