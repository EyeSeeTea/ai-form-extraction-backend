import { z } from "zod";

import type { Future } from "../entities/generic/Future.js";
import type { JsonValue } from "../entities/Job.js";
import { extractFormJob } from "./extract-form/ExtractFormJob.js";

export type RetryPolicy = {
  readonly type: "exponential";
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
};

export type JobDefinition<
  Input extends JsonValue = JsonValue,
  Result extends JsonValue = JsonValue,
  Dependencies = unknown,
> = {
  readonly type: string;
  readonly inputSchema: z.ZodType<Input>;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;
  readonly execute: (input: Input, dependencies: Dependencies) => Future<Error, Result>;
};

export const jobRegistry = {
  [extractFormJob.type]: extractFormJob,
} as const;

export type JobRegistry = typeof jobRegistry;
export type JobType = keyof JobRegistry;
export type KnownJobDefinition = JobRegistry[JobType];

export function isKnownJobType(type: string): type is JobType {
  return type in jobRegistry;
}

export function getJobDefinition(type: string): KnownJobDefinition | undefined {
  if (!isKnownJobType(type)) {
    return undefined;
  }

  return jobRegistry[type];
}

export type JobInputByType<T extends JobType> = (typeof jobRegistry)[T] extends {
  inputSchema: z.ZodType<infer Input extends JsonValue>;
}
  ? Input
  : never;

export function parseJobInput<T extends JobType>(type: T, input: unknown): JobInputByType<T> {
  const definition = jobRegistry[type];
  return definition.inputSchema.parse(input) as unknown as JobInputByType<T>;
}
