import { Buffer } from "node:buffer";

import { ValidationError } from "../shared/ValidationError.js";

export function decodeBase64FileContents(contents: string): Uint8Array {
  const normalized = contents.replace(/\s+/g, "");
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    throw new ValidationError("Invalid base64 file contents");
  }

  const bytes = Buffer.from(normalized, "base64");
  const expected = normalized.replace(/=+$/, "");
  const actual = bytes.toString("base64").replace(/=+$/, "");

  if (actual !== expected) {
    throw new ValidationError("Invalid base64 file contents");
  }

  return bytes;
}
