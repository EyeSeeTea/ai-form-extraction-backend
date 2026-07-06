import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { JsonObject } from "../../entities/Job.js";
import { validateExtractionResult } from "../ExtractionResultValidator.js";
import { ValidationError } from "../../../shared/ValidationError.js";

const schema = {
  type: "object",
  properties: {
    country: { type: "string" },
    team: { type: "string" },
    date: { type: "string" },
  },
  required: ["country", "team", "date"],
  additionalProperties: false,
} satisfies JsonObject;

const extractionSchema = z.object({
  country: z.string(),
  team: z.string(),
  date: z.string(),
});

describe("validateExtractionResult", () => {
  it("returns complete extracted objects without warnings", () => {
    const extractedFields = {
      country: "Kenya",
      team: "Nairobi East",
      date: "2026-01-01",
    };

    const validation = validateExtractionResult({
      jsonSchema: schema,
      resultSchema: extractionSchema,
      result: extractedFields,
    });

    expect(validation).toEqual({
      warnings: [],
      quality: {
        missingFieldCount: 0,
        invalidFieldCount: 0,
        schemaCoverage: 1,
      },
    });
  });

  it("emits warnings for missing required fields without failing", () => {
    const validation = validateExtractionResult({
      jsonSchema: schema,
      resultSchema: extractionSchema,
      result: {
        country: "Kenya",
        date: "2026-01-01",
      },
    });

    expect(validation.warnings).toEqual(["Missing field: team"]);
    expect(validation.quality).toEqual({
      missingFieldCount: 1,
      invalidFieldCount: 0,
      schemaCoverage: 2 / 3,
    });
  });

  it("reports zero coverage when all required fields are missing", () => {
    const validation = validateExtractionResult({
      jsonSchema: schema,
      resultSchema: extractionSchema,
      result: {},
    });

    expect(validation.warnings).toEqual([
      "Missing field: country",
      "Missing field: team",
      "Missing field: date",
    ]);
    expect(validation.quality).toEqual({
      missingFieldCount: 3,
      invalidFieldCount: 0,
      schemaCoverage: 0,
    });
  });

  it("reports zero coverage for nested schemas when the required parent is missing", () => {
    const nestedSchema = {
      type: "object",
      properties: {
        parent: {
          type: "object",
          properties: {
            child: { type: "string" },
          },
          required: ["child"],
        },
      },
      required: ["parent"],
    } satisfies JsonObject;
    const nestedResultSchema = z.object({
      parent: z.object({
        child: z.string(),
      }),
    });

    const validation = validateExtractionResult({
      jsonSchema: nestedSchema,
      resultSchema: nestedResultSchema,
      result: {},
    });

    expect(validation.warnings).toEqual(["Missing field: parent"]);
    expect(validation.quality).toEqual({
      missingFieldCount: 1,
      invalidFieldCount: 0,
      schemaCoverage: 0,
    });
  });

  it("fails non-object model output", () => {
    expect(() =>
      validateExtractionResult({ jsonSchema: schema, resultSchema: extractionSchema, result: [] }),
    ).toThrow(ValidationError);
  });

  it("preserves extra fields", () => {
    const extractedFields = {
      country: "Kenya",
      team: "Nairobi East",
      date: "2026-01-01",
      enumerator: "Amina",
    };

    const validation = validateExtractionResult({
      jsonSchema: schema,
      resultSchema: extractionSchema,
      result: extractedFields,
    });

    expect(validation.warnings).toEqual([]);
  });

  it("emits warnings for invalid field types and preserves original output", () => {
    const extractedFields = {
      country: "Kenya",
      team: 123,
      date: "2026-01-01",
    };

    const validation = validateExtractionResult({
      jsonSchema: schema,
      resultSchema: extractionSchema,
      result: extractedFields,
    });

    expect(validation.warnings).toEqual(["Invalid field: team"]);
    expect(validation.quality).toEqual({
      missingFieldCount: 0,
      invalidFieldCount: 1,
      schemaCoverage: 1,
    });
  });

  it("does not report child fields as missing when a nullable parent is null", () => {
    const nullableParentSchema = {
      type: "object",
      properties: {
        parent: {
          type: ["object", "null"],
          properties: {
            child: { type: "string" },
          },
          required: ["child"],
        },
      },
      required: ["parent"],
    } satisfies JsonObject;
    const nullableParentResultSchema = z.object({
      parent: z
        .object({
          child: z.string(),
        })
        .nullable(),
    });

    const validation = validateExtractionResult({
      jsonSchema: nullableParentSchema,
      resultSchema: nullableParentResultSchema,
      result: { parent: null },
    });

    expect(validation.warnings).toEqual([]);
    expect(validation.quality).toEqual({
      missingFieldCount: 0,
      invalidFieldCount: 0,
      schemaCoverage: 1,
    });
  });
});
