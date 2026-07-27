import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { authenticate } from "../../src/api/middleware/Authenticate.js";

describe("authenticate middleware", () => {
  it("rejects requests without the configured auth token", async () => {
    const server = createAuthenticatedServer("expected-token");

    const response = await server.inject({ method: "GET", url: "/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
      message: "Unauthorized",
    });

    await server.close();
  });

  it("rejects requests without the ApiToken authorization scheme", async () => {
    const server = createAuthenticatedServer("expected-token");

    const response = await server.inject({
      method: "GET",
      url: "/me",
      headers: {
        authorization: "expected-token",
      },
    });

    expect(response.statusCode).toBe(401);

    await server.close();
  });

  it("accepts an ApiToken authorization header and saves the forwarded DHIS2 username", async () => {
    const server = createAuthenticatedServer("expected-token");

    const response = await server.inject({
      method: "GET",
      url: "/me",
      headers: {
        authorization: "ApiToken expected-token",
        "x-forwarded-user": "system",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      dhis2Username: "system",
    });

    await server.close();
  });
});

function createAuthenticatedServer(authToken: string) {
  const server = Fastify({ logger: false });

  server.decorateRequest("dhis2Username");
  server.addHook("onRequest", authenticate(authToken));
  server.get("/me", async (request): Promise<{ dhis2Username?: string }> => {
    return request.dhis2Username ? { dhis2Username: request.dhis2Username } : {};
  });

  return server;
}
