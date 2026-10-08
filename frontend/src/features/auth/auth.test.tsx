import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { creator, emptyPayments } from "@/test/fixtures";
import { failure, me, mockApi, renderApp } from "@/test/utils";

const tokens = { access_token: "a", refresh_token: "r", token_type: "bearer" };

describe("login", () => {
  it("validates the form before calling the API", async () => {
    const api = mockApi();
    const { user } = renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(api.find("POST", "/auth/login")).toHaveLength(0);
  });

  it("shows the server's message when the credentials are wrong", async () => {
    mockApi({ "POST /auth/login": failure(401, "INVALID_CREDENTIALS", "Invalid email or password") });
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("logs a brand in and lands on its dashboard", async () => {
    const api = mockApi({ "POST /auth/login": tokens, "GET /auth/me": me("BRAND"), "GET /projects/mine": { role: "BRAND", items: [] }, "GET /payments/mine": emptyPayments("BRAND") });
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), "brand@x.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Your projects" })).toBeInTheDocument();
    expect(localStorage.getItem("access_token")).toBe("a");
    expect(api.find("POST", "/auth/login")[0].body).toEqual({ email: "brand@x.com", password: "secret123" });
  });

  it("offers password reset and a disabled Google button", async () => {
    mockApi();
    renderApp("/login");
    expect(await screen.findByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  });
});

describe("route protection", () => {
  it("sends logged-out visitors to the login page", async () => {
    mockApi();
    renderApp("/dashboard/brand");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("keeps a creator out of the brand dashboard", async () => {
    mockApi({ "GET /auth/me": me("CREATOR") });
    renderApp("/dashboard/brand", { as: "CREATOR" });
    expect(await screen.findByRole("heading", { name: /Find AI creators/ })).toBeInTheDocument();
  });

  it("keeps non-admins out of the admin area", async () => {
    mockApi({ "GET /auth/me": me("BRAND") });
    renderApp("/dashboard/admin", { as: "BRAND" });
    expect(await screen.findByRole("heading", { name: /Find AI creators/ })).toBeInTheDocument();
  });
});

describe("registration", () => {
  it("registers a creator and starts onboarding", async () => {
    const api = mockApi({ "POST /auth/register": me("CREATOR"), "POST /auth/login": tokens, "GET /auth/me": me("CREATOR"), "GET /creators/me": creator() });
    const { user } = renderApp("/register");
    await user.click(await screen.findByLabelText(/Join as a creator/));
    await user.type(await screen.findByLabelText("Display name"), "Aisha Verma");
    await user.type(screen.getByLabelText("Email"), "aisha@x.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Set up your creator profile" })).toBeInTheDocument();
    expect(api.find("POST", "/auth/register")[0].body).toEqual({ role: "CREATOR", name: "Aisha Verma", email: "aisha@x.com", password: "secret123" });
  });

  it("rejects a short password without calling the API", async () => {
    const api = mockApi();
    const { user } = renderApp("/register");
    await user.type(await screen.findByLabelText("Company name"), "Acme");
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("At least 8 characters")).toBeInTheDocument();
    expect(api.find("POST", "/auth/register")).toHaveLength(0);
  });
});

describe("password reset", () => {
  it("shows the same confirmation whether or not the email exists", async () => {
    const api = mockApi({ "POST /auth/forgot-password": null });
    const { user } = renderApp("/forgot-password");
    await user.type(await screen.findByLabelText("Email"), "nobody@x.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(api.find("POST", "/auth/forgot-password")[0].body).toEqual({ email: "nobody@x.com" });
  });

  it("checks the confirmation field and sends the token", async () => {
    const api = mockApi({ "POST /auth/reset-password": null });
    const { user } = renderApp("/reset-password?token=abc");
    await user.type(await screen.findByLabelText("New password"), "newpassword1");
    await user.type(screen.getByLabelText("Confirm password"), "different1");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(api.find("POST", "/auth/reset-password")).toHaveLength(0);
    await user.clear(screen.getByLabelText("Confirm password"));
    await user.type(screen.getByLabelText("Confirm password"), "newpassword1");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText(/password was updated/)).toBeInTheDocument();
    await waitFor(() => expect(api.find("POST", "/auth/reset-password")[0].body).toEqual({ token: "abc", password: "newpassword1" }));
  });

  it("explains an expired link and offers a new one", async () => {
    mockApi({ "POST /auth/reset-password": failure(400, "INVALID_TOKEN", "This reset link is invalid, expired or already used") });
    const { user } = renderApp("/reset-password?token=old");
    await user.type(await screen.findByLabelText("New password"), "newpassword1");
    await user.type(screen.getByLabelText("Confirm password"), "newpassword1");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid, expired or already used");
    expect(screen.getByRole("link", { name: "Request a new link" })).toBeInTheDocument();
  });

  it("handles a link with no token", async () => {
    mockApi();
    renderApp("/reset-password");
    expect(await screen.findByRole("heading", { name: "Link not valid" })).toBeInTheDocument();
  });
});
