import { describe, expect, it } from "vitest";

import { getEitherSuccess } from "../../entities/generic/__tests__/EitherTestUtils.js";
import { parseExtractionResponse } from "../ExtractionResponse.js";

describe("parseExtractionResponse", () => {
  it("normalizes envelope-relative confidence paths to result-relative paths", () => {
    expect(
      getEitherSuccess(
        parseExtractionResponse({
          result: {
            date: { day: 1, month: 2, year: 2026 },
            countryName: "Kenya",
          },
          fieldConfidence: {
            "/result/date/day": 0.8,
            "/result/date/month": 0.7,
            "/result/date/year": 0.9,
            "/result/countryName": 0.95,
          },
        }),
      ),
    ).toEqual({
      result: {
        date: { day: 1, month: 2, year: 2026 },
        countryName: "Kenya",
      },
      fieldConfidence: {
        "/date/day": 0.8,
        "/date/month": 0.7,
        "/date/year": 0.9,
        "/countryName": 0.95,
      },
    });
  });

  it("keeps a public result key named result addressable", () => {
    expect(
      getEitherSuccess(
        parseExtractionResponse({
          result: { result: "value" },
          fieldConfidence: { "/result": 0.6 },
        }),
      ).fieldConfidence,
    ).toEqual({ "/result": 0.6 });
  });

  it("does not strip a legitimate nested result property path", () => {
    expect(
      getEitherSuccess(
        parseExtractionResponse({
          result: { result: { country: "Kenya" } },
          fieldConfidence: { "/result/country": 0.8 },
        }),
      ).fieldConfidence,
    ).toEqual({ "/result/country": 0.8 });
  });

  it("returns a validation error when result is missing", () => {
    const result = parseExtractionResponse({});

    expect(result.isError()).toBe(true);
    expect(result.value).toMatchObject({
      type: "error",
      error: { message: "Extraction response envelope did not include a result" },
    });
  });
});
