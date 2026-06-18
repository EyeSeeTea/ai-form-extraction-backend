import { describe, expect, it, vi } from "vitest";

import { authHeaders, createTestServer } from "./TestServer.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Job routes", () => {
  it("POST /api/jobs returns unauthorized without auth", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        type: "extract_form",
        input: {
          formId: "form-1",
          sourceUrl: "https://example.org/forms/1",
        },
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
        type: "extract_form",
        input: {
          formId: "",
          sourceUrl: "not-a-url",
        },
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

  it("creates and retrieves a job", async () => {
    const server = await createTestServer();
    const createdResponse = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: authHeaders,
      payload: {
        type: "extract_form",
        input: {
          formId: "form-1",
          sourceUrl: "https://example.org/forms/1",
        },
      },
    });

    expect(createdResponse.statusCode).toBe(202);
    const created = createdResponse.json<{
      id: string;
      type: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      statusUrl: string;
    }>();

    expect(created.id).toMatch(uuidPattern);
    expect(created).toMatchObject({
      type: "extract_form",
      status: "queued",
      statusUrl: `/api/jobs/${created.id}`,
    });

    const getResponse = await server.inject({
      method: "GET",
      url: `/api/jobs/${created.id}`,
      headers: authHeaders,
    });

    expect(getResponse.statusCode).toBe(200);
    const job = getResponse.json<Record<string, unknown>>();
    expect(job).toMatchObject({
      id: created.id,
      type: "extract_form",
      status: "queued",
    });
    expect(job).not.toHaveProperty("input");
    expect(job).not.toHaveProperty("lockedAt");
    expect(job).not.toHaveProperty("lockedBy");
    expect(job).not.toHaveProperty("lastErrorJson");
    expect(job).not.toHaveProperty("inputJson");

    await server.close();
  });

  it("nudges the worker after creating a job", async () => {
    const nudgeJobWorker = vi.fn();
    const server = await createTestServer({}, { nudgeJobWorker });
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs",
      headers: authHeaders,
      payload: {
        type: "extract_form",
        input: {
          formId: "form-2",
          sourceUrl: "https://example.org/forms/2",
        },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(nudgeJobWorker).toHaveBeenCalledTimes(1);

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
