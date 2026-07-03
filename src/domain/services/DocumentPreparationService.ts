import type { Future } from "../entities/generic/Future.js";
import type { UploadedDocumentInput } from "../uploads/UploadedDocument.js";

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
  prepare(input: UploadedDocumentInput): Future<Error, DocumentPreparationResult>;
}
