import { describe, expect, it } from "vitest";

import { createDefaultReporter, formatValue, renderCase, renderReport } from "./EvalReporter.js";

describe("default evaluation reporter", () => {
  it("renders actionable failure details", () => {
    const output = renderCase(
      {
        description: "Sample",
        status: "fail",
        outputDirectory: "/tmp/sample",
        elapsedMs: 2400,
        costUsd: 0.001234,
        mismatches: [
          {
            path: "/age",
            expected: 42,
            actual: 41,
            expectedPresent: true,
            actualPresent: true,
            confidence: 0.91,
          },
        ],
      },
      false,
    );

    expect(output).toContain("FAIL");
    expect(output).toContain("elapsed: 2.4s  cost: $0.001234");
    expect(output).toContain("expected: 42");
    expect(output).toContain("actual:   41");
    expect(output).toContain("confidence: 0.91");
    expect(output).toContain("artifacts: /tmp/sample");
  });

  it("keeps machine values compact and truncates long terminal values", () => {
    expect(formatValue("a".repeat(200))).toHaveLength(120);
    expect(
      renderReport({
        suiteName: "Suite",
        cases: [],
        elapsedMs: 1200,
        knownCostUsd: 0,
        missingCostCount: 0,
        comparison: {
          matched: 0,
          mismatched: 0,
          compared: 0,
          mismatchPercentage: null,
        },
      }),
    ).toContain("elapsed: 1.2s");
  });

  it("prints line-oriented progress without terminal control sequences", () => {
    const output: string[] = [];
    const reporter = createDefaultReporter({ isTTY: false, write: (text) => output.push(text) });
    const report = {
      description: "Sample",
      status: "pass" as const,
      outputDirectory: "/tmp/sample",
      elapsedMs: 100,
    };

    reporter.onProgress({ type: "caseStarted", index: 0, total: 1, description: "Sample" });
    reporter.onProgress({ type: "caseCompleted", index: 0, total: 1, report });

    expect(output.join("")).toBe("START 1/1 Sample\nPASS       Sample (100ms)\n");
    expect(output.join("")).not.toContain("\u001b");
  });

  it("colors summary count values without coloring their labels", () => {
    const output = renderReport(
      {
        suiteName: "Suite",
        cases: [],
        elapsedMs: 0,
        knownCostUsd: 0,
        missingCostCount: 0,
        comparison: {
          matched: 0,
          mismatched: 0,
          compared: 0,
          mismatchPercentage: null,
        },
      },
      true,
    );

    expect(output).toContain("passed: \u001b[32m0\u001b[0m");
    expect(output).not.toContain("\u001b[32mpassed");
  });
});
