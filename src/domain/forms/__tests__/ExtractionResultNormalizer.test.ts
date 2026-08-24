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

  it("removes optional empty objects recursively", () => {
    const schema = {
      type: "object",
      properties: {
        section: {
          type: "object",
          properties: {
            subsection: {
              type: "object",
              properties: { value: { type: "string" } },
            },
          },
        },
      },
    } satisfies JsonObject;

    expect(normalizeExtractionResult({ section: { subsection: {} } }, schema)).toEqual({});
  });

  it("preserves required empty objects and meaningful falsy values", () => {
    const schema = {
      type: "object",
      properties: {
        requiredSection: {
          type: "object",
          properties: { enabled: { type: "boolean" } },
        },
        enabled: { type: "boolean" },
        count: { type: "number" },
        items: { type: "array", items: { type: "object" } },
      },
      required: ["requiredSection"],
    } satisfies JsonObject;

    expect(
      normalizeExtractionResult(
        {
          requiredSection: {},
          enabled: false,
          count: 0,
          items: [{}],
        },
        schema,
      ),
    ).toEqual({ requiredSection: {}, enabled: false, count: 0, items: [{}] });
  });
});
