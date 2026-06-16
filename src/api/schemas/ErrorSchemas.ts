import { z } from "zod";

import { schemaRegistry } from "./SchemaRegistry.js";

export const errorResponse = z.object({
  error: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});

const validationIssue = z.object({
  keyword: z.string(),
  instancePath: z.string(),
  schemaPath: z.string(),
  message: z.string(),
  params: z.record(z.string(), z.unknown()),
});

export const validationErrorResponse = errorResponse.extend({
  issues: z.array(validationIssue),
});

schemaRegistry.add(errorResponse, { id: "Error" });
schemaRegistry.add(validationErrorResponse, { id: "ValidationError" });
