import { describe, expect, it } from "vitest";

import { createTestServer } from "./TestServer.js";

describe("Health routes", () => {
  it("GET /api/health returns service status", async () => {
    const server = await createTestServer();
    const response = await server.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "service-under-test", status: "ok" });

    await server.close();
  });

  it("GET /api/ready returns readiness status", async () => {
    const server = await createTestServer();
    const response = await server.inject({ method: "GET", url: "/api/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ready" });

    await server.close();
  });

  it("does not fail when CORS is disabled with an empty origin", async () => {
    const server = await createTestServer({ CORS_ORIGIN: "" });
    const response = await server.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();

    await server.close();
  });
});
