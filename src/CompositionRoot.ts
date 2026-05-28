import type { Environment } from "./config/Environment.js";
import { createDatabaseClient, type DatabaseClient } from "./data/database/Database.js";
import { ExampleItemDatabaseRepository } from "./data/repositories/ExampleItemDatabaseRepository.js";
import { HealthDatabaseRepository } from "./data/repositories/HealthDatabaseRepository.js";
import { GetHealthUseCase } from "./domain/usecases/GetHealthUseCase.js";
import { GetReadinessUseCase } from "./domain/usecases/GetReadinessUseCase.js";
import { ListExampleItemsUseCase } from "./domain/usecases/ListExampleItemsUseCase.js";
import { SaveExampleItemUseCase } from "./domain/usecases/SaveExampleItemUseCase.js";

export type CompositionRoot = {
  readonly health: {
    readonly getHealth: GetHealthUseCase;
    readonly getReadiness: GetReadinessUseCase;
  };
  readonly exampleItems: {
    readonly listExampleItems: ListExampleItemsUseCase;
    readonly saveExampleItem: SaveExampleItemUseCase;
  };
  close(): Promise<void>;
};

export function createCompositionRoot(environment: Environment): CompositionRoot {
  const databaseClient = createDatabaseClient(environment.DATABASE_URL);
  return createCompositionRootFromDatabaseClient(environment, databaseClient);
}

export function createCompositionRootFromDatabaseClient(
  environment: Environment,
  databaseClient: DatabaseClient,
): CompositionRoot {
  const healthRepository = new HealthDatabaseRepository(databaseClient);
  const exampleItemRepository = new ExampleItemDatabaseRepository(databaseClient.db);

  return {
    health: {
      getHealth: new GetHealthUseCase(environment.SERVICE_NAME),
      getReadiness: new GetReadinessUseCase(healthRepository),
    },
    exampleItems: {
      listExampleItems: new ListExampleItemsUseCase(exampleItemRepository),
      saveExampleItem: new SaveExampleItemUseCase(exampleItemRepository),
    },
    close: () => databaseClient.close(),
  };
}
