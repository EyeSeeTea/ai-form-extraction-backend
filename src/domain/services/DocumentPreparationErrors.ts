export type DocumentPreparationErrorCode =
  | "missing_pdf_file_references"
  | "pdf_document_contains_no_pages"
  | "pdf_document_exceeds_max_pages"
  | "pdf_document_exceeds_max_rendered_pages"
  | "pdf_document_render_error";

export class DocumentPreparationError extends Error {
  readonly code: DocumentPreparationErrorCode;

  constructor(code: DocumentPreparationErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DocumentPreparationError";
    this.code = code;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function isDocumentPreparationError(
  error: unknown,
  code?: DocumentPreparationErrorCode,
): error is DocumentPreparationError {
  return error instanceof DocumentPreparationError && (code === undefined || error.code === code);
}

export function createMissingPdfFileReferencesError(cause?: unknown): DocumentPreparationError {
  return new DocumentPreparationError(
    "missing_pdf_file_references",
    "PDF document is missing file references",
    cause,
  );
}

export function createPdfDocumentContainsNoPagesError(cause?: unknown): DocumentPreparationError {
  return new DocumentPreparationError(
    "pdf_document_contains_no_pages",
    "PDF document contains no pages",
    cause,
  );
}

export function createPdfDocumentExceedsMaxPagesError(
  maxPages: number,
  cause?: unknown,
): DocumentPreparationError {
  return new DocumentPreparationError(
    "pdf_document_exceeds_max_pages",
    `PDF exceeds maximum page count of ${String(maxPages)} pages`,
    cause,
  );
}

export function createPdfDocumentExceedsMaxRenderedPagesError(
  maxRenderedPages: number,
  cause?: unknown,
): DocumentPreparationError {
  return new DocumentPreparationError(
    "pdf_document_exceeds_max_rendered_pages",
    `PDF exceeds maximum rendered page count of ${String(maxRenderedPages)}`,
    cause,
  );
}

export function createPdfDocumentRenderError(cause?: unknown): DocumentPreparationError {
  return new DocumentPreparationError(
    "pdf_document_render_error",
    `Failed to render PDF document: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  );
}
