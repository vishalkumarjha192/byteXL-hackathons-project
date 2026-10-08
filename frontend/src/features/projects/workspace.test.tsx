import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { project, workspace } from "@/test/fixtures";
import { FakeWebSocket, me, mockApi, renderApp } from "@/test/utils";

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal("WebSocket", FakeWebSocket); });
const base = (role: "BRAND" | "CREATOR", ws: ReturnType<typeof workspace>, extra = {}) =>
  mockApi({ "GET /auth/me": me(role), "GET /projects/p1/workspace": ws, "GET /messages/project/p1": [], "GET /projects/mine": { role, items: [] }, ...extra });

describe("project workspace as the brand", () => {
  it("approves final files", async () => {
    const api = base("BRAND", workspace({ status: "FINAL_SUBMITTED", payment: "HELD" }), { "POST /projects/p1/approve": project({ status: "APPROVED" }) });
    const { user } = renderApp("/projects/p1/workspace", { as: "BRAND" });
    await user.click(await screen.findByRole("button", { name: "Approve final files" }));
    await waitFor(() => expect(api.find("POST", "/projects/p1/approve")).toHaveLength(1));
  });

  it("makes the brand fund the project before completing it", async () => {
    let funded = false;
    const api = mockApi({
      "GET /auth/me": me("BRAND"), "GET /messages/project/p1": [],
      "GET /projects/p1/workspace": () => workspace({ status: "APPROVED", payment: funded ? "HELD" : "PENDING" }),
      "POST /payments/project/p1/fund": () => { funded = true; return {}; }, "POST /projects/p1/complete": project({ status: "COMPLETED" }),
    });
    const { user } = renderApp("/projects/p1/workspace", { as: "BRAND" });
    const complete = await screen.findByRole("button", { name: "Complete and release payment" });
    expect(complete).toBeDisabled();
    expect(screen.getByText("Fund the project first so the creator can be paid.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Fund project/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Complete and release payment" })).toBeEnabled());
    expect(screen.getByText("Held in escrow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete and release payment" }));
    await waitFor(() => expect(api.find("POST", "/projects/p1/complete")).toHaveLength(1));
  });

  it("requests a revision with feedback", async () => {
    const api = base("BRAND", workspace({ status: "DRAFT_SUBMITTED" }), { "POST /revisions": { id: "r1" } });
    const { user } = renderApp("/projects/p1/workspace", { as: "BRAND" });
    await user.type(await screen.findByLabelText("What should change?"), "Shorter hook please");
    await user.click(screen.getByRole("button", { name: "Request revision" }));
    await waitFor(() => expect(api.find("POST", "/revisions")[0].body).toEqual({ project_id: "p1", description: "Shorter hook please" }));
  });

  it("lets the brand cancel only after confirming", async () => {
    const api = base("BRAND", workspace({ status: "IN_PROGRESS" }), { "POST /projects/p1/cancel": project({ status: "CANCELLED" }) });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user } = renderApp("/projects/p1/workspace", { as: "BRAND" });
    const cancel = await screen.findByRole("button", { name: "Cancel project" });
    await user.click(cancel);
    expect(api.find("POST", "/projects/p1/cancel")).toHaveLength(0);
    await user.click(cancel);
    await waitFor(() => expect(api.find("POST", "/projects/p1/cancel")).toHaveLength(1));
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("shows reviews and lets the brand review once the project is completed", async () => {
    const api = base("BRAND", workspace({ status: "COMPLETED", payment: "RELEASED", can_review: true }), { "POST /reviews": { id: "rv1" } });
    const { user } = renderApp("/projects/p1/workspace", { as: "BRAND" });
    const submit = await screen.findByRole("button", { name: "Submit review" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.type(screen.getByLabelText("Your review"), "Fast and creative");
    await user.click(submit);
    await waitFor(() => expect(api.find("POST", "/reviews")[0].body).toEqual({ project_id: "p1", rating: 4, comment: "Fast and creative" }));
  });
});

describe("project workspace as the creator", () => {
  it("submits a draft link and sees the amount they will receive", async () => {
    const api = base("CREATOR", workspace({ role: "CREATOR", status: "IN_PROGRESS", payment: "PENDING" }), { "POST /deliverables": { id: "d1", version: 1 } });
    const { user } = renderApp("/projects/p1/workspace", { as: "CREATOR" });
    expect(await screen.findByText("Waiting for the brand to fund the project.")).toBeInTheDocument();
    expect(screen.getByText("₹4,000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fund project/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Or paste a link"), "https://example.com/draft.mp4");
    await user.click(screen.getByRole("button", { name: "Submit draft" }));
    await waitFor(() => expect(api.find("POST", "/deliverables")[0].body).toEqual({ project_id: "p1", file_url: "https://example.com/draft.mp4", kind: "DRAFT", note: null }));
  });

  it("hides the submit form once the final files are in", async () => {
    base("CREATOR", workspace({ role: "CREATOR", status: "FINAL_SUBMITTED" }));
    renderApp("/projects/p1/workspace", { as: "CREATOR" });
    await screen.findByRole("heading", { name: "Deliverables" });
    expect(screen.queryByRole("button", { name: /Submit (draft|final)/ })).not.toBeInTheDocument();
  });

  it("refuses someone who is not part of the project", async () => {
    mockApi({ "GET /auth/me": me("CREATOR"), "GET /projects/p1/workspace": { __status: 403, error: { code: "FORBIDDEN", message: "You are not part of this project" } } });
    renderApp("/projects/p1/workspace", { as: "CREATOR" });
    expect(await screen.findByText("Workspace unavailable")).toBeInTheDocument();
  });
});
