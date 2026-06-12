import { describe, expect, it } from "vitest";
import { isDeprecatedModelId } from "../app/src/main/model-catalog.js";

describe("isDeprecatedModelId", () => {
  it("flags legacy Google generations (1.x and 2.0)", () => {
    expect(isDeprecatedModelId("google", "gemini-2.0-flash")).toBe(true);
    expect(isDeprecatedModelId("google", "gemini-2.0-flash-lite")).toBe(true);
    expect(isDeprecatedModelId("google", "gemini-1.5-pro")).toBe(true);
    expect(isDeprecatedModelId("google", "gemini-1.5-flash-8b")).toBe(true);
  });

  it("keeps current Google models (2.5+, 3.x, latest aliases)", () => {
    expect(isDeprecatedModelId("google", "gemini-2.5-flash")).toBe(false);
    expect(isDeprecatedModelId("google", "gemini-2.5-pro")).toBe(false);
    expect(isDeprecatedModelId("google", "gemini-3.5-flash")).toBe(false);
    expect(isDeprecatedModelId("google", "gemini-flash-latest")).toBe(false);
  });

  it("flags legacy OpenAI models", () => {
    expect(isDeprecatedModelId("openai", "gpt-4-turbo")).toBe(true);
    expect(isDeprecatedModelId("openai", "gpt-3.5-turbo")).toBe(true);
    expect(isDeprecatedModelId("openai", "o1")).toBe(true);
    expect(isDeprecatedModelId("openai", "o1-mini")).toBe(true);
  });

  it("keeps current OpenAI models", () => {
    expect(isDeprecatedModelId("openai", "gpt-4o")).toBe(false);
    expect(isDeprecatedModelId("openai", "gpt-4o-mini")).toBe(false);
  });

  it("never hides models for providers without a legacy list", () => {
    expect(isDeprecatedModelId("anthropic", "claude-opus-4-8")).toBe(false);
    expect(isDeprecatedModelId("deepseek", "deepseek-v4-pro")).toBe(false);
    expect(isDeprecatedModelId("some-custom-provider", "whatever-1.0")).toBe(false);
  });
});
