import { Future } from "../../entities/generic/Future.js";
import type { JsonObject } from "../../entities/generic/Json.js";
import type { Job } from "../../entities/Job.js";
import type { CreateJobUseCase } from "./CreateJobUseCase.js";
import { ValidationError } from "../../../shared/ValidationError.js";
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

export type GenericExtractFormInputFile = Readonly<{
  contents: string;
  mimeType: string;
  filename: string;
}>;

export type CreateGenericExtractFormJobInput = Readonly<{
  form: string;
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
      validateProfile(input.profile);
      validatePromptAndSchema(input);

      const validatedDocument = validateUploadedDocumentInput({
        files: input.inputFiles.map((file) => this.toUploadedDocumentFileInput(file)),
        maxFiles: this.maxFiles,
        maxFileSizeBytes: this.maxFileSizeBytes,
      });

      const storedDocument = await $(
        this.uploadedFileStorage.store({
          files: validatedDocument.files,
          kind: validatedDocument.kind,
        }),
      );

      try {
        return await $(
          this.createJob.execute(
            {
              type: "generic_extract_form",
              createdBy: input.createdBy,
              input: {
                form: input.form,
                profile: input.profile,
                prompt: input.prompt,
                outputSchema: input.outputSchema,
                document: storedDocument,
              },
            },
            now,
          ),
        );
      } catch (error) {
        await $(
          this.uploadedFileStorage
            .cleanupBundle(storedDocument.bundleId)
            .flatMapError(() => Future.success<Error, undefined>(undefined)),
        );
        throw error;
      }
    });
  }

  private toUploadedDocumentFileInput(
    input: GenericExtractFormInputFile,
  ): UploadedDocumentFileInput {
    const bytes = decodeBase64FileContents(input.contents);
    if (bytes.length > this.maxFileSizeBytes) {
      throw new ValidationError(
        `Uploaded file ${input.filename} exceeds maximum size ${String(this.maxFileSizeBytes)} bytes`,
      );
    }

    return {
      filename: input.filename,
      mimetype: input.mimeType,
      size: bytes.length,
      bytes,
    };
  }
}

function validateProfile(profile: string): void {
  if (!isExtractionProfileName(profile)) {
    throw new ValidationError(`Unknown extraction profile: ${profile}`);
  }
}

function validatePromptAndSchema(
  input: Pick<CreateGenericExtractFormJobInput, "prompt" | "outputSchema">,
): void {
  validateGenericExtractFormPrompt(input.prompt);
  validateGenericExtractFormOutputSchema(input.outputSchema);
}
