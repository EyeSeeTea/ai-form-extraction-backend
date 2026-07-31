import type { Logger } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExtractionProfileStaticRepository } from "../../../data/repositories/ExtractionProfileStaticRepository.js";
import type { Job } from "../../../domain/entities/Job.js";
import { Future } from "../../../domain/entities/generic/Future.js";
import { DefaultGenericExtractionProfileFactory } from "../../../domain/extraction/GenericExtractionProfileFactory.js";
import { DefaultManagedExtractionProfileResolver } from "../../../domain/extraction/ManagedExtractionProfileResolver.js";
import { getRegisteredJob } from "../../../domain/jobs/RegisteredJobRegistry.js";
import { RegisteredJobExecutor } from "../../../domain/jobs/RegisteredJobExecutor.js";
import type { UploadedDocumentInput } from "../../../domain/uploads/UploadedDocument.js";
import { CountExampleItemsUseCase } from "../../../domain/usecases/CountExampleItemsUseCase.js";
import { ExtractFormUseCase } from "../../../domain/usecases/ExtractFormUseCase.js";
import { GenericExtractFormUseCase } from "../../../domain/usecases/GenericExtractFormUseCase.js";
import type { FormExtractionServiceFactory } from "../../../domain/services/FormExtractionServiceFactory.js";
import type { FormExtractionService } from "../../../domain/services/FormExtractionService.js";
import type { FormExtractionServiceOutput } from "../../../domain/services/FormExtractionService.js";
import { ClaimNextJobUseCase } from "../../../domain/usecases/jobs/ClaimNextJobUseCase.js";
import { CompleteJobUseCase } from "../../../domain/usecases/jobs/CompleteJobUseCase.js";
import {
  createJobRepositoryForJob,
  now,
} from "../../../domain/usecases/jobs/__tests__/JobTestSupport.js";
import { RecordJobFailureUseCase } from "../../../domain/usecases/jobs/RecordJobFailureUseCase.js";
import { JobWorker } from "../JobWorker.js";
import { createExampleItemMockRepository } from "../../../../test/mocks/ExampleItemMockRepository.js";
import {
  createDocumentPreparationResult,
  createEndOfSeasonExtractedFields,
  createExtractFormServiceOutput,
} from "../../../../test/fixtures/ExtractFormFixture.js";
import { NonRetryableJobError } from "../../../domain/jobs/JobErrors.js";
import { createPdfDocumentContainsNoPagesError } from "../../../domain/services/DocumentPreparationErrors.js";
const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

describe("JobWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims and completes a count example items job", async () => {
    const job: Job = {
      id: "job-count-1",
      type: "count_example_items",
      createdBy: null,
      status: "running",
      input: {
        sleepMs: 0,
      },
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
    const countExampleItems = new CountExampleItemsUseCase(
      createExampleItemMockRepository([
        { id: "1", name: "First", createdAt: now },
        { id: "2", name: "Second", createdAt: now },
      ]),
    );
    const extractFormService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput(),
        ),
      ),
    };
    const extractForm = createExtractFormUseCase(extractFormService);
    const jobExecutor = new RegisteredJobExecutor(getRegisteredJob, {
      countExampleItems,
      extractForm,
      genericExtractForm: createGenericExtractFormUseCase(extractFormService),
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

    expect(completeSpy.mock.calls[0]?.[0]).toMatchObject({
      id: job.id,
      result: {
        exampleItemCount: 2,
      },
      lockedBy: "worker-1",
      lockedAt: now,
    });
    expect(recordFailureSpy).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        jobType: "count_example_items",
        sleepMs: 0,
      }),
      "Job execution started",
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.id,
        jobType: "count_example_items",
        sleepMs: 0,
        exampleItemCount: 2,
      }),
      "Job execution completed",
    );
  });

  it("claims and completes a job", async () => {
    const job: Job = {
      id: "job-1",
      type: "extract_form",
      createdBy: null,
      status: "running",
      input: {
        formType: "end-of-season",
        document: {
          bundleId: "bundle-1",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-1",
              storageKey: "bundle-1/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
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
    const extractFormService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput(),
        ),
      ),
    };
    const extractForm = createExtractFormUseCase(extractFormService);
    const jobExecutor = new RegisteredJobExecutor(getRegisteredJob, {
      countExampleItems: new CountExampleItemsUseCase(createExampleItemMockRepository()),
      extractForm,
      genericExtractForm: createGenericExtractFormUseCase(extractFormService),
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
      | Readonly<{
          id: string;
          result: Readonly<{
            formType: string;
            result: Record<string, unknown>;
            diagnostics: Record<string, unknown>;
          }>;
          now: Date;
          lockedBy: string;
          lockedAt: Date;
        }>
      | undefined;

    expect(completeInput).toMatchObject({
      id: job.id,
      result: {
        formType: "end-of-season",
        result: createEndOfSeasonExtractedFields(),
        diagnostics: {
          providerName: "stub",
          model: "stub-model",
          warnings: [],
        },
      },
      lockedBy: "worker-1",
      lockedAt: now,
    });
    expect(completeInput?.result).not.toHaveProperty("trackerPayload");
    expect(completeInput?.now).toBeInstanceOf(Date);
    expect(recordFailureSpy).not.toHaveBeenCalled();
  });

  it("reschedules retryable failures", async () => {
    const job: Job = {
      id: "job-2",
      type: "extract_form",
      createdBy: null,
      status: "running",
      input: {
        formType: "end-of-season",
        document: {
          bundleId: "bundle-2",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-2",
              storageKey: "bundle-2/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
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
    const extractFormService: FormExtractionService = {
      extract: vi.fn(() => Future.error<Error, FormExtractionServiceOutput>(new Error("boom"))),
    };
    const extractForm = createExtractFormUseCase(extractFormService);
    const jobExecutor = new RegisteredJobExecutor(getRegisteredJob, {
      countExampleItems: new CountExampleItemsUseCase(createExampleItemMockRepository()),
      extractForm,
      genericExtractForm: createGenericExtractFormUseCase(extractFormService),
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
      | Readonly<{
          id: string;
          error: Readonly<{
            message: string;
            name?: string;
            stack?: string;
          }>;
          now: Date;
          lockedBy: string;
          lockedAt: Date;
          nextAvailableAt?: Date;
        }>
      | undefined;

    expect(recordFailureInput).toMatchObject({
      id: job.id,
      lockedBy: "worker-1",
      lockedAt: now,
    });
    expect(recordFailureInput?.error.message).toBe("boom");
    expect(recordFailureInput?.error.name).toBe("Error");
    expect(recordFailureInput?.error.stack).toBeDefined();
    expect(recordFailureInput?.now).toBeInstanceOf(Date);
    expect(recordFailureInput?.nextAvailableAt).toBeInstanceOf(Date);
  });

  it("does not reschedule non-retryable failures", async () => {
    const job: Job = {
      id: "job-4",
      type: "extract_form",
      createdBy: null,
      status: "running",
      input: {
        formType: "end-of-season",
        document: {
          bundleId: "bundle-4",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-4",
              storageKey: "bundle-4/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
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
    });
    const claimNextSpy = vi.spyOn(repository, "claimNext");

    const claimNext = new ClaimNextJobUseCase(repository);
    const completeJob = new CompleteJobUseCase(repository);
    const recordJobFailureExecute = vi.fn(
      (
        input: Readonly<{
          id: string;
          error: Readonly<{
            message: string;
            name?: string;
            stack?: string;
          }>;
          now: Date;
          lockedBy: string;
          lockedAt: Date;
          retryable?: boolean;
        }>,
      ) => {
        void input;
        return Future.success<Error, Job | undefined>(job);
      },
    );
    const recordJobFailure = {
      execute: recordJobFailureExecute,
    } as unknown as RecordJobFailureUseCase;
    const jobExecutor = new RegisteredJobExecutor(getRegisteredJob, {
      countExampleItems: new CountExampleItemsUseCase(createExampleItemMockRepository()),
      extractForm: createExtractFormUseCase({
        extract: vi.fn(() =>
          Future.error<Error, FormExtractionServiceOutput>(
            new NonRetryableJobError("invalid model output"),
          ),
        ),
      }),
      genericExtractForm: createGenericExtractFormUseCase({
        extract: vi.fn(() =>
          Future.error<Error, FormExtractionServiceOutput>(
            new NonRetryableJobError("invalid model output"),
          ),
        ),
      }),
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
      expect(recordJobFailureExecute).toHaveBeenCalledTimes(1);
    });
    await worker.stop();

    const recordFailureInput = recordJobFailureExecute.mock.calls[0]?.[0] as
      | Readonly<{
          retryable?: boolean;
          error: Readonly<{
            message: string;
            name?: string;
            stack?: string;
          }>;
        }>
      | undefined;

    expect(recordFailureInput?.retryable).toBe(false);
    expect(recordFailureInput?.error).toMatchObject({
      message: "invalid model output",
      name: "NonRetryableJobError",
    });
  });

  it("does not reschedule PDF preparation failures with no usable pages", async () => {
    const job: Job = {
      id: "job-4b",
      type: "extract_form",
      createdBy: null,
      status: "running",
      input: {
        formType: "end-of-season",
        document: {
          bundleId: "bundle-4b",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-4b",
              storageKey: "bundle-4b/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
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

    const claimNext = new ClaimNextJobUseCase(repository);
    const completeJob = new CompleteJobUseCase(repository);
    const recordJobFailure = new RecordJobFailureUseCase(repository);
    const documentPreparationService = {
      prepare: vi.fn(() =>
        Future.error<Error, ReturnType<typeof createDocumentPreparationResult>>(
          createPdfDocumentContainsNoPagesError(),
        ),
      ),
    };
    const extractionService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.error<Error, FormExtractionServiceOutput>(new Error("extract should not be called")),
      ),
    };
    const formExtractionServiceFactory: FormExtractionServiceFactory = {
      create: () => extractionService,
    };
    const extractForm = new ExtractFormUseCase(
      documentPreparationService,
      formExtractionServiceFactory,
      createProfileResolver(),
      logger,
    );
    const jobExecutor = new RegisteredJobExecutor(getRegisteredJob, {
      countExampleItems: new CountExampleItemsUseCase(createExampleItemMockRepository()),
      extractForm,
      genericExtractForm: createGenericExtractFormUseCase(extractionService),
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

    const recordFailureInput = recordFailureSpy.mock.calls[0]?.[0] as
      | Readonly<{
          error: Readonly<{
            message: string;
            name?: string;
          }>;
        }>
      | undefined;

    expect(recordFailureInput?.error).toMatchObject({
      message: "PDF document contains no pages",
      name: "NonRetryableJobError",
    });
  });

  it("keeps polling when updating job state fails", async () => {
    const job: Job = {
      id: "job-3",
      type: "extract_form",
      createdBy: null,
      status: "running",
      input: {
        formType: "end-of-season",
        document: {
          bundleId: "bundle-3",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-3",
              storageKey: "bundle-3/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
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
    const extractFormService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, ReturnType<typeof createExtractFormServiceOutput>>(
          createExtractFormServiceOutput(),
        ),
      ),
    };
    const extractForm = createExtractFormUseCase(extractFormService);
    const jobExecutor = new RegisteredJobExecutor(getRegisteredJob, {
      countExampleItems: new CountExampleItemsUseCase(createExampleItemMockRepository()),
      extractForm,
      genericExtractForm: createGenericExtractFormUseCase(extractFormService),
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
      | Readonly<{
          err?: Error;
          jobId?: string;
        }>
      | undefined;

    expect(updateFailureInput?.jobId).toBe(job.id);
    expect(updateFailureInput?.err).toBeInstanceOf(Error);
    expect(recordFailureSpy).not.toHaveBeenCalled();
  });

  it("does not log generic extraction prompt bodies or base64 file contents", async () => {
    const job: Job = {
      id: "job-generic-1",
      type: "generic_extract_form",
      createdBy: null,
      status: "running",
      input: {
        form: "caller-label",
        profile: "default",
        prompt: "Sensitive prompt body",
        outputSchema: {
          type: "object",
          properties: {
            country: { type: "string" },
          },
        },
        document: {
          bundleId: "bundle-generic-1",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [
            {
              bundleId: "bundle-generic-1",
              storageKey: "bundle-generic-1/001.pdf",
              originalFilename: "form.pdf",
              mimetype: "application/pdf",
              size: 1024,
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
      },
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
    const completeJob = new CompleteJobUseCase(repository);
    const recordJobFailure = new RecordJobFailureUseCase(repository);
    const claimNext = new ClaimNextJobUseCase(repository);
    const extractFormService: FormExtractionService = {
      extract: vi.fn(() =>
        Future.success<Error, FormExtractionServiceOutput>({
          providerName: "stub",
          model: "stub-model",
          extractedFields: {
            country: "Kenya",
          },
          warnings: [],
        }),
      ),
    };

    const worker = new JobWorker(
      claimNext,
      completeJob,
      recordJobFailure,
      new RegisteredJobExecutor(getRegisteredJob, {
        countExampleItems: new CountExampleItemsUseCase(createExampleItemMockRepository()),
        extractForm: createExtractFormUseCase(extractFormService),
        genericExtractForm: createGenericExtractFormUseCase(extractFormService),
      }),
      logger,
      {
        lockedBy: "worker-1",
        pollIntervalMs: 10,
        concurrency: 1,
        leaseTimeoutMs: 1_000,
      },
    );

    worker.start();
    await waitFor(() => {
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: "job-generic-1",
          jobType: "generic_extract_form",
          form: "caller-label",
          profile: "default",
          promptLength: "Sensitive prompt body".length,
        }),
        "Job execution started",
      );
    });
    await worker.stop();

    const startedPayload = vi
      .mocked(logger.info)
      .mock.calls.find(([, message]) => message === "Job execution started")?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(startedPayload).not.toHaveProperty("prompt");
    expect(startedPayload).not.toHaveProperty("contents");
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

function createExtractFormUseCase(
  formExtractionService: FormExtractionService,
): ExtractFormUseCase {
  const documentPreparationService = {
    prepare: vi.fn((input: UploadedDocumentInput) => {
      void input;
      return Future.success<Error, ReturnType<typeof createDocumentPreparationResult>>(
        createDocumentPreparationResult(),
      );
    }),
  };

  const formExtractionServiceFactory: FormExtractionServiceFactory = {
    create: () => formExtractionService,
  };

  return new ExtractFormUseCase(
    documentPreparationService,
    formExtractionServiceFactory,
    createProfileResolver(),
    logger,
  );
}

function createProfileResolver() {
  return new DefaultManagedExtractionProfileResolver(createExtractionProfileRepository());
}

function createGenericProfileFactory() {
  return new DefaultGenericExtractionProfileFactory(createExtractionProfileRepository());
}

function createExtractionProfileRepository() {
  return new ExtractionProfileStaticRepository({
    provider: "stub",
    model: "stub-model",
  });
}

function createGenericExtractFormUseCase(
  formExtractionService: FormExtractionService,
): GenericExtractFormUseCase {
  const documentPreparationService = {
    prepare: vi.fn((input: UploadedDocumentInput) => {
      void input;
      return Future.success<Error, ReturnType<typeof createDocumentPreparationResult>>(
        createDocumentPreparationResult(),
      );
    }),
  };

  const formExtractionServiceFactory: FormExtractionServiceFactory = {
    create: () => formExtractionService,
  };

  return new GenericExtractFormUseCase(
    documentPreparationService,
    formExtractionServiceFactory,
    createGenericProfileFactory(),
    logger,
  );
}
