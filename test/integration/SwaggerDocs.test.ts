import { describe, expect, it } from "vitest";
import type { OpenAPIV3 } from "openapi-types";

import { createTestServer } from "./TestServer.js";

describe("Swagger docs", () => {
  it("documents the ApiToken authentication scheme for protected endpoints", async () => {
    const server = await createTestServer();
    await server.ready();

    const openapi = server.swagger() as unknown as OpenAPIV3.Document;
    expect(openapi.components?.securitySchemes?.["Authentication"]).toEqual({
      type: "apiKey",
      in: "header",
      name: "Authorization",
      description: "Use `Authorization: ApiToken <token>` to access protected endpoints.",
    });

    expect(openapi.paths["/api/jobs"]?.post?.security).toEqual([{ Authentication: [] }]);
    expect(openapi.paths["/api/jobs/extract-form"]?.post?.security).toEqual([
      { Authentication: [] },
    ]);
    expect(openapi.paths["/api/jobs/extract-form/{formType}"]?.post?.security).toEqual([
      { Authentication: [] },
    ]);
    expect(openapi.paths["/api/example-items"]?.get?.security).toEqual([{ Authentication: [] }]);
    expect(openapi.paths["/api/health"]?.get?.security).toBeUndefined();

    await server.close();
  });
});
