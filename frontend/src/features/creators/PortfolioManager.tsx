import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Input, Label, Select } from "@/components/ui";
import { FileUploader } from "@/components/FileUploader";
import { creatorsApi } from "./api";

/** Uploads a file straight into the portfolio. */
export function PortfolioFileUpload() {
  const qc = useQueryClient();
  const add = useMutation({ mutationFn: creatorsApi.addPortfolio, onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }) });
  return (
    <div className="mb-4">
      <FileUploader purpose="PORTFOLIO" accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm" maxMB={100} label="Upload an image or video" multiple
        onUploaded={(f) => add.mutate({ title: f.filename.replace(/\.[^.]+$/, ""), media_url: f.url, media_type: f.content_type.startsWith("video") ? "VIDEO" : "IMAGE" })} />
      {add.isError && <p role="alert" className="mt-2 text-sm text-red-700">{add.error.message}</p>}
    </div>
  );
}

/** Upload, add a link, and list/delete items. Used by the onboarding wizard. */
export function PortfolioManager({ creatorId }: { creatorId: string }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["portfolio", creatorId], queryFn: () => creatorsApi.portfolio(creatorId) });
  const [p, setP] = useState({ title: "", media_url: "", media_type: "LINK" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["portfolio"] });
  const add = useMutation({ mutationFn: () => creatorsApi.addPortfolio(p), onSuccess: () => { setP({ title: "", media_url: "", media_type: "LINK" }); refresh(); } });
  const del = useMutation({ mutationFn: creatorsApi.deletePortfolio, onSuccess: refresh });
  return (
    <div>
      <PortfolioFileUpload />
      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">Or link to work hosted elsewhere</p>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div><Label htmlFor="ob-t">Title</Label><Input id="ob-t" required minLength={2} value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></div>
          <div><Label htmlFor="ob-u">URL</Label><Input id="ob-u" type="url" required placeholder="https://" value={p.media_url} onChange={(e) => setP({ ...p, media_url: e.target.value })} /></div>
          <div><Label htmlFor="ob-m">Type</Label><Select id="ob-m" value={p.media_type} onChange={(e) => setP({ ...p, media_type: e.target.value })}><option value="LINK">Link</option><option value="VIDEO">Video</option><option value="IMAGE">Image</option></Select></div>
          <Button type="submit" variant="outline" loading={add.isPending}>Add</Button>
        </form>
        {add.isError && <p role="alert" className="mt-2 text-sm text-red-700">{add.error.message}</p>}
      </Card>
      <div className="mt-4 space-y-2">
        {list.data?.length === 0 && <EmptyState title="Nothing here yet" hint="You can skip this and add work later from your profile." />}
        {list.data?.map((i) => (
          <Card key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <a href={i.media_url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium hover:text-brand"><ExternalLink className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{i.title}</span></a>
            <Button variant="ghost" aria-label={`Delete ${i.title}`} onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
