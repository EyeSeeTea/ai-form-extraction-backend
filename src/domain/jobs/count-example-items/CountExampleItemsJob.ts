import type { Future } from "../../entities/generic/Future.js";
import type { JobDefinition, RetryPolicy } from "../JobDefinition.js";
import type { CountExampleItemsJobInput } from "./CountExampleItemsJob.schema.js";
import { countExampleItemsJobInputSchema } from "./CountExampleItemsJob.schema.js";
import type {
  CountExampleItemsResult,
  CountExampleItemsUseCase,
} from "../../usecases/CountExampleItemsUseCase.js";

export type CountExampleItemsJobDependencies = {
  readonly countExampleItems: Pick<CountExampleItemsUseCase, "execute">;
};

export type CountExampleItemsJobDefinition = JobDefinition<
  CountExampleItemsJobInput,
  CountExampleItemsResult,
  CountExampleItemsJobDependencies
>;

const countExampleItemsRetryPolicy: RetryPolicy = {
  type: "exponential",
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
};

export const countExampleItemsJob = {
  type: "count_example_items",
  submissionMode: "json",
  inputSchema: countExampleItemsJobInputSchema,
  maxAttempts: 3,
  timeoutMs: 70_000,
  retryPolicy: countExampleItemsRetryPolicy,
  toDebugInput(input: CountExampleItemsJobInput) {
    return {
      sleepMs: input.sleepMs,
    };
  },
  toDebugResult(result: CountExampleItemsResult) {
    return {
      exampleItemCount: result.exampleItemCount,
    };
  },
  execute(
    input: CountExampleItemsJobInput,
    dependencies: CountExampleItemsJobDependencies,
  ): Future<Error, CountExampleItemsResult> {
    return dependencies.countExampleItems.execute(input);
  },
} as const satisfies CountExampleItemsJobDefinition;

export type CountExampleItemsJob = typeof countExampleItemsJob;
