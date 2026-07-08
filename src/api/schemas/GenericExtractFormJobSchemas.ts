import { z } from "zod";

import {
  genericExtractFormFormSchema,
  genericExtractFormInputFileSchema,
  genericExtractFormOutputSchema,
  genericExtractFormProfileSchema,
  genericExtractFormPromptSchema,
} from "../../domain/jobs/generic-extract-form/GenericExtractFormContract.js";
import { authenticatedRoute } from "./AuthenticatedRouteSchema.js";
import { errorResponse, validationErrorResponse } from "./ErrorSchemas.js";
import { createJobResponseSchema } from "./JobSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";

const genericExtractFormRequestBody = z.object({
  form: genericExtractFormFormSchema,
  profile: genericExtractFormProfileSchema.optional(),
  inputFiles: z.array(genericExtractFormInputFileSchema).min(1),
  prompt: genericExtractFormPromptSchema,
  outputSchema: genericExtractFormOutputSchema,
});

schemaRegistry.add(genericExtractFormRequestBody, { id: "GenericExtractFormRequest" });

const genericExtractFormBadRequestResponse = z.union([validationErrorResponse, errorResponse]);

export const GenericExtractFormJobSchemas = {
  create: {
    consumes: ["application/json"],
    ...authenticatedRoute,
    tags: ["Jobs"],
    body: genericExtractFormRequestBody,
    response: {
      202: createJobResponseSchema,
      400: genericExtractFormBadRequestResponse,
    },
  },
} as const;

export type CreateGenericExtractFormJobRequestBody = z.infer<typeof genericExtractFormRequestBody>;
