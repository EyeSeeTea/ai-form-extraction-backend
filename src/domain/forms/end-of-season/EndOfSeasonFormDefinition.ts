import { z } from "zod";

import type { FormDefinition } from "../FormDefinition.js";
import eosJsonSchema from "./eos.schema.json" with { type: "json" };

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
  jsonSchema: eosJsonSchema,
  metadata: endOfSeasonMetadata,
  mapResult(fields) {
    return fields;
  },
} as const satisfies FormDefinition<
  "end-of-season",
  EndOfSeasonExtractedFields,
  EndOfSeasonExtractedFields,
  typeof endOfSeasonMetadata
>;
