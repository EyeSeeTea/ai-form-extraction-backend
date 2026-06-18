import { Future } from "../entities/generic/Future.js";
import type { JsonObject } from "../entities/Job.js";
import type { ExtractFormJobInput } from "../jobs/extract-form/ExtractFormJob.schema.js";

export type ExtractFormResult = JsonObject & {
  readonly formId: string;
  readonly sourceUrl: string;
  readonly placeholder: true;
};

export class ExtractFormUseCase {
  execute(input: ExtractFormJobInput): Future<Error, ExtractFormResult> {
    return Future.block<Error, ExtractFormResult>(async ($) => {
      await $(
        Future.sleep(10_000).mapError((error) =>
          error instanceof Error ? error : new Error(String(error)),
        ),
      );

      return {
        formId: input.formId,
        sourceUrl: input.sourceUrl,
        placeholder: true,
      };
    });
  }
}
