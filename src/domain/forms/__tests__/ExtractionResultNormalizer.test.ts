import { describe, expect, it } from "vitest";

import type { JsonObject } from "../../entities/generic/Json.js";
import { normalizeExtractionResult } from "../ExtractionResultNormalizer.js";

describe("normalizeExtractionResult", () => {
  it("removes nulls only from optional non-nullable fields", () => {
    const schema = {
      type: "object",
      properties: {
        optional: { type: "string" },
        required: { type: "string" },
        nullable: { type: ["string", "null"] },
      },
      required: ["required"],
    } satisfies JsonObject;

    expect(
      normalizeExtractionResult({ optional: null, required: null, nullable: null }, schema),
    ).toEqual({ required: null, nullable: null });
  });

  it("normalizes nested objects and objects inside arrays without removing array items", () => {
    const schema = {
      type: "object",
      properties: {
        parent: {
          type: "object",
          properties: {
            optional: { type: "string" },
            required: { type: "string" },
          },
          required: ["required"],
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" } },
          },
        },
      },
    } satisfies JsonObject;

    expect(
      normalizeExtractionResult(
        {
          parent: { optional: null, required: null },
          items: [{ label: null }, null],
        },
        schema,
      ),
    ).toEqual({ parent: { required: null }, items: [{}, null] });
  });

  it("uses nullable additionalProperties when no named property schema exists", () => {
    const schema = {
      type: "object",
      additionalProperties: { type: ["string", "null"] },
    } satisfies JsonObject;

    expect(normalizeExtractionResult({ kept: null, unknown: null }, schema)).toEqual({
      kept: null,
      unknown: null,
    });
  });
});
