import { z } from "zod";

import type { Future } from "../entities/generic/Future.js";
import type { JsonValue } from "../entities/Job.js";
import type { JobSubmissionMode } from "./JobDefinition.js";
import { countExampleItemsJob } from "./count-example-items/CountExampleItemsJob.js";
import { extractFormJob } from "./extract-form/ExtractFormJob.js";

// Register new job definitions here.
export const jobRegistry = {
  [countExampleItemsJob.type]: countExampleItemsJob,
  [extractFormJob.type]: extractFormJob,
} as const;

export type JobRegistry = typeof jobRegistry;
export type JobType = keyof JobRegistry;
export type KnownJobDefinition = JobRegistry[JobType];
export type JobInputOf<Definition extends KnownJobDefinition> = z.infer<Definition["inputSchema"]>;
export type JobResultOf<Definition extends KnownJobDefinition> =
  ReturnType<Definition["execute"]> extends Future<Error, infer Result> ? Result : never;
export type JobDependenciesOf<Definition extends KnownJobDefinition> = Parameters<
  Definition["execute"]
>[1];
export type ExecutedJobDefinition<Definition extends KnownJobDefinition = KnownJobDefinition> = {
  readonly result: JobResultOf<Definition>;
  readonly debugResult: Record<string, unknown>;
};

export function isKnownJobType(type: string): type is JobType {
  return type in jobRegistry;
}

export function getJobDefinition(type: string): KnownJobDefinition | undefined {
  if (!isKnownJobType(type)) {
    return undefined;
  }

  return jobRegistry[type];
}

export function getJobDefinitionsBySubmissionMode(
  submissionMode: JobSubmissionMode,
): KnownJobDefinition[] {
  return Object.values(jobRegistry).filter(
    (definition) => definition.submissionMode === submissionMode,
  );
}

export type JobInputByType<T extends JobType> = JobInputOf<(typeof jobRegistry)[T]>;

export function parseJobInput<T extends JobType>(type: T, input: unknown): JobInputByType<T> {
  return parseDefinitionInput(jobRegistry[type], input);
}

export function getJobDebugInput(type: string, input: unknown): Record<string, unknown> {
  const definition = getJobDefinition(type);
  if (!definition) {
    return {};
  }

  const parsedInput = definition.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    return {};
  }

  return callDebugInput(
    definition.toDebugInput as (input: typeof parsedInput.data) => Record<string, unknown>,
    parsedInput.data,
  );
}

export function executeJobDefinition<Definition extends KnownJobDefinition>(
  definition: Definition,
  input: unknown,
  dependencies: JobDependenciesOf<Definition>,
): Future<Error, ExecutedJobDefinition<Definition>> {
  const parsedInput = parseDefinitionInput(definition, input);
  return executeParsedJobDefinition(definition, parsedInput, dependencies).map((result) =>
    toExecutedJobDefinition(definition, result as JobResultOf<Definition>),
  );
}

function parseDefinitionInput<Definition extends KnownJobDefinition>(
  definition: Definition,
  input: unknown,
): JobInputOf<Definition> {
  return definition.inputSchema.parse(input) as JobInputOf<Definition>;
}

export function getDefinitionDebugResult<Definition extends KnownJobDefinition>(
  definition: Definition,
  result: JobResultOf<Definition>,
): Record<string, unknown> {
  return (definition.toDebugResult as (result: JobResultOf<Definition>) => Record<string, unknown>)(
    result,
  );
}

function executeParsedJobDefinition<Definition extends KnownJobDefinition>(
  definition: Definition,
  input: JobInputOf<Definition>,
  dependencies: JobDependenciesOf<Definition>,
): ReturnType<Definition["execute"]> {
  return (
    definition.execute as (
      input: JobInputOf<Definition>,
      dependencies: JobDependenciesOf<Definition>,
    ) => ReturnType<Definition["execute"]>
  )(input, dependencies);
}

function toExecutedJobDefinition<Definition extends KnownJobDefinition>(
  definition: Definition,
  result: JobResultOf<Definition>,
): ExecutedJobDefinition<Definition> {
  return {
    result,
    debugResult: getDefinitionDebugResult(definition, result),
  };
}

function callDebugInput<Input extends JsonValue>(
  toDebugInput: (input: Input) => Record<string, unknown>,
  input: Input,
): Record<string, unknown> {
  return toDebugInput(input);
}
