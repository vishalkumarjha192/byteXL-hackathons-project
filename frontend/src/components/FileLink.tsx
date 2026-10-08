import { useState } from "react";
import { Paperclip } from "lucide-react";
import { api } from "@/lib/api";
import { fileSize } from "@/lib/format";
import type { UploadedFile } from "@/lib/types";

/** Private files have no permanent URL: clicking asks the server for a short-lived signed link, then opens it. */
export function FileLink({ file, label, light }: { file: UploadedFile; label?: string; light?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    setBusy(true); setError("");
    try {
      const url = file.url ?? (await api<{ url: string }>(`/files/${file.id}/link`)).url;
      window.open(url, "_blank", "noopener");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={open} disabled={busy} className={`inline-flex items-center gap-1.5 text-left font-semibold underline-offset-2 hover:underline disabled:opacity-60 ${light ? "text-white" : "text-brand"}`}>
        <Paperclip className="h-4 w-4 shrink-0" aria-hidden />{label ?? file.filename}<span className={`text-xs font-normal ${light ? "text-white/70" : "text-muted"}`}>{fileSize(file.size)}</span>
      </button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
