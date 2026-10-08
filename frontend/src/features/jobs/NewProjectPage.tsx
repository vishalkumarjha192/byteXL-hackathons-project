import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { FileUploader } from "@/components/FileUploader";
import { Stepper } from "@/components/Stepper";
import { AiBriefPanel } from "@/features/ai/AiBriefPanel";
import type { Brief } from "@/features/ai/api";
import { creatorsApi } from "@/features/creators/api";
import { date, fileSize, money } from "@/lib/format";
import type { UploadedFile } from "@/lib/types";
import { jobsApi } from "./api";

const schema = z.object({
  title: z.string().min(3, "At least 3 characters"),
  content_type: z.string().min(2, "Describe the format, e.g. Reel"),
  category: z.string().min(1, "Choose a category"),
  description: z.string().min(10, "At least 10 characters"),
  target_audience: z.string().optional(),
  language: z.string().optional(),
  platform: z.string().optional(),
  video_duration: z.string().optional().refine((v) => !v || (Number(v) >= 1 && Number(v) <= 3600), "Enter 1 to 3600 seconds"),
  style: z.string().max(200).optional(),
  deliverables: z.string().max(2000).optional(),
  revisions: z.coerce.number({ invalid_type_error: "Enter a number" }).int().min(0, "0 or more").max(20, "20 at most"),
  budget: z.coerce.number({ invalid_type_error: "Enter a budget" }).gt(0, "Budget must be above 0"),
  currency: z.string().length(3),
  deadline: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const STEPS = ["Basics", "Requirements", "Budget", "Files", "Review"];
const STEP_FIELDS: (keyof Form)[][] = [
  ["title", "content_type", "category", "description"],
  ["target_audience", "language", "platform", "video_duration", "style", "deliverables", "revisions"],
  ["budget", "currency", "deadline"], [], [],
];
const ASSET_TYPES: Record<string, string> = { PRODUCT_IMAGE: "Product image", PRODUCT_VIDEO: "Product video", LOGO: "Brand logo", GUIDELINES: "Brand guidelines", REFERENCE_VIDEO: "Reference video" };
const guessType = (f: UploadedFile) => (f.content_type.startsWith("video") ? "PRODUCT_VIDEO" : f.content_type === "application/pdf" ? "GUIDELINES" : "PRODUCT_IMAGE");

export default function NewProjectPage() {
  const nav = useNavigate();
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: creatorsApi.lookups, staleTime: Infinity });
  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<{ file: UploadedFile; type: string }[]>([]);
  const [error, setError] = useState("");
  const { register, handleSubmit, setValue, trigger, getValues, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { currency: "INR", revisions: 2 } });

  const applyBrief = (b: Brief) => {
    const opt = { shouldValidate: true, shouldDirty: true };
    setValue("title", b.title, opt); setValue("category", b.suggested.category, opt); setValue("content_type", b.suggested.content_type, opt);
    setValue("platform", b.suggested.platform, opt); setValue("language", b.suggested.language, opt);
    setValue("deliverables", b.deliverables.join("\n"), opt);
    setValue("description", `${b.hook}\n\nScript:\n${b.script}\n\nCall to action: ${b.cta}`, opt);
  };
  const next = async () => { if (await trigger(STEP_FIELDS[step])) { setStep(step + 1); window.scrollTo({ top: 0 }); } };
  const publish = handleSubmit(async (d) => {
    setError("");
    try {
      const body: Record<string, unknown> = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== "" && v !== undefined));
      if (d.video_duration) body.video_duration = Number(d.video_duration);
      body.assets = assets.map((a) => ({ file_id: a.file.id, file_type: a.type }));
      await jobsApi.create(body);
      nav("/dashboard/brand");
    } catch (e) { setError((e as Error).message); }
  });
  const v = getValues();
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-bold">Post a project</h1>
      <div className="mt-5"><Stepper steps={STEPS} current={step} /></div>
      <form noValidate className="mt-6" onSubmit={(e) => { e.preventDefault(); last ? publish() : next(); }}>
        <div hidden={step !== 0} className="space-y-6">
          <AiBriefPanel onApply={applyBrief} />
          <Card className="space-y-5 p-6">
            <div><Label htmlFor="title" error={errors.title?.message}>Project title</Label><Input id="title" placeholder="30-second skincare Reel" {...register("title")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="category" error={errors.category?.message}>Category</Label><Select id="category" {...register("category")}><option value="">Choose one</option>{lookups.data?.skills.map((s) => <option key={s.id}>{s.name}</option>)}</Select></div>
              <div><Label htmlFor="content_type" error={errors.content_type?.message}>Format</Label><Input id="content_type" placeholder="Instagram Reel" {...register("content_type")} /></div>
            </div>
            <div><Label htmlFor="description" error={errors.description?.message}>Brief</Label><Textarea id="description" rows={6} placeholder="Product, tone, key messages, must-haves." {...register("description")} /></div>
          </Card>
        </div>

        <Card hidden={step !== 1} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="language">Language</Label><Select id="language" {...register("language")}><option value="">Any</option>{lookups.data?.languages.map((s) => <option key={s.id}>{s.name}</option>)}</Select></div>
            <div><Label htmlFor="platform">Platform</Label><Select id="platform" {...register("platform")}><option value="">Any</option>{["Instagram", "TikTok", "YouTube", "Website"].map((s) => <option key={s}>{s}</option>)}</Select></div>
            <div><Label htmlFor="video_duration" error={errors.video_duration?.message}>Video length (seconds)</Label><Input id="video_duration" inputMode="numeric" placeholder="30" {...register("video_duration")} /></div>
          </div>
          <div><Label htmlFor="target_audience">Target audience</Label><Input id="target_audience" placeholder="Women 25-34 who care about skincare" {...register("target_audience")} /></div>
          <div><Label htmlFor="style">Style</Label><Input id="style" placeholder="Warm, handheld, natural light" {...register("style")} /></div>
          <div><Label htmlFor="deliverables" error={errors.deliverables?.message}>Deliverables</Label><Textarea id="deliverables" rows={3} placeholder={"1 x 30s Reel (9:16)\n3 alternative hooks"} {...register("deliverables")} /></div>
          <div className="max-w-[160px]"><Label htmlFor="revisions" error={errors.revisions?.message}>Revisions included</Label><Input id="revisions" type="number" min={0} max={20} {...register("revisions")} /></div>
        </Card>

        <Card hidden={step !== 2} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="budget" error={errors.budget?.message}>Budget</Label><Input id="budget" type="number" min={1} {...register("budget")} /></div>
            <div><Label htmlFor="currency">Currency</Label><Select id="currency" {...register("currency")}><option>INR</option><option>USD</option></Select></div>
            <div><Label htmlFor="deadline">Deadline</Label><Input id="deadline" type="date" {...register("deadline")} /></div>
          </div>
          <p className="text-sm text-muted">Payment is held securely once you hire a creator and fund the project. Creators are paid only when you complete it.</p>
        </Card>

        <Card hidden={step !== 3} className="space-y-4 p-6">
          <p className="text-sm text-muted">Add anything creators need: product shots, your logo, brand guidelines or reference videos. This step is optional.</p>
          <FileUploader purpose="ASSET" accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.pdf" maxMB={50} multiple label="Drop files here or choose them"
            onUploaded={(file) => setAssets((a) => (a.length >= 10 ? a : [...a, { file, type: guessType(file) }]))} />
          {assets.length >= 10 && <p className="text-sm text-muted">You can attach up to 10 files.</p>}
          <ul className="space-y-2">
            {assets.map((a, i) => (
              <li key={a.file.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{a.file.filename} <span className="font-normal text-muted">{fileSize(a.file.size)}</span></span>
                <Select aria-label={`Type of ${a.file.filename}`} className="w-44" value={a.type} onChange={(e) => setAssets(assets.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                  {Object.entries(ASSET_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </Select>
                <Button type="button" variant="ghost" aria-label={`Remove ${a.file.filename}`} onClick={() => setAssets(assets.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>

        {last && (
          <Card className="p-6">
            <h2 className="text-lg font-bold">{v.title}</h2>
            <p className="mt-1 text-sm text-muted">{v.category} · {v.content_type}</p>
            <p className="mt-4 whitespace-pre-line text-sm text-muted">{v.description}</p>
            <dl className="mt-5 divide-y divide-line text-sm">
              {([["Budget", money(Number(v.budget) || 0, v.currency)], ["Deadline", v.deadline ? date(v.deadline) : "No deadline"], ["Language", v.language || "Any"], ["Platform", v.platform || "Any"],
                ["Video length", v.video_duration ? `${v.video_duration} seconds` : "Not specified"], ["Audience", v.target_audience || "Not specified"], ["Style", v.style || "Not specified"],
                ["Revisions included", String(v.revisions)], ["Files", assets.length ? `${assets.length} attached` : "None"]] as [string, string][]).map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{val}</dd></div>
              ))}
            </dl>
            {v.deliverables && <div className="mt-4 text-sm"><p className="font-semibold">Deliverables</p><p className="whitespace-pre-line text-muted">{v.deliverables}</p></div>}
          </Card>
        )}

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</Button>
          {last ? <Button type="submit" variant="brand" loading={isSubmitting}>Publish project</Button> : <Button type="submit" variant="brand">{step === 3 && assets.length === 0 ? "Skip for now" : "Next"}</Button>}
        </div>
      </form>
    </div>
  );
}
