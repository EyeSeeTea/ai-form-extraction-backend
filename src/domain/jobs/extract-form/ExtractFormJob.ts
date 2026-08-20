import type { Future } from "../../entities/generic/Future.js";
import type { JobDefinition, RetryPolicy } from "../JobDefinition.js";
import type { ExtractFormJobInput } from "./ExtractFormJob.schema.js";
import { extractFormJobInputSchema } from "./ExtractFormJob.schema.js";
import type { ExtractFormUseCase, ExtractFormResult } from "../../usecases/ExtractFormUseCase.js";

export type ExtractFormJobDependencies = Readonly<{
  extractForm: Pick<ExtractFormUseCase, "execute">;
}>;

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
  submissionMode: "multipart",
  inputSchema: extractFormJobInputSchema,
  maxAttempts: 3,
  timeoutMs: 60_000,
  retryPolicy: extractFormRetryPolicy,
  toDebugInput(input: ExtractFormJobInput) {
    return {
      formType: input.formType,
      bundleId: input.document.bundleId,
      documentKind: input.document.kind,
      fileCount: input.document.files.length,
    };
  },
  toDebugResult(result: ExtractFormResult) {
    return {
      formType: result.formType,
      providerName: result.diagnostics.providerName,
      model: result.diagnostics.model,
      warningCount: result.diagnostics.warnings.length,
      resultFieldCount: Object.keys(result.result).length,
    };
  },
  execute(
    input: ExtractFormJobInput,
    dependencies: ExtractFormJobDependencies,
  ): Future<Error, ExtractFormResult> {
    return dependencies.extractForm.execute(input);
  },
} as const satisfies ExtractFormJobDefinition;

export type ExtractFormJob = typeof extractFormJob;
