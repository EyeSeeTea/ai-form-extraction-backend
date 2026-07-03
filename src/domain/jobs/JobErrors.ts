export class NonRetryableJobError extends Error {
  override readonly name = "NonRetryableJobError";

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function isNonRetryableJobError(error: unknown): boolean {
  return error instanceof NonRetryableJobError;
}
