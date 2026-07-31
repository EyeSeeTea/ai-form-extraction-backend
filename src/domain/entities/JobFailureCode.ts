/**
 * Public, stable job failure codes returned by the jobs API.
 * The runtime only exposes it when it is listed here
 */
export const jobFailureCodes = [
  "missing_pdf_file_references",
  "pdf_document_contains_no_pages",
  "pdf_document_exceeds_max_pages",
  "pdf_document_exceeds_max_rendered_pages",
  "pdf_document_render_error",
  "extraction_validation_error",
  "form_extraction_configuration_error",
  "form_extraction_response_error",
  "job_timed_out",
  "job_lease_expired",
  "unknown_job_type",
  "job_failed",
] as const;

export type JobFailureCode = (typeof jobFailureCodes)[number];

const jobFailureCodeSet = new Set<string>(jobFailureCodes);

export function isJobFailureCode(value: unknown): value is JobFailureCode {
  return typeof value === "string" && jobFailureCodeSet.has(value);
}
