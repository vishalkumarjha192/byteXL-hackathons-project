import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page } from "@/test/fixtures";
import { me, mockApi, renderApp } from "@/test/utils";

const stats = { total_users: 10, total_creators: 6, total_brands: 3, suspended_users: 1, open_projects: 2, active_projects: 1, completed_projects: 4, pending_verification: 2, open_reports: 3,
  gross_volume: [{ currency: "INR", amount: 50000 }], platform_revenue: [{ currency: "INR", amount: 10000 }] };
const admin = { "GET /auth/me": me("ADMIN"), "GET /admin/stats": stats };
const report = { id: "r1", target_type: "PROJECT", target_id: "p1", target: "Fake listing", reason: "SPAM", details: "Looks duplicated", status: "OPEN", reporter: "x@y.com", resolution_note: null, created_at: "2026-10-01T10:00:00Z" };

describe("admin dashboard", () => {
  it("shows platform statistics", async () => {
    mockApi(admin);
    renderApp("/dashboard/admin", { as: "ADMIN" });
    expect(await screen.findByText("Gross marketplace volume")).toBeInTheDocument();
    expect(screen.getByText("₹50,000")).toBeInTheDocument();
    expect(screen.getByText("₹10,000")).toBeInTheDocument();
    const pending = screen.getByText("Pending verification").closest("div")!;
    expect(within(pending).getByText("2")).toBeInTheDocument();
  });

  it("jumps to the right tab from a statistic card", async () => {
    mockApi({ ...admin, "GET /admin/reports": page([report]) });
    const { user } = renderApp("/dashboard/admin", { as: "ADMIN" });
    await user.click(await screen.findByText("Open reports"));
    expect(await screen.findByText("Fake listing")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reports" })).toHaveAttribute("aria-selected", "true");
  });

  it("reviews a report and removes the content", async () => {
    const api = mockApi({ ...admin, "GET /admin/reports": page([report]), "POST /admin/reports/r1/resolve": { id: "r1", status: "RESOLVED" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderApp("/dashboard/admin?tab=reports", { as: "ADMIN" });
    await user.click(await screen.findByRole("button", { name: "Review" }));
    const dialog = await screen.findByRole("dialog", { name: "Review report" });
    expect(within(dialog).getByText(/Looks duplicated/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Note (optional)"), "Spam listing");
    await user.click(within(dialog).getByRole("button", { name: "Remove content" }));
    await waitFor(() => expect(api.find("POST", "/admin/reports/r1/resolve")[0].body).toEqual({ action: "REMOVE_CONTENT", note: "Spam listing" }));
  });

  it("keeps focus in the note field while typing and closes on Escape", async () => {
    mockApi({ ...admin, "GET /admin/reports": page([report]) });
    const { user } = renderApp("/dashboard/admin?tab=reports", { as: "ADMIN" });
    await user.click(await screen.findByRole("button", { name: "Review" }));
    const note = await screen.findByLabelText("Note (optional)");
    await user.type(note, "Long note typed in one go");
    expect(note).toHaveValue("Long note typed in one go");
    expect(note).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not offer content removal for a creator profile", async () => {
    mockApi({ ...admin, "GET /admin/reports": page([{ ...report, target_type: "CREATOR", target: "Aisha Verma" }]) });
    const { user } = renderApp("/dashboard/admin?tab=reports", { as: "ADMIN" });
    await user.click(await screen.findByRole("button", { name: "Review" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Remove content" })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/suspend them from the Users tab/)).toBeInTheDocument();
  });

  it("suspends a user only after confirming, and cannot suspend admins", async () => {
    const users = [
      { id: "u1", email: "c@x.com", name: "Aisha", role: "CREATOR", is_active: true, created_at: "2026-10-01T10:00:00Z" },
      { id: "u2", email: "admin@x.com", name: "admin@x.com", role: "ADMIN", is_active: true, created_at: "2026-09-01T10:00:00Z" },
    ];
    const api = mockApi({ ...admin, "GET /admin/users": page(users), "POST /admin/users/u1/suspend": { id: "u1", is_active: false } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user } = renderApp("/dashboard/admin?tab=users", { as: "ADMIN" });
    await screen.findByText("c@x.com");
    expect(screen.getAllByRole("button", { name: "Suspend" })).toHaveLength(1); // none for the admin row
    await user.click(screen.getByRole("button", { name: "Suspend" }));
    expect(api.find("POST", "/admin/users/u1/suspend")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(api.find("POST", "/admin/users/u1/suspend")[0].body).toEqual({ suspended: true }));
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("verifies and features a creator", async () => {
    const c = { id: "c1", user_id: "u1", display_name: "Aisha Verma", email: "a@x.com", verified: false, verification_requested: true, featured: false, is_active: true, rating: 0, review_count: 0, completed_projects: 0 };
    const api = mockApi({ ...admin, "GET /admin/creators": page([c]), "POST /admin/creators/c1/verify": {}, "POST /admin/creators/c1/feature": {} });
    const { user } = renderApp("/dashboard/admin?tab=creators", { as: "ADMIN" });
    expect(await screen.findByText("Awaiting review")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await user.click(screen.getByRole("button", { name: "Feature" }));
    await waitFor(() => {
      expect(api.find("POST", "/admin/creators/c1/verify")[0].body).toEqual({ verified: true });
      expect(api.find("POST", "/admin/creators/c1/feature")[0].body).toEqual({ featured: true });
    });
  });

  it("blocks deleting a category that is in use", async () => {
    mockApi({ ...admin, "GET /admin/categories": { skills: [{ id: 1, name: "AI UGC", usage: 4 }, { id: 2, name: "Voiceover", usage: 0 }], niches: [], languages: [], ai_tools: [] } });
    renderApp("/dashboard/admin?tab=categories", { as: "ADMIN" });
    expect(await screen.findByRole("button", { name: "Delete AI UGC" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Voiceover" })).toBeEnabled();
  });

  it("lists the audit log", async () => {
    mockApi({ ...admin, "GET /admin/audit": page([{ id: "a1", admin: "admin@x.com", action: "SUSPEND_USER", summary: "Suspended c@x.com", created_at: "2026-10-01T10:00:00Z" }]) });
    renderApp("/dashboard/admin?tab=audit", { as: "ADMIN" });
    expect(await screen.findByText("Suspended c@x.com")).toBeInTheDocument();
    expect(screen.getByText("suspend user")).toBeInTheDocument();
  });
});
