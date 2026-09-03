import { pdf } from "pdf-to-img";

import { Future } from "../../domain/entities/generic/Future.js";
import {
  isDocumentPreparationError,
  createPdfDocumentContainsNoPagesError,
  createPdfDocumentExceedsMaxPagesError,
  createPdfDocumentExceedsMaxRenderedPagesError,
  createPdfDocumentRenderError,
} from "../../domain/services/DocumentPreparationErrors.js";
import type {
  PdfPageImageRenderer,
  PdfPageImageRendererInput,
  PreparedImageBytes,
} from "../../domain/services/PdfPageImageRenderer.js";

const renderScale = 2;

export class PdfToImgPdfPageImageRenderer implements PdfPageImageRenderer {
  render(input: PdfPageImageRendererInput): Future<Error, PreparedImageBytes[]> {
    return Future.block<Error, PreparedImageBytes[]>(async ($) => {
      const document = await $(Future.fromPromise(() => pdf(input.bytes, { scale: renderScale })));

      try {
        if (document.length === 0) {
          return await $(Future.error(createPdfDocumentContainsNoPagesError()));
        }

        if (document.length > input.maxPages) {
          return await $(Future.error(createPdfDocumentExceedsMaxPagesError(input.maxPages)));
        }

        const images: PreparedImageBytes[] = [];

        for (let pageNumber = 1; pageNumber <= document.length; pageNumber += 1) {
          if (images.length >= input.maxRenderedPages) {
            return await $(
              Future.error(createPdfDocumentExceedsMaxRenderedPagesError(input.maxRenderedPages)),
            );
          }

          images.push({
            pageNumber,
            mediaType: "image/png",
            bytes: await $(Future.fromPromise(() => document.getPage(pageNumber))),
          });
        }

        return images;
      } finally {
        await $(
          Future.fromPromise(() => document.destroy()).flatMapError(() =>
            Future.success(undefined),
          ),
        );
      }
    }).mapError((error) =>
      isDocumentPreparationError(error) ? error : createPdfDocumentRenderError(error),
    );
  }
}
