import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspace } from "@/test/fixtures";
import { FakeWebSocket, me, mockApi, renderApp } from "@/test/utils";

const msg = (o = {}) => ({ id: "m1", sender_id: "u2", sender_name: "Aisha Verma", mine: false, message: "Hi there", attachment_url: null, attachment_file: null, created_at: "2026-10-01T10:00:00Z", read_at: null, ...o });

describe("live chat", () => {
  beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal("WebSocket", FakeWebSocket); });
  const open = (messages: () => unknown[], extra = {}) => mockApi({ "GET /auth/me": me("BRAND"), "GET /projects/p1/workspace": workspace(), "GET /messages/project/p1": messages, ...extra });

  it("connects a socket with the login token and shows it as live", async () => {
    open(() => []);
    renderApp("/projects/p1/workspace", { as: "BRAND" });
    expect(await screen.findByText("No messages yet. Say hello.")).toBeInTheDocument();
    expect(await screen.findByText("Live")).toBeInTheDocument();
    expect(FakeWebSocket.instances[0].url).toMatch(/\/messages\/ws\/p1\?token=test-token$/);
  });

  it("refreshes the conversation when the server pushes an event", async () => {
    let list: unknown[] = [];
    const api = open(() => list);
    renderApp("/projects/p1/workspace", { as: "BRAND" });
    await screen.findByText("Live");
    expect(screen.queryByText("Hi there")).not.toBeInTheDocument();
    list = [msg()];
    act(() => FakeWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: "message", id: "m1" }) }));
    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(api.find("GET", "/messages/project/p1").length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to polling when the socket drops", async () => {
    open(() => []);
    renderApp("/projects/p1/workspace", { as: "BRAND" });
    await screen.findByText("Live");
    act(() => FakeWebSocket.instances[0].onclose?.());
    expect(await screen.findByText("Reconnecting")).toBeInTheDocument();
  });

  it("sends a message and shows file attachments and read status", async () => {
    const file = { id: "f1", filename: "ref.pdf", content_type: "application/pdf", size: 4096, purpose: "ATTACHMENT", url: null, created_at: "2026-10-01T00:00:00Z" };
    const api = open(() => [msg({ attachment_file: file }), msg({ id: "m2", mine: true, sender_name: "Acme", message: "Thanks!", read_at: "2026-10-01T11:00:00Z" })], { "POST /messages": msg({ id: "m3", mine: true }) });
    const { user } = renderApp("/projects/p1/workspace", { as: "BRAND" });
    expect(await screen.findByRole("button", { name: /ref.pdf/ })).toBeInTheDocument();
    expect(screen.getByText(/· Seen/)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Message"), "On it");
    await user.click(send);
    await waitFor(() => expect(api.find("POST", "/messages")[0].body).toEqual({ project_id: "p1", message: "On it" }));
    await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""));
  });
});

describe("notifications", () => {
  const note = (o = {}) => ({ id: "n1", type: "NEW_APPLICATION", title: "New application", message: "Aisha applied to your project", link: "/about", is_read: false, created_at: "2026-10-01T10:00:00Z", ...o });
  const list = (items: unknown[], unread: number) => ({ items, page: 1, page_size: 20, total: items.length, unread_count: unread });

  it("shows the unread count on the bell", async () => {
    mockApi({ "GET /auth/me": me("CREATOR"), "GET /notifications/unread-count": { unread_count: 3 }, "GET /creators": { items: [], page: 1, page_size: 6, total: 0 } });
    renderApp("/", { as: "CREATOR" });
    expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toBeInTheDocument();
  });

  it("marks one as read and opens what it points to", async () => {
    const api = mockApi({ "GET /auth/me": me("CREATOR"), "GET /notifications": list([note(), note({ id: "n2", title: "Old news", is_read: true })], 1),
      "GET /users/me": { email_notifications: true }, "POST /notifications/n1/read": null });
    const { user } = renderApp("/notifications", { as: "CREATOR" });
    await user.click(await screen.findByRole("button", { name: /New application/ }));
    expect(await screen.findByRole("heading", { name: "About Creatorly" })).toBeInTheDocument();
    expect(api.find("POST", "/notifications/n1/read")).toHaveLength(1);
  });

  it("does not call the server for a notification that is already read", async () => {
    const api = mockApi({ "GET /auth/me": me("CREATOR"), "GET /notifications": list([note({ is_read: true })], 0), "GET /users/me": { email_notifications: true } });
    const { user } = renderApp("/notifications", { as: "CREATOR" });
    await user.click(await screen.findByRole("button", { name: /New application/ }));
    await screen.findByRole("heading", { name: "About Creatorly" });
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("marks everything read and toggles email notifications", async () => {
    const api = mockApi({ "GET /auth/me": me("CREATOR"), "GET /notifications": list([note()], 1), "GET /users/me": { email_notifications: true },
      "POST /notifications/read-all": null, "PATCH /users/me": { email_notifications: false } });
    const { user } = renderApp("/notifications", { as: "CREATOR" });
    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(api.find("POST", "/notifications/read-all")).toHaveLength(1));
    await user.click(await screen.findByLabelText("Also email me about important updates"));
    await waitFor(() => expect(api.find("PATCH", "/users/me")[0].body).toEqual({ email_notifications: false }));
  });

  it("shows an empty state", async () => {
    mockApi({ "GET /auth/me": me("CREATOR"), "GET /notifications": list([], 0), "GET /users/me": { email_notifications: true } });
    renderApp("/notifications", { as: "CREATOR" });
    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });
});
