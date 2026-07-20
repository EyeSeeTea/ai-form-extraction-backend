import type { Future } from "../entities/generic/Future.js";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";
import type { JobDefinition } from "./JobDefinition.js";
import {
  countExampleItemsJob,
  type CountExampleItemsJobDependencies,
} from "./count-example-items/CountExampleItemsJob.js";
import { extractFormJob, type ExtractFormJobDependencies } from "./extract-form/ExtractFormJob.js";
import {
  genericExtractFormJob,
  type GenericExtractFormJobDependencies,
} from "./generic-extract-form/GenericExtractFormJob.js";

export type RegisteredJobDependencies = CountExampleItemsJobDependencies &
  ExtractFormJobDependencies &
  GenericExtractFormJobDependencies;

export type RegisteredJobDefinition = Pick<
  JobDefinition,
  "type" | "submissionMode" | "inputSchema" | "maxAttempts" | "timeoutMs" | "retryPolicy"
>;

export type ExecutedRegisteredJob = Readonly<{
  result: JsonValue;
  debugResult: JsonObject;
}>;

export type RegisteredJob = Readonly<{
  definition: RegisteredJobDefinition;
  execute: (
    input: JsonValue,
    dependencies: RegisteredJobDependencies,
  ) => Future<Error, ExecutedRegisteredJob>;
  getDebugInput: (input: JsonValue) => JsonObject;
}>;

export type RegisteredJobLookup = (type: string) => RegisteredJob | undefined;

const registeredJobs = {
  [countExampleItemsJob.type]: createRegisteredJob(countExampleItemsJob, (dependencies) => ({
    countExampleItems: dependencies.countExampleItems,
  })),
  [extractFormJob.type]: createRegisteredJob(extractFormJob, (dependencies) => ({
    extractForm: dependencies.extractForm,
  })),
  [genericExtractFormJob.type]: createRegisteredJob(genericExtractFormJob, (dependencies) => ({
    genericExtractForm: dependencies.genericExtractForm,
  })),
} as const;

type JobType = keyof typeof registeredJobs;

export function getRegisteredJobs(): readonly RegisteredJob[] {
  return Object.values(registeredJobs);
}

export function getRegisteredJob(type: string): RegisteredJob | undefined {
  if (!isKnownJobType(type)) {
    return undefined;
  }

  return registeredJobs[type];
}

function isKnownJobType(type: string): type is JobType {
  return Object.hasOwn(registeredJobs, type);
}

function createRegisteredJob<Input extends JsonValue, Result extends JsonValue, Dependencies>(
  definition: JobDefinition<Input, Result, Dependencies>,
  bindDependencies: (dependencies: RegisteredJobDependencies) => Dependencies,
): RegisteredJob {
  return {
    definition,
    execute(input, dependencies) {
      return definition.execute(input as Input, bindDependencies(dependencies)).map((result) => ({
        result,
        debugResult: definition.toDebugResult(result),
      }));
    },
    getDebugInput(input) {
      const parsedInput = definition.inputSchema.safeParse(input);
      return parsedInput.success ? definition.toDebugInput(parsedInput.data) : {};
    },
  };
}
