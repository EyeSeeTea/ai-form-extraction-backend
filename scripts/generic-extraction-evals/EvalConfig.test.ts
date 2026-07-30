import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { filterEvaluationCases, loadEvaluationSuite } from "./EvalConfig.js";

describe("loadEvaluationSuite", () => {
  it("filters descriptions case-insensitively by substring", () => {
    const cases = [{ description: "Sample Alpha" }, { description: "Sample Beta" }];

    expect(filterEvaluationCases(cases, "BETA").map((item) => item.description)).toEqual([
      "Sample Beta",
    ]);
  });

  it("resolves case values from suite defaults relative to the config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "generic-evals-test-"));
    try {
      await writeFile(join(directory, "prompt.txt"), "Extract values");
      await writeFile(join(directory, "schema.json"), JSON.stringify({ type: "object" }));
      await writeFile(join(directory, "expected.json"), JSON.stringify({}));
      await writeFile(join(directory, "document.pdf"), "%PDF-1.7 test");
      await writeFile(
        join(directory, "suite.json"),
        JSON.stringify({
          name: "Examples",
          form: "example-form",
          prompt: "prompt.txt",
          outputSchema: "schema.json",
          expected: "expected.json",
          files: ["document.pdf"],
          evals: [{ description: "first sample" }],
        }),
      );

      const suite = await loadEvaluationSuite(join(directory, "suite.json"));

      expect(suite.cases[0]).toMatchObject({
        description: "first sample",
        form: "example-form",
        profile: "default",
        confidence: false,
        prompt: "Extract values",
        outputSchema: { type: "object" },
        expected: {},
        filePaths: ["document.pdf"],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("allows a case to override inherited values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "generic-evals-test-"));
    try {
      await writeFile(join(directory, "default-prompt.txt"), "Default");
      await writeFile(join(directory, "case-prompt.txt"), "Case");
      await writeFile(join(directory, "schema.json"), JSON.stringify({ type: "object" }));
      await writeFile(join(directory, "expected.json"), JSON.stringify({}));
      await writeFile(join(directory, "document.pdf"), "%PDF-1.7 test");
      await writeFile(
        join(directory, "suite.json"),
        JSON.stringify({
          name: "Overrides",
          prompt: "default-prompt.txt",
          outputSchema: "schema.json",
          expected: "expected.json",
          files: ["document.pdf"],
          confidence: true,
          evals: [
            { description: "uses suite default" },
            {
              description: "case",
              prompt: "case-prompt.txt",
              form: "special-form",
              confidence: false,
            },
          ],
        }),
      );

      const suite = await loadEvaluationSuite(join(directory, "suite.json"));

      expect(suite.cases[0]).toMatchObject({ confidence: true });
      expect(suite.cases[1]).toMatchObject({
        form: "special-form",
        prompt: "Case",
        confidence: false,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate descriptions before execution", async () => {
    const directory = await mkdtemp(join(tmpdir(), "generic-evals-test-"));
    try {
      await writeFile(
        join(directory, "suite.json"),
        JSON.stringify({
          name: "Duplicates",
          evals: [{ description: "same" }, { description: "same" }],
        }),
      );

      await expect(loadEvaluationSuite(join(directory, "suite.json"))).rejects.toThrow(
        "Duplicate evaluation description",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("allows empty expected objects only in scaffold mode", async () => {
    const directory = await mkdtemp(join(tmpdir(), "generic-evals-test-"));
    try {
      await writeFile(join(directory, "prompt.txt"), "Extract values");
      await writeFile(
        join(directory, "schema.json"),
        JSON.stringify({
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        }),
      );
      await writeFile(join(directory, "expected.json"), "{}");
      await writeFile(join(directory, "document.pdf"), "%PDF-1.7 test");
      await writeFile(
        join(directory, "suite.json"),
        JSON.stringify({
          name: "Scaffold",
          prompt: "prompt.txt",
          outputSchema: "schema.json",
          expected: "expected.json",
          files: ["document.pdf"],
          evals: [{ description: "case" }],
        }),
      );

      await expect(loadEvaluationSuite(join(directory, "suite.json"))).rejects.toThrow(
        "does not match output schema",
      );
      await expect(
        loadEvaluationSuite(join(directory, "suite.json"), { allowEmptyExpected: true }),
      ).resolves.toMatchObject({ name: "Scaffold" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
