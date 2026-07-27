import { describe, expect, it } from "vitest";

import { getJobDefinition, isKnownJobType, parseJobInput } from "../JobRegistry.js";

describe("jobRegistry", () => {
  it("returns no definition for an unknown type", () => {
    expect(getJobDefinition("missing")).toBeUndefined();
    expect(isKnownJobType("missing")).toBe(false);
  });

  it("parses valid extract form input", () => {
    expect(isKnownJobType("extract_form")).toBe(true);

    const parsed = parseJobInput("extract_form", {
      formId: "form-1",
      sourceUrl: "https://example.org/forms/1",
    });

    expect(parsed).toEqual({
      formId: "form-1",
      sourceUrl: "https://example.org/forms/1",
    });
  });

  it("rejects invalid extract form input", () => {
    expect(() =>
      parseJobInput("extract_form", {
        formId: "",
        sourceUrl: "not-a-url",
      }),
    ).toThrow();
  });
});
