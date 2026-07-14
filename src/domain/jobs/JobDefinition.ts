import { z } from "zod";

import type { Future } from "../entities/generic/Future.js";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";

export type RetryPolicy = {
  readonly type: "exponential";
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
};

export type JobSubmissionMode = "json" | "multipart" | "route-only";

export type JobDefinition<
  Input extends JsonValue = JsonValue,
  Result extends JsonValue = JsonValue,
  Dependencies = unknown,
> = {
  readonly type: string;
  readonly submissionMode: JobSubmissionMode;
  readonly inputSchema: z.ZodType<Input>;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;
  readonly execute: (input: Input, dependencies: Dependencies) => Future<Error, Result>;
  readonly toDebugInput: (input: Input) => JsonObject;
  readonly toDebugResult: (result: Result) => JsonObject;
};
