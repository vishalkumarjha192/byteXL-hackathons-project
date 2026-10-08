import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { creator, lookups, page } from "@/test/fixtures";
import { failure, mockApi, renderApp } from "@/test/utils";

const two = page([creator(), creator({ id: "c2", display_name: "Ben Cole", verified: false, review_count: 0, rating: 0, starting_price: 9000 })]);

describe("creator search", () => {
  it("lists creators with price, rating and badges", async () => {
    mockApi({ "GET /creators": two });
    renderApp("/creators");
    expect(await screen.findByText("Aisha Verma")).toBeInTheDocument();
    expect(screen.getByText("Ben Cole")).toBeInTheDocument();
    expect(screen.getByText("2 creators")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified creator")).toBeInTheDocument();
    expect(screen.getByText("₹3,000")).toBeInTheDocument();
    expect(screen.getByText(/New · 15 projects/)).toBeInTheDocument(); // creator with no reviews
  });

  it("sends the search text and filters to the API", async () => {
    const api = mockApi({ "GET /creators": two });
    const { user } = renderApp("/creators");
    await screen.findByText("Aisha Verma");
    await user.type(screen.getByLabelText("Search"), "skin");
    await waitFor(() => expect(api.find("GET", "/creators").some((c) => c.query.get("q") === "skin")).toBe(true));
    await screen.findByRole("option", { name: "Beauty" });
    await user.selectOptions(screen.getByLabelText("Niche"), "Beauty");
    await user.selectOptions(screen.getByLabelText("Language"), "Hindi");
    await user.selectOptions(screen.getByLabelText("Sort by"), "price");
    await waitFor(() => {
      const last = api.find("GET", "/creators").at(-1)!.query;
      expect([last.get("q"), last.get("niche"), last.get("language"), last.get("sort")]).toEqual(["skin", "Beauty", "Hindi", "price"]);
    });
    expect(lookups.niches.length).toBeGreaterThan(0);
  });

  it("starts from filters in the URL", async () => {
    const api = mockApi({ "GET /creators": two });
    renderApp("/creators?category=AI%20UGC&min_rating=4");
    await screen.findByText("Aisha Verma");
    const first = api.find("GET", "/creators")[0].query;
    expect([first.get("category"), first.get("min_rating")]).toEqual(["AI UGC", "4"]);
  });

  it("shows an empty state when nothing matches", async () => {
    mockApi({ "GET /creators": page([]) });
    renderApp("/creators?niche=SaaS");
    expect(await screen.findByText("No creators match these filters")).toBeInTheDocument();
  });

  it("recovers from an error with Try again", async () => {
    let calls = 0;
    mockApi({ "GET /creators": () => (++calls === 1 ? failure(500, "DB", "Database is down") : two) });
    const { user } = renderApp("/creators");
    expect(await screen.findByText("Database is down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Aisha Verma")).toBeInTheDocument();
  });
});

describe("creator profile", () => {
  const portfolio = [{ id: "i1", title: "Serum reel", description: "Launch film", media_url: "https://example.com/v", media_type: "LINK", thumbnail_url: null, created_at: "2026-10-01T00:00:00Z" }];
  const reviews = { average: 4.8, total: 1, items: [{ id: "r1", rating: 5, comment: "Great to work with", created_at: "2026-10-01T00:00:00Z", reviewer_name: "Acme", mine: false }] };

  it("shows the bio, pricing, portfolio and reviews", async () => {
    mockApi({ "GET /creators/c1": creator(), "GET /creators/c1/portfolio": portfolio, "GET /reviews/creator/c1": reviews });
    renderApp("/creators/c1");
    expect(await screen.findByRole("heading", { name: /Aisha Verma/ })).toBeInTheDocument();
    expect(screen.getByText("I make skincare UGC with HeyGen.")).toBeInTheDocument();
    expect(screen.getByText("Delivers in 3 days")).toBeInTheDocument();
    expect(await screen.findByText("Serum reel")).toBeInTheDocument();
    expect(await screen.findByText("Great to work with")).toBeInTheDocument();
    expect(screen.getByText(/from 1 review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a project" })).toBeInTheDocument();
  });

  it("shows empty portfolio and reviews states", async () => {
    mockApi({ "GET /creators/c1": creator({ bio: null }), "GET /creators/c1/portfolio": [], "GET /reviews/creator/c1": { average: 0, total: 0, items: [] } });
    renderApp("/creators/c1");
    expect(await screen.findByText("No portfolio yet")).toBeInTheDocument();
    expect(await screen.findByText("No reviews yet")).toBeInTheDocument();
    expect(screen.getByText("This creator hasn't added a bio yet.")).toBeInTheDocument();
  });

  it("handles a creator that does not exist", async () => {
    mockApi({ "GET /creators/nope": failure(404, "CREATOR_NOT_FOUND", "Creator not found") });
    renderApp("/creators/nope");
    expect(await screen.findByText("Creator not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse creators" })).toBeInTheDocument();
  });
});
