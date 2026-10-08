import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, mockApi } from "@/test/utils";
import { FileLink } from "./FileLink";
import { FileUploader } from "./FileUploader";

class FakeXHR {
  static sent: { method: string; url: string; headers: Record<string, string>; form: FormData }[] = [];
  static reply: { status: number; body: unknown } = { status: 201, body: null };
  status = 0; responseText = ""; upload: { onprogress?: (e: unknown) => void } = {};
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  private method = ""; private url = ""; private headers: Record<string, string> = {};
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  send(form: FormData) {
    FakeXHR.sent.push({ method: this.method, url: this.url, headers: this.headers, form });
    setTimeout(() => { this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 }); this.status = FakeXHR.reply.status; this.responseText = JSON.stringify(FakeXHR.reply.body); this.onload?.(); }, 0);
  }
}
const stored = { id: "f1", filename: "me.png", content_type: "image/png", size: 10, purpose: "AVATAR", url: "http://x/api/v1/files/f1/content", created_at: "2026-10-01T00:00:00Z" };
const fileInput = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;
const png = (name = "me.png", bytes = 10) => new File([new Uint8Array(bytes)], name, { type: "image/png" });

beforeEach(() => { FakeXHR.sent = []; FakeXHR.reply = { status: 201, body: { success: true, data: stored } }; vi.stubGlobal("XMLHttpRequest", FakeXHR); });

describe("FileUploader", () => {
  const setup = () => {
    const onUploaded = vi.fn();
    const { container } = render(<FileUploader purpose="AVATAR" accept=".png,.jpg" maxMB={1} onUploaded={onUploaded} />);
    return { onUploaded, input: fileInput(container), user: userEvent.setup({ applyAccept: false }) };
  };

  it("rejects the wrong file type without uploading", async () => {
    const { user, input, onUploaded } = setup();
    await user.upload(input, new File(["MZ"], "virus.exe"));
    expect(await screen.findByRole("alert")).toHaveTextContent("only .png, .jpg files are allowed");
    expect(FakeXHR.sent).toHaveLength(0);
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("rejects a file that is too large without uploading", async () => {
    const { user, input } = setup();
    await user.upload(input, png("big.png", 2 * 1024 * 1024));
    expect(await screen.findByRole("alert")).toHaveTextContent("big.png is larger than 1 MB");
    expect(FakeXHR.sent).toHaveLength(0);
  });

  it("uploads with the purpose and the login token, then reports the stored file", async () => {
    localStorage.setItem("access_token", "tok");
    const { user, input, onUploaded } = setup();
    await user.upload(input, png());
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(stored));
    const sent = FakeXHR.sent[0];
    expect(sent.method).toBe("POST");
    expect(sent.url).toMatch(/\/files$/);
    expect(sent.headers.Authorization).toBe("Bearer tok");
    expect(sent.form.get("purpose")).toBe("AVATAR");
    expect((sent.form.get("file") as File).name).toBe("me.png");
  });

  it("shows the server's reason when the upload is refused", async () => {
    FakeXHR.reply = { status: 403, body: { success: false, error: { code: "FORBIDDEN", message: "Only the hired creator can upload deliverables" } } };
    const { user, input, onUploaded } = setup();
    await user.upload(input, png());
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the hired creator can upload deliverables");
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("accepts files dropped on the zone", async () => {
    const { onUploaded } = setup();
    const zone = screen.getByText("Drop a file here or choose one").closest("label")!;
    await act(async () => { zone.dispatchEvent(Object.assign(new Event("drop", { bubbles: true, cancelable: true }), { dataTransfer: { files: [png()] } })); });
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
  });
});

describe("FileLink", () => {
  const priv = { ...stored, id: "f2", filename: "draft.mp4", purpose: "DELIVERABLE", url: null, size: 2048 };

  it("asks the server for a short-lived link before opening a private file", async () => {
    const api = mockApi({ "GET /files/f2/link": { url: "https://signed.example/x?token=t", expires_in: 300 } });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<FileLink file={priv} />);
    await userEvent.click(screen.getByRole("button", { name: /draft.mp4/ }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://signed.example/x?token=t", "_blank", "noopener"));
    expect(api.find("GET", "/files/f2/link")).toHaveLength(1);
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("opens public files directly without a request", async () => {
    const api = mockApi();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<FileLink file={stored} />);
    await userEvent.click(screen.getByRole("button", { name: /me.png/ }));
    expect(open).toHaveBeenCalledWith(stored.url, "_blank", "noopener");
    expect(api.calls).toHaveLength(0);
  });

  it("explains when access is denied", async () => {
    mockApi({ "GET /files/f2/link": failure(403, "FORBIDDEN", "You do not have access to this file") });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<FileLink file={priv} />);
    await userEvent.click(screen.getByRole("button", { name: /draft.mp4/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access to this file");
    expect(open).not.toHaveBeenCalled();
  });
});
