import { describe, it, expect } from "vitest";
import {
  validateFeedbackPayload,
  SCHEMA_VERSION,
  FEEDBACK_ROUTE,
  FEEDBACK_KEY_HEADER,
} from "../shared/feedback-contract.js";

const valid = {
  schemaVersion: 1,
  source: "orbit",
  title: "It crashed",
  body: "Steps: ...",
  clientTs: "2026-06-02T00:00:00.000Z",
};

describe("feedback contract", () => {
  it("exposes stable wire constants", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(FEEDBACK_ROUTE).toBe("/feedback");
    expect(FEEDBACK_KEY_HEADER).toBe("X-Orbit-Feedback-Key");
  });

  it("accepts a minimal valid payload", () => {
    expect(validateFeedbackPayload(valid)).toBe(true);
  });

  it("rejects missing title", () => {
    expect(validateFeedbackPayload({ ...valid, title: "" })).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(validateFeedbackPayload({ ...valid, source: "evil" })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateFeedbackPayload(null)).toBe(false);
    expect(validateFeedbackPayload("nope")).toBe(false);
  });

  it("rejects a wrong schemaVersion, non-string body, or missing clientTs", () => {
    expect(validateFeedbackPayload({ ...valid, schemaVersion: 2 })).toBe(false);
    expect(validateFeedbackPayload({ ...valid, body: 123 })).toBe(false);
    expect(
      validateFeedbackPayload({ schemaVersion: 1, source: "orbit", title: "t", body: "b" }),
    ).toBe(false);
  });
});
