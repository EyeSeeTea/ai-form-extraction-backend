import { describe, expect, it } from "vitest";

import { createServer } from "../../src/api/Server.js";
import type { CompositionRoot } from "../../src/CompositionRoot.js";
import type { Environment } from "../../src/config/Environment.js";
import { GetHealthUseCase } from "../../src/domain/usecases/GetHealthUseCase.js";
import { GetReadinessUseCase } from "../../src/domain/usecases/GetReadinessUseCase.js";
import { ListExampleItemsUseCase } from "../../src/domain/usecases/ListExampleItemsUseCase.js";
import { SaveExampleItemUseCase } from "../../src/domain/usecases/SaveExampleItemUseCase.js";
import { createLogger } from "../../src/shared/Logger.js";

const environment: Environment = {
  NODE_ENV: "test",
  SERVICE_NAME: "service-under-test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://app:app@localhost:5432/app",
  CORS_ORIGIN: "*",
  OTEL_ENABLED: false,
};

function createTestCompositionRoot(): CompositionRoot {
  const exampleItems = [
    {
      id: "8d3f5491-4ddc-44f8-ae8f-dc7e351808e4",
      name: "Initial item",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ];

  return {
    health: {
      getHealth: new GetHealthUseCase(environment.SERVICE_NAME),
      getReadiness: new GetReadinessUseCase({ check: async () => ({ reachable: true }) }),
    },
    exampleItems: {
      listExampleItems: new ListExampleItemsUseCase({
        list: async () => exampleItems,
        save: async () => {},
      }),
      saveExampleItem: new SaveExampleItemUseCase({
        list: async () => exampleItems,
        save: async (exampleItem) => {
          exampleItems.push(exampleItem);
        },
      }),
    },
    close: async () => {},
  };
}

describe("Server", () => {
  it("serves health checks", async () => {
    const server = await createServer(
      environment,
      createLogger(environment),
      createTestCompositionRoot(),
    );
    const response = await server.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "service-under-test", status: "ok" });

    await server.close();
  });

  it("serves example items", async () => {
    const server = await createServer(
      environment,
      createLogger(environment),
      createTestCompositionRoot(),
    );
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
});
