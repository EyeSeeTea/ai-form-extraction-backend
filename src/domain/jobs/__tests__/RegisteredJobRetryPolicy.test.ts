import { describe, expect, it } from "vitest";

import { getNextJobAttemptAt } from "../RegisteredJobRetryPolicy.js";

const now = new Date("2026-01-01T12:00:00.000Z");

describe("RegisteredJobRetryPolicy", () => {
  it("uses the initial delay for the first retry", () => {
    expect(getNextJobAttemptAt(jobWith({ attempts: 1 }), now)).toEqual(
      new Date("2026-01-01T12:00:01.000Z"),
    );
  });

  it("applies exponential backoff", () => {
    expect(getNextJobAttemptAt(jobWith({ attempts: 2 }), now)).toEqual(
      new Date("2026-01-01T12:00:02.000Z"),
    );
  });

  it("caps the delay at the Registered Job maximum", () => {
    expect(getNextJobAttemptAt(jobWith({ attempts: 10, maxAttempts: 11 }), now)).toEqual(
      new Date("2026-01-01T12:00:30.000Z"),
    );
  });

  it("does not schedule an exhausted job", () => {
    expect(getNextJobAttemptAt(jobWith({ attempts: 3, maxAttempts: 3 }), now)).toBeUndefined();
  });

  it("does not schedule an unknown Registered Job", () => {
    expect(
      getNextJobAttemptAt({ type: "missing", attempts: 1, maxAttempts: 3 }, now),
    ).toBeUndefined();
  });

  it("does not schedule inherited object properties", () => {
    for (const type of ["constructor", "toString", "__proto__"]) {
      expect(getNextJobAttemptAt({ type, attempts: 1, maxAttempts: 3 }, now)).toBeUndefined();
    }
  });
});

function jobWith(overrides: Partial<{ type: string; attempts: number; maxAttempts: number }>) {
  return {
    type: "count_example_items",
    attempts: 1,
    maxAttempts: 3,
    ...overrides,
  };
}
