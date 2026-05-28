import { describe, expect, it } from "vitest";

import { createTestServer } from "./TestServer.js";

describe("ExampleItem routes", () => {
  it("GET /api/example-items returns all items", async () => {
    const server = await createTestServer();
    const response = await server.inject({ method: "GET", url: "/api/example-items" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: "8d3f5491-4ddc-44f8-ae8f-dc7e351808e4",
          name: "Initial item",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    await server.close();
  });

  it("POST /api/example-items creates an item", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/example-items",
      payload: { name: "Created item" },
    });

    expect(response.statusCode).toBe(201);
    const created = response.json<{ id: string; name: string; createdAt: string }>();
    expect(created).toMatchObject({ name: "Created item" });
    expect(created.id).toBeDefined();
    expect(created.createdAt).toBeDefined();

    await server.close();
  });

  it("PUT /api/example-items/:id updates an existing item", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "PUT",
      url: "/api/example-items/8d3f5491-4ddc-44f8-ae8f-dc7e351808e4",
      payload: { name: "Updated item" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "8d3f5491-4ddc-44f8-ae8f-dc7e351808e4",
      name: "Updated item",
    });

    await server.close();
  });

  it("PUT /api/example-items/:id returns 404 when item does not exist", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "PUT",
      url: "/api/example-items/00000000-0000-0000-0000-000000000000",
      payload: { name: "Ghost" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "Not Found" });

    await server.close();
  });

  it("POST /api/example-items returns 400 for invalid payload", async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/example-items",
      payload: { name: "" },
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
});
