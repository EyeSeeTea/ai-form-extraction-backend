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

const extractionIssueCode = z.enum(["required", "type", "pattern", "format", "enum", "custom"]);

const extractionResultIssue = z.object({
  path: z.array(z.string()),
  code: extractionIssueCode,
  message: z.string(),
});

const extractionResultQuality = z.object({
  missingFieldCount: z.number().int().nonnegative(),
  invalidFieldCount: z.number().int().nonnegative(),
  schemaCoverage: z.number().min(0).max(1),
  status: z.enum(["valid", "partial", "invalid"]),
});

const extractionDiagnostics = z.object({
  providerName: z.string(),
  model: z.string(),
  profile: z.string(),
  warnings: z.array(z.string()),
  issues: z.array(extractionResultIssue),
  quality: extractionResultQuality,
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
      costUsd: z.number().optional(),
    })
    .optional(),
  rawResponseId: z.string().optional(),
});

const genericExtractFormResult = z.object({
  form: z.string(),
  profile: z.string(),
  result: z.record(z.string(), z.json()),
  diagnostics: extractionDiagnostics,
});

const genericExtractFormSucceededJobResponse = jobBaseResponse.extend({
  type: z.literal("generic_extract_form"),
  status: z.literal("succeeded"),
  result: genericExtractFormResult,
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
  genericExtractFormSucceededJobResponse,
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
schemaRegistry.add(genericExtractFormResult, { id: "GenericExtractFormResult" });

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
