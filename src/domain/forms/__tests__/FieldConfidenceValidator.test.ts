import { describe, expect, it } from "vitest";

import { validateFieldConfidence } from "../FieldConfidenceValidator.js";

describe("validateFieldConfidence", () => {
  it("normalizes scores for nested scalar values, arrays, escaped keys, and nulls", () => {
    const result = {
      "a/b": {
        "tilde~key": "value",
        nullable: null,
      },
      items: [{ value: 42 }, { value: false }],
    };

    expect(
      validateFieldConfidence(result, {
        "/a~1b/tilde~0key": 0.25,
        "/a~1b/nullable": 0,
        "/items/0/value": 1,
        "/items/1/value": 0.5,
      }),
    ).toEqual({
      fieldConfidence: {
        "/a~1b/tilde~0key": 0.25,
        "/a~1b/nullable": 0,
        "/items/0/value": 1,
        "/items/1/value": 0.5,
      },
      warnings: [],
    });
  });

  it("warns and preserves valid scores when metadata is partial or invalid", () => {
    const validation = validateFieldConfidence(
      {
        country: "Kenya",
        details: { team: "Nairobi East" },
        items: ["one"],
      },
      {
        "/country": 0.8,
        "/details": 0.9,
        "/items/0": 2,
        "/unknown": 0.7,
        "/bad~2path": 0.4,
      },
    );

    expect(validation.fieldConfidence).toEqual({ "/country": 0.8 });
    expect(validation.warnings).toEqual([
      "Rejected field confidence path: /details (field is not scalar)",
      "Rejected field confidence score: /items/0 (expected a number from 0 to 1)",
      "Rejected field confidence path: /unknown (unknown field)",
      "Rejected field confidence path: /bad~2path (invalid JSON Pointer)",
      "Unscored field: /details/team",
      "Unscored field: /items/0",
    ]);
  });

  it("warns for every returned scalar when the map is absent or malformed", () => {
    expect(validateFieldConfidence({ country: "Kenya", answer: null }, undefined)).toEqual({
      fieldConfidence: {},
      warnings: [
        "Field confidence map was not returned",
        "Unscored field: /country",
        "Unscored field: /answer",
      ],
    });

    expect(validateFieldConfidence({ country: "Kenya" }, [])).toEqual({
      fieldConfidence: {},
      warnings: ["Invalid field confidence map: expected an object", "Unscored field: /country"],
    });
  });
});
