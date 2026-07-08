import { describe, expect, it } from "vitest";

import { ExtractionProfileStaticRepository } from "../../../data/repositories/ExtractionProfileStaticRepository.js";
import { DefaultGenericExtractionProfileFactory } from "../GenericExtractionProfileFactory.js";

describe("DefaultGenericExtractionProfileFactory", () => {
  it("builds caller-provided generic extraction overrides from the base profile", () => {
    const genericProfileFactory = createGenericExtractionProfileFactory();

    expect(
      genericProfileFactory.create({
        profile: "default",
        form: "caller-label",
        extractionJsonSchema: {
          type: "object",
        },
        instructions: "Use caller instructions",
      }),
    ).toMatchObject({
      id: "default",
      formType: "caller-label",
      provider: "stub",
      model: "stub-model",
      extractionJsonSchema: {
        type: "object",
      },
      prompt: {
        instructions: "Use caller instructions",
      },
    });
  });
});

function createGenericExtractionProfileFactory() {
  return new DefaultGenericExtractionProfileFactory(
    new ExtractionProfileStaticRepository({
      provider: "stub",
      model: "stub-model",
    }),
  );
}
