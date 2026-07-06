import { z } from "zod";

import type { FormDefinition } from "../FormDefinition.js";
import eosJsonSchema from "./eos.schema.json" with { type: "json" };

export const endOfSeasonExtractionSchema = z.object({
  end_of_season_report: z
    .object({
      header_information: z
        .object({
          country: z.unknown().optional(),
          team: z.unknown().optional(),
          date: z.unknown().optional(),
        })
        .nullish(),
    })
    .nullish(),
});

export type EndOfSeasonExtractedFields = z.infer<typeof endOfSeasonExtractionSchema>;

export const endOfSeasonResultSchema = z.object({
  end_of_season_report: z.object({
    header_information: z
      .object({
        country: z.string().nullable(),
        team: z.string().nullable(),
        date: z.iso.date().nullable(),
      })
      .nullable(),
  }),
});

export type EndOfSeasonResult = z.infer<typeof endOfSeasonResultSchema>;

const endOfSeasonMetadata = {
  programId: "program-end-of-season",
  trackedEntityTypeId: "tracked-entity-farm",
  orgUnitId: "org-unit-end-of-season",
  countryDataElementId: "data-element-country",
  teamDataElementId: "data-element-team",
  dateDataElementId: "data-element-date",
} as const;

export const endOfSeasonFormDefinition = {
  formType: "end-of-season",
  extractionSchema: endOfSeasonExtractionSchema,
  jsonSchema: eosJsonSchema,
  resultSchema: endOfSeasonResultSchema,
  resultJsonSchema: eosJsonSchema,
  metadata: endOfSeasonMetadata,
  mapResult(fields) {
    const headerInformation = fields.end_of_season_report?.header_information;

    return {
      end_of_season_report: {
        header_information:
          headerInformation === null || headerInformation === undefined
            ? null
            : {
                country: normalizeString(headerInformation.country),
                team: normalizeString(headerInformation.team),
                date: normalizeString(headerInformation.date),
              },
      },
    };
  },
} as const satisfies FormDefinition<
  "end-of-season",
  EndOfSeasonExtractedFields,
  EndOfSeasonResult,
  typeof endOfSeasonMetadata
>;

function normalizeString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
