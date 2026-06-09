/**
 * Owns the "Feedback received, thank you!" confirmation lifecycle for the
 * Send-feedback modal.
 *
 * The modal used to close silently on a successful send, so the user had no way
 * to tell success from a no-op (the reported complaint). On success we now show
 * an inline thank-you and auto-close after a short delay. The only subtlety is
 * the timer: if the user reopens the modal inside that window, the stale timer
 * must not close the freshly opened modal -- so this controller owns the single
 * pending timer and re-arms / cancels it cleanly. DOM-free so it's unit-testable
 * under the node test environment.
 */
export interface FeedbackConfirmationConfig {
  /** How long the thank-you state stays up before the modal auto-closes. */
  delayMs: number;
  /** Swap the form for the inline thank-you state. */
  onShowSuccess: () => void;
  /** Close the modal once the thank-you has been shown long enough. */
  onClose: () => void;
}

export class FeedbackConfirmation {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: FeedbackConfirmationConfig) {}

  /** Show the thank-you state now and schedule the auto-close. */
  confirm(): void {
    this.cancel();
    this.config.onShowSuccess();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.config.onClose();
    }, this.config.delayMs);
  }

  /** Drop any pending auto-close (manual close, reopen, Esc). No-op when idle. */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
