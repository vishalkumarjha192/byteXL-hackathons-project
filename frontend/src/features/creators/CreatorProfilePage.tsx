import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Clock, ExternalLink, MapPin, Star } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, ErrorState, Skeleton, VerifiedBadge, LinkButton } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { CreatorReviews } from "@/features/reviews/CreatorReviews";
import { ReportButton } from "@/features/admin/ReportButton";
import { creatorsApi } from "./api";

export default function CreatorProfilePage() {
  const { id = "" } = useParams();
  const creator = useQuery({ queryKey: ["creator", id], queryFn: () => creatorsApi.get(id), retry: false });
  const portfolio = useQuery({ queryKey: ["portfolio", id], queryFn: () => creatorsApi.portfolio(id), enabled: creator.isSuccess });

  if (creator.isLoading) return <div className="mx-auto max-w-5xl space-y-4 px-5 py-10"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (creator.isError) {
    const notFound = creator.error instanceof ApiError && creator.error.status === 404;
    return <div className="mx-auto max-w-xl px-5 py-16">{notFound
      ? <EmptyState title="Creator not found" hint="This profile may have been removed." action={<LinkButton to="/creators">Browse creators</LinkButton>} />
      : <ErrorState message={creator.error.message} onRetry={() => creator.refetch()} />}</div>;
  }
  const c = creator.data!;
  const tags = (title: string, items: { id: number; name: string }[]) => items.length > 0 && (
    <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="flex flex-wrap gap-1.5">{items.map((i) => <Badge key={i.id}>{i.name}</Badge>)}</div></div>
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link to="/creators" className="text-sm text-muted hover:text-ink">Back to creators</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="flex items-center gap-4">
            <Avatar name={c.display_name} src={c.avatar} size={72} />
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold">{c.display_name}{c.verified && <VerifiedBadge />}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-muted">
                <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-current" aria-hidden />{c.review_count ? `${c.rating.toFixed(1)} from ${c.review_count} reviews` : "No reviews yet"}</span>
                {c.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{c.location}</span>}
                <span>{c.completed_projects} projects completed</span>
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-prose whitespace-pre-line text-muted">{c.bio ?? "This creator hasn't added a bio yet."}</p>
          <div className="mt-6 space-y-5">{tags("Content types", c.skills)}{tags("Niches", c.niches)}{tags("Languages", c.languages)}{tags("AI tools", c.ai_tools)}</div>

          <h2 className="mb-4 mt-12 text-2xl font-bold">Portfolio</h2>
          {portfolio.isLoading ? <Skeleton className="h-40" /> : portfolio.data?.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {portfolio.data.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  {p.media_type === "IMAGE" ? <img src={p.media_url} alt={p.title} className="aspect-video w-full object-cover" loading="lazy" />
                    : p.media_type === "VIDEO" ? <video src={p.media_url} poster={p.thumbnail_url ?? undefined} controls preload="none" className="aspect-video w-full bg-ink" />
                    : <a href={p.media_url} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center gap-2 bg-mist text-sm font-semibold text-brand"><ExternalLink className="h-4 w-4" aria-hidden />Open external work</a>}
                  <div className="p-4"><p className="font-semibold">{p.title}</p>{p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}<div className="mt-2"><ReportButton targetType="PORTFOLIO" targetId={p.id} /></div></div>
                </Card>
              ))}
            </div>
          ) : <EmptyState title="No portfolio yet" hint="This creator hasn't uploaded work samples." />}

          <CreatorReviews creatorId={c.id} />
        </div>

        <aside>
          <Card className="sticky top-24 p-5">
            <p className="text-xs text-muted">Starting at</p>
            <p className="font-display text-3xl font-bold">{money(c.starting_price)}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Clock className="h-4 w-4" aria-hidden />{c.delivery_days ? `Delivers in ${c.delivery_days} days` : "Delivery time not set"}</p>
            <p className="mt-5 text-sm text-muted">To hire this creator, post a project and review their application.</p>
            <LinkButton to="/dashboard/brand/projects/new" variant="brand" className="mt-3 w-full">Post a project</LinkButton>
            <div className="mt-4 border-t border-line pt-3"><ReportButton targetType="CREATOR" targetId={c.id} label="Report this profile" /></div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
