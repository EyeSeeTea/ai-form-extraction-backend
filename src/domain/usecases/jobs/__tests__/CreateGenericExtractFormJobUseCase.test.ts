import { beforeEach, describe, expect, it, vi } from "vitest";

import { Future } from "../../../entities/generic/Future.js";
import type { Job } from "../../../entities/Job.js";
import type { JobRepository } from "../../../repositories/JobRepository.js";
import type { UploadedFileStorage } from "../../../uploads/UploadedFileStorage.js";
import type { UploadedDocumentInput } from "../../../uploads/UploadedDocument.js";
import {
  GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES,
  GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES,
} from "../../../jobs/generic-extract-form/GenericExtractFormLimits.js";
import { CreateJobUseCase } from "../CreateJobUseCase.js";
import {
  CreateGenericExtractFormJobUseCase,
  type CreateGenericExtractFormJobInput,
} from "../CreateGenericExtractFormJobUseCase.js";

describe("CreateGenericExtractFormJobUseCase", () => {
  const uploadedFileStorage = createUploadedFileStorageStub();
  const createJobRepository = createJobRepositoryStub();
  const useCase = new CreateGenericExtractFormJobUseCase(
    new CreateJobUseCase(createJobRepository),
    uploadedFileStorage,
    5,
    1024,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid base64", async () => {
    await expect(
      useCase.execute(createInput({ contents: "not-base64" })).toPromise(),
    ).rejects.toThrow("Invalid base64 file contents");
  });

  it("rejects decoded files above the configured size limit", async () => {
    await expect(
      useCase
        .execute(createInput({ contents: Buffer.alloc(1025, 1).toString("base64") }))
        .toPromise(),
    ).rejects.toThrow("exceeds maximum size 1024 bytes");
  });

  it("rejects prompt and schema payloads above configured limits", async () => {
    await expect(
      useCase
        .execute({
          ...createInput(),
          prompt: "x".repeat(GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES + 1),
        })
        .toPromise(),
    ).rejects.toThrow(
      `prompt exceeds maximum size ${String(GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES)} bytes`,
    );

    await expect(
      useCase
        .execute({
          ...createInput(),
          outputSchema: {
            type: "object",
            value: "x".repeat(GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES + 1),
          },
        })
        .toPromise(),
    ).rejects.toThrow(
      `outputSchema exceeds maximum size ${String(GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES)} bytes`,
    );
  });

  it("rejects non-default profiles before storing files", async () => {
    await expect(
      useCase
        .execute({
          ...createInput(),
          profile: "experimental",
        } as unknown as CreateGenericExtractFormJobInput)
        .toPromise(),
    ).rejects.toThrow("Unknown extraction profile: experimental");

    expect(uploadedFileStorage.store).not.toHaveBeenCalled();
    expect(createJobRepository.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported output schemas before storing files", async () => {
    await expect(
      useCase
        .execute({
          ...createInput(),
          outputSchema: {
            type: "object",
            properties: {
              country: {
                type: "unsupported-json-schema-type",
              },
            },
          },
        })
        .toPromise(),
    ).rejects.toThrow("Unsupported outputSchema");

    expect(uploadedFileStorage.store).not.toHaveBeenCalled();
    expect(createJobRepository.create).not.toHaveBeenCalled();
  });

  it("rejects output schemas whose root type is not object", async () => {
    await expect(
      useCase
        .execute({
          ...createInput(),
          outputSchema: {
            type: "string",
          },
        })
        .toPromise(),
    ).rejects.toThrow("outputSchema root type must be object");

    expect(uploadedFileStorage.store).not.toHaveBeenCalled();
    expect(createJobRepository.create).not.toHaveBeenCalled();
  });

  it("accepts unknown form labels and creates a generic_extract_form job", async () => {
    const job: Job = await useCase
      .execute({
        ...createInput(),
        form: "not-a-registered-form",
        profile: "default",
      })
      .toPromise();

    expect(job.type).toBe("generic_extract_form");
    const createCalls = createJobRepository.create.mock.calls as [
      Parameters<JobRepository["create"]>[0],
    ][];
    expect(createCalls[0]?.[0]).toMatchObject({
      type: "generic_extract_form",
      input: {
        form: "not-a-registered-form",
        profile: "default",
        prompt: "Extract visible values",
      },
    });
  });

  it("rejects MIME and signature mismatches using uploaded document validation", async () => {
    await expect(
      useCase
        .execute(
          createInput({
            filename: "page-001.jpg",
            mimeType: "image/jpeg",
            contents: pdfBytes().toString("base64"),
          }),
        )
        .toPromise(),
    ).rejects.toThrow("metadata does not match its file signature");
  });

  it("cleans up stored bundles when job creation fails", async () => {
    createJobRepository.create.mockReturnValueOnce(Future.error(new Error("repository failed")));

    await expect(useCase.execute(createInput()).toPromise()).rejects.toThrow("repository failed");

    expect(uploadedFileStorage.cleanupBundle).toHaveBeenCalledWith("bundle-1");
  });
});

function createInput(
  fileOverrides: Partial<{
    readonly filename: string;
    readonly mimeType: string;
    readonly contents: string;
  }> = {},
): CreateGenericExtractFormJobInput {
  return {
    form: "caller-label",
    profile: "default",
    createdBy: "user",
    prompt: "Extract visible values",
    outputSchema: {
      type: "object",
      properties: {
        country: { type: "string" },
      },
    },
    inputFiles: [
      {
        filename: fileOverrides.filename ?? "form.pdf",
        mimeType: fileOverrides.mimeType ?? "application/pdf",
        contents: fileOverrides.contents ?? pdfBytes().toString("base64"),
      },
    ],
  };
}

function createUploadedFileStorageStub(): UploadedFileStorage & {
  readonly store: ReturnType<typeof vi.fn>;
  readonly cleanupBundle: ReturnType<typeof vi.fn>;
} {
  const storedDocument: UploadedDocumentInput = {
    bundleId: "bundle-1",
    createdAt: "2026-01-01T12:00:00.000Z",
    kind: "pdf",
    files: [
      {
        bundleId: "bundle-1",
        storageKey: "bundle-1/001.pdf",
        originalFilename: "form.pdf",
        mimetype: "application/pdf",
        size: pdfBytes().length,
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    ],
  };

  return {
    store: vi.fn(() => Future.success<Error, UploadedDocumentInput>(storedDocument)),
    readFile: vi.fn(),
    cleanupBundle: vi.fn(() => Future.success<Error, undefined>(undefined)),
  };
}

function createJobRepositoryStub(): JobRepository & { readonly create: ReturnType<typeof vi.fn> } {
  return {
    create: vi.fn((input: Parameters<JobRepository["create"]>[0]) =>
      Future.success<Error, Job>({
        id: "job-1",
        type: input.type,
        createdBy: input.createdBy,
        status: "queued",
        input: input.input,
        attempts: 0,
        maxAttempts: input.maxAttempts,
        availableAt: input.availableAt,
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      }),
    ),
    getById: vi.fn(),
    claimNext: vi.fn(),
    complete: vi.fn(),
    recordFailure: vi.fn(),
  };
}

function pdfBytes() {
  return Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
}
