import { describe, expect, it, vi } from "vitest";

import { authHeaders, createTestServer } from "./TestServer.js";

describe("Job routes", () => {
  it("POST /api/jobs returns unauthorized without auth", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        type: "extract_form",
        input: {},
      },
    });

    expect(response.statusCode).toBe(401);

    await server.close();
  });

  it("GET /api/jobs/:id returns unauthorized without auth", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/jobs/00000000-0000-4000-8000-000000000001",
    });

    expect(response.statusCode).toBe(401);

    await server.close();
  });

  it("rejects unknown job types", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: authHeaders,
      payload: {
        type: "unknown",
        input: {},
      },
    });

    expect(response.statusCode).toBe(400);

    await server.close();
  });

  it("rejects invalid input", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: authHeaders,
      payload: {
        type: "",
        input: {},
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: string; message: string; issues: unknown[] }>();
    expect(body).toMatchObject({
      error: "Bad Request",
      message: "Invalid request payload",
    });
    expect(body.issues).toBeDefined();

    await server.close();
  });

  it("creates a queued count_example_items job from the generic route", async () => {
    const nudgeJobWorker = vi.fn();
    const server = await createTestServer({}, { nudgeJobWorker });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: authHeaders,
      payload: {
        type: "count_example_items",
        input: {
          sleepMs: 0,
        },
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json<{ id: string; type: string; status: string; statusUrl: string }>();
    expect(body.type).toBe("count_example_items");
    expect(body.status).toBe("queued");
    expect(body.statusUrl).toBe(`/api/jobs/${body.id}`);
    expect(nudgeJobWorker).toHaveBeenCalledTimes(1);

    await server.close();
  });

  it("stores the forwarded DHIS2 username as createdBy on generic jobs", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: {
        ...authHeaders,
        "x-forwarded-user": "system",
      },
      payload: {
        type: "count_example_items",
        input: {
          sleepMs: 0,
        },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      createdBy: "system",
    });

    await server.close();
  });

  it("rejects extract_form on the generic job route", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: authHeaders,
      payload: {
        type: "extract_form",
        input: {
          formType: "end-of-season",
          document: {
            bundleId: "bundle-1",
            createdAt: "2026-01-01T12:00:00.000Z",
            kind: "pdf",
            files: [
              {
                bundleId: "bundle-1",
                storageKey: "bundle-1/001.pdf",
                originalFilename: "form.pdf",
                mimetype: "application/pdf",
                size: 1024,
                sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
              },
            ],
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);

    await server.close();
  });

  it("returns 404 for a missing job", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/jobs/00000000-0000-4000-8000-000000000001",
      headers: authHeaders,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "Not Found",
      message: "Job not found",
    });

    await server.close();
  });

  it("does not implement GET /api/jobs", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "GET",
      url: "/api/jobs",
      headers: authHeaders,
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });
});
