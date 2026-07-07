import { describe, expect, it } from "vitest";

import { getFormDefinition } from "../../FormRegistry.js";
import eosJsonSchema from "../eos.schema.json" with { type: "json" };
import { endOfSeasonFormDefinition } from "../EndOfSeasonFormDefinition.js";

describe("EndOfSeasonFormDefinition", () => {
  it("exposes the canonical JSON schema", () => {
    expect(endOfSeasonFormDefinition.formType).toBe("end-of-season");
    expect(endOfSeasonFormDefinition.extractionJsonSchema).toBe(eosJsonSchema);
    expect(typeof endOfSeasonFormDefinition.extractionJsonSchema).toBe("object");
  });

  it("is registered under the end-of-season form type", () => {
    const formDefinition = getFormDefinition("end-of-season");

    expect(formDefinition).toBeDefined();
    expect(formDefinition?.formType).toBe("end-of-season");
    expect(formDefinition?.extractionJsonSchema).toBe(eosJsonSchema);
  });

  it("derives runtime validation from the canonical JSON schema", () => {
    const validExtraction = endOfSeasonFormDefinition.extractionSchema.safeParse({
      end_of_season_report: {
        header_information: {
          country: "Kenya",
        },
      },
    });
    const validResult = endOfSeasonFormDefinition.resultSchema.safeParse({
      end_of_season_report: {
        header_information: {
          country: "Kenya",
          team: "Nairobi East",
          date: "2026-01-01",
        },
      },
    });
    const invalidResult = endOfSeasonFormDefinition.resultSchema.safeParse({
      end_of_season_report: {
        header_information: {
          country: "Kenya",
        },
      },
    });

    expect(validExtraction.success).toBe(true);
    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });
});
