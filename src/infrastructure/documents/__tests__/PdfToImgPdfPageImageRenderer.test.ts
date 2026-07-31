import { describe, expect, it } from "vitest";

import { PdfToImgPdfPageImageRenderer } from "../PdfToImgPdfPageImageRenderer.js";

describe("PdfToImgPdfPageImageRenderer", () => {
  it("renders one PNG image from a one-page PDF", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    const images = await renderer
      .render({
        bytes: createPdfDocument([{ images: [rgbPixel(255, 0, 0)] }]),
        maxPages: 10,
        maxRenderedPages: 10,
      })
      .toPromise();

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      pageNumber: 1,
      mediaType: "image/png",
    });
    expect(images[0]?.bytes.slice(0, pngSignature.length)).toEqual(Buffer.from(pngSignature));
  });

  it("preserves page order for multi-page PDFs", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    const images = await renderer
      .render({
        bytes: createPdfDocument([
          { images: [rgbPixel(255, 0, 0)] },
          { images: [rgbPixel(0, 255, 0)] },
        ]),
        maxPages: 10,
        maxRenderedPages: 10,
      })
      .toPromise();

    expect(images.map((image) => image.pageNumber)).toEqual([1, 2]);
    expect(images[0]?.bytes).not.toEqual(images[1]?.bytes);
  });

  it("renders one image for a page with multiple embedded images", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    const images = await renderer
      .render({
        bytes: createPdfDocument([
          {
            images: [rgbPixel(255, 0, 0), rgbPixel(0, 0, 255)],
          },
        ]),
        maxPages: 10,
        maxRenderedPages: 10,
      })
      .toPromise();

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      pageNumber: 1,
      mediaType: "image/png",
    });
  });

  it("enforces the maximum page count", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    await expect(
      renderer
        .render({
          bytes: createPdfDocument([
            { images: [rgbPixel(255, 0, 0)] },
            { images: [rgbPixel(0, 255, 0)] },
          ]),
          maxPages: 1,
          maxRenderedPages: 10,
        })
        .toPromise(),
    ).rejects.toMatchObject({ code: "pdf_document_exceeds_max_pages" });
  });

  it("enforces the maximum rendered page count", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    await expect(
      renderer
        .render({
          bytes: createPdfDocument([
            { images: [rgbPixel(255, 0, 0)] },
            { images: [rgbPixel(0, 0, 255)] },
          ]),
          maxPages: 10,
          maxRenderedPages: 1,
        })
        .toPromise(),
    ).rejects.toMatchObject({ code: "pdf_document_exceeds_max_rendered_pages" });
  });

  it("renders blank pages with no embedded images", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    const images = await renderer
      .render({
        bytes: createPdfDocument([{ images: [] }]),
        maxPages: 10,
        maxRenderedPages: 10,
      })
      .toPromise();

    expect(images).toHaveLength(1);
    expect(images[0]?.bytes.slice(0, pngSignature.length)).toEqual(Buffer.from(pngSignature));
  });

  it("throws a deterministic error for an empty PDF", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    await expect(
      renderer
        .render({
          bytes: createEmptyPdfDocument(),
          maxPages: 10,
          maxRenderedPages: 10,
        })
        .toPromise(),
    ).rejects.toMatchObject({ code: "pdf_document_contains_no_pages" });
  });

  it("throws a clear error for invalid PDF bytes", async () => {
    const renderer = new PdfToImgPdfPageImageRenderer();
    await expect(
      renderer
        .render({
          bytes: Uint8Array.from([0x00, 0x01, 0x02, 0x03]),
          maxPages: 10,
          maxRenderedPages: 10,
        })
        .toPromise(),
    ).rejects.toMatchObject({ code: "pdf_document_render_error" });
  });
});

type PdfPageSpec = {
  readonly images: readonly Uint8Array[];
};

function createPdfDocument(pages: readonly PdfPageSpec[]): Uint8Array {
  const objects: { readonly number: number; readonly body: Buffer }[] = [];
  const pageRecords = pages.map((page, pageIndex) => {
    const imageObjectNumbers = page.images.map(
      (_, imageIndex) => 3 + imageOffsetsBeforePage(pages, pageIndex) + imageIndex,
    );
    const contentObjectNumber = 3 + imageOffsetsBeforePage(pages, pageIndex) + page.images.length;
    const pageObjectNumber = contentObjectNumber + 1;
    return {
      page,
      imageObjectNumbers,
      contentObjectNumber,
      pageObjectNumber,
    };
  });

  objects.push({
    number: 1,
    body: Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
  });
  objects.push({
    number: 2,
    body: Buffer.from(
      `<< /Type /Pages /Kids [${pageRecords
        .map((record) => `${String(record.pageObjectNumber)} 0 R`)
        .join(" ")}] /Count ${String(pageRecords.length)} >>`,
    ),
  });

  for (const record of pageRecords) {
    for (const [index, imageBytes] of record.page.images.entries()) {
      const objectNumber = record.imageObjectNumbers[index];
      if (!objectNumber) {
        throw new Error("Image object number missing");
      }
      objects.push({
        number: objectNumber,
        body: createImageObjectBody(imageBytes),
      });
    }

    objects.push({
      number: record.contentObjectNumber,
      body: createStreamBody(createPageContent(record.imageObjectNumbers)),
    });

    objects.push({
      number: record.pageObjectNumber,
      body: Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << ${record.imageObjectNumbers
          .map((objectNumber, index) => `/Im${String(index)} ${String(objectNumber)} 0 R`)
          .join(" ")} >> >> /Contents ${String(record.contentObjectNumber)} 0 R >>`,
      ),
    });
  }

  return buildPdf(objects);
}

function imageOffsetsBeforePage(pages: readonly PdfPageSpec[], pageIndex: number): number {
  let offset = 0;
  for (let index = 0; index < pageIndex; index += 1) {
    offset += pages[index]?.images.length ?? 0;
    offset += 2;
  }
  return offset;
}

function buildPdf(objects: { readonly number: number; readonly body: Buffer }[]): Uint8Array {
  const header = Buffer.from("%PDF-1.7\n");
  const sortedObjects = [...objects].sort((left, right) => left.number - right.number);
  const objectBuffers = sortedObjects.map(({ number, body }) =>
    Buffer.concat([Buffer.from(`${String(number)} 0 obj\n`), body, Buffer.from("\nendobj\n")]),
  );

  let position = header.length;
  const offsets = objectBuffers.map((buffer) => {
    const offset = position;
    position += buffer.length;
    return offset;
  });

  const xrefStart = position;
  const xrefEntries = [
    "0000000000 65535 f \n",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
  ].join("");
  const trailer = `trailer << /Size ${String(sortedObjects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;

  return Uint8Array.from(
    Buffer.concat([
      header,
      ...objectBuffers,
      Buffer.from(`xref\n0 ${String(sortedObjects.length + 1)}\n${xrefEntries}${trailer}`),
    ]),
  );
}

function createEmptyPdfDocument(): Uint8Array {
  return buildPdf([
    {
      number: 1,
      body: Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    },
    {
      number: 2,
      body: Buffer.from("<< /Type /Pages /Kids [] /Count 0 >>"),
    },
  ]);
}

function createImageObjectBody(bytes: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${String(bytes.length)} >>\nstream\n`,
    ),
    Buffer.from(bytes),
    Buffer.from("\nendstream"),
  ]);
}

function createStreamBody(content: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from(`<< /Length ${String(content.length)} >>\nstream\n`),
    Buffer.from(content),
    Buffer.from("\nendstream"),
  ]);
}

function createPageContent(imageObjectNumbers: readonly number[]): Uint8Array {
  const parts: string[] = [];

  for (const [index] of imageObjectNumbers.entries()) {
    parts.push("q");
    parts.push(`1 0 0 1 ${String(index * 10)} 0 cm`);
    parts.push(`/Im${String(index)} Do`);
    parts.push("Q");
  }

  return Buffer.from(`${parts.join("\n")}\n`);
}

const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function rgbPixel(red: number, green: number, blue: number): Uint8Array {
  return Uint8Array.from([red, green, blue]);
}
