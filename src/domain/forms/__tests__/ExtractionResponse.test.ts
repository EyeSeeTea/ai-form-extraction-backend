import { describe, expect, it } from "vitest";

import { parseExtractionResponse } from "../ExtractionResponse.js";

describe("parseExtractionResponse", () => {
  it("normalizes envelope-relative confidence paths to result-relative paths", () => {
    expect(
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
      parseExtractionResponse({
        result: { result: "value" },
        fieldConfidence: { "/result": 0.6 },
      }).fieldConfidence,
    ).toEqual({ "/result": 0.6 });
  });

  it("does not strip a legitimate nested result property path", () => {
    expect(
      parseExtractionResponse({
        result: { result: { country: "Kenya" } },
        fieldConfidence: { "/result/country": 0.8 },
      }).fieldConfidence,
    ).toEqual({ "/result/country": 0.8 });
  });
});
