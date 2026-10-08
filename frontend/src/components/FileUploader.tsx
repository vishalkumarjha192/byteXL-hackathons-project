import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { uploadFile } from "@/lib/api";
import type { UploadedFile } from "@/lib/types";

interface Props { purpose: string; projectId?: string; accept: string; maxMB: number; label?: string; multiple?: boolean; onUploaded: (f: UploadedFile) => void }

export function FileUploader({ purpose, projectId, accept, maxMB, label = "Drop a file here or choose one", multiple, onUploaded }: Props) {
  const [busy, setBusy] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const exts = accept.split(",").map((s) => s.trim().toLowerCase());

  async function handle(files: FileList | File[]) {
    setError("");
    for (const f of Array.from(files)) {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (!exts.includes(ext)) return setError(`${f.name}: only ${exts.join(", ")} files are allowed`);
      if (f.size > maxMB * 1024 * 1024) return setError(`${f.name} is larger than ${maxMB} MB`);
      try {
        setBusy({ name: f.name, pct: 0 });
        onUploaded(await uploadFile(f, { purpose, projectId, onProgress: (pct) => setBusy({ name: f.name, pct }) }));
      } catch (e) { setError((e as Error).message); break; } finally { setBusy(null); }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) handle(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm focus-within:outline focus-within:outline-2 focus-within:outline-brand ${drag ? "border-brand bg-brand-soft" : "border-line hover:bg-mist"} ${busy ? "pointer-events-none opacity-70" : ""}`}>
        <Upload className="h-5 w-5 text-muted" aria-hidden />
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted">{exts.join(" ")} up to {maxMB} MB</span>
        <input ref={input} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={!!busy} onChange={(e) => e.target.files && handle(e.target.files)} />
      </label>
      {busy && (
        <div className="mt-2" role="status">
          <div className="flex justify-between text-xs text-muted"><span className="truncate">{busy.name}</span><span>{busy.pct}%</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-mist"><div className="h-1.5 rounded-full bg-brand transition-[width]" style={{ width: `${busy.pct}%` }} /></div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
