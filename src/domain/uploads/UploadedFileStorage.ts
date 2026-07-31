import type { Future } from "../entities/generic/Future.js";
import type { UploadedDocumentInput, ValidatedUploadedDocument } from "./UploadedDocument.js";

export interface UploadedFileStorage {
  store(input: ValidatedUploadedDocument): Future<Error, UploadedDocumentInput>;
  readFile(storageKey: string): Future<Error, Uint8Array>;
  cleanupBundle(bundleId: string): Future<Error, void>;
}
