import type { Future } from "../../entities/generic/Future.js";
import type { JobDefinition, RetryPolicy } from "../JobRegistry.js";
import type { ExtractFormJobInput } from "./ExtractFormJob.schema.js";
import { extractFormJobInputSchema } from "./ExtractFormJob.schema.js";
import type { ExtractFormUseCase, ExtractFormResult } from "../../usecases/ExtractFormUseCase.js";

export type ExtractFormJobDependencies = {
  readonly extractForm: ExtractFormUseCase;
};

export type ExtractFormJobDefinition = JobDefinition<
  ExtractFormJobInput,
  ExtractFormResult,
  ExtractFormJobDependencies
>;

const extractFormRetryPolicy: RetryPolicy = {
  type: "exponential",
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
};

export const extractFormJob = {
  type: "extract_form",
  inputSchema: extractFormJobInputSchema,
  maxAttempts: 3,
  timeoutMs: 60_000,
  retryPolicy: extractFormRetryPolicy,
  execute(
    input: ExtractFormJobInput,
    dependencies: ExtractFormJobDependencies,
  ): Future<Error, ExtractFormResult> {
    return dependencies.extractForm.execute(input);
  },
} as const satisfies ExtractFormJobDefinition;

export type ExtractFormJob = typeof extractFormJob;
