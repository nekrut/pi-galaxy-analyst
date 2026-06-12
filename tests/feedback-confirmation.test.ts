import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackConfirmation } from "../app/src/renderer/feedback-confirmation.js";

const DELAY = 1500;

describe("FeedbackConfirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function make() {
    const onShowSuccess = vi.fn();
    const onClose = vi.fn();
    const confirmation = new FeedbackConfirmation({ delayMs: DELAY, onShowSuccess, onClose });
    return { confirmation, onShowSuccess, onClose };
  }

  it("shows the success state immediately on confirm", () => {
    const { confirmation, onShowSuccess, onClose } = make();

    confirmation.confirm();

    expect(onShowSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("auto-closes once after the configured delay", () => {
    const { confirmation, onClose } = make();
    confirmation.confirm();

    vi.advanceTimersByTime(DELAY - 1);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cancel before the delay prevents the auto-close", () => {
    const { confirmation, onClose } = make();
    confirmation.confirm();

    confirmation.cancel();
    vi.advanceTimersByTime(DELAY * 5);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves only one live timer when confirm is called again (reopen within the window)", () => {
    const { confirmation, onShowSuccess, onClose } = make();

    confirmation.confirm();
    vi.advanceTimersByTime(DELAY - 1); // first window almost elapsed
    confirmation.confirm(); // a second send re-arms; the stale timer must not also fire

    expect(onShowSuccess).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(DELAY);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cancel is a no-op when nothing is pending", () => {
    const { confirmation, onClose } = make();

    expect(() => confirmation.cancel()).not.toThrow();
    vi.advanceTimersByTime(DELAY * 5);

    expect(onClose).not.toHaveBeenCalled();
  });
});
