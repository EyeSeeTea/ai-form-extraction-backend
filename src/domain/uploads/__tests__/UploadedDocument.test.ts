import { describe, expect, it } from "vitest";

import { validateUploadedDocumentInput } from "../UploadedDocument.js";
import { getEitherSuccess } from "../../entities/generic/__tests__/EitherTestUtils.js";

describe("validateUploadedDocumentInput", () => {
  it("preserves the submitted file order", () => {
    const result = getEitherSuccess(
      validateUploadedDocumentInput({
        maxFiles: 5,
        maxFileSizeBytes: 1024,
        files: [
          {
            filename: "second.jpg",
            mimetype: "image/jpeg",
            size: 4,
            bytes: jpegBytes(0x21),
          },
          {
            filename: "first.jpg",
            mimetype: "image/jpeg",
            size: 4,
            bytes: jpegBytes(0x22),
          },
        ],
      }),
    );

    expect(result.kind).toBe("jpeg-pages");
    expect(result.files.map((file) => file.filename)).toEqual(["second.jpg", "first.jpg"]);
  });

  it("rejects files whose declared size does not match the content length", () => {
    const result = validateUploadedDocumentInput({
      maxFiles: 5,
      maxFileSizeBytes: 1024,
      files: [
        {
          filename: "form.pdf",
          mimetype: "application/pdf",
          size: 99,
          bytes: pdfBytes(),
        },
      ],
    });

    expect(result.isError()).toBe(true);
    expect(result.value).toMatchObject({
      type: "error",
      error: { message: "Uploaded file form.pdf size does not match its content length" },
    });
  });
});

function pdfBytes() {
  return Buffer.from("%PDF");
}

function jpegBytes(seed: number) {
  return Buffer.from([0xff, 0xd8, 0xff, seed]);
}
