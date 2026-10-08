import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "./NotificationBell";
import { Button, LinkButton } from "./ui";

const nav = [
  { to: "/creators", label: "Find creators" },
  { to: "/jobs", label: "Browse jobs" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const home = user?.role === "BRAND" ? "/dashboard/brand" : user?.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/creator";
  const homeLabel = user?.role === "BRAND" ? "Dashboard" : "Dashboard";
  const link = ({ isActive }: { isActive: boolean }) => `text-sm font-medium ${isActive ? "text-brand" : "text-ink hover:text-brand"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="font-display text-xl font-bold">Creatorly</Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            {nav.map((n) => <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <NotificationBell />
                <LinkButton to={home} variant="outline">{homeLabel}</LinkButton>
                <Button variant="ghost" onClick={() => { logout(); navigate("/"); }}>Log out</Button>
              </>
            ) : (
              <>
                <LinkButton to="/login" variant="ghost">Log in</LinkButton>
                <LinkButton to="/register">Get started</LinkButton>
              </>
            )}
          </div>
          <button className="rounded-lg p-2 md:hidden" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="border-t border-line bg-white px-5 py-4 md:hidden" onClick={() => setOpen(false)}>
            <div className="flex flex-col gap-4">
              {nav.map((n) => <NavLink key={n.to} to={n.to} className={link}>{n.label}</NavLink>)}
              {user ? (
                <>
                  <Link to={home} className="text-sm font-medium">{homeLabel}</Link>
                  <Link to="/notifications" className="text-sm font-medium">Notifications</Link>
                  <button className="text-left text-sm font-medium" onClick={() => { logout(); navigate("/"); }}>Log out</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium">Log in</Link>
                  <Link to="/register" className="text-sm font-medium text-brand">Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-line bg-mist">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-muted md:flex-row md:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-ink">Creatorly</p>
            <p className="mt-1 max-w-xs">Hire AI creators for UGC, ads, product visuals and social video.</p>
          </div>
          <div className="flex gap-10">
            <div className="flex flex-col gap-2">
              <Link to="/creators">Find creators</Link><Link to="/jobs">Browse jobs</Link><Link to="/register">Join as a creator</Link>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/how-it-works">How it works</Link><Link to="/pricing">Pricing</Link><Link to="/about">About</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
