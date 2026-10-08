import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyPayments, project } from "@/test/fixtures";
import { me, mockApi, renderApp } from "@/test/utils";

const brief = {
  title: "30-second skincare instagram reel", hook: "Still struggling with skincare?", script: "0-3s: hook", cta: "Tap the link", source: "template",
  scenes: [{ time: "0-3s", visual: "Close-up", voiceover: "Hook" }], deliverables: ["1 x 30-second Instagram Reel"],
  suggested: { category: "AI UGC", content_type: "Instagram Reel", platform: "Instagram", language: "English" },
};
const brandRoutes = { "GET /auth/me": me("BRAND"), "GET /projects/mine": { role: "BRAND", items: [] }, "GET /payments/mine": emptyPayments("BRAND") };

describe("project wizard", () => {
  it("blocks Next until the step is valid, then walks through all five steps and publishes", async () => {
    const api = mockApi({ ...brandRoutes, "POST /projects": project() });
    const { user } = renderApp("/dashboard/brand/projects/new", { as: "BRAND" });
    expect(await screen.findByText(/Step 1 of 5/)).toHaveTextContent("Basics");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("At least 3 characters")).toBeInTheDocument();
    expect(screen.getByText("Choose a category")).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();

    await screen.findByRole("option", { name: "AI UGC" });
    await user.type(screen.getByLabelText("Project title"), "30s skincare Reel");
    await user.selectOptions(screen.getByLabelText("Category"), "AI UGC");
    await user.type(screen.getByLabelText("Format"), "Instagram Reel");
    await user.type(screen.getByLabelText("Brief"), "Instagram reel for our serum launch");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Step 2 of 5/)).toHaveTextContent("Requirements");

    await user.type(screen.getByLabelText("Video length (seconds)"), "30");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Step 3 of 5/)).toHaveTextContent("Budget");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Budget must be above 0")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Budget"), "5000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Step 4 of 5/)).toHaveTextContent("Files");

    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(await screen.findByText(/Step 5 of 5/)).toHaveTextContent("Review");
    expect(screen.getByRole("heading", { name: "30s skincare Reel" })).toBeInTheDocument();
    expect(screen.getByText("30 seconds")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish project" }));
    expect(await screen.findByRole("heading", { name: "Your projects" })).toBeInTheDocument();
    expect(api.find("POST", "/projects")[0].body).toMatchObject({
      title: "30s skincare Reel", category: "AI UGC", content_type: "Instagram Reel", budget: 5000, currency: "INR", video_duration: 30, revisions: 2, assets: [],
    });
  });

  it("goes back without losing what was typed", async () => {
    mockApi(brandRoutes);
    const { user } = renderApp("/dashboard/brand/projects/new", { as: "BRAND" });
    await user.type(await screen.findByLabelText("Project title"), "Keep me");
    await screen.findByRole("option", { name: "AI UGC" });
    await user.selectOptions(screen.getByLabelText("Category"), "AI UGC");
    await user.type(screen.getByLabelText("Format"), "Reel");
    await user.type(screen.getByLabelText("Brief"), "A long enough description");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(/Step 2 of 5/);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText(/Step 1 of 5/)).toBeInTheDocument();
    expect(screen.getByLabelText("Project title")).toHaveValue("Keep me");
  });

  it("fills the form from an AI-generated brief", async () => {
    mockApi({ ...brandRoutes, "POST /ai/brief": brief });
    const { user } = renderApp("/dashboard/brand/projects/new", { as: "BRAND" });
    await screen.findByRole("option", { name: "AI UGC" });
    await user.type(screen.getByLabelText("What do you want made?"), "Create a 30-second skincare Instagram Reel");
    await user.click(screen.getByRole("button", { name: "Generate brief" }));
    expect(await screen.findByText("Template draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use this brief" }));
    expect(await screen.findByText("Added to the form below")).toBeInTheDocument();
    expect(screen.getByLabelText("Project title")).toHaveValue(brief.title);
    expect(screen.getByLabelText("Category")).toHaveValue("AI UGC");
    expect(screen.getByLabelText("Format")).toHaveValue("Instagram Reel");
  });

  it("shows the server error if publishing fails", async () => {
    mockApi({ ...brandRoutes, "POST /projects": () => ({ __status: 422, error: { code: "INVALID_FILE", message: "One of the files cannot be attached." } }) });
    const { user } = renderApp("/dashboard/brand/projects/new", { as: "BRAND" });
    await screen.findByRole("option", { name: "AI UGC" });
    await user.type(screen.getByLabelText("Project title"), "30s skincare Reel");
    await user.selectOptions(screen.getByLabelText("Category"), "AI UGC");
    await user.type(screen.getByLabelText("Format"), "Reel");
    await user.type(screen.getByLabelText("Brief"), "A long enough description");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(/Step 2 of 5/);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(await screen.findByLabelText("Budget"), "5000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Skip for now" }));
    await user.click(await screen.findByRole("button", { name: "Publish project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("One of the files cannot be attached.");
  });
});

describe("applying to a job", () => {
  const application = { id: "a1", project_id: "p1", proposal: "x".repeat(30), proposed_price: 5000, delivery_days: 3, status: "PENDING", created_at: "2026-10-02T00:00:00Z",
    project_title: "30s skincare Reel", project_status: "OPEN", currency: "INR", creator: { id: "c1", display_name: "Aisha", avatar: null, rating: 0, verified: false, completed_projects: 0 } };

  it("validates the proposal, sends the application and then shows its status", async () => {
    let applied = false;
    const api = mockApi({
      "GET /auth/me": me("CREATOR"), "GET /projects/p1": project(), "GET /applications/mine": () => (applied ? [application] : []),
      "POST /applications": () => { applied = true; return { id: "a1", status: "PENDING" }; }, "POST /applications/a1/withdraw": null,
    });
    const { user } = renderApp("/jobs/p1", { as: "CREATOR" });
    expect(await screen.findByRole("heading", { name: "Apply to this project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your price (INR)")).toHaveValue(5000);

    await user.type(screen.getByLabelText("Proposal"), "too short");
    await user.click(screen.getByRole("button", { name: "Send application" }));
    expect(await screen.findByText("Write at least 20 characters")).toBeInTheDocument();
    expect(screen.getByText("At least 1 day")).toBeInTheDocument();
    expect(api.find("POST", "/applications")).toHaveLength(0);

    await user.clear(screen.getByLabelText("Proposal"));
    await user.type(screen.getByLabelText("Proposal"), "I make skincare UGC and can deliver in three days.");
    await user.type(screen.getByLabelText("Delivery (days)"), "3");
    await user.click(screen.getByRole("button", { name: "Send application" }));
    expect(await screen.findByRole("heading", { name: "Your application" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(api.find("POST", "/applications")[0].body).toEqual({ project_id: "p1", proposal: "I make skincare UGC and can deliver in three days.", proposed_price: 5000, delivery_days: 3 });

    await user.click(screen.getByRole("button", { name: "Withdraw application" }));
    await waitFor(() => expect(api.find("POST", "/applications/a1/withdraw")).toHaveLength(1));
  });

  it("asks guests to log in", async () => {
    mockApi({ "GET /projects/p1": project() });
    renderApp("/jobs/p1");
    expect(await screen.findByText("Log in as a creator to apply to this project.")).toBeInTheDocument();
  });

  it("does not show the apply form to brands or for closed projects", async () => {
    mockApi({ "GET /auth/me": me("BRAND"), "GET /projects/p1": project() });
    const { unmount } = renderApp("/jobs/p1", { as: "BRAND" });
    await screen.findByRole("heading", { name: "30s skincare Reel" });
    expect(screen.queryByText("Apply to this project")).not.toBeInTheDocument();
    unmount();
    mockApi({ "GET /auth/me": me("CREATOR"), "GET /projects/p1": project({ status: "IN_PROGRESS" }), "GET /applications/mine": [] });
    renderApp("/jobs/p1", { as: "CREATOR" });
    expect(await screen.findByText("This project is no longer accepting applications.")).toBeInTheDocument();
  });

  it("shows the brief details and brand files, and hides files from guests", async () => {
    const file = { id: "f1", filename: "guide.pdf", content_type: "application/pdf", size: 2048, purpose: "ASSET", url: null, created_at: "2026-10-01T00:00:00Z" };
    const detail = project({ style: "Warm, handheld", deliverables: "1 reel\n3 hooks", revisions: 3, assets: [{ id: "x1", file_type: "GUIDELINES", file }] });
    mockApi({ "GET /projects/p1": detail });
    const guest = renderApp("/jobs/p1");
    await screen.findByRole("heading", { name: "30s skincare Reel" });
    expect(screen.getByText("Warm, handheld")).toBeInTheDocument();
    expect(screen.getByText("30 seconds")).toBeInTheDocument();
    expect(within(screen.getByText("Revisions included").parentElement!).getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/1 file attached. Log in to view them./)).toBeInTheDocument();
    guest.unmount();
    mockApi({ "GET /auth/me": me("CREATOR"), "GET /projects/p1": detail, "GET /applications/mine": [] });
    renderApp("/jobs/p1", { as: "CREATOR" });
    expect(await screen.findByRole("button", { name: /guidelines: guide.pdf/ })).toBeInTheDocument();
  });
});
