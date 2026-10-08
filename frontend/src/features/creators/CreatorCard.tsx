import { Link } from "react-router-dom";
import { Clock, Star } from "lucide-react";
import { Avatar, Badge, Card, VerifiedBadge } from "@/components/ui";
import { money } from "@/lib/format";
import type { Creator } from "@/lib/types";

export function CreatorCard({ c }: { c: Creator }) {
  return (
    <Link to={`/creators/${c.id}`} className="group block">
      <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
        <div className="flex items-center gap-3">
          <Avatar name={c.display_name} src={c.avatar} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{c.display_name}</span>{c.verified && <VerifiedBadge />}</p>
            <p className="flex items-center gap-1 text-sm text-muted">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              {c.review_count ? `${c.rating.toFixed(1)} (${c.review_count})` : "New"} · {c.completed_projects} projects
            </p>
          </div>
        </div>
        <p className="mt-4 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{c.bio ?? "This creator hasn't added a bio yet."}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.featured && <Badge tone="brand">Featured</Badge>}
          {c.niches.slice(0, 2).map((n) => <Badge key={n.id} tone="brand">{n.name}</Badge>)}
          {c.languages.slice(0, 2).map((n) => <Badge key={n.id}>{n.name}</Badge>)}
        </div>
        <div className="mt-5 flex items-end justify-between border-t border-line pt-4 text-sm">
          <div><p className="text-xs text-muted">Starting at</p><p className="font-display text-lg font-bold">{money(c.starting_price)}</p></div>
          <p className="flex items-center gap-1 text-muted"><Clock className="h-4 w-4" aria-hidden />{c.delivery_days ? `${c.delivery_days} days` : "Delivery not set"}</p>
        </div>
      </Card>
    </Link>
  );
}
