import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, Badge, EmptyState, ErrorState, Input, Pagination, Select, Skeleton, LinkButton } from "@/components/ui";
import { creatorsApi } from "@/features/creators/api";
import { date, money } from "@/lib/format";
import { jobsApi } from "./api";

const PAGE_SIZE = 10;

export default function JobsPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: creatorsApi.lookups, staleTime: Infinity });
  const jobs = useQuery({ queryKey: ["jobs", q, category, page], queryFn: () => jobsApi.list({ q, category, page: String(page), page_size: String(PAGE_SIZE) }), placeholderData: (p) => p });

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-4xl font-bold">Open projects</h1>
      <p className="mt-2 text-muted">Briefs from brands looking for AI creators.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px]">
        <Input aria-label="Search projects" placeholder="Search by title" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {lookups.data?.skills.map((s) => <option key={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <div className="mt-6 space-y-4">
        {jobs.isError ? <ErrorState message={(jobs.error as Error).message} onRetry={() => jobs.refetch()} />
          : jobs.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : jobs.data?.items.length === 0 ? <EmptyState title="No open projects" hint="Nothing matches yet. Brands post new briefs every day, so check back soon." action={<LinkButton to="/dashboard/brand/projects/new" variant="outline">Post a project</LinkButton>} />
          : jobs.data?.items.map((j) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="block">
              <Card className="p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div><h2 className="text-lg font-bold">{j.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted">{j.description}</p></div>
                  <p className="shrink-0 font-display text-lg font-bold">{money(j.budget, j.currency)}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Badge tone="brand">{j.category}</Badge><Badge>{j.content_type}</Badge>{j.language && <Badge>{j.language}</Badge>}
                  <span className="ml-auto">Due {date(j.deadline)} · Posted {date(j.created_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
      </div>
      <Pagination page={page} total={jobs.data?.total ?? 0} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}
