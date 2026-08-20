import { describe, expect, it, vi } from "vitest";

import { createServer } from "../../src/api/Server.js";
import { testEnvironment, authHeaders, createTestCompositionRoot } from "./TestServer.js";
import { createLogger } from "../../src/shared/Logger.js";
import { Future } from "../../src/domain/entities/generic/Future.js";
import type { Job } from "../../src/domain/entities/Job.js";
import { getRegisteredJob } from "../../src/domain/jobs/RegisteredJobRegistry.js";
import { RegisteredJobExecutor } from "../../src/domain/jobs/RegisteredJobExecutor.js";
import type { DocumentPreparationService } from "../../src/domain/services/DocumentPreparationService.js";
import { endOfSeasonFormDefinition } from "../../src/domain/forms/end-of-season/EndOfSeasonFormDefinition.js";
import { JobWorker } from "../../src/runtime/jobs/JobWorker.js";
import { createJobMockRepository } from "../mocks/JobMockRepository.js";
import { createDocumentPreparationResult } from "../fixtures/ExtractFormFixture.js";

const extractionDocument = {
  bundleId: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  kind: "jpeg-pages" as const,
  files: [
    {
      bundleId: "00000000-0000-4000-8000-000000000001",
      storageKey: "00000000-0000-4000-8000-000000000001/001.jpg",
      originalFilename: "page-001.jpg",
      mimetype: "image/jpeg",
      size: 12,
      sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  ],
};

describe("completed extraction jobs", () => {
  it.each(["generic_extract_form", "extract_form"] as const)(
    "exposes the %s provider result through job retrieval",
    async (type) => {
      const jobId =
        type === "generic_extract_form"
          ? "00000000-0000-4000-8000-000000000010"
          : "00000000-0000-4000-8000-000000000011";
      const repository = createJobMockRepository([
        createQueuedJob(jobId, type, createExtractionJobInput(type)),
      ]);
      const documentPreparationService: DocumentPreparationService = {
        prepare: vi.fn(() =>
          Future.success<Error, ReturnType<typeof createDocumentPreparationResult>>(
            createDocumentPreparationResult(),
          ),
        ),
      };
      const compositionRoot = createTestCompositionRoot({
        jobRepository: repository,
        documentPreparationService,
      });
      const server = await createServer(
        testEnvironment,
        createLogger(testEnvironment),
        compositionRoot,
      );
      const worker = new JobWorker(
        compositionRoot.jobs.claimNextJob,
        compositionRoot.jobs.completeJob,
        compositionRoot.jobs.recordJobFailure,
        new RegisteredJobExecutor(getRegisteredJob, {
          countExampleItems: compositionRoot.jobs.execution.countExampleItems,
          extractForm: compositionRoot.jobs.execution.extractForm,
          genericExtractForm: compositionRoot.jobs.execution.genericExtractForm,
        }),
        createLogger(testEnvironment),
        { lockedBy: "integration-test-worker", pollIntervalMs: 5 },
      );

      worker.start();
      worker.nudge();

      try {
        const response = await waitForSucceededJob(server, jobId);

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          id: jobId,
          type,
          status: "succeeded",
          result: {
            fieldConfidence: {
              "/end_of_season_report/header_information/country": 0.95,
              "/end_of_season_report/header_information/team": 0.9,
              "/end_of_season_report/header_information/date": 0.85,
            },
            diagnostics: {
              providerName: "stub",
              model: "stub-model",
            },
          },
        });
      } finally {
        await worker.stop();
        await server.close();
      }
    },
  );
});

function createExtractionJobInput(type: "generic_extract_form" | "extract_form"): Job["input"] {
  if (type === "extract_form") {
    return {
      formType: "end-of-season",
      document: extractionDocument,
    };
  }

  return {
    form: "caller-label",
    confidence: true,
    profile: "default",
    prompt: "Extract visible values",
    outputSchema: endOfSeasonFormDefinition.resultJsonSchema,
    document: extractionDocument,
  };
}

function createQueuedJob(id: string, type: string, input: Job["input"]): Job {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    type,
    createdBy: null,
    status: "queued",
    input,
    attempts: 0,
    maxAttempts: 3,
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function waitForSucceededJob(server: Awaited<ReturnType<typeof createServer>>, id: string) {
  const deadline = Date.now() + 1_000;

  while (Date.now() < deadline) {
    const response = await server.inject({
      method: "GET",
      url: `/api/jobs/${id}`,
      headers: authHeaders,
    });
    const body = response.json<{ status?: string }>();
    if (body.status === "succeeded" || body.status === "failed") {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Job ${id} did not complete before the test timeout`);
}
