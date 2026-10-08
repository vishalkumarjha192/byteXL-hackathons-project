import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Badge, Button, Card, Label, Textarea } from "@/components/ui";
import { aiApi, type Brief } from "./api";

export function AiBriefPanel({ onApply }: { onApply: (b: Brief) => void }) {
  const [prompt, setPrompt] = useState("");
  const [applied, setApplied] = useState(false);
  const gen = useMutation({ mutationFn: () => aiApi.brief(prompt), onMutate: () => setApplied(false) });
  const b = gen.data;

  return (
    <Card className="mt-6 border-brand/30 bg-brand-soft/40 p-6">
      <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand" aria-hidden /><h2 className="text-lg font-bold">Draft your brief with AI</h2></div>
      <p className="mt-1 text-sm text-muted">Describe the content in a sentence. You can edit everything before publishing.</p>
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (prompt.trim().length >= 10) gen.mutate(); }}>
        <Label htmlFor="ai-prompt">What do you want made?</Label>
        <Textarea id="ai-prompt" rows={2} maxLength={500} placeholder="Create a 30-second skincare Instagram Reel" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        {gen.isError && <p role="alert" className="mt-2 text-sm text-red-700">{gen.error.message}</p>}
        <Button type="submit" variant="brand" className="mt-3" loading={gen.isPending} disabled={prompt.trim().length < 10}>Generate brief</Button>
      </form>

      {b && (
        <div className="mt-6 space-y-4 rounded-lg bg-white p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold">{b.title}</h3>
            <Badge tone={b.source === "ai" ? "brand" : "neutral"}>{b.source === "ai" ? "AI generated" : "Template draft"}</Badge>
          </div>
          {b.source === "template" && <p className="text-xs text-muted">This is a template draft built from your sentence. An AI provider can be connected on the server for a tailored brief.</p>}
          <div><p className="font-semibold">Hook</p><p className="text-muted">{b.hook}</p></div>
          <div><p className="font-semibold">Script</p><p className="whitespace-pre-line text-muted">{b.script}</p></div>
          <div>
            <p className="font-semibold">Scenes</p>
            <ul className="mt-1 space-y-1.5">{b.scenes.map((s) => <li key={s.time} className="text-muted"><b className="text-ink">{s.time}</b> {s.visual}</li>)}</ul>
          </div>
          <div><p className="font-semibold">Call to action</p><p className="text-muted">{b.cta}</p></div>
          <div><p className="font-semibold">Deliverables</p><ul className="list-disc pl-5 text-muted">{b.deliverables.map((d) => <li key={d}>{d}</li>)}</ul></div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => { onApply(b); setApplied(true); }}>Use this brief</Button>
            {applied && <span role="status" className="text-green-700">Added to the form below</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
