import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { EmptyState, ErrorState, Input, Pagination, Select, Skeleton, Button, Label } from "@/components/ui";
import { creatorsApi } from "./api";
import { CreatorCard } from "./CreatorCard";

const PAGE_SIZE = 12;

export default function CreatorsPage() {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const [q, setQ] = useState(get("q"));
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: creatorsApi.lookups, staleTime: Infinity });
  const query = Object.fromEntries(params.entries());
  const result = useQuery({ queryKey: ["creators", query], queryFn: () => creatorsApi.search({ ...query, page_size: String(PAGE_SIZE) }), placeholderData: (p) => p });

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next);
  };
  useEffect(() => {
    const t = setTimeout(() => q !== get("q") && set("q", q), 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const L = lookups.data;
  const page = Number(get("page") || 1);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-4xl font-bold">Find your AI creator</h1>
      <p className="mt-2 text-muted">Filter by niche, language, tools and budget, then open a profile to see real work.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4" aria-label="Filters">
          <div>
            <Label htmlFor="q">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
              <Input id="q" className="pl-9" placeholder="Name or keyword" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {([["category", "Content type", L?.skills], ["niche", "Niche", L?.niches], ["language", "Language", L?.languages], ["ai_tool", "AI tool", L?.ai_tools]] as const).map(([k, label, opts]) => (
            <div key={k}>
              <Label htmlFor={k}>{label}</Label>
              <Select id={k} value={get(k)} onChange={(e) => set(k, e.target.value)}>
                <option value="">Any</option>
                {opts?.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </Select>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="min_price">Min price</Label><Input id="min_price" type="number" min={0} value={get("min_price")} onChange={(e) => set("min_price", e.target.value)} /></div>
            <div><Label htmlFor="max_price">Max price</Label><Input id="max_price" type="number" min={0} value={get("max_price")} onChange={(e) => set("max_price", e.target.value)} /></div>
          </div>
          <div>
            <Label htmlFor="min_rating">Rating</Label>
            <Select id="min_rating" value={get("min_rating")} onChange={(e) => set("min_rating", e.target.value)}>
              <option value="">Any</option><option value="4">4.0 and up</option><option value="4.5">4.5 and up</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="delivery_days">Delivery</Label>
            <Select id="delivery_days" value={get("delivery_days")} onChange={(e) => set("delivery_days", e.target.value)}>
              <option value="">Any</option><option value="2">Within 2 days</option><option value="5">Within 5 days</option><option value="10">Within 10 days</option>
            </Select>
          </div>
          {params.size > 0 && <Button variant="outline" className="w-full" onClick={() => { setQ(""); setParams({}); }}>Clear filters</Button>}
        </aside>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-muted" aria-live="polite">{result.data ? `${result.data.total} creators` : "Loading creators"}</p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-muted">Sort by</label>
              <Select id="sort" className="w-44" value={get("sort") || "recommended"} onChange={(e) => set("sort", e.target.value)}>
                <option value="recommended">Recommended</option><option value="rating">Rating</option><option value="price">Price: low to high</option><option value="newest">Newest</option>
              </Select>
            </div>
          </div>
          {result.isError ? <ErrorState message={(result.error as Error).message} onRetry={() => result.refetch()} />
            : result.isLoading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-60" />)}</div>
            : result.data?.items.length === 0 ? <EmptyState title="No creators match these filters" hint="Try removing a filter or widening your price range." action={<Button variant="outline" onClick={() => { setQ(""); setParams({}); }}>Clear filters</Button>} />
            : <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{result.data?.items.map((c) => <CreatorCard key={c.id} c={c} />)}</div>
                <Pagination page={page} total={result.data?.total ?? 0} pageSize={PAGE_SIZE} onChange={(p) => set("page", String(p))} />
              </>}
        </section>
      </div>
    </div>
  );
}
