import { z } from "zod";

import { jobRegistry } from "../../domain/jobs/JobRegistry.js";
import { errorResponse, validationErrorResponse } from "./ErrorSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";

const createJobRequestVariants = Object.values(jobRegistry).map((definition) =>
  z.object({
    type: z.literal(definition.type),
    input: definition.inputSchema,
  }),
);

const createJobRequestSchema = z.union(
  createJobRequestVariants as [
    (typeof createJobRequestVariants)[number],
    ...(typeof createJobRequestVariants)[number][],
  ],
);

const jobErrorResponse = z.object({
  message: z.string(),
  code: z.string(),
});

const jobBaseResponse = z.object({
  id: z.uuid(),
  type: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const queuedJobResponse = jobBaseResponse.extend({
  status: z.literal("queued"),
});

const runningJobResponse = jobBaseResponse.extend({
  status: z.literal("running"),
});

const succeededJobResponse = jobBaseResponse.extend({
  status: z.literal("succeeded"),
  result: z.unknown(),
});

const failedJobResponse = jobBaseResponse.extend({
  status: z.literal("failed"),
  error: jobErrorResponse,
});

export const jobResponseSchema = z.union([
  queuedJobResponse,
  runningJobResponse,
  succeededJobResponse,
  failedJobResponse,
]);

export type JobErrorDto = z.infer<typeof jobErrorResponse>;

export const createJobResponseSchema = jobResponseSchema.and(
  z.object({
    statusUrl: z.string(),
  }),
);

schemaRegistry.add(jobResponseSchema, { id: "Job" });
schemaRegistry.add(createJobResponseSchema, { id: "CreateJobResponse" });

export const JobSchemas = {
  create: {
    tags: ["Jobs"],
    body: createJobRequestSchema,
    response: {
      202: createJobResponseSchema,
      400: validationErrorResponse,
    },
  },
  get: {
    tags: ["Jobs"],
    params: z.object({
      id: z.uuid(),
    }),
    response: {
      200: jobResponseSchema,
      400: validationErrorResponse,
      404: errorResponse,
    },
  },
} as const;

export type JobDto = z.infer<typeof jobResponseSchema>;
