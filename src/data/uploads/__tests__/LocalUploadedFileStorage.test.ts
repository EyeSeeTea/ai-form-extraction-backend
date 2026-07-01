import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { LocalUploadedFileStorage } from "../LocalUploadedFileStorage.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("LocalUploadedFileStorage", () => {
  it("stores files sequentially using the submitted order", async () => {
    const uploadsDir = await createUploadsDir();
    const storage = new LocalUploadedFileStorage(uploadsDir);

    const stored = await storage
      .store({
        kind: "jpeg-pages",
        files: [
          {
            filename: "second.jpg",
            mimetype: "image/jpeg",
            size: 4,
            bytes: jpegBytes(0x21),
          },
          {
            filename: "first.jpg",
            mimetype: "image/jpeg",
            size: 4,
            bytes: jpegBytes(0x22),
          },
        ],
      })
      .toPromise();

    expect(stored.files.map((file) => file.storageKey)).toEqual([
      `${stored.bundleId}/001.jpg`,
      `${stored.bundleId}/002.jpg`,
    ]);
    expect(stored.files.map((file) => file.originalFilename)).toEqual(["second.jpg", "first.jpg"]);
    const [firstStoredFile, secondStoredFile] = stored.files;
    expect(firstStoredFile).toBeDefined();
    expect(secondStoredFile).toBeDefined();
    if (!firstStoredFile || !secondStoredFile) {
      throw new Error("Expected stored files to be present");
    }
    await expect(readFile(join(uploadsDir, firstStoredFile.storageKey))).resolves.toEqual(
      jpegBytes(0x21),
    );
    await expect(readFile(join(uploadsDir, secondStoredFile.storageKey))).resolves.toEqual(
      jpegBytes(0x22),
    );
  });

  it("rejects invalid bundle IDs before deleting anything", async () => {
    const uploadsDir = await createUploadsDir();
    const sentinelPath = join(uploadsDir, "sentinel.txt");
    await writeFile(sentinelPath, "keep");
    const storage = new LocalUploadedFileStorage(uploadsDir);

    await expect(storage.cleanupBundle("../bad-path").toPromise()).rejects.toThrow(
      "Invalid bundle ID",
    );
    await expect(readFile(sentinelPath, "utf8")).resolves.toBe("keep");
  });
});

async function createUploadsDir() {
  const directory = await mkdtemp(join(tmpdir(), "local-upload-storage-"));
  createdDirs.push(directory);
  return directory;
}

function jpegBytes(seed: number) {
  return Buffer.from([0xff, 0xd8, 0xff, seed]);
}
