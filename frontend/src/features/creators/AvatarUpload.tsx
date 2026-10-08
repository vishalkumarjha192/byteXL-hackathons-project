import { Avatar } from "@/components/ui";
import { FileUploader } from "@/components/FileUploader";

export function AvatarUpload({ name, src, purpose = "AVATAR", onChange }: { name: string; src: string | null | undefined; purpose?: "AVATAR" | "LOGO"; onChange: (url: string) => void }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || "?"} src={src} size={64} />
      <div className="flex-1"><FileUploader purpose={purpose} accept=".png,.jpg,.jpeg,.webp" maxMB={5} label={src ? "Replace picture" : "Upload a picture"} onUploaded={(f) => f.url && onChange(f.url)} /></div>
    </div>
  );
}
