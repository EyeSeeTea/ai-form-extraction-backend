import type { Future } from "../entities/generic/Future.js";
import type {
  UploadedDocumentFileInput,
  UploadedDocumentInput,
  UploadedDocumentKind,
} from "./UploadedDocument.js";

export type StoreUploadedFilesInput = {
  readonly kind: UploadedDocumentKind;
  readonly files: UploadedDocumentFileInput[];
};

export interface UploadedFileStorage {
  store(input: StoreUploadedFilesInput): Future<Error, UploadedDocumentInput>;
  cleanupBundle(bundleId: string): Future<Error, void>;
}
