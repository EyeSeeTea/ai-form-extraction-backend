import { z } from "zod";

import { knownFormTypes } from "../../domain/forms/FormRegistry.js";
import { authenticatedRoute } from "./AuthenticatedRouteSchema.js";
import { createJobResponseSchema } from "./JobSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";
import { errorResponse } from "./ErrorSchemas.js";

const extractFormRequestBody = z
  .object({
    files: z.unknown(),
  })
  .strip();

const extractFormParams = z.object({
  formType: z.enum(knownFormTypes),
});

schemaRegistry.add(extractFormRequestBody, { id: "ExtractFormRequest" });

export const ExtractFormJobSchemas = {
  create: {
    consumes: ["multipart/form-data"],
    ...authenticatedRoute,
    tags: ["Jobs"],
    params: extractFormParams,
    body: extractFormRequestBody,
    response: {
      202: createJobResponseSchema,
      400: errorResponse,
    },
  },
} as const;
