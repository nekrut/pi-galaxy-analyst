// In-progress "Send feedback" form contents worth surviving a modal
// close/reopen (issue #234). Only the user-typed text is a draft; the
// include-system-info / include-logs toggles reset to their defaults on every
// open, so they are deliberately not held here.
export interface FeedbackDraft {
  title: string;
  body: string;
}

// A form with no real text is worth nothing -- reopening after an empty open
// should start fresh rather than restore two empty strings.
export function isEmptyDraft(draft: FeedbackDraft): boolean {
  return draft.title.trim() === "" && draft.body.trim() === "";
}

// Retains the in-progress feedback form across modal close/reopen and drops it
// once the report is sent. In-memory only: the modal is hidden, not torn down,
// so a single module-scope instance outlives every open/close cycle within a
// session, while a fresh app launch starts with a clean form. Every dismiss
// path (close, cancel, escape, backdrop) retains; only a successful send clears.
export class FeedbackDraftStore {
  private draft: FeedbackDraft = { title: "", body: "" };

  save(draft: FeedbackDraft): void {
    this.draft = isEmptyDraft(draft)
      ? { title: "", body: "" }
      : { title: draft.title, body: draft.body };
  }

  load(): FeedbackDraft {
    return { title: this.draft.title, body: this.draft.body };
  }

  clear(): void {
    this.draft = { title: "", body: "" };
  }
}
