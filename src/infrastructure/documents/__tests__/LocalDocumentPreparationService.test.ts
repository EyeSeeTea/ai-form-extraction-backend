import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { Future } from "../../../domain/entities/generic/Future.js";
import type {
  PdfPageImageRenderer,
  PdfPageImageRendererInput,
  PreparedImageBytes,
} from "../../../domain/services/PdfPageImageRenderer.js";
import { LocalUploadedFileStorage } from "../../../data/uploads/LocalUploadedFileStorage.js";
import { LocalDocumentPreparationService } from "../LocalDocumentPreparationService.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("LocalDocumentPreparationService", () => {
  it("returns JPEG pages in the uploaded order", async () => {
    const uploadsDir = await createUploadsDir();
    const storage = new LocalUploadedFileStorage(uploadsDir);
    const service = new LocalDocumentPreparationService(storage, new FakePdfPageImageRenderer(), {
      pdfMaxPages: 20,
      pdfMaxExtractedImages: 20,
    });

    const storedDocument = await storage
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

    const prepared = await service.prepare(storedDocument).toPromise();

    expect(prepared.warnings).toEqual([]);
    expect(prepared.images).toHaveLength(2);
    expect(prepared.images.map((image) => image.pageNumber)).toEqual([1, 2]);
    expect(prepared.images.map((image) => image.mediaType)).toEqual(["image/jpeg", "image/jpeg"]);
    expect(prepared.images.map((image) => image.bytes)).toEqual([jpegBytes(0x21), jpegBytes(0x22)]);
    expect(prepared.images.map((image) => image.source.storageKey)).toEqual(
      storedDocument.files.map((file) => file.storageKey),
    );
    expect(prepared.images.map((image) => image.source.sha256)).toEqual(
      storedDocument.files.map((file) => file.sha256),
    );
  });

  it("delegates PDF preparation to the renderer and keeps the source metadata", async () => {
    const uploadsDir = await createUploadsDir();
    const storage = new LocalUploadedFileStorage(uploadsDir);
    const renderer = new FakePdfPageImageRenderer([
      {
        pageNumber: 1,
        mediaType: "image/png",
        bytes: Buffer.from([1, 2, 3]),
      },
    ]);
    const service = new LocalDocumentPreparationService(storage, renderer, {
      pdfMaxPages: 11,
      pdfMaxExtractedImages: 7,
    });

    const storedDocument = await storage
      .store({
        kind: "pdf",
        files: [
          {
            filename: "report.pdf",
            mimetype: "application/pdf",
            size: pdfBytes.length,
            bytes: pdfBytes,
          },
        ],
      })
      .toPromise();
    const [pdfFile] = storedDocument.files;
    if (!pdfFile) {
      throw new Error("Expected PDF file to be present");
    }

    const prepared = await service.prepare(storedDocument).toPromise();

    expect(renderer.calls).toHaveLength(1);
    expect(renderer.calls[0]).toEqual({
      bytes: pdfBytes,
      maxPages: 11,
      maxRenderedPages: 7,
    });
    expect(prepared.images).toEqual([
      {
        pageNumber: 1,
        mediaType: "image/png",
        bytes: Buffer.from([1, 2, 3]),
        source: {
          storageKey: pdfFile.storageKey,
          sha256: pdfFile.sha256,
        },
      },
    ]);
  });

  it("fails deterministically when a PDF document has no file references", async () => {
    const uploadsDir = await createUploadsDir();
    const storage = new LocalUploadedFileStorage(uploadsDir);
    const service = new LocalDocumentPreparationService(storage, new FakePdfPageImageRenderer(), {
      pdfMaxPages: 11,
      pdfMaxExtractedImages: 7,
    });

    await expect(
      service
        .prepare({
          bundleId: "bundle-empty",
          createdAt: "2026-01-01T12:00:00.000Z",
          kind: "pdf",
          files: [],
        })
        .toPromise(),
    ).rejects.toMatchObject({ code: "missing_pdf_file_references" });
  });
});

class FakePdfPageImageRenderer implements PdfPageImageRenderer {
  readonly calls: PdfPageImageRendererInput[] = [];

  constructor(private readonly output: PreparedImageBytes[] = []) {}

  render(input: PdfPageImageRendererInput): Future<Error, PreparedImageBytes[]> {
    this.calls.push(input);
    return Future.success(this.output);
  }
}

async function createUploadsDir() {
  const directory = await mkdtemp(join(tmpdir(), "local-document-preparation-"));
  createdDirs.push(directory);
  return directory;
}

const pdfBytes = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
]);

function jpegBytes(seed: number) {
  return Buffer.from([0xff, 0xd8, 0xff, seed]);
}
