import { describe, it, expect, vi, beforeEach } from "vitest";

const submitFeedback = vi.fn();
vi.mock("../extensions/loom/feedback.js", () => ({
  submitFeedback: (...a: unknown[]) => submitFeedback(...a),
  buildBrainSysinfo: () => ({ platform: "darwin" }),
  summarizeActivityTail: () => "t1 kind (src)",
}));
vi.mock("../extensions/loom/activity.js", () => ({ getRecentActivityEvents: () => [] }));

const { registerFeedbackCommand } = await import("../extensions/loom/feedback-command.js");

function makeApi() {
  const commands = new Map<
    string,
    { handler: (a: string | undefined, ctx: any) => Promise<void> }
  >();
  const pi = { registerCommand: vi.fn((n: string, d: any) => commands.set(n, d)) };
  return { pi, commands };
}

beforeEach(() => vi.clearAllMocks());

describe("/feedback", () => {
  it("registers a feedback command", () => {
    const { pi, commands } = makeApi();
    registerFeedbackCommand(pi as any);
    expect(commands.has("feedback")).toBe(true);
  });

  it("notifies and skips POST when there is no UI", async () => {
    const { pi, commands } = makeApi();
    registerFeedbackCommand(pi as any);
    const notify = vi.fn();
    await commands.get("feedback")!.handler(undefined, { hasUI: false, ui: { notify } });
    expect(notify).toHaveBeenCalled();
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it("gathers input and POSTs when UI is present", async () => {
    submitFeedback.mockResolvedValue({ ok: true, id: "z" });
    const { pi, commands } = makeApi();
    registerFeedbackCommand(pi as any);
    const ui = {
      input: vi.fn().mockResolvedValue("My title"),
      editor: vi.fn().mockResolvedValue("My body"),
      confirm: vi.fn().mockResolvedValue(true),
      notify: vi.fn(),
    };
    await commands.get("feedback")!.handler(undefined, { hasUI: true, ui });
    expect(submitFeedback).toHaveBeenCalledOnce();
    const payload = submitFeedback.mock.calls[0][0];
    expect(payload.source).toBe("loom-cli");
    expect(payload.title).toBe("My title");
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Thanks"), "info");
  });

  it("aborts if the user cancels the title", async () => {
    const { pi, commands } = makeApi();
    registerFeedbackCommand(pi as any);
    const ui = {
      input: vi.fn().mockResolvedValue(undefined),
      editor: vi.fn(),
      confirm: vi.fn(),
      notify: vi.fn(),
    };
    await commands.get("feedback")!.handler(undefined, { hasUI: true, ui });
    expect(submitFeedback).not.toHaveBeenCalled();
  });
});
