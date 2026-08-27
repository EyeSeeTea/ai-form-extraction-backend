import { describe, expect, it } from "vitest";

import { ExtractionProfileStaticRepository } from "../ExtractionProfileStaticRepository.js";
import {
  managedExtractionSystemPrompt,
  managedExtractionUserPromptTemplate,
} from "../../../domain/extraction/PromptComposer.js";

describe("ExtractionProfileStaticRepository", () => {
  it("lists and resolves the default configured profile", async () => {
    const repository = createExtractionProfileRepository();

    await expect(repository.list().toPromise()).resolves.toEqual(["fast", "default", "high"]);
    await expect(repository.getById("default").toPromise()).resolves.toMatchObject({
      id: "default",
      provider: "stub",
      model: "stub-model",
      prompt: {
        system: managedExtractionSystemPrompt,
        userTemplate: managedExtractionUserPromptTemplate,
        instructions: "",
      },
      extractionJsonSchema: {},
    });
  });

  it.each([
    ["fast", "qwen/qwen3.7-flash"],
    ["high", "qwen/qwen3.8-27b"],
  ] as const)("resolves the %s profile with its OpenRouter model", async (id, model) => {
    const repository = createExtractionProfileRepository();

    await expect(repository.getById(id).toPromise()).resolves.toMatchObject({
      id,
      provider: "openrouter",
      model,
    });
  });

  it("returns no profile for unknown extraction profiles", async () => {
    const repository = createExtractionProfileRepository();

    await expect(repository.getById("experimental").toPromise()).resolves.toBeUndefined();
  });
});

function createExtractionProfileRepository() {
  return new ExtractionProfileStaticRepository({
    provider: "stub",
    model: "stub-model",
  });
}
