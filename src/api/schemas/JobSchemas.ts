import { z } from "zod";

import { jobFailureCodes } from "../../domain/entities/JobFailureCode.js";
import { getRegisteredJobs } from "../../domain/jobs/RegisteredJobRegistry.js";
import { authenticatedRoute } from "./AuthenticatedRouteSchema.js";
import { errorResponse, validationErrorResponse } from "./ErrorSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";

const createJobRequestVariants = getRegisteredJobs()
  .filter(({ definition }) => definition.submissionMode === "json")
  .map(({ definition }) =>
    z.object({
      type: z.literal(definition.type),
      input: definition.inputSchema,
    }),
  );
const [
  firstCreateJobRequestVariant,
  secondCreateJobRequestVariant,
  ...remainingCreateJobRequestVariants
] = createJobRequestVariants;

const createJsonJobBodySchema =
  firstCreateJobRequestVariant === undefined
    ? z.never()
    : secondCreateJobRequestVariant === undefined
      ? firstCreateJobRequestVariant
      : z.union([
          firstCreateJobRequestVariant,
          secondCreateJobRequestVariant,
          ...remainingCreateJobRequestVariants,
        ]);

const jobErrorResponse = z.object({
  message: z.string(),
  code: z.enum(jobFailureCodes),
});

const jobBaseResponse = z.object({
  id: z.uuid(),
  type: z.string(),
  createdBy: z.string().nullable(),
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
export type CreateJsonJobRequestBody = z.infer<typeof createJsonJobBodySchema>;

export const createJobResponseSchema = jobResponseSchema.and(
  z.object({
    statusUrl: z.string(),
  }),
);

schemaRegistry.add(jobResponseSchema, { id: "Job" });
schemaRegistry.add(createJobResponseSchema, { id: "CreateJobResponse" });

export const JobSchemas = {
  create: {
    ...authenticatedRoute,
    tags: ["Jobs"],
    body: createJsonJobBodySchema,
    response: {
      202: createJobResponseSchema,
      400: validationErrorResponse,
    },
  },
  get: {
    ...authenticatedRoute,
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
