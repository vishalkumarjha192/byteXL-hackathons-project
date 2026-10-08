import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, X } from "lucide-react";
import { Button, Card, ErrorState, Input, Skeleton } from "@/components/ui";
import { FileLink } from "@/components/FileLink";
import { FileUploader } from "@/components/FileUploader";
import { tokens, wsUrl } from "@/lib/api";
import type { UploadedFile } from "@/lib/types";
import { commsApi } from "./api";

const time = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function ChatWindow({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [live, setLive] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  // Live updates arrive over a WebSocket. If it drops, polling every 5 seconds takes over until it reconnects.
  const q = useQuery({ queryKey: ["messages", projectId], queryFn: () => commsApi.messages(projectId), refetchInterval: live ? 60_000 : 5000 });
  const send = useMutation({
    mutationFn: () => commsApi.send({ project_id: projectId, message: text, ...(file ? { attachment_file_id: file.id } : {}) }),
    onSuccess: () => { setText(""); setFile(null); setShowUpload(false); qc.invalidateQueries({ queryKey: ["messages", projectId] }); },
  });

  useEffect(() => {
    let ws: WebSocket | null = null, retry = 0, closed = false;
    const connect = () => {
      if (!tokens.access) return;
      ws = new WebSocket(wsUrl(`/messages/ws/${projectId}?token=${tokens.access}`));
      ws.onopen = () => setLive(true);
      ws.onmessage = () => { qc.invalidateQueries({ queryKey: ["messages", projectId] }); qc.invalidateQueries({ queryKey: ["unread-count"] }); };
      ws.onclose = () => { setLive(false); if (!closed) retry = window.setTimeout(connect, 5000); };
    };
    connect();
    return () => { closed = true; window.clearTimeout(retry); ws?.close(); };
  }, [projectId, qc]);

  const count = q.data?.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
    if (count) qc.invalidateQueries({ queryKey: ["unread-count"] });
  }, [count, qc]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Messages</h2><span className="flex items-center gap-1.5 text-xs text-muted"><span aria-hidden className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-line"}`} />{live ? "Live" : "Reconnecting"}</span></div>
      <div className="mt-4 max-h-96 min-h-24 space-y-3 overflow-y-auto rounded-lg bg-mist p-3" aria-live="polite" aria-label="Conversation">
        {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
          : q.isLoading ? <Skeleton className="h-20" />
          : count === 0 ? <p className="py-6 text-center text-sm text-muted">No messages yet. Say hello.</p>
          : q.data!.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${m.mine ? "bg-brand text-white" : "bg-white"}`}>
                {!m.mine && <p className="mb-0.5 text-xs font-semibold text-muted">{m.sender_name}</p>}
                <p className="whitespace-pre-line break-words">{m.message}</p>
                {m.attachment_file && <div className="mt-1"><FileLink file={m.attachment_file} light={m.mine} /></div>}
                {m.attachment_url && <a href={m.attachment_url} target="_blank" rel="noreferrer" className={`mt-1 flex items-center gap-1 underline ${m.mine ? "text-white" : "text-brand"}`}><Paperclip className="h-3.5 w-3.5" aria-hidden />Attachment</a>}
                <p className={`mt-1 text-[11px] ${m.mine ? "text-white/70" : "text-muted"}`}>{time(m.created_at)}{m.mine && (m.read_at ? " · Seen" : " · Sent")}</p>
              </div>
            </div>
          ))}
        <div ref={bottom} />
      </div>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}>
        {file && <p className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4 text-muted" aria-hidden />{file.filename}<button type="button" aria-label="Remove attachment" onClick={() => setFile(null)} className="rounded p-0.5 hover:bg-mist"><X className="h-4 w-4" /></button></p>}
        {showUpload && !file && <FileUploader purpose="ATTACHMENT" projectId={projectId} accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.pdf,.zip,.docx" maxMB={20} onUploaded={setFile} />}
        <div className="flex gap-2">
          <Input aria-label="Message" placeholder="Write a message" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="button" variant="outline" aria-label="Attach a file" aria-pressed={showUpload} onClick={() => setShowUpload(!showUpload)}><Paperclip className="h-4 w-4" /></Button>
          <Button type="submit" variant="brand" loading={send.isPending} disabled={!text.trim()}>Send</Button>
        </div>
        {send.isError && <p role="alert" className="text-sm text-red-700">{send.error.message}</p>}
      </form>
    </Card>
  );
}
