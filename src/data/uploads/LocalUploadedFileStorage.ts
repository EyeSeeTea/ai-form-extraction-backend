import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { Future } from "../../domain/entities/generic/Future.js";
import type { UploadedFileStorage } from "../../domain/uploads/UploadedFileStorage.js";
import type {
  UploadedDocumentFileRef,
  UploadedDocumentInput,
  ValidatedUploadedDocument,
} from "../../domain/uploads/UploadedDocument.js";

export class LocalUploadedFileStorage implements UploadedFileStorage {
  constructor(private readonly uploadsDir: string) {}

  store(input: ValidatedUploadedDocument): Future<Error, UploadedDocumentInput> {
    const bundleId = randomUUID();
    const createdAt = new Date().toISOString();
    const bundleDir = join(this.uploadsDir, bundleId);
    const writeFiles = Future.block<Error, UploadedDocumentInput>(async ($) => {
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
    });

    return Future.fromPromise(() => mkdir(bundleDir, { recursive: true }))
      .flatMap(() => writeFiles)
      .flatMapError((error) =>
        Future.fromPromise(() => rm(bundleDir, { recursive: true, force: true }))
          .flatMapError(() => Future.success(undefined))
          .flatMap(() => Future.error(error)),
      );
  }

  readFile(storageKey: string): Future<Error, Uint8Array> {
    return Future.fromPromise(() => readFile(resolveStoragePath(this.uploadsDir, storageKey)));
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

function resolveStoragePath(uploadsDir: string, storageKey: string): string {
  ensureValidStorageKey(storageKey);

  return resolve(uploadsDir, storageKey);
}

function ensureValidStorageKey(storageKey: string): void {
  if (storageKey.length === 0) {
    throw new Error("Invalid storage key: empty value");
  }

  if (isAbsolute(storageKey)) {
    throw new Error(`Invalid storage key: ${storageKey}`);
  }

  if (storageKey.includes("\\")) {
    throw new Error(`Invalid storage key: ${storageKey}`);
  }

  const segments = storageKey.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Invalid storage key: ${storageKey}`);
  }
}
