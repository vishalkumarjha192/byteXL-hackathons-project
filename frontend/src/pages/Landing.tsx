import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar, LinkButton, Skeleton, VerifiedBadge } from "@/components/ui";
import { CreatorCard } from "@/features/creators/CreatorCard";
import { creatorsApi } from "@/features/creators/api";
import { money } from "@/lib/format";

const categories = [
  ["AI UGC", "Creator-style videos that feel native to the feed"],
  ["AI Avatar", "Presenter videos without a film crew"],
  ["Product Ads", "Short ads built to convert"],
  ["AI Image", "Product photography and campaign visuals"],
  ["Voiceover", "Narration in your brand's voice and language"],
  ["Social Media Content", "Reels, Shorts and TikToks on a schedule"],
];
const steps = [
  ["Post a brief", "Say what you need, your budget and your deadline."],
  ["Review applications", "Creators send proposals, prices and portfolio samples."],
  ["Approve the work", "Check the draft, ask for revisions, then approve the final files."],
  ["Pay and review", "Release payment when you are happy and leave a review."],
];
const faqs = [
  ["What is an AI content creator?", "A creator who uses tools like Runway, HeyGen, Midjourney and ElevenLabs to produce videos, images and voiceovers for brands."],
  ["How do I choose a creator?", "Filter by niche, language, tools and price, then check the portfolio on their profile."],
  ["What does it cost to use Creatorly?", "Posting a project is free. A commission is taken from each completed project. See the pricing page for details."],
  ["Can I hire for a single video?", "Yes. Projects can be one deliverable or a recurring series."],
];

export default function Landing() {
  const top = useQuery({ queryKey: ["creators", "featured"], queryFn: () => creatorsApi.search({ sort: "recommended", page_size: "6" }) });
  const hero = top.data?.items.slice(0, 3) ?? [];

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:py-24">
        <div>
          <h1 className="text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">Find AI creators. Create better content. Grow faster.</h1>
          <p className="mt-6 max-w-xl text-lg text-muted">Connect with AI content creators who produce high-quality UGC, ads, product videos and social content for modern brands.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton to="/creators" variant="brand" className="px-6 py-3">Find creators</LinkButton>
            <LinkButton to="/register?role=creator" variant="outline" className="px-6 py-3">Become a creator</LinkButton>
          </div>
        </div>
        <div className="space-y-3" aria-label="Top creators">
          {top.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
            : hero.length === 0 ? <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Creators will appear here as they join.</div>
            : hero.map((c) => (
              <Link key={c.id} to={`/creators/${c.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 shadow-sm hover:shadow-md">
                <Avatar name={c.display_name} src={c.avatar} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold"><span className="truncate">{c.display_name}</span>{c.verified && <VerifiedBadge />}</p>
                  <p className="truncate text-sm text-muted">{c.niches.map((n) => n.name).join(", ") || "Creator"}</p>
                </div>
                <p className="text-right text-sm"><span className="block text-xs text-muted">from</span><span className="font-semibold">{money(c.starting_price)}</span></p>
              </Link>
            ))}
        </div>
      </section>

      {(top.data?.items.length ?? 0) > 0 && (
        <section className="bg-mist py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mb-8 flex items-end justify-between"><h2 className="text-3xl font-bold">Featured creators</h2><Link to="/creators" className="text-sm font-semibold text-brand">See all creators</Link></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{top.data!.items.map((c) => <CreatorCard key={c.id} c={c} />)}</div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-bold">What you can hire for</h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(([name, text]) => (
            <Link key={name} to={`/creators?category=${encodeURIComponent(name)}`} className="bg-white p-6 hover:bg-mist">
              <h3 className="text-lg font-bold">{name}</h3><p className="mt-1 text-sm text-muted">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-ink py-16 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-bold">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([t, s], i) => (
              <li key={t}><span className="font-display text-4xl font-bold text-white/30">{i + 1}</span><h3 className="mt-2 text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-white/70">{s}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-3xl font-bold">Questions</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-4"><summary className="cursor-pointer list-none font-semibold">{q}</summary><p className="mt-2 text-muted">{a}</p></details>
          ))}
        </div>
      </section>
    </>
  );
}
