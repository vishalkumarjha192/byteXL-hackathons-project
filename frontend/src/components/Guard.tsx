import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Skeleton } from "./ui";

export function RequireRole({ role }: { role?: Role }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-40" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
