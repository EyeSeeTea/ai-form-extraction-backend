import { describe, expect, it } from "vitest";

import { compareEvaluationResults } from "./EvaluationComparator.js";

describe("compareEvaluationResults", () => {
  it("reports nested leaf differences with confidence", () => {
    expect(
      compareEvaluationResults(
        { patient: { name: "Ada", age: 42 }, tags: ["a", "b"] },
        { patient: { name: "Ada", age: 41 }, tags: ["a", "c", "d"] },
        { "/patient/age": 0.91, "/tags/1": 0.72, "/tags/2": 0.5 },
      ),
    ).toEqual({
      mismatches: [
        {
          path: "/patient/age",
          expected: 42,
          actual: 41,
          expectedPresent: true,
          actualPresent: true,
          confidence: 0.91,
        },
        {
          path: "/tags/1",
          expected: "b",
          actual: "c",
          expectedPresent: true,
          actualPresent: true,
          confidence: 0.72,
        },
        {
          path: "/tags/2",
          actual: "d",
          expectedPresent: false,
          actualPresent: true,
          confidence: 0.5,
        },
      ],
      stats: {
        matched: 2,
        mismatched: 3,
        compared: 5,
        mismatchPercentage: 60,
      },
    });
  });

  it("expands missing nested properties and preserves escaped pointers", () => {
    expect(compareEvaluationResults({ "a/b": { "x~y": true } }, {})).toMatchObject({
      mismatches: [
        {
          path: "/a~1b/x~0y",
          expected: true,
          expectedPresent: true,
          actualPresent: false,
        },
      ],
      stats: { matched: 0, mismatched: 1, compared: 1, mismatchPercentage: 100 },
    });
  });

  it("calculates matched, mismatched, and weighted mismatch percentages", () => {
    expect(
      compareEvaluationResults({ name: "Ada", age: 42 }, { name: "Ada", age: 41 }).stats,
    ).toEqual({
      matched: 1,
      mismatched: 1,
      compared: 2,
      mismatchPercentage: 50,
    });
  });
});
