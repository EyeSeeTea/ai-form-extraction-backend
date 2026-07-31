import { Future } from "../../domain/entities/generic/Future.js";
import type {
  DocumentPreparationService,
  DocumentPreparationResult,
} from "../../domain/services/DocumentPreparationService.js";
import { createMissingPdfFileReferencesError } from "../../domain/services/DocumentPreparationErrors.js";
import type {
  PdfPageImageRenderer,
  PreparedImageBytes,
} from "../../domain/services/PdfPageImageRenderer.js";
import type { UploadedFileStorage } from "../../domain/uploads/UploadedFileStorage.js";
import type { UploadedDocumentInput } from "../../domain/uploads/UploadedDocument.js";

export type LocalDocumentPreparationServiceOptions = Readonly<{
  pdfMaxPages: number;
  pdfMaxExtractedImages: number;
}>;

export class LocalDocumentPreparationService implements DocumentPreparationService {
  constructor(
    private readonly uploadedFileStorage: UploadedFileStorage,
    private readonly pdfPageImageRenderer: PdfPageImageRenderer,
    private readonly options: LocalDocumentPreparationServiceOptions,
  ) {}

  prepare(input: UploadedDocumentInput): Future<Error, DocumentPreparationResult> {
    return Future.block(async ($) => {
      if (input.kind === "jpeg-pages") {
        return await $(this.prepareJpegPages(input));
      }

      return await $(this.preparePdf(input));
    });
  }

  private prepareJpegPages(input: UploadedDocumentInput): Future<Error, DocumentPreparationResult> {
    return Future.block(async ($) => {
      const images: DocumentPreparationResult["images"] = [];

      for (const [index, file] of input.files.entries()) {
        const bytes = await $(this.uploadedFileStorage.readFile(file.storageKey));
        images.push({
          pageNumber: index + 1,
          mediaType: "image/jpeg",
          bytes,
          source: {
            storageKey: file.storageKey,
            sha256: file.sha256,
          },
        });
      }

      return {
        images,
        warnings: [],
      };
    });
  }

  private preparePdf(input: UploadedDocumentInput): Future<Error, DocumentPreparationResult> {
    return Future.block(async ($) => {
      const [pdfFile] = input.files;
      if (!pdfFile) {
        throw createMissingPdfFileReferencesError();
      }

      const bytes = await $(this.uploadedFileStorage.readFile(pdfFile.storageKey));
      const preparedImages = await $(
        this.pdfPageImageRenderer.render({
          bytes,
          maxPages: this.options.pdfMaxPages,
          maxRenderedPages: this.options.pdfMaxExtractedImages,
        }),
      );

      return {
        images: preparedImages.map((image) =>
          this.toPreparedImage(image, pdfFile.storageKey, pdfFile.sha256),
        ),
        warnings: [],
      };
    });
  }

  private toPreparedImage(
    image: PreparedImageBytes,
    storageKey: string,
    sha256: string,
  ): DocumentPreparationResult["images"][number] {
    return {
      pageNumber: image.pageNumber,
      mediaType: image.mediaType,
      bytes: image.bytes,
      source: {
        storageKey,
        sha256,
      },
    };
  }
}
