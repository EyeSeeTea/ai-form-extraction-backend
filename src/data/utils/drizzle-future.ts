import { DrizzleError, DrizzleQueryError } from "drizzle-orm";

import { Future } from "../../domain/entities/generic/Future.js";

export type DbErrorKind = "drizzle-query" | "drizzle" | "sqlite" | "unknown";

export type DbErrorOptions = {
  kind: DbErrorKind;
  operation: string;
  message: string;
  cause: unknown;
  code?: string;
  query?: string;
  params?: readonly unknown[];
};

export class DbError extends Error {
  readonly kind: DbErrorKind;
  readonly operation: string;
  readonly code: string | undefined;
  readonly query: string | undefined;
  readonly params: readonly unknown[] | undefined;
  readonly causeName: string | undefined;

  constructor(options: DbErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "DbError";
    this.kind = options.kind;
    this.operation = options.operation;
    this.code = options.code;
    this.query = options.query;
    this.params = options.params;
    this.causeName = options.cause instanceof Error ? options.cause.name : undefined;
  }
}

function isSqliteError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    error.name === "SqliteError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

export function toDbError(error: unknown, operation: string): DbError {
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause ?? error;
    const details: DbErrorOptions = {
      kind: isSqliteError(cause) ? "sqlite" : "drizzle-query",
      operation,
      message: error.message,
      cause,
    };

    if (isSqliteError(cause)) {
      details.code = cause.code;
    }

    details.query = error.query;
    details.params = error.params;

    return new DbError(details);
  }

  if (error instanceof DrizzleError) {
    return new DbError({
      kind: "drizzle",
      operation,
      message: error.message,
      cause: error,
    });
  }

  if (isSqliteError(error)) {
    const details: DbErrorOptions = {
      kind: "sqlite",
      operation,
      message: error.message,
      cause: error,
    };

    details.code = error.code;
    return new DbError(details);
  }

  if (error instanceof Error) {
    return new DbError({
      kind: "unknown",
      operation,
      message: error.message,
      cause: error,
    });
  }

  return new DbError({
    kind: "unknown",
    operation,
    message: "Unknown database error",
    cause: error,
  });
}

export function fromQuery<T>(operation: string, query: () => Promise<T>): Future<DbError, T> {
  return Future.block<DbError, T>(async ($) => {
    return await $(Future.fromPromise(query, (error) => toDbError(error, operation)));
  });
}
