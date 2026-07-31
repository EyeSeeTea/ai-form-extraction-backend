export class FormExtractionResponseError extends Error {
  override readonly name = "FormExtractionResponseError";
  readonly code = "form_extraction_response_error";

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class FormExtractionConfigurationError extends Error {
  override readonly name = "FormExtractionConfigurationError";
  readonly code = "form_extraction_configuration_error";

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function isDeterministicFormExtractionError(
  error: unknown,
): error is FormExtractionResponseError | FormExtractionConfigurationError {
  return (
    error instanceof FormExtractionResponseError ||
    error instanceof FormExtractionConfigurationError
  );
}
