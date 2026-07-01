import type { Future } from "../entities/generic/Future.js";
import type { JsonObject } from "../entities/Job.js";
import type { KnownFormDefinition } from "../forms/FormRegistry.js";
import type { UploadedDocumentInput } from "../uploads/UploadedDocument.js";

export type FormExtractionServiceInput = {
  readonly formDefinition: KnownFormDefinition;
  readonly document: UploadedDocumentInput;
  readonly source: {
    readonly bundleId: string;
    readonly createdAt: string;
    readonly kind: UploadedDocumentInput["kind"];
    readonly files: {
      readonly storageKey: string;
      readonly mimetype: string;
      readonly size: number;
      readonly sha256: string;
    }[];
  };
};

export type FormExtractionServiceOutput<ExtractedFields extends JsonObject = JsonObject> = {
  readonly providerName: string;
  readonly extractedFields: ExtractedFields;
  readonly warnings: string[];
};

export interface FormExtractionService {
  extract(input: FormExtractionServiceInput): Future<Error, FormExtractionServiceOutput>;
}
