export class FormExtractionResponseError extends Error {
  override readonly name = "FormExtractionResponseError";

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class FormExtractionConfigurationError extends Error {
  override readonly name = "FormExtractionConfigurationError";

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
