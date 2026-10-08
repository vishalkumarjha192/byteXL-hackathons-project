import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui";

const Shell = ({ title, intro, children }: { title: string; intro: string; children: ReactNode }) => (
  <div className="mx-auto max-w-3xl px-5 py-14">
    <h1 className="text-4xl font-bold">{title}</h1>
    <p className="mt-3 text-lg text-muted">{intro}</p>
    <div className="mt-10 space-y-10">{children}</div>
  </div>
);
const Block = ({ title, items }: { title: string; items: string[] }) => (
  <section><h2 className="text-2xl font-bold">{title}</h2><ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ol></section>
);

export function HowItWorks() {
  return (
    <Shell title="How Creatorly works" intro="One workflow for brands and creators, from brief to payment.">
      <Block title="For brands" items={["Post a project with your brief, budget and deadline.", "Review applications and creator portfolios.", "Hire a creator and work in a shared project space.", "Request revisions or approve the final files.", "Release payment and leave a review."]} />
      <Block title="For creators" items={["Build a profile with your niches, tools, languages and pricing.", "Add portfolio work so brands can judge your style.", "Apply to open projects with a proposal and price.", "Deliver drafts, handle feedback and submit final files.", "Get paid and build your rating."]} />
      <div className="flex gap-3"><LinkButton to="/register" variant="brand">Get started</LinkButton><LinkButton to="/creators" variant="outline">Find creators</LinkButton></div>
    </Shell>
  );
}

export function Pricing() {
  return (
    <Shell title="Pricing" intro="Free to join and free to post. We earn only when a project is completed.">
      <Block title="Brands" items={["No subscription and no posting fee.", "You pay the agreed project price.", "Payment is held until you approve the final files."]} />
      <Block title="Creators" items={["No subscription and no application fee.", "A platform commission is deducted from each completed project.", "You see the exact amount you will receive before you accept a contract."]} />
    </Shell>
  );
}

export function About() {
  return (
    <Shell title="About Creatorly" intro="We help brands work with AI creators they can trust.">
      <p className="max-w-prose text-muted">AI tools have made it possible for one person to produce what once took a studio. Creatorly gives those creators a place to show their work and gives brands a clear way to find, brief, review and pay them.</p>
    </Shell>
  );
}
