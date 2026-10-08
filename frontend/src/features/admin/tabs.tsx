import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, Button, Card, ErrorState, Input, Label, Select, Skeleton, StatusBadge, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { date, money } from "@/lib/format";
import { DataTable, DetailModal, Modal, useAdminAction, useAdminList } from "./shared";

const small = "px-3 py-1.5";
const useFilters = () => { const [page, setPage] = useState(1); return { page, setPage }; };
const err = (m: { isError: boolean; error: Error | null }) => m.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{m.error?.message}</p>;

// ---------- overview ----------
interface Stats {
  total_users: number; total_creators: number; total_brands: number; suspended_users: number; open_projects: number; active_projects: number;
  completed_projects: number; pending_verification: number; open_reports: number; gross_volume: { currency: string; amount: number }[]; platform_revenue: { currency: string; amount: number }[];
}
export function OverviewTab({ go }: { go: (t: string) => void }) {
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api<Stats>("/admin/stats") });
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const s = q.data!;
  const sum = (l: Stats["gross_volume"]) => l.length ? l.map((x) => money(x.amount, x.currency)).join(" + ") : money(0);
  const cards: [string, string | number, string?][] = [
    ["Total users", s.total_users, "users"], ["Creators", s.total_creators, "creators"], ["Brands", s.total_brands, "brands"],
    ["Active projects", s.active_projects, "projects"], ["Completed projects", s.completed_projects, "projects"], ["Open projects", s.open_projects, "projects"],
    ["Gross marketplace volume", sum(s.gross_volume), "payments"], ["Platform revenue", sum(s.platform_revenue), "payments"],
    ["Pending verification", s.pending_verification, "creators"], ["Open reports", s.open_reports, "reports"], ["Suspended users", s.suspended_users, "users"],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([k, v, tab]) => (
        <button key={k} onClick={() => tab && go(tab)} className="text-left">
          <Card className="h-full p-5 hover:shadow-md"><p className="text-sm text-muted">{k}</p><p className="mt-1 font-display text-2xl font-bold">{v}</p></Card>
        </button>
      ))}
    </div>
  );
}

// ---------- users ----------
interface U { id: string; email: string; name: string; role: string; is_active: boolean; created_at: string }
export function UsersTab() {
  const { page, setPage } = useFilters();
  const [q, setQ] = useState(""); const [role, setRole] = useState(""); const [active, setActive] = useState("");
  const list = useAdminList<U>("users", { q, role, active }, page); const act = useAdminAction();
  useEffect(() => setPage(1), [q, role, active, setPage]);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input aria-label="Search by email" className="max-w-xs" placeholder="Search by email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Role" className="w-40" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="BRAND">Brands</option><option value="CREATOR">Creators</option><option value="ADMIN">Admins</option></Select>
        <Select aria-label="Status" className="w-40" value={active} onChange={(e) => setActive(e.target.value)}><option value="">Any status</option><option value="true">Active</option><option value="false">Suspended</option></Select>
      </div>
      {err(act)}
      <DataTable q={list} page={page} onPage={setPage} empty="No users found" cols={[
        { h: "User", c: (u) => <><p className="font-medium">{u.name}</p><p className="text-muted">{u.email}</p></> },
        { h: "Role", c: (u) => <Badge>{u.role.toLowerCase()}</Badge> },
        { h: "Status", c: (u) => <Badge tone={u.is_active ? "brand" : "neutral"}>{u.is_active ? "Active" : "Suspended"}</Badge> },
        { h: "Joined", c: (u) => date(u.created_at) },
        { h: "Action", c: (u) => u.role === "ADMIN" ? <span className="text-muted">-</span> : (
          <Button variant="outline" className={small} loading={act.isPending && act.variables?.path === `/users/${u.id}/suspend`}
            onClick={() => (u.is_active ? window.confirm(`Suspend ${u.email}? They will be signed out and hidden.`) : true) && act.mutate({ path: `/users/${u.id}/suspend`, body: { suspended: u.is_active } })}>
            {u.is_active ? "Suspend" : "Reinstate"}</Button>) },
      ]} />
    </>
  );
}

// ---------- creators ----------
interface C { id: string; display_name: string; email: string; verified: boolean; verification_requested: boolean; featured: boolean; is_active: boolean; rating: number; review_count: number; completed_projects: number }
export function CreatorsTab({ initialPending = false }: { initialPending?: boolean }) {
  const { page, setPage } = useFilters();
  const [q, setQ] = useState(""); const [view, setView] = useState(initialPending ? "pending" : "");
  const params = { q, pending: view === "pending" ? "true" : undefined, verified: view === "verified" ? "true" : view === "unverified" ? "false" : undefined, featured: view === "featured" ? "true" : undefined };
  const list = useAdminList<C>("creators", params, page); const act = useAdminAction();
  useEffect(() => setPage(1), [q, view, setPage]);
  const run = (path: string, body: unknown) => act.mutate({ path, body });
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input aria-label="Search creators" className="max-w-xs" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Filter" className="w-48" value={view} onChange={(e) => setView(e.target.value)}><option value="">All creators</option><option value="pending">Awaiting verification</option><option value="verified">Verified</option><option value="unverified">Not verified</option><option value="featured">Featured</option></Select>
      </div>
      {err(act)}
      <DataTable q={list} page={page} onPage={setPage} empty="No creators found" cols={[
        { h: "Creator", c: (c) => <><Link to={`/creators/${c.id}`} className="font-medium hover:text-brand">{c.display_name}</Link><p className="text-muted">{c.email}</p></> },
        { h: "Rating", c: (c) => c.review_count ? `${c.rating.toFixed(1)} (${c.review_count})` : "No reviews" },
        { h: "Status", c: (c) => <div className="flex flex-wrap gap-1">{c.verified && <Badge tone="brand">Verified</Badge>}{c.verification_requested && !c.verified && <Badge>Awaiting review</Badge>}{c.featured && <Badge tone="brand">Featured</Badge>}{!c.is_active && <Badge>Suspended</Badge>}</div> },
        { h: "Actions", c: (c) => (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={small} onClick={() => run(`/creators/${c.id}/verify`, { verified: !c.verified })}>{c.verified ? "Remove verification" : "Verify"}</Button>
            <Button variant="outline" className={small} onClick={() => run(`/creators/${c.id}/feature`, { featured: !c.featured })}>{c.featured ? "Unfeature" : "Feature"}</Button>
          </div>) },
      ]} />
    </>
  );
}

// ---------- brands ----------
interface B { id: string; company_name: string; email: string; industry: string | null; projects: number; is_active: boolean }
export function BrandsTab() {
  const { page, setPage } = useFilters(); const [q, setQ] = useState("");
  const list = useAdminList<B>("brands", { q }, page);
  useEffect(() => setPage(1), [q, setPage]);
  return (
    <>
      <div className="mb-4"><Input aria-label="Search brands" className="max-w-xs" placeholder="Company or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <DataTable q={list} page={page} onPage={setPage} empty="No brands found" cols={[
        { h: "Brand", c: (b) => <><p className="font-medium">{b.company_name}</p><p className="text-muted">{b.email}</p></> },
        { h: "Industry", c: (b) => b.industry ?? "-" }, { h: "Projects", c: (b) => b.projects },
        { h: "Status", c: (b) => <Badge tone={b.is_active ? "brand" : "neutral"}>{b.is_active ? "Active" : "Suspended"}</Badge> },
      ]} />
    </>
  );
}

// ---------- projects ----------
interface P { id: string; title: string; brand: string; status: string; budget: number; currency: string; created_at: string }
export function ProjectsTab() {
  const { page, setPage } = useFilters(); const [q, setQ] = useState(""); const [status, setStatus] = useState("");
  const [view, setView] = useState<P | null>(null);
  const list = useAdminList<P>("projects", { q, status }, page);
  useEffect(() => setPage(1), [q, status, setPage]);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input aria-label="Search projects" className="max-w-xs" placeholder="Project title" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Status" className="w-52" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{["OPEN", "IN_PROGRESS", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "FINAL_SUBMITTED", "APPROVED", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}</Select>
      </div>
      <DataTable q={list} page={page} onPage={setPage} empty="No projects found" cols={[
        { h: "Project", c: (p) => <><p className="font-medium">{p.title}</p><p className="text-muted">{p.brand}</p></> },
        { h: "Status", c: (p) => <StatusBadge status={p.status} /> }, { h: "Budget", c: (p) => money(p.budget, p.currency) }, { h: "Created", c: (p) => date(p.created_at) },
        { h: "View", c: (p) => <Button variant="outline" className={small} onClick={() => setView(p)}>Details</Button> },
      ]} />
      {view && <DetailModal kind="projects" id={view.id} title={view.title} onClose={() => setView(null)} />}
    </>
  );
}

// ---------- payments ----------
interface Pay { id: string; project: string; payer: string; recipient: string; amount: number; platform_fee: number; currency: string; status: string; created_at: string }
export function PaymentsTab() {
  const { page, setPage } = useFilters(); const [status, setStatus] = useState("");
  const [view, setView] = useState<Pay | null>(null);
  const list = useAdminList<Pay>("payments", { status }, page);
  useEffect(() => setPage(1), [status, setPage]);
  return (
    <>
      <div className="mb-4"><Select aria-label="Status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{["PENDING", "HELD", "RELEASED", "REFUNDED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select></div>
      <DataTable q={list} page={page} onPage={setPage} empty="No payments found" cols={[
        { h: "Project", c: (p) => <><p className="font-medium">{p.project}</p><p className="text-muted">{p.payer} to {p.recipient}</p></> },
        { h: "Amount", c: (p) => money(p.amount, p.currency) }, { h: "Platform fee", c: (p) => money(p.platform_fee, p.currency) },
        { h: "Status", c: (p) => <StatusBadge status={p.status} /> }, { h: "Date", c: (p) => date(p.created_at) },
        { h: "View", c: (p) => <Button variant="outline" className={small} onClick={() => setView(p)}>Details</Button> },
      ]} />
      {view && <DetailModal kind="payments" id={view.id} title={`Payment for ${view.project}`} onClose={() => setView(null)} />}
    </>
  );
}

// ---------- reports ----------
interface R { id: string; target_type: string; target_id: string; target: string; reason: string; details: string | null; status: string; reporter: string; resolution_note: string | null; created_at: string }
export function ReportsTab() {
  const { page, setPage } = useFilters(); const [status, setStatus] = useState("OPEN");
  const [open, setOpen] = useState<R | null>(null); const [note, setNote] = useState("");
  const list = useAdminList<R>("reports", { status }, page); const act = useAdminAction();
  useEffect(() => setPage(1), [status, setPage]);
  const resolve = (action: string) => open && act.mutate({ path: `/reports/${open.id}/resolve`, body: { action, note: note || null } }, { onSuccess: () => { setOpen(null); setNote(""); } });
  const link = (r: R) => r.target_type === "PROJECT" ? `/jobs/${r.target_id}` : r.target_type === "CREATOR" ? `/creators/${r.target_id}` : null;
  return (
    <>
      <div className="mb-4"><Select aria-label="Status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option><option value="">All</option></Select></div>
      <DataTable q={list} page={page} onPage={setPage} empty="No reports here" cols={[
        { h: "Reported content", c: (r) => <><Badge>{r.target_type.toLowerCase()}</Badge> <span className="font-medium">{r.target}</span>{link(r) && <Link to={link(r)!} className="ml-2 text-brand">View</Link>}</> },
        { h: "Reason", c: (r) => <><p className="font-medium">{r.reason.toLowerCase()}</p>{r.details && <p className="max-w-xs text-muted">{r.details}</p>}</> },
        { h: "Reporter", c: (r) => r.reporter }, { h: "Date", c: (r) => date(r.created_at) },
        { h: "Status", c: (r) => <><StatusBadge status={r.status} />{r.resolution_note && <p className="mt-1 max-w-[12rem] text-xs text-muted">{r.resolution_note}</p>}</> },
        { h: "Action", c: (r) => r.status === "OPEN" ? <Button variant="outline" className={small} onClick={() => { setOpen(r); setNote(""); act.reset(); }}>Review</Button> : <span className="text-muted">-</span> },
      ]} />
      {open && (
        <Modal title="Review report" onClose={() => setOpen(null)}>
          <p className="text-sm"><Badge>{open.target_type.toLowerCase()}</Badge> <b>{open.target}</b></p>
          <p className="mt-2 text-sm text-muted">Reported for {open.reason.toLowerCase()} by {open.reporter}.{open.details && ` "${open.details}"`}</p>
          <div className="mt-4"><Label htmlFor="note">Note (optional)</Label><Textarea id="note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="mt-3">{err(act)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {open.target_type !== "CREATOR" && <Button variant="brand" loading={act.isPending} onClick={() => window.confirm("Remove this content? This cannot be undone.") && resolve("REMOVE_CONTENT")}>Remove content</Button>}
            <Button variant="outline" onClick={() => resolve("RESOLVE")}>Mark resolved</Button>
            <Button variant="ghost" onClick={() => resolve("DISMISS")}>Dismiss</Button>
          </div>
          {open.target_type === "CREATOR" && <p className="mt-3 text-xs text-muted">Profiles cannot be removed. To act on this creator, suspend them from the Users tab.</p>}
        </Modal>
      )}
    </>
  );
}

// ---------- audit log ----------
interface Audit { id: string; admin: string; action: string; summary: string; created_at: string }
export function AuditTab() {
  const { page, setPage } = useFilters();
  const list = useAdminList<Audit>("audit", {}, page);
  return (
    <>
      <p className="mb-4 text-sm text-muted">Every admin action is recorded here and cannot be edited.</p>
      <DataTable q={list} page={page} onPage={setPage} empty="No admin actions yet" cols={[
        { h: "When", c: (a) => new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) },
        { h: "Admin", c: (a) => a.admin }, { h: "Action", c: (a) => <Badge>{a.action.replace(/_/g, " ").toLowerCase()}</Badge> }, { h: "Details", c: (a) => a.summary },
      ]} />
    </>
  );
}

// ---------- categories ----------
type Cats = Record<string, { id: number; name: string; usage: number }[]>;
const KIND_LABEL: Record<string, string> = { skills: "Content types", niches: "Niches", languages: "Languages", ai_tools: "AI tools" };
export function CategoriesTab() {
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<Cats>("/admin/categories") });
  const act = useAdminAction(); const [names, setNames] = useState<Record<string, string>>({});
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-6">
      {err(act)}
      {Object.entries(q.data!).map(([kind, rows]) => (
        <Card key={kind} className="p-5">
          <h2 className="text-lg font-bold">{KIND_LABEL[kind]}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-full border border-line py-1 pl-3 pr-1 text-sm">
                {r.name}<span className="text-xs text-muted">{r.usage} in use</span>
                <button aria-label={`Delete ${r.name}`} disabled={r.usage > 0} title={r.usage > 0 ? "In use, cannot delete" : "Delete"} onClick={() => window.confirm(`Delete ${r.name}?`) && act.mutate({ path: `/categories/${kind}/${r.id}`, method: "DELETE" })}
                  className="rounded-full px-2 py-0.5 text-muted hover:bg-mist hover:text-red-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted">x</button>
              </li>
            ))}
          </ul>
          <form className="mt-4 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); const name = (names[kind] ?? "").trim(); if (name) act.mutate({ path: `/categories/${kind}`, body: { name } }, { onSuccess: () => setNames({ ...names, [kind]: "" }) }); }}>
            <Input aria-label={`New ${KIND_LABEL[kind]} name`} placeholder="Add new" minLength={2} maxLength={80} value={names[kind] ?? ""} onChange={(e) => setNames({ ...names, [kind]: e.target.value })} />
            <Button type="submit" variant="outline">Add</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
