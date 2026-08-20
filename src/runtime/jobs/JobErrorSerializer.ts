import type { JobError } from "../../domain/entities/Job.js";
import type { JobFailureCode } from "../../domain/entities/JobFailureCode.js";
import { isJobFailureCode } from "../../domain/entities/JobFailureCode.js";
import type { JsonValue } from "../../domain/entities/generic/Json.js";

export function toJobError(error: unknown): JobError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: classifyJobFailure(error),
      name: error.name,
      stack: error.stack,
      cause: serializeErrorCause(error.cause),
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown job error",
    code: "job_failed",
  };
}

function serializeErrorCause(cause: unknown): JsonValue | undefined {
  if (cause === undefined) {
    return undefined;
  }

  if (cause instanceof Error) {
    return errorToJsonValue(cause);
  }

  if (
    cause === null ||
    typeof cause === "string" ||
    typeof cause === "number" ||
    typeof cause === "boolean"
  ) {
    return cause;
  }

  if (Array.isArray(cause)) {
    return cause.map((item) => serializeErrorCause(item) ?? null);
  }

  if (typeof cause === "object") {
    return Object.fromEntries(
      Object.entries(cause as Record<string, unknown>).map(([key, value]) => [
        key,
        serializeErrorCause(value) ?? null,
      ]),
    );
  }

  return "[unsupported cause]";
}

function errorToJsonValue(error: Error): JsonValue {
  const value: Record<string, JsonValue> = { message: error.message };
  const code = getErrorCode(error);
  if (typeof code === "string" && code.length > 0) value["code"] = code;
  if (error.name) value["name"] = error.name;
  if (error.stack) value["stack"] = error.stack;
  if (error.cause !== undefined) value["cause"] = serializeErrorCause(error.cause) ?? null;
  return value;
}

function classifyJobFailure(error: unknown): JobFailureCode {
  const code = getErrorCode(error);
  if (isJobFailureCode(code)) return code;
  const cause = error instanceof Error ? error.cause : undefined;
  return cause === undefined ? "job_failed" : classifyJobFailure(cause);
}

function getErrorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;
}
