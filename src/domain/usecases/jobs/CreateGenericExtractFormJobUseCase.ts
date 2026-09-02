import { Future } from "../../entities/generic/Future.js";
import { Either } from "../../entities/generic/Either.js";
import type { JsonObject } from "../../entities/generic/Json.js";
import type { Job } from "../../entities/Job.js";
import type { CreateJobUseCase } from "./CreateJobUseCase.js";
import { ValidationError } from "../../errors/ValidationError.js";
import {
  isExtractionProfileName,
  type ExtractionProfileName,
} from "../../extraction/ExtractionProfile.js";
import {
  validateGenericExtractFormOutputSchema,
  validateGenericExtractFormPrompt,
} from "../../jobs/generic-extract-form/GenericExtractFormContract.js";
import {
  validateUploadedDocumentInput,
  type UploadedDocumentFileInput,
} from "../../uploads/UploadedDocument.js";
import type { UploadedFileStorage } from "../../uploads/UploadedFileStorage.js";
import { decodeBase64FileContents } from "../../../utils/base64.js";
import { cleanupUploadedBundleAndPreserveError } from "../support/ExtractionUseCaseSupport.js";

export type GenericExtractFormInputFile = Readonly<{
  contents: string;
  mimeType: string;
  filename: string;
}>;

export type CreateGenericExtractFormJobInput = Readonly<{
  form: string;
  confidence: boolean;
  profile: ExtractionProfileName;
  createdBy: string | null;
  inputFiles: GenericExtractFormInputFile[];
  prompt: string;
  outputSchema: JsonObject;
}>;

export class CreateGenericExtractFormJobUseCase {
  constructor(
    private readonly createJob: CreateJobUseCase,
    private readonly uploadedFileStorage: UploadedFileStorage,
    private readonly maxFiles: number,
    private readonly maxFileSizeBytes: number,
  ) {}

  execute(input: CreateGenericExtractFormJobInput, now: Date = new Date()): Future<Error, Job> {
    return Future.block(async ($) => {
      await $(Future.fromEither(validateProfile(input.profile)));
      await $(Future.fromEither(validatePromptAndSchema(input)));

      const inputFiles = await $(
        Future.fromEither(this.toUploadedDocumentFileInputs(input.inputFiles)),
      );
      const validatedDocument = await $(
        Future.fromEither(
          validateUploadedDocumentInput({
            files: inputFiles,
            maxFiles: this.maxFiles,
            maxFileSizeBytes: this.maxFileSizeBytes,
          }),
        ),
      );

      const storedDocument = await $(
        this.uploadedFileStorage.store({
          files: validatedDocument.files,
          kind: validatedDocument.kind,
        }),
      );

      return await $(
        this.createJob
          .execute(
            {
              type: "generic_extract_form",
              createdBy: input.createdBy,
              input: {
                form: input.form,
                confidence: input.confidence,
                profile: input.profile,
                prompt: input.prompt,
                outputSchema: input.outputSchema,
                document: storedDocument,
              },
            },
            now,
          )
          .flatMapError((error) =>
            cleanupUploadedBundleAndPreserveError(
              this.uploadedFileStorage,
              storedDocument.bundleId,
              error,
            ),
          ),
      );
    });
  }

  private toUploadedDocumentFileInputs(
    inputs: readonly GenericExtractFormInputFile[],
  ): Either<ValidationError, UploadedDocumentFileInput[]> {
    const files: UploadedDocumentFileInput[] = [];

    for (const input of inputs) {
      const file = decodeBase64FileContents(input.contents).flatMap((bytes) => {
        if (bytes.length > this.maxFileSizeBytes) {
          return Either.error(
            new ValidationError(
              `Uploaded file ${input.filename} exceeds maximum size ${String(this.maxFileSizeBytes)} bytes`,
            ),
          );
        }

        return Either.success({
          filename: input.filename,
          mimetype: input.mimeType,
          size: bytes.length,
          bytes,
        });
      });

      if (file.value.type === "error") return Either.error(file.value.error);
      files.push(file.value.data);
    }

    return Either.success(files);
  }
}

function validateProfile(profile: string): Either<ValidationError, undefined> {
  if (!isExtractionProfileName(profile)) {
    return Either.error(new ValidationError(`Unknown extraction profile: ${profile}`));
  }

  return Either.success(undefined);
}

function validatePromptAndSchema(
  input: Pick<CreateGenericExtractFormJobInput, "prompt" | "outputSchema">,
): Either<ValidationError, void> {
  return validateGenericExtractFormPrompt(input.prompt).flatMap(() =>
    validateGenericExtractFormOutputSchema(input.outputSchema),
  );
}
