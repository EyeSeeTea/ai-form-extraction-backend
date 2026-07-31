import { describe, expect, it } from "vitest";

import { validateUploadedDocumentInput } from "../UploadedDocument.js";

describe("validateUploadedDocumentInput", () => {
  it("preserves the submitted file order", () => {
    const result = validateUploadedDocumentInput({
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
    });

    expect(result.kind).toBe("jpeg-pages");
    expect(result.files.map((file) => file.filename)).toEqual(["second.jpg", "first.jpg"]);
  });

  it("rejects files whose declared size does not match the content length", () => {
    expect(() =>
      validateUploadedDocumentInput({
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
      }),
    ).toThrow("size does not match");
  });
});

function pdfBytes() {
  return Buffer.from("%PDF");
}

function jpegBytes(seed: number) {
  return Buffer.from([0xff, 0xd8, 0xff, seed]);
}
