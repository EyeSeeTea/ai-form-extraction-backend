import { describe, expect, it } from "vitest";

import { ExtractionProfileStaticRepository } from "../ExtractionProfileStaticRepository.js";
import {
  managedExtractionSystemPrompt,
  managedExtractionUserPromptTemplate,
} from "../../../domain/extraction/PromptComposer.js";

describe("ExtractionProfileStaticRepository", () => {
  it("lists and resolves known extraction profiles", async () => {
    const repository = createExtractionProfileRepository();

    await expect(repository.list().toPromise()).resolves.toEqual(["default"]);
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
