import { z } from "zod";

import { ValidationError } from "../../shared/ValidationError.js";

export type UploadedDocumentKind = "pdf" | "jpeg-pages";

export type UploadedDocumentFileInput = Readonly<{
  filename: string;
  mimetype: string;
  size: number;
  bytes: Uint8Array;
}>;

export type UploadedDocumentFileRef = Readonly<{
  bundleId: string;
  storageKey: string;
  originalFilename: string;
  mimetype: string;
  size: number;
  sha256: string;
}>;

export type UploadedDocumentInput = Readonly<{
  bundleId: string;
  createdAt: string;
  kind: UploadedDocumentKind;
  files: UploadedDocumentFileRef[];
}>;

export type UploadedDocumentValidationInput = Readonly<{
  files: UploadedDocumentFileInput[];
  maxFiles: number;
  maxFileSizeBytes: number;
}>;

export type ValidatedUploadedDocument = Readonly<{
  kind: UploadedDocumentKind;
  files: UploadedDocumentFileInput[];
}>;

const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2d];
const jpegSignature = [0xff, 0xd8, 0xff];

export const uploadedDocumentFileRefSchema = z.object({
  bundleId: z.string().min(1),
  storageKey: z.string().min(1),
  originalFilename: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const uploadedDocumentInputSchema = z.object({
  bundleId: z.string().min(1),
  createdAt: z.iso.datetime(),
  kind: z.enum(["pdf", "jpeg-pages"]),
  files: z.array(uploadedDocumentFileRefSchema).min(1),
});

export function validateUploadedDocumentInput(
  input: UploadedDocumentValidationInput,
): ValidatedUploadedDocument {
  if (input.files.length === 0) {
    throw new ValidationError("At least one uploaded file is required");
  }

  if (input.files.length > input.maxFiles) {
    throw new ValidationError(`Too many uploaded files: maximum is ${String(input.maxFiles)}`);
  }

  const kinds = new Set<UploadedDocumentKind>();

  for (const file of input.files) {
    if (file.bytes.length <= 0) {
      throw new ValidationError(`Uploaded file ${file.filename} is empty`);
    }

    if (file.size !== file.bytes.length) {
      throw new ValidationError(
        `Uploaded file ${file.filename} size does not match its content length`,
      );
    }

    if (file.bytes.length > input.maxFileSizeBytes) {
      throw new ValidationError(
        `Uploaded file ${file.filename} exceeds maximum size ${String(input.maxFileSizeBytes)} bytes`,
      );
    }

    const metadataKind = inferKindFromMetadata(file.filename, file.mimetype);
    const signatureKind = inferKindFromSignature(file.bytes);

    if (!metadataKind) {
      throw new ValidationError(
        `Unsupported uploaded file type for ${file.filename} (${file.mimetype})`,
      );
    }

    if (!signatureKind) {
      throw new ValidationError(`Uploaded file ${file.filename} has an unsupported signature`);
    }

    if (metadataKind !== signatureKind) {
      throw new ValidationError(
        `Uploaded file ${file.filename} metadata does not match its file signature`,
      );
    }

    kinds.add(signatureKind);
  }

  if (kinds.size !== 1) {
    throw new ValidationError("Mixed PDF and JPEG uploads are not allowed");
  }

  const kind = [...kinds][0];
  if (!kind) {
    throw new ValidationError("At least one uploaded file is required");
  }
  if (kind === "pdf" && input.files.length !== 1) {
    throw new ValidationError("Exactly one PDF file is required");
  }

  if (kind === "jpeg-pages" && input.files.length < 1) {
    throw new ValidationError("At least one JPEG file is required");
  }

  return {
    kind,
    files: [...input.files],
  };
}

function inferKindFromMetadata(
  filename: string,
  mimetype: string,
): UploadedDocumentKind | undefined {
  const lowerFilename = filename.toLowerCase();
  const lowerMimetype = mimetype.toLowerCase();

  if (lowerMimetype === "application/pdf" && lowerFilename.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    lowerMimetype === "image/jpeg" &&
    (lowerFilename.endsWith(".jpg") || lowerFilename.endsWith(".jpeg"))
  ) {
    return "jpeg-pages";
  }

  return undefined;
}

function inferKindFromSignature(bytes: Uint8Array): UploadedDocumentKind | undefined {
  if (startsWith(bytes, pdfSignature)) {
    return "pdf";
  }

  if (startsWith(bytes, jpegSignature)) {
    return "jpeg-pages";
  }

  return undefined;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((value, index) => bytes[index] === value);
}
