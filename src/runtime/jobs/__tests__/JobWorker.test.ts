import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";

import type { Job } from "../../../domain/entities/Job.js";
import { Future } from "../../../domain/entities/generic/Future.js";
import { jobRegistry } from "../../../domain/jobs/JobRegistry.js";
import { ExtractFormUseCase } from "../../../domain/usecases/ExtractFormUseCase.js";
import { ClaimNextJobUseCase } from "../../../domain/usecases/jobs/ClaimNextJobUseCase.js";
import { CompleteJobUseCase } from "../../../domain/usecases/jobs/CompleteJobUseCase.js";
import {
  createJobRepositoryForJob,
  now,
} from "../../../domain/usecases/jobs/__tests__/JobTestSupport.js";
import { RecordJobFailureUseCase } from "../../../domain/usecases/jobs/RecordJobFailureUseCase.js";
import { JobExecutor } from "../JobExecutor.js";
import { JobWorker } from "../JobWorker.js";
const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

describe("JobWorker", () => {
  it("claims and completes a job", async () => {
    const job: Job = {
      id: "job-1",
      type: "extract_form",
      status: "running",
      input: { formId: "form-1", sourceUrl: "https://example.org/forms/1" },
      attempts: 1,
      maxAttempts: 3,
      availableAt: now,
      lockedAt: now,
      lockedBy: "worker-1",
      createdAt: now,
      updatedAt: now,
    };

    const repository = createJobRepositoryForJob(job, {
      claimNext: vi
        .fn()
        .mockReturnValueOnce(Future.success<Error, Job | undefined>(job))
        .mockReturnValue(Future.success<Error, Job | undefined>(undefined)),
      complete: vi.fn(() => Future.success<Error, Job | undefined>(job)),
      recordFailure: vi.fn(() => Future.success<Error, Job | undefined>(job)),
    });
    const claimNextSpy = vi.spyOn(repository, "claimNext");
    const completeSpy = vi.spyOn(repository, "complete");
    const recordFailureSpy = vi.spyOn(repository, "recordFailure");

    const claimNext = new ClaimNextJobUseCase(repository);
    const completeJob = new CompleteJobUseCase(repository);
    const recordJobFailure = new RecordJobFailureUseCase(repository);
    const extractForm = new ExtractFormUseCase();
    vi.spyOn(extractForm, "execute").mockReturnValue(
      Future.success<
        Error,
        { readonly formId: string; readonly sourceUrl: string; readonly placeholder: true }
      >({
        formId: "form-1",
        sourceUrl: "https://example.org/forms/1",
        placeholder: true,
      }),
    );
    const jobExecutor = new JobExecutor(jobRegistry, {
      extractForm,
    });

    const worker = new JobWorker(claimNext, completeJob, recordJobFailure, jobExecutor, logger, {
      lockedBy: "worker-1",
      pollIntervalMs: 10,
      concurrency: 1,
      leaseTimeoutMs: 1_000,
    });

    worker.start();
    await waitFor(() => {
      expect(claimNextSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalledTimes(1);
    });
    await worker.stop();

    const completeInput = completeSpy.mock.calls[0]?.[0] as
      | {
          readonly id: string;
          readonly result: {
            readonly formId: string;
            readonly sourceUrl: string;
            readonly placeholder: true;
          };
          readonly now: Date;
          readonly lockedBy: string;
          readonly lockedAt: Date;
        }
      | undefined;

    expect(completeInput).toMatchObject({
      id: job.id,
      result: { formId: "form-1", sourceUrl: "https://example.org/forms/1", placeholder: true },
      lockedBy: "worker-1",
      lockedAt: now,
    });
    expect(completeInput?.now).toBeInstanceOf(Date);
    expect(recordFailureSpy).not.toHaveBeenCalled();
  });

  it("records failures", async () => {
    const job: Job = {
      id: "job-2",
      type: "extract_form",
      status: "running",
      input: { formId: "form-2", sourceUrl: "https://example.org/forms/2" },
      attempts: 1,
      maxAttempts: 3,
      availableAt: now,
      lockedAt: now,
      lockedBy: "worker-1",
      createdAt: now,
      updatedAt: now,
    };

    const repository = createJobRepositoryForJob(job, {
      claimNext: vi
        .fn()
        .mockReturnValueOnce(Future.success<Error, Job | undefined>(job))
        .mockReturnValue(Future.success<Error, Job | undefined>(undefined)),
      recordFailure: vi.fn(() => Future.success<Error, Job | undefined>(job)),
      complete: vi.fn(() => Future.success<Error, Job | undefined>(job)),
    });
    const claimNextSpy = vi.spyOn(repository, "claimNext");
    const recordFailureSpy = vi.spyOn(repository, "recordFailure");
    const completeSpy = vi.spyOn(repository, "complete");

    const claimNext = new ClaimNextJobUseCase(repository);
    const completeJob = new CompleteJobUseCase(repository);
    const recordJobFailure = new RecordJobFailureUseCase(repository);
    const extractForm = new ExtractFormUseCase();
    vi.spyOn(extractForm, "execute").mockReturnValue(Future.error(new Error("boom")));
    const jobExecutor = new JobExecutor(jobRegistry, {
      extractForm,
    });

    const worker = new JobWorker(claimNext, completeJob, recordJobFailure, jobExecutor, logger, {
      lockedBy: "worker-1",
      pollIntervalMs: 10,
      concurrency: 1,
      leaseTimeoutMs: 1_000,
    });

    worker.start();
    await waitFor(() => {
      expect(claimNextSpy).toHaveBeenCalled();
      expect(recordFailureSpy).toHaveBeenCalledTimes(1);
    });
    await worker.stop();

    expect(completeSpy).not.toHaveBeenCalled();
    const recordFailureInput = recordFailureSpy.mock.calls[0]?.[0] as
      | {
          readonly id: string;
          readonly error: { readonly message: string };
          readonly now: Date;
          readonly lockedBy: string;
          readonly lockedAt: Date;
        }
      | undefined;

    expect(recordFailureInput).toMatchObject({
      id: job.id,
      lockedBy: "worker-1",
      lockedAt: now,
    });
    expect(recordFailureInput?.error.message).toBe("boom");
    expect(recordFailureInput?.now).toBeInstanceOf(Date);
  });

  it("keeps polling when updating job state fails", async () => {
    const job: Job = {
      id: "job-3",
      type: "extract_form",
      status: "running",
      input: { formId: "form-3", sourceUrl: "https://example.org/forms/3" },
      attempts: 1,
      maxAttempts: 3,
      availableAt: now,
      lockedAt: now,
      lockedBy: "worker-1",
      createdAt: now,
      updatedAt: now,
    };

    const repository = createJobRepositoryForJob(job, {
      claimNext: vi
        .fn()
        .mockReturnValueOnce(Future.success<Error, Job | undefined>(job))
        .mockReturnValue(Future.success<Error, Job | undefined>(undefined)),
      complete: vi.fn(() => Future.error<Error, Job | undefined>(new Error("complete failed"))),
      recordFailure: vi.fn(() => Future.error<Error, Job | undefined>(new Error("record failed"))),
    });
    const claimNextSpy = vi.spyOn(repository, "claimNext");
    const recordFailureSpy = vi.spyOn(repository, "recordFailure");
    const errorSpy = vi.spyOn(logger, "error");

    const claimNext = new ClaimNextJobUseCase(repository);
    const completeJob = new CompleteJobUseCase(repository);
    const recordJobFailure = new RecordJobFailureUseCase(repository);
    const extractForm = new ExtractFormUseCase();
    vi.spyOn(extractForm, "execute").mockReturnValue(
      Future.success<
        Error,
        { readonly formId: string; readonly sourceUrl: string; readonly placeholder: true }
      >({
        formId: "form-3",
        sourceUrl: "https://example.org/forms/3",
        placeholder: true,
      }),
    );
    const jobExecutor = new JobExecutor(jobRegistry, {
      extractForm,
    });

    const worker = new JobWorker(claimNext, completeJob, recordJobFailure, jobExecutor, logger, {
      lockedBy: "worker-1",
      pollIntervalMs: 10,
      concurrency: 1,
      leaseTimeoutMs: 1_000,
    });

    worker.start();
    await waitFor(() => {
      expect(claimNextSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    await worker.stop();

    const updateFailureCall = errorSpy.mock.calls.find(
      ([, message]) => message === "Job update failed",
    );
    expect(updateFailureCall).toBeDefined();

    const updateFailureInput = updateFailureCall?.[0] as
      | {
          readonly err?: Error;
          readonly jobId?: string;
        }
      | undefined;

    expect(updateFailureInput?.jobId).toBe(job.id);
    expect(updateFailureInput?.err).toBeInstanceOf(Error);
    expect(recordFailureSpy).not.toHaveBeenCalled();
  });
});

async function waitFor(assertion: () => void, timeoutMs = 1_000): Promise<void> {
  const start = Date.now();

  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start >= timeoutMs) {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    }
  }
}
