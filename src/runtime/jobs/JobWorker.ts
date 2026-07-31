import type { Logger } from "pino";

import type { ClaimedJob, Job } from "../../domain/entities/Job.js";
import { isNonRetryableJobError } from "../../domain/jobs/JobErrors.js";
import type { RegisteredJobExecutor } from "../../domain/jobs/RegisteredJobExecutor.js";
import type { ClaimNextJobUseCase } from "../../domain/usecases/jobs/ClaimNextJobUseCase.js";
import type { CompleteJobUseCase } from "../../domain/usecases/jobs/CompleteJobUseCase.js";
import type { RecordJobFailureUseCase } from "../../domain/usecases/jobs/RecordJobFailureUseCase.js";
import { toJobError } from "./JobErrorSerializer.js";
import { toError } from "../../utils/error-utils.js";

export type JobWorkerOptions = Readonly<{
  pollIntervalMs?: number;
  concurrency?: number;
  lockedBy: string;
  leaseTimeoutMs?: number;
}>;

export class JobWorker {
  private running = false;
  private stopping = false;
  private loopPromise: Promise<void> | undefined;
  private wakeResolver: (() => void) | undefined;
  private readonly activeTasks = new Set<Promise<void>>();
  private readonly pollIntervalMs: number;
  private readonly concurrency: number;
  private readonly leaseTimeoutMs: number;

  constructor(
    private readonly claimNextJob: ClaimNextJobUseCase,
    private readonly completeJob: CompleteJobUseCase,
    private readonly recordJobFailure: RecordJobFailureUseCase,
    private readonly jobExecutor: RegisteredJobExecutor,
    private readonly logger: Logger,
    options: JobWorkerOptions,
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.concurrency = options.concurrency ?? 1;
    this.leaseTimeoutMs = options.leaseTimeoutMs ?? 120_000;
    this.lockedBy = options.lockedBy;
  }

  private readonly lockedBy: string;

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopping = false;
    this.loopPromise = this.runLoop().catch((error: unknown) => {
      this.logger.error({ err: toError(error) }, "Job worker crashed");
    });
  }

  nudge(): void {
    this.resolveWake();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.running = false;
    this.resolveWake();

    await this.loopPromise;
    await Promise.allSettled([...this.activeTasks]);
    this.loopPromise = undefined;
  }

  private async runLoop(): Promise<void> {
    this.logger.info({ lockedBy: this.lockedBy }, "Job worker started");

    while (!this.stopping) {
      try {
        while (this.activeTasks.size < this.concurrency) {
          const now = new Date();
          const job = await this.claimNextJob
            .execute({
              lockedBy: this.lockedBy,
              now,
              staleRunningBefore: new Date(now.getTime() - this.leaseTimeoutMs),
            })
            .toPromise();

          if (!job) {
            break;
          }

          this.launchJob(job);
        }
      } catch (error) {
        this.logger.error({ err: toError(error) }, "Job claim failed");
      }

      if (this.activeTasks.size === 0) {
        await this.waitForWakeOrTimeout();
      } else {
        await this.waitForActiveTaskOrWake();
      }
    }

    this.logger.info({ lockedBy: this.lockedBy }, "Job worker stopped");
  }

  private launchJob(job: Job): void {
    const task = this.executeJob(job)
      .catch((error: unknown) => {
        this.logger.error({ err: toError(error), jobId: job.id }, "Job update failed");
      })
      .finally(() => {
        this.activeTasks.delete(task);
        this.resolveWake();
      });

    this.activeTasks.add(task);
  }

  private async executeJob(job: Job): Promise<void> {
    const claimedJob = requireClaimedLease(job);
    const startedAt = Date.now();

    this.logger.info(
      {
        jobId: claimedJob.id,
        jobType: claimedJob.type,
        attempt: claimedJob.attempts,
        maxAttempts: claimedJob.maxAttempts,
        ...this.jobExecutor.getDebugInput(claimedJob),
      },
      "Job execution started",
    );

    let execution: Awaited<ReturnType<RegisteredJobExecutor["execute"]>>;
    try {
      execution = await this.jobExecutor.execute({
        ...claimedJob,
      });
    } catch (error) {
      this.logger.warn(
        {
          err: toError(error),
          jobId: claimedJob.id,
          jobType: claimedJob.type,
          attempt: claimedJob.attempts,
          maxAttempts: claimedJob.maxAttempts,
          durationMs: Date.now() - startedAt,
          ...this.jobExecutor.getDebugInput(claimedJob),
        },
        "Job execution failed",
      );
      await this.recordJobFailure
        .execute({
          id: claimedJob.id,
          error: toJobError(error),
          now: new Date(),
          lockedBy: claimedJob.lockedBy,
          lockedAt: claimedJob.lockedAt,
          retryable: !isNonRetryableJobError(error),
        })
        .toPromise();
      return;
    }

    this.logger.info(
      {
        jobId: claimedJob.id,
        jobType: claimedJob.type,
        attempt: claimedJob.attempts,
        maxAttempts: claimedJob.maxAttempts,
        durationMs: Date.now() - startedAt,
        ...this.jobExecutor.getDebugInput(claimedJob),
        ...execution.debugResult,
      },
      "Job execution completed",
    );

    await this.completeJob
      .execute({
        id: claimedJob.id,
        result: execution.result,
        now: new Date(),
        lockedBy: claimedJob.lockedBy,
        lockedAt: claimedJob.lockedAt,
      })
      .toPromise();
  }

  private async waitForWakeOrTimeout(): Promise<void> {
    await Promise.race([this.waitForWake(), sleep(this.pollIntervalMs)]);
  }

  private async waitForActiveTaskOrWake(): Promise<void> {
    await Promise.race([this.waitForWake(), Promise.race([...this.activeTasks])]);
  }

  private waitForWake(): Promise<void> {
    return new Promise((resolve) => {
      this.wakeResolver = () => {
        this.wakeResolver = undefined;
        resolve();
      };
    });
  }

  private resolveWake(): void {
    this.wakeResolver?.();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requireClaimedLease(job: Job): ClaimedJob {
  if (!job.lockedAt || !job.lockedBy) {
    throw new Error(`Claimed job is missing lease data: ${job.id}`);
  }

  return {
    id: job.id,
    type: job.type,
    createdBy: job.createdBy,
    input: job.input,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    lockedAt: job.lockedAt,
    lockedBy: job.lockedBy,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
