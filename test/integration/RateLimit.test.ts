import { describe, expect, it } from "vitest";

import { createTestServer } from "./TestServer.js";

describe("Rate limiting", () => {
  it("returns 429 after the configured limit is exceeded", async () => {
    const server = await createTestServer({
      RATE_LIMIT_MAX: 1,
      RATE_LIMIT_TIME_WINDOW_MS: 60_000,
    });

    const firstResponse = await server.inject({ method: "GET", url: "/api/health" });
    const secondResponse = await server.inject({ method: "GET", url: "/api/health" });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(429);
    const body = secondResponse.json<{ error: string; message: string }>();

    expect(body).toMatchObject({
      error: "Too Many Requests",
    });
    expect(body.message).toContain("Rate limit exceeded");
    expect(secondResponse.headers["retry-after"]).toBeDefined();

    await server.close();
  });
});
