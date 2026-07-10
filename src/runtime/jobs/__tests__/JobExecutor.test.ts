import { describe, expect, it } from "vitest";
import { toJobError } from "../JobExecutor.js";
import { createPdfDocumentContainsNoPagesError } from "../../../domain/services/DocumentPreparationErrors.js";
import { JobTimeoutError, NonRetryableJobError } from "../../../domain/jobs/JobErrors.js";
import { ValidationError } from "../../../shared/ValidationError.js";
import {
  FormExtractionConfigurationError,
  FormExtractionResponseError,
} from "../../../domain/services/FormExtractionErrors.js";

describe("toJobError", () => {
  it("classifies wrapped document preparation failures", () => {
    const error = new NonRetryableJobError(
      "PDF document contains no pages",
      createPdfDocumentContainsNoPagesError(),
    );

    expect(toJobError(error)).toMatchObject({
      message: "PDF document contains no pages",
      code: "pdf_document_contains_no_pages",
      name: "NonRetryableJobError",
      cause: {
        message: "PDF document contains no pages",
        name: "DocumentPreparationError",
        code: "pdf_document_contains_no_pages",
      },
    });
  });

  it("classifies wrapped validation failures", () => {
    const error = new NonRetryableJobError(
      "Invalid extraction result",
      new ValidationError("bad"),
      "extraction_validation_error",
    );

    expect(toJobError(error)).toMatchObject({
      message: "Invalid extraction result",
      code: "extraction_validation_error",
    });
  });

  it("classifies form extraction provider response failures", () => {
    expect(toJobError(new FormExtractionResponseError("invalid model output"))).toMatchObject({
      message: "invalid model output",
      code: "form_extraction_response_error",
    });
  });

  it("classifies form extraction configuration failures", () => {
    expect(toJobError(new FormExtractionConfigurationError("missing API key"))).toMatchObject({
      message: "missing API key",
      code: "form_extraction_configuration_error",
    });
  });

  it("classifies job timeout failures", () => {
    expect(toJobError(new JobTimeoutError("extract_form", 1_000))).toMatchObject({
      message: "Job extract_form timed out after 1000ms",
      code: "job_timed_out",
    });
  });

  it("classifies unknown job type failures", () => {
    expect(
      toJobError(
        new NonRetryableJobError("Unknown job type: missing", undefined, "unknown_job_type"),
      ),
    ).toMatchObject({
      message: "Unknown job type: missing",
      code: "unknown_job_type",
    });
  });

  it("falls back to a generic code for unclassified failures", () => {
    expect(toJobError(new Error("boom"))).toMatchObject({
      message: "boom",
      code: "job_failed",
    });
  });
});
