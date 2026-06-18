import { describe, expect, it } from "vitest";
import { FeedbackDraftStore, isEmptyDraft } from "../app/src/renderer/feedback-draft.js";

/**
 * Issue #234: typing a feedback report, dismissing the "Send feedback" modal to
 * copy something from chat, then reopening it dropped the in-progress text --
 * the modal reset its fields on every open. FeedbackDraftStore holds the typed
 * title/body so any dismiss (close, cancel, escape, backdrop) survives a
 * reopen, and drops it only once the report is actually sent. These tests pin
 * that retain/clear contract without touching the DOM.
 */
describe("isEmptyDraft", () => {
  it("treats blank and whitespace-only fields as empty", () => {
    expect(isEmptyDraft({ title: "", body: "" })).toBe(true);
    expect(isEmptyDraft({ title: "   ", body: "\n\t " })).toBe(true);
  });

  it("is non-empty when either field has real text", () => {
    expect(isEmptyDraft({ title: "bug", body: "" })).toBe(false);
    expect(isEmptyDraft({ title: "", body: "it broke" })).toBe(false);
  });
});

describe("FeedbackDraftStore", () => {
  it("starts empty", () => {
    const store = new FeedbackDraftStore();

    expect(store.load()).toEqual({ title: "", body: "" });
  });

  it("retains a saved draft across a close/reopen", () => {
    const store = new FeedbackDraftStore();

    // close: stash whatever was typed
    store.save({ title: "crash on send", body: "steps: 1, 2, 3" });

    // reopen: the same text comes back
    expect(store.load()).toEqual({ title: "crash on send", body: "steps: 1, 2, 3" });
  });

  it("clears the draft once feedback is sent", () => {
    const store = new FeedbackDraftStore();
    store.save({ title: "crash on send", body: "steps: 1, 2, 3" });

    store.clear();

    expect(store.load()).toEqual({ title: "", body: "" });
  });

  it("retains nothing when the form is blank on dismiss", () => {
    const store = new FeedbackDraftStore();

    store.save({ title: "   ", body: "" });

    expect(store.load()).toEqual({ title: "", body: "" });
  });

  it("overwrites an earlier draft with the latest edit", () => {
    const store = new FeedbackDraftStore();

    store.save({ title: "first", body: "first body" });
    store.save({ title: "second", body: "second body" });

    expect(store.load()).toEqual({ title: "second", body: "second body" });
  });

  it("snapshots on save -- later edits to the source object don't leak in", () => {
    const store = new FeedbackDraftStore();
    const live = { title: "draft", body: "typing..." };

    store.save(live);
    live.title = "mutated";
    live.body = "still typing";

    expect(store.load()).toEqual({ title: "draft", body: "typing..." });
  });

  it("hands back a copy from load -- mutating it doesn't corrupt the store", () => {
    const store = new FeedbackDraftStore();
    store.save({ title: "draft", body: "body" });

    const got = store.load();
    got.title = "tampered";

    expect(store.load()).toEqual({ title: "draft", body: "body" });
  });
});
