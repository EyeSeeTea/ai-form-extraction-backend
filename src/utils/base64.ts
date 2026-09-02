import { Buffer } from "node:buffer";

import { ValidationError } from "../domain/errors/ValidationError.js";
import { Either } from "../domain/entities/generic/Either.js";

export function decodeBase64FileContents(contents: string): Either<ValidationError, Uint8Array> {
  const normalized = contents.replace(/\s+/g, "");
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    return Either.error(new ValidationError("Invalid base64 file contents"));
  }

  const bytes = Buffer.from(normalized, "base64");
  const expected = normalized.replace(/=+$/, "");
  const actual = bytes.toString("base64").replace(/=+$/, "");

  if (actual !== expected) {
    return Either.error(new ValidationError("Invalid base64 file contents"));
  }

  return Either.success(bytes);
}
