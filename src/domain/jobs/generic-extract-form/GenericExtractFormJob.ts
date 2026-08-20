import type { Future } from "../../entities/generic/Future.js";
import type { JobDefinition } from "../JobDefinition.js";
import { extractFormJob } from "../extract-form/ExtractFormJob.js";
import type {
  GenericExtractFormResult,
  GenericExtractFormUseCase,
} from "../../usecases/GenericExtractFormUseCase.js";
import type { GenericExtractFormJobInput } from "./GenericExtractFormJob.schema.js";
import { genericExtractFormJobInputSchema } from "./GenericExtractFormJob.schema.js";

export type GenericExtractFormJobDependencies = Readonly<{
  genericExtractForm: Pick<GenericExtractFormUseCase, "execute">;
}>;

export type GenericExtractFormJobDefinition = JobDefinition<
  GenericExtractFormJobInput,
  GenericExtractFormResult,
  GenericExtractFormJobDependencies
>;

export const genericExtractFormJob = {
  type: "generic_extract_form",
  submissionMode: "route-only",
  inputSchema: genericExtractFormJobInputSchema,
  maxAttempts: 3,
  timeoutMs: 120_000,
  retryPolicy: extractFormJob.retryPolicy,
  toDebugInput(input: GenericExtractFormJobInput) {
    return {
      form: input.form,
      profile: input.profile,
      bundleId: input.document.bundleId,
      documentKind: input.document.kind,
      fileCount: input.document.files.length,
      promptLength: input.prompt.length,
      outputSchemaLength: JSON.stringify(input.outputSchema).length,
    };
  },
  toDebugResult(result: GenericExtractFormResult) {
    return {
      form: result.form,
      profile: result.profile,
      providerName: result.diagnostics.providerName,
      model: result.diagnostics.model,
      warningCount: result.diagnostics.warnings.length,
      resultFieldCount: Object.keys(result.result).length,
    };
  },
  execute(
    input: GenericExtractFormJobInput,
    dependencies: GenericExtractFormJobDependencies,
  ): Future<Error, GenericExtractFormResult> {
    return dependencies.genericExtractForm.execute(input);
  },
} as const satisfies GenericExtractFormJobDefinition;
