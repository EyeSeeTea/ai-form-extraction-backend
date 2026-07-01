import { z } from "zod";

import type { FormDefinition } from "../FormDefinition.js";

export const endOfSeasonExtractionSchema = z.object({
  formType: z.literal("end-of-season"),
  country: z.string().min(1),
  team: z.string().min(1),
  date: z.iso.date(),
});

export type EndOfSeasonExtractedFields = z.infer<typeof endOfSeasonExtractionSchema>;

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
  metadata: endOfSeasonMetadata,
  toTrackerPayload(fields) {
    return {
      program: endOfSeasonMetadata.programId,
      trackedEntityType: endOfSeasonMetadata.trackedEntityTypeId,
      orgUnit: endOfSeasonMetadata.orgUnitId,
      eventDate: fields.date,
      status: "COMPLETED",
      dataValues: [
        {
          dataElement: endOfSeasonMetadata.countryDataElementId,
          value: fields.country,
        },
        {
          dataElement: endOfSeasonMetadata.teamDataElementId,
          value: fields.team,
        },
        {
          dataElement: endOfSeasonMetadata.dateDataElementId,
          value: fields.date,
        },
      ],
    };
  },
} as const satisfies FormDefinition<
  "end-of-season",
  EndOfSeasonExtractedFields,
  typeof endOfSeasonMetadata
>;
