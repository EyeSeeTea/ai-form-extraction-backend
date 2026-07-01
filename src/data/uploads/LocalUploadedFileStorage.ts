import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { randomUUID } from "node:crypto";

import { Future } from "../../domain/entities/generic/Future.js";
import type {
  StoreUploadedFilesInput,
  UploadedFileStorage,
} from "../../domain/uploads/UploadedFileStorage.js";
import type {
  UploadedDocumentFileRef,
  UploadedDocumentInput,
} from "../../domain/uploads/UploadedDocument.js";

export class LocalUploadedFileStorage implements UploadedFileStorage {
  constructor(private readonly uploadsDir: string) {}

  store(input: StoreUploadedFilesInput): Future<Error, UploadedDocumentInput> {
    return Future.block(async ($) => {
      const bundleId = randomUUID();
      const createdAt = new Date().toISOString();
      const bundleDir = join(this.uploadsDir, bundleId);

      await $(Future.fromPromise(() => mkdir(bundleDir, { recursive: true })));

      try {
        const files: UploadedDocumentFileRef[] = [];

        for (const [index, file] of input.files.entries()) {
          const extension = input.kind === "pdf" ? "pdf" : "jpg";
          const fileName = `${String(index + 1).padStart(3, "0")}.${extension}`;
          const storageKey = posix.join(bundleId, fileName);
          const filePath = join(this.uploadsDir, storageKey);
          await $(Future.fromPromise(() => mkdir(dirname(filePath), { recursive: true })));
          await $(Future.fromPromise(() => writeFile(filePath, Buffer.from(file.bytes))));

          const sha256 = createHash("sha256").update(file.bytes).digest("hex");

          files.push({
            bundleId,
            storageKey,
            originalFilename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            sha256,
          });
        }

        return {
          bundleId,
          createdAt,
          kind: input.kind,
          files,
        };
      } catch (error) {
        await $(
          Future.fromPromise(() => rm(bundleDir, { recursive: true, force: true })).flatMapError(
            () => Future.success<Error, undefined>(undefined),
          ),
        );
        throw error instanceof Error ? error : new Error(String(error));
      }
    });
  }

  cleanupBundle(bundleId: string): Future<Error, void> {
    return Future.block(async ($) => {
      ensureValidBundleId(bundleId);
      await $(
        Future.fromPromise(() =>
          rm(join(this.uploadsDir, bundleId), { recursive: true, force: true }),
        ),
      );
    });
  }
}

const bundleIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureValidBundleId(bundleId: string): void {
  if (!bundleIdPattern.test(bundleId)) {
    throw new Error(`Invalid bundle ID: ${bundleId}`);
  }
}
