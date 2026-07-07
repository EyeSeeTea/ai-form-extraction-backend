import { describe, expect, it } from "vitest";

import type { JsonObject } from "../../entities/Job.js";
import { jsonSchemaToZod } from "../JsonSchemaToZod.js";

describe("jsonSchemaToZod", () => {
  it("supports required fields, nested objects, arrays, oneOf, and patterns", () => {
    const schemaDefinition: JsonObject = {
      type: "object",
      properties: {
        id: { type: "string" },
        count: { oneOf: [{ type: "number" }, { type: "string", pattern: "^\\d+$" }] },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        nested: {
          type: ["object", "null"],
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
        },
      },
      required: ["id", "count"],
    };
    const schema = jsonSchemaToZod(schemaDefinition);
    const permissiveSchema = jsonSchemaToZod(schemaDefinition, { respectRequired: false });

    expect(
      schema.safeParse({
        id: "abc",
        count: "12",
        tags: ["x"],
        nested: { enabled: true },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        id: "abc",
        count: "nope",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        count: 1,
      }).success,
    ).toBe(false);
    expect(
      permissiveSchema.safeParse({
        count: 1,
      }).success,
    ).toBe(true);
  });
});
