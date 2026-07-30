import { describe, expect, it, vi } from "vitest";

import { createJobMockRepository } from "../mocks/JobMockRepository.js";
import { authHeaders, createTestServer } from "./TestServer.js";

type ErrorResponseBody = Readonly<{
  error: string;
  message: string;
  requestId?: string;
}>;

type ValidationIssue = Readonly<{
  keyword: string;
  instancePath: string;
  schemaPath: string;
  message: string;
  params: Record<string, unknown>;
}>;

type ValidationErrorResponseBody = ErrorResponseBody &
  Readonly<{
    issues: readonly ValidationIssue[];
  }>;

describe("Extract form job routes", () => {
  it("rejects unauthorized multipart requests", async () => {
    const server = await createTestServer();
    const { payload } = buildPdfMultipartRequest();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/end-of-season",
      payload,
      headers: {
        "content-type": "multipart/form-data; boundary=----boundary-001",
      },
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it("creates a queued generic extraction job from JSON input", async () => {
    const nudgeJobWorker = vi.fn();
    const server = await createTestServer({}, { nudgeJobWorker });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: createGenericExtractRequest(),
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      type: "generic_extract_form",
      status: "queued",
      createdBy: null,
    });
    expect(nudgeJobWorker).toHaveBeenCalledTimes(1);

    await server.close();
  });

  it("defaults the generic extraction profile to default", async () => {
    const jobRepository = createJobMockRepository();
    const createSpy = vi.spyOn(jobRepository, "create");
    const server = await createTestServer({}, { jobRepository });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: createGenericExtractRequest(),
    });

    expect(response.statusCode).toBe(202);
    const createCall: Parameters<typeof jobRepository.create>[0] | undefined =
      createSpy.mock.calls[0]?.[0];
    expect(createCall?.type).toBe("generic_extract_form");
    expect(createCall?.input).toMatchObject({
      profile: "default",
      confidence: false,
    });
    await server.close();
  });

  it("stores confidence when a generic extraction request enables it", async () => {
    const jobRepository = createJobMockRepository();
    const createSpy = vi.spyOn(jobRepository, "create");
    const server = await createTestServer({}, { jobRepository });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: createGenericExtractRequest({ confidence: true }),
    });

    expect(response.statusCode).toBe(202);
    const createCall: Parameters<typeof jobRepository.create>[0] | undefined =
      createSpy.mock.calls[0]?.[0];
    expect(createCall?.input).toMatchObject({ confidence: true });
    await server.close();
  });

  it("rejects unknown formType from the path", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/unknown",
      ...buildMultipartRequest([filePart("files", "page-001.pdf", "application/pdf", pdfBytes())]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects requests without files", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("creates a queued job for a valid PDF upload", async () => {
    const nudgeJobWorker = vi.fn();
    const server = await createTestServer({}, { nudgeJobWorker });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([filePart("files", "form.pdf", "application/pdf", pdfBytes())]),
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

  it("stores the forwarded DHIS2 username as createdBy on extract form jobs", async () => {
    const server = await createTestServer();
    const request = buildMultipartRequest([
      filePart("files", "form.pdf", "application/pdf", pdfBytes()),
    ]);
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/end-of-season",
      headers: {
        "x-forwarded-user": "system",
        ...request.headers,
      },
      payload: request.payload,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      createdBy: "system",
    });

    await server.close();
  });

  it("accepts multipart payloads larger than Fastify's default body limit", async () => {
    const server = await createTestServer({
      UPLOAD_MAX_FILE_SIZE_BYTES: 2_000_000,
    });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([
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
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([
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
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([
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
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([
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
      url: "/api/jobs/extract-form/end-of-season",
      ...buildMultipartRequest([filePart("files", "page-001.jpg", "image/jpeg", pdfBytes())]),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects generic extraction requests with missing inputFiles", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: {
        form: "caller-label",
        prompt: "Extract visible values",
        outputSchema: {
          type: "object",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ValidationErrorResponseBody>();
    expect(body.error).toBe("Bad Request");
    expect(body.message).toBe("Invalid request payload");
    expect(Array.isArray(body.issues)).toBe(true);
    await server.close();
  });

  it("rejects generic extraction requests with invalid base64", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: createGenericExtractRequest({ contents: "not-base64" }),
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorResponseBody>();
    expect(body).toMatchObject({
      error: "Bad Request",
      message: "Invalid base64 file contents",
    });
    await server.close();
  });

  it("rejects generic extraction requests with non-default profiles", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: createGenericExtractRequest({ profile: "experimental" }),
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ValidationErrorResponseBody>();
    expect(body.error).toBe("Bad Request");
    expect(body.message).toBe("Invalid request payload");
    expect(Array.isArray(body.issues)).toBe(true);
    await server.close();
  });

  it("rejects generic extraction requests with unsupported MIME types", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: createGenericExtractRequest({
        filename: "notes.txt",
        mimeType: "text/plain",
      }),
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("rejects generic extraction requests with non-object outputSchema roots", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form",
      headers: authHeaders,
      payload: {
        ...createGenericExtractRequest(),
        outputSchema: {
          type: "string",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ValidationErrorResponseBody>();
    expect(body.error).toBe("Bad Request");
    expect(body.message).toBe("Invalid request payload");
    expect(Array.isArray(body.issues)).toBe(true);
    await server.close();
  });
});

function buildPdfMultipartRequest() {
  const { payload } = buildMultipartRequest(
    [filePart("files", "form.pdf", "application/pdf", pdfBytes())],
    false,
  );
  return { payload };
}

function buildMultipartRequest(
  parts: (
    | Readonly<{ type: "text"; name: string; value: string }>
    | Readonly<{
        type: "file";
        name: string;
        filename: string;
        contentType: string;
        bytes: Buffer;
      }>
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

function createGenericExtractRequest(
  overrides: Partial<
    Readonly<{
      contents: string;
      filename: string;
      mimeType: "application/pdf" | "image/jpeg" | "text/plain";
      profile: string;
      confidence: boolean;
    }>
  > = {},
) {
  return {
    form: "caller-label",
    ...(overrides.profile ? { profile: overrides.profile } : {}),
    ...(overrides.confidence === undefined ? {} : { confidence: overrides.confidence }),
    inputFiles: [
      {
        contents: overrides.contents ?? pdfBytes().toString("base64"),
        mimeType: overrides.mimeType ?? "application/pdf",
        filename: overrides.filename ?? "form.pdf",
      },
    ],
    prompt: "Extract visible values",
    outputSchema: {
      type: "object",
      properties: {
        country: { type: "string" },
      },
    },
  };
}
