import { describe, expect, it } from "vitest";

import { authHeaders, createTestServer } from "./TestServer.js";

/* The DHIS2 route proxy discards the caller's Content-Type and forwards bodies as
   text/plain;charset=ISO-8859-1, so JSON arriving that way must still be parsed. */
describe("text/plain JSON bodies", () => {
  it("parses a JSON body forwarded as text/plain", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/example-items",
      headers: { ...authHeaders, "content-type": "text/plain;charset=ISO-8859-1" },
      payload: JSON.stringify({ name: "Routed item" }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "Routed item" });

    await server.close();
  });

  it("still validates a parsed text/plain body against the route schema", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/example-items",
      headers: { ...authHeaders, "content-type": "text/plain" },
      payload: JSON.stringify({ name: "" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Bad Request",
      message: "Invalid request payload",
    });

    await server.close();
  });

  it("rejects a text/plain body that is not JSON", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/extract-form/end-of-season",
      headers: { ...authHeaders, "content-type": "text/plain" },
      payload: "not json at all",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Bad Request" });

    await server.close();
  });
});
