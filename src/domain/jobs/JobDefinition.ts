import { z } from "zod";

import type { Future } from "../entities/generic/Future.js";
import type { JsonObject, JsonValue } from "../entities/generic/Json.js";

export type RetryPolicy = Readonly<{
  type: "exponential";
  initialDelayMs: number;
  maxDelayMs: number;
}>;

export type JobSubmissionMode = "json" | "multipart" | "route-only";

export type JobDefinition<
  Input extends JsonValue = JsonValue,
  Result extends JsonValue = JsonValue,
  Dependencies = unknown,
> = Readonly<{
  type: string;
  submissionMode: JobSubmissionMode;
  inputSchema: z.ZodType<Input>;
  maxAttempts: number;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  execute: (input: Input, dependencies: Dependencies) => Future<Error, Result>;
  toDebugInput: (input: Input) => JsonObject;
  toDebugResult: (result: Result) => JsonObject;
}>;
