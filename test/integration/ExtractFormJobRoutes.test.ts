import { describe, expect, it, vi } from "vitest";

import { authHeaders, createTestServer } from "./TestServer.js";

describe("Extract form job routes", () => {
  it("rejects unauthorized multipart requests", async () => {
    const server = await createTestServer();
    const { payload } = buildPdfMultipartRequest();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      payload,
      headers: {
        "content-type": "multipart/form-data; boundary=----boundary-001",
      },
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it("rejects missing formType", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([filePart("files", "page-001.pdf", "application/pdf", pdfBytes())]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects unknown formType", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "unknown"),
        filePart("files", "page-001.pdf", "application/pdf", pdfBytes()),
      ]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects requests without files", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([textPart("formType", "end-of-season")]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("creates a queued job for a valid PDF upload", async () => {
    const nudgeJobWorker = vi.fn();
    const server = await createTestServer({}, { nudgeJobWorker });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "end-of-season"),
        filePart("files", "form.pdf", "application/pdf", pdfBytes()),
      ]),
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ id: string; status: string; statusUrl: string }>();
    expect(body.status).toBe("queued");
    expect(body.statusUrl).toBe(`/api/jobs/${body.id}`);
    expect(nudgeJobWorker).toHaveBeenCalledTimes(1);

    const jobResponse = await server.inject({
      method: "GET",
      url: `/api/jobs/${body.id}`,
      headers: authHeaders,
    });
    expect(jobResponse.statusCode).toBe(200);
    expect(jobResponse.json()).toMatchObject({
      id: body.id,
      type: "extract_form",
      status: "queued",
    });

    await server.close();
  });

  it("accepts multipart payloads larger than Fastify's default body limit", async () => {
    const server = await createTestServer({
      UPLOAD_MAX_FILE_SIZE_BYTES: 2_000_000,
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "end-of-season"),
        filePart("files", "form.pdf", "application/pdf", pdfBytes(1_200_000)),
      ]),
    });

    expect(response.statusCode).toBe(202);

    await server.close();
  });

  it("creates a queued job for multiple JPEG uploads in order", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "end-of-season"),
        filePart("files", "page-001.jpg", "image/jpeg", jpegBytes(1)),
        filePart("files", "page-002.jpg", "image/jpeg", jpegBytes(2)),
      ]),
    });

    expect(response.statusCode).toBe(202);

    await server.close();
  });

  it("rejects mixed PDF and JPEG uploads", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "end-of-season"),
        filePart("files", "form.pdf", "application/pdf", pdfBytes()),
        filePart("files", "page-001.jpg", "image/jpeg", jpegBytes(1)),
      ]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects unsupported uploads", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "end-of-season"),
        filePart("files", "notes.txt", "text/plain", Buffer.from("hello")),
      ]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects MIME and signature mismatches", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      ...buildMultipartRequest([
        textPart("formType", "end-of-season"),
        filePart("files", "page-001.jpg", "image/jpeg", pdfBytes()),
      ]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });
});

function buildPdfMultipartRequest() {
  const { payload } = buildMultipartRequest(
    [
      textPart("formType", "end-of-season"),
      filePart("files", "form.pdf", "application/pdf", pdfBytes()),
    ],
    false,
  );
  return { payload };
}

function buildMultipartRequest(
  parts: (
    | { readonly type: "text"; readonly name: string; readonly value: string }
    | {
        readonly type: "file";
        readonly name: string;
        readonly filename: string;
        readonly contentType: string;
        readonly bytes: Buffer;
      }
  )[],
  includeAuthHeaders = true,
) {
  const boundary = "----boundary-001";
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));

    if (part.type === "text") {
      chunks.push(
        Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`),
      );
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.contentType}\r\n\r\n`,
        ),
      );
      chunks.push(part.bytes);
      chunks.push(Buffer.from("\r\n"));
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    headers: includeAuthHeaders
      ? {
          ...authHeaders,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        }
      : {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
    payload: Buffer.concat(chunks),
  };
}

function textPart(name: string, value: string) {
  return { type: "text" as const, name, value };
}

function filePart(name: string, filename: string, contentType: string, bytes: Buffer) {
  return { type: "file" as const, name, filename, contentType, bytes };
}

function pdfBytes(size = 0) {
  const header = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
  if (size <= header.length) {
    return header;
  }

  return Buffer.concat([header, Buffer.alloc(size - header.length, 0x20)]);
}

function jpegBytes(seed: number) {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, seed, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}
