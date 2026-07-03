import type { Future } from "../entities/generic/Future.js";
import type { UploadedDocumentInput } from "../uploads/UploadedDocument.js";
import type { DocumentPreparationError } from "./DocumentPreparationErrors.js";

export type PreparedImage = {
  readonly pageNumber: number;
  readonly mediaType: "image/jpeg" | "image/png";
  readonly bytes: Uint8Array;
  readonly source: {
    readonly storageKey: string;
    readonly sha256: string;
  };
};

export type DocumentPreparationResult = {
  readonly images: PreparedImage[];
  readonly warnings: string[];
};

export interface DocumentPreparationService {
  /**
   * Prepares uploaded documents into ordered image inputs.
   *
   * Error contract:
   * - {@link DocumentPreparationError} means the document or preparation input is not processable as
   *   provided, such as an invalid PDF structure, zero-page PDF, or configured page-count limit.
   *   Repeating the same input is expected to fail the same way.
   * - Other `Error` instances may represent operational failures, such as storage reads, filesystem
   *   errors, renderer crashes, or unexpected runtime failures. Repeating the same input may succeed
   *   later depending on the underlying cause.
   *
   * Consumers can use `isDocumentPreparationError` to classify deterministic preparation failures.
   */
  prepare(input: UploadedDocumentInput): Future<Error, DocumentPreparationResult>;
}
