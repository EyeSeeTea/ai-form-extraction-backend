import multipart from "@fastify/multipart";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../../CompositionRoot.js";
import type { Environment } from "../../config/Environment.js";
import {
  GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES,
  GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES,
} from "../../domain/jobs/generic-extract-form/GenericExtractFormLimits.js";
import { ValidationError } from "../../shared/ValidationError.js";
import { ExtractFormJobSchemas } from "../schemas/ExtractFormJobSchemas.js";
import {
  GenericExtractFormJobSchemas,
  type CreateGenericExtractFormJobRequestBody,
} from "../schemas/GenericExtractFormJobSchemas.js";
import { serializeJob } from "../serializers/JobSerializer.js";

export function createExtractFormJobRoutes(
  compositionRoot: CompositionRoot,
  environment: Environment,
): FastifyPluginAsyncZod {
  return async function extractFormJobRoutes(server) {
    await server.register(multipart, {
      attachFieldsToBody: true,
      limits: {
        fileSize: environment.UPLOAD_MAX_FILE_SIZE_BYTES,
        files: environment.UPLOAD_MAX_FILES,
      },
    });

    server.post<{ Body: CreateGenericExtractFormJobRequestBody }>("/jobs/extract-form", {
      bodyLimit: getGenericExtractFormBodyLimit(environment),
      schema: GenericExtractFormJobSchemas.create,
      handler: async (request, reply) => {
        try {
          const job = await compositionRoot.jobs.createGenericExtractFormJob
            .execute({
              form: request.body.form,
              profile: request.body.profile ?? "default",
              createdBy: request.dhis2Username ?? null,
              inputFiles: request.body.inputFiles,
              prompt: request.body.prompt,
              outputSchema: request.body.outputSchema,
            })
            .toPromise();

          try {
            compositionRoot.jobs.nudgeJobWorker();
          } catch {
            // best-effort wake-up
          }

          return await reply.code(202).send({
            ...serializeJob(job),
            statusUrl: `/api/jobs/${job.id}`,
          });
        } catch (error) {
          if (error instanceof ValidationError) {
            return await reply.code(400).send({
              error: "Bad Request",
              message: error.message,
            });
          }

          throw error;
        }
      },
    });

    server.post("/jobs/extract-form/:formType", {
      bodyLimit: environment.UPLOAD_MAX_FILE_SIZE_BYTES + 1_048_576,
      schema: ExtractFormJobSchemas.create,
      handler: async (request, reply) => {
        const formType = request.params.formType;
        const files = await readMultipartFiles(request.body.files);

        try {
          const job = await compositionRoot.jobs.createExtractFormJob
            .execute({
              formType,
              createdBy: request.dhis2Username ?? null,
              files,
            })
            .toPromise();

          try {
            compositionRoot.jobs.nudgeJobWorker();
          } catch {
            // best-effort wake-up
          }

          return await reply.code(202).send({
            ...serializeJob(job),
            statusUrl: `/api/jobs/${job.id}`,
          });
        } catch (error) {
          if (error instanceof ValidationError) {
            return await reply.code(400).send({
              error: "Bad Request",
              message: error.message,
            });
          }

          throw error;
        }
      },
    });
  };
}

type MultipartFileLike = {
  readonly filename?: string;
  readonly mimetype?: string;
  readonly fieldname?: string;
  readonly encoding?: string;
  readonly toBuffer?: () => Promise<Buffer> | Buffer;
  readonly value?: unknown;
  readonly file?: unknown;
  readonly size?: number;
};

async function readMultipartFiles(field: unknown): Promise<
  {
    readonly filename: string;
    readonly mimetype: string;
    readonly size: number;
    readonly bytes: Uint8Array;
  }[]
> {
  const rawFiles = Array.isArray(field) ? field : field === undefined ? [] : [field];

  if (rawFiles.length === 0) {
    throw new ValidationError("At least one uploaded file is required");
  }

  const files: {
    readonly filename: string;
    readonly mimetype: string;
    readonly size: number;
    readonly bytes: Uint8Array;
  }[] = [];

  for (const rawFile of rawFiles) {
    const file = await normalizeMultipartFile(rawFile);
    files.push(file);
  }

  return files;
}

async function normalizeMultipartFile(input: unknown): Promise<{
  readonly filename: string;
  readonly mimetype: string;
  readonly size: number;
  readonly bytes: Uint8Array;
}> {
  const file = extractMultipartFileLike(input);
  if (!file) {
    throw new ValidationError("Invalid uploaded file payload");
  }

  const bytes = await readFileBytes(file);
  const filename = file.filename ?? "upload.bin";
  const mimetype = file.mimetype ?? "application/octet-stream";

  return {
    filename,
    mimetype,
    size: file.size ?? bytes.length,
    bytes,
  };
}

function extractMultipartFileLike(input: unknown): MultipartFileLike | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const candidate = input as MultipartFileLike & Record<string, unknown>;

  if (typeof candidate.toBuffer === "function" || typeof candidate.filename === "string") {
    return candidate;
  }

  if ("value" in candidate && candidate.value && typeof candidate.value === "object") {
    return extractMultipartFileLike(candidate.value);
  }

  return undefined;
}

async function readFileBytes(file: MultipartFileLike): Promise<Uint8Array> {
  if (typeof file.toBuffer === "function") {
    const buffer = await file.toBuffer();
    return Buffer.from(buffer);
  }

  if (file.value instanceof Uint8Array) {
    return file.value;
  }

  if (file.file instanceof Uint8Array) {
    return file.file;
  }

  throw new ValidationError("Uploaded file content is not available");
}

function getGenericExtractFormBodyLimit(environment: Environment): number {
  const maxBase64FileBytes = Math.ceil((environment.UPLOAD_MAX_FILE_SIZE_BYTES * 4) / 3) + 4;
  const filesBytes = environment.UPLOAD_MAX_FILES * (maxBase64FileBytes + 2_048);

  return (
    filesBytes +
    GENERIC_EXTRACT_FORM_MAX_PROMPT_BYTES +
    GENERIC_EXTRACT_FORM_MAX_OUTPUT_SCHEMA_BYTES +
    1_048_576
  );
}
