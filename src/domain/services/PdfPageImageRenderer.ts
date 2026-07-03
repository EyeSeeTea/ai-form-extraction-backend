import type { Future } from "../entities/generic/Future.js";

export type PreparedImageBytes = {
  readonly pageNumber: number;
  readonly mediaType: "image/jpeg" | "image/png";
  readonly bytes: Uint8Array;
};

export type PdfPageImageRendererInput = {
  readonly bytes: Uint8Array;
  readonly maxPages: number;
  readonly maxRenderedPages: number;
};

export interface PdfPageImageRenderer {
  render(input: PdfPageImageRendererInput): Future<Error, PreparedImageBytes[]>;
}
