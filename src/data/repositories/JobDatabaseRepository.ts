import { and, eq, sql } from "drizzle-orm";

import type { Job, JobError } from "../../domain/entities/Job.js";
import { Future } from "../../domain/entities/generic/Future.js";
import type {
  ClaimNextJobInput,
  CompleteJobInput,
  CreateJobInput,
  JobRepository,
  RecordJobFailureInput,
} from "../../domain/repositories/JobRepository.js";
import type { JsonValue } from "../../domain/entities/generic/Json.js";
import type { Maybe } from "../../utils/ts-utils.js";
import type { Database } from "../database/Database.js";
import { jobs } from "../database/schema/Schema.js";
import type { IdGenerator } from "../utils/IdGenerator.js";
import { fromQuery } from "../utils/drizzle-future.js";

type JobRow = {
  readonly id: string;
  readonly type: string;
  readonly createdBy: string | null;
  readonly status: string;
  readonly inputJson: string;
  readonly resultJson: string | null;
  readonly errorJson: string | null;
  readonly lastErrorJson: string | null;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: Date | number;
  readonly lockedAt: Date | number | null;
  readonly lockedBy: string | null;
  readonly createdAt: Date | number;
  readonly updatedAt: Date | number;
};

export class JobDatabaseRepository implements JobRepository {
  constructor(
    private readonly db: Database,
    private readonly idGenerator: IdGenerator,
  ) {}

  private findById(id: string): Future<Error, Maybe<Job>> {
    return fromQuery(`find job ${id}`, () =>
      this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1),
    ).map((rows) => mapMaybeJobRow(rows[0]));
  }

  create(input: CreateJobInput): Future<Error, Job> {
    const id = this.idGenerator.generate();

    return fromQuery(`create job ${id}`, () =>
      this.db.insert(jobs).values({
        id,
        type: input.type,
        createdBy: input.createdBy,
        status: "queued",
        inputJson: JSON.stringify(input.input),
        resultJson: null,
        errorJson: null,
        lastErrorJson: null,
        attempts: 0,
        maxAttempts: input.maxAttempts,
        availableAt: input.availableAt,
        lockedAt: null,
        lockedBy: null,
      }),
    ).flatMap(() =>
      this.findById(id).map((job) => {
        if (!job) {
          throw new Error("Failed to insert job");
        }

        return job;
      }),
    );
  }

  getById(id: string): Future<Error, Maybe<Job>> {
    return this.findById(id);
  }

  claimNext(input: ClaimNextJobInput): Future<Error, Maybe<Job>> {
    return fromQuery("claim next job", () =>
      Promise.resolve<JobRow | undefined>(
        (() => {
          for (;;) {
            const row = this.db.get<JobRow | undefined>(sql`
          UPDATE jobs
          SET
            status = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN 'failed'
              ELSE 'running'
            END,
            input_json = input_json,
            result_json = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN null
              ELSE result_json
            END,
            error_json = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN ${JSON.stringify({
                  message: "Job exhausted retry attempts before lease recovery",
                  code: "job_lease_expired",
                  name: "JobLeaseExpiredError",
                })}
              ELSE error_json
            END,
            last_error_json = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN ${JSON.stringify({
                  message: "Job exhausted retry attempts before lease recovery",
                  code: "job_lease_expired",
                  name: "JobLeaseExpiredError",
                })}
              ELSE last_error_json
            END,
            attempts = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN attempts
              ELSE attempts + 1
            END,
            available_at = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN ${input.now.getTime()}
              ELSE available_at
            END,
            locked_at = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN null
              ELSE ${input.now.getTime()}
            END,
            locked_by = CASE
              WHEN status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
                AND attempts >= max_attempts
                THEN null
              ELSE ${input.lockedBy}
            END,
            updated_at = ${input.now.getTime()}
          WHERE id = (
            SELECT id
            FROM jobs
            WHERE
              (
                status = 'queued'
                AND available_at <= ${input.now.getTime()}
              )
              OR (
                status = 'running'
                AND locked_at <= ${input.staleRunningBefore.getTime()}
              )
            ORDER BY available_at ASC, created_at ASC
            LIMIT 1
          )
          RETURNING
            id,
            type,
            created_by AS createdBy,
            status,
            input_json AS inputJson,
            result_json AS resultJson,
            error_json AS errorJson,
            last_error_json AS lastErrorJson,
            attempts,
            max_attempts AS maxAttempts,
            available_at AS availableAt,
            locked_at AS lockedAt,
            locked_by AS lockedBy,
            created_at AS createdAt,
            updated_at AS updatedAt
        `);

            if (!row) {
              return undefined;
            }

            if (row.status === "failed") {
              continue;
            }

            return row;
          }
        })(),
      ),
    ).map((row) => mapMaybeJobRow(row));
  }

  complete(input: CompleteJobInput): Future<Error, Maybe<Job>> {
    return fromQuery(`complete job ${input.id}`, () =>
      this.db
        .update(jobs)
        .set({
          status: "succeeded",
          resultJson: JSON.stringify(input.result),
          errorJson: null,
          lockedAt: null,
          lockedBy: null,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(jobs.id, input.id),
            eq(jobs.status, "running"),
            eq(jobs.lockedBy, input.lockedBy),
            eq(jobs.lockedAt, input.lockedAt),
          ),
        )
        .returning(),
    ).map((rows) => {
      const row = rows[0];
      if (row === undefined) {
        return undefined;
      }

      return mapJobRow(row);
    });
  }

  recordFailure(input: RecordJobFailureInput): Future<Error, Maybe<Job>> {
    return fromQuery(`record job failure ${input.id}`, () =>
      this.db
        .update(jobs)
        .set({
          status: input.nextAvailableAt ? "queued" : "failed",
          availableAt: input.nextAvailableAt ?? input.now,
          resultJson: null,
          errorJson: input.nextAvailableAt ? null : JSON.stringify(input.error),
          lastErrorJson: JSON.stringify(input.error),
          lockedAt: null,
          lockedBy: null,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(jobs.id, input.id),
            eq(jobs.status, "running"),
            eq(jobs.lockedBy, input.lockedBy),
            eq(jobs.lockedAt, input.lockedAt),
          ),
        )
        .returning(),
    ).map((rows) => {
      const row = rows[0];
      if (row === undefined) {
        return undefined;
      }

      return mapJobRow(row);
    });
  }
}

function mapJobRow(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    createdBy: row.createdBy,
    status: row.status as Job["status"],
    input: parseJsonValue(row.inputJson),
    result: parseNullableJsonValue(row.resultJson),
    error: parseNullableJsonError(row.errorJson),
    lastError: parseNullableJsonError(row.lastErrorJson),
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    availableAt: toDate(row.availableAt),
    lockedAt: parseNullableDate(row.lockedAt),
    lockedBy: row.lockedBy ?? undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function mapMaybeJobRow(row: JobRow | undefined): Maybe<Job> {
  if (row === undefined) {
    return undefined;
  }

  return mapJobRow(row);
}

function parseJsonValue(value: string): JsonValue {
  return JSON.parse(value) as JsonValue;
}

function parseNullableJsonValue(value: string | null): JsonValue | undefined {
  if (value === null) {
    return undefined;
  }

  return parseJsonValue(value);
}

function parseNullableJsonError(value: string | null): JobError | undefined {
  if (value === null) {
    return undefined;
  }

  const error = JSON.parse(value) as Partial<JobError>;

  return {
    message: typeof error.message === "string" ? error.message : "Job failed",
    code: error.code ?? "job_failed",
    name: error.name,
    stack: error.stack,
    cause: error.cause,
  };
}

function parseNullableDate(value: Date | number | null): Date | undefined {
  if (value === null) {
    return undefined;
  }

  return toDate(value);
}

function toDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value);
}
