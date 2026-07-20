import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { CreateJobUseCase } from "./CreateJobUseCase.js";
import { getFormDefinition } from "../../forms/FormRegistry.js";
import { ValidationError } from "../../../shared/ValidationError.js";
import {
  validateUploadedDocumentInput,
  type UploadedDocumentFileInput,
} from "../../uploads/UploadedDocument.js";
import type { UploadedFileStorage } from "../../uploads/UploadedFileStorage.js";

export type CreateExtractFormJobInput = Readonly<{
  formType: string;
  createdBy: string | null;
  files: UploadedDocumentFileInput[];
}>;

export class CreateExtractFormJobUseCase {
  constructor(
    private readonly createJob: CreateJobUseCase,
    private readonly uploadedFileStorage: UploadedFileStorage,
    private readonly maxFiles: number,
    private readonly maxFileSizeBytes: number,
  ) {}

  execute(input: CreateExtractFormJobInput, now: Date = new Date()): Future<Error, Job> {
    return Future.block(async ($) => {
      const formDefinition = getFormDefinition(input.formType);
      if (!formDefinition) {
        throw new ValidationError(`Unknown form type: ${input.formType}`);
      }

      const validatedDocument = validateUploadedDocumentInput({
        files: input.files,
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
              type: "extract_form",
              createdBy: input.createdBy,
              input: {
                formType: formDefinition.formType,
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
}
