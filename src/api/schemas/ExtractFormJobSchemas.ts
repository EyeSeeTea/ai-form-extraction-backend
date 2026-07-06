import { z } from "zod";

import { authenticatedRoute } from "./AuthenticatedRouteSchema.js";
import { createJobResponseSchema } from "./JobSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";
import { errorResponse } from "./ErrorSchemas.js";

const extractFormRequestBody = z
  .object({
    formType: z.unknown(),
    files: z.unknown(),
  })
  .strip();

schemaRegistry.add(extractFormRequestBody, { id: "ExtractFormRequest" });

export const ExtractFormJobSchemas = {
  create: {
    consumes: ["multipart/form-data"],
    ...authenticatedRoute,
    tags: ["Jobs"],
    body: extractFormRequestBody,
    response: {
      202: createJobResponseSchema,
      400: errorResponse,
    },
  },
} as const;
