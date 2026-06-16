import { createServer } from "../../src/api/Server.js";
import type { CompositionRoot } from "../../src/CompositionRoot.js";
import type { Environment } from "../../src/config/Environment.js";
import { CreateExampleItemUseCase } from "../../src/domain/usecases/CreateExampleItemUseCase.js";
import { GetHealthUseCase } from "../../src/domain/usecases/GetHealthUseCase.js";
import { GetReadinessUseCase } from "../../src/domain/usecases/GetReadinessUseCase.js";
import { ListExampleItemsUseCase } from "../../src/domain/usecases/ListExampleItemsUseCase.js";
import { UpdateExampleItemUseCase } from "../../src/domain/usecases/UpdateExampleItemUseCase.js";
import { createLogger } from "../../src/shared/Logger.js";
import { createExampleItemMockRepository } from "../mocks/ExampleItemMockRepository.js";
import { createHealthMockRepository } from "../mocks/HealthMockRepository.js";

export const testEnvironment: Environment = {
  NODE_ENV: "test",
  SERVICE_NAME: "service-under-test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_PATH: ":memory:",
  CORS_ORIGIN: "*",
  OTEL_ENABLED: false,
};

export function createTestCompositionRoot(): CompositionRoot {
  const mockRepository = createExampleItemMockRepository([
    {
      id: "8d3f5491-4ddc-44f8-ae8f-dc7e351808e4",
      name: "Initial item",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ]);

  return {
    health: {
      getHealth: new GetHealthUseCase(testEnvironment.SERVICE_NAME),
      getReadiness: new GetReadinessUseCase(createHealthMockRepository()),
    },
    exampleItems: {
      listExampleItems: new ListExampleItemsUseCase(mockRepository),
      createExampleItem: new CreateExampleItemUseCase(mockRepository),
      updateExampleItem: new UpdateExampleItemUseCase(mockRepository),
    },
    close: async () => {},
  };
}

export async function createTestServer() {
  return createServer(testEnvironment, createLogger(testEnvironment), createTestCompositionRoot());
}
