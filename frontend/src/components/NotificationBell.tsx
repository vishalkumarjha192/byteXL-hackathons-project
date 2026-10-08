import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { commsApi } from "@/features/comms/api";

export function NotificationBell() {
  const q = useQuery({ queryKey: ["unread-count"], queryFn: commsApi.unreadCount, refetchInterval: 30_000 });
  const n = q.data?.unread_count ?? 0;
  return (
    <Link to="/notifications" className="relative rounded-lg p-2.5 hover:bg-mist" aria-label={n ? `Notifications, ${n} unread` : "Notifications"}>
      <Bell className="h-5 w-5" aria-hidden />
      {n > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}
