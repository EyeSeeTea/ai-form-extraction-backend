import type { Future } from "../entities/generic/Future.js";

export type PreparedImageBytes = Readonly<{
  pageNumber: number;
  mediaType: "image/jpeg" | "image/png";
  bytes: Uint8Array;
}>;

export type PdfPageImageRendererInput = Readonly<{
  bytes: Uint8Array;
  maxPages: number;
  maxRenderedPages: number;
}>;

export interface PdfPageImageRenderer {
  render(input: PdfPageImageRendererInput): Future<Error, PreparedImageBytes[]>;
}
