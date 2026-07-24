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

    const succeededJobSchema = openapi.components?.schemas?.["Job"];
    expect(succeededJobSchema).toBeDefined();
    const succeededVariants = (succeededJobSchema as OpenAPIV3.SchemaObject)
      .anyOf as OpenAPIV3.SchemaObject[];
    const succeededVariant = succeededVariants.find(
      (variant) =>
        (variant.properties?.["status"] as unknown as Record<string, unknown> | undefined)?.[
          "const"
        ] === "succeeded",
    );
    expect(succeededVariant).toBeDefined();
    const resultSchema = succeededVariant?.properties?.["result"] as OpenAPIV3.SchemaObject;
    expect(resultSchema.description).toContain("fieldConfidence");

    const extractionJobResultSchema = openapi.components?.schemas?.[
      "ExtractionJobResult"
    ] as OpenAPIV3.SchemaObject;
    expect(extractionJobResultSchema.properties?.["fieldConfidence"]).toMatchObject({
      type: "object",
      additionalProperties: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    });
    expect(extractionJobResultSchema.properties?.["diagnostics"]).toBeDefined();

    await server.close();
  });
});
