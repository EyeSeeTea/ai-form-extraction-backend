import type { Environment } from "./config/Environment.js";
import { createDatabaseClient, type DatabaseClient } from "./data/database/Database.js";
import { ExampleItemDatabaseRepository } from "./data/repositories/ExampleItemDatabaseRepository.js";
import { JobDatabaseRepository } from "./data/repositories/JobDatabaseRepository.js";
import { HealthDatabaseRepository } from "./data/repositories/HealthDatabaseRepository.js";
import { UuidIdGenerator } from "./data/utils/IdGenerator.js";
import { ClaimNextJobUseCase } from "./domain/usecases/jobs/ClaimNextJobUseCase.js";
import { CompleteJobUseCase } from "./domain/usecases/jobs/CompleteJobUseCase.js";
import { CreateExampleItemUseCase } from "./domain/usecases/CreateExampleItemUseCase.js";
import { CreateJobUseCase } from "./domain/usecases/jobs/CreateJobUseCase.js";
import { ExtractFormUseCase } from "./domain/usecases/ExtractFormUseCase.js";
import { GetHealthUseCase } from "./domain/usecases/GetHealthUseCase.js";
import { GetJobUseCase } from "./domain/usecases/jobs/GetJobUseCase.js";
import { GetReadinessUseCase } from "./domain/usecases/GetReadinessUseCase.js";
import { RecordJobFailureUseCase } from "./domain/usecases/jobs/RecordJobFailureUseCase.js";
import { ListExampleItemsUseCase } from "./domain/usecases/ListExampleItemsUseCase.js";
import { UpdateExampleItemUseCase } from "./domain/usecases/UpdateExampleItemUseCase.js";

export type CompositionRoot = {
  readonly health: {
    readonly getHealth: GetHealthUseCase;
    readonly getReadiness: GetReadinessUseCase;
  };
  readonly exampleItems: {
    readonly listExampleItems: ListExampleItemsUseCase;
    readonly createExampleItem: CreateExampleItemUseCase;
    readonly updateExampleItem: UpdateExampleItemUseCase;
  };
  readonly jobs: {
    readonly createJob: CreateJobUseCase;
    readonly getJob: GetJobUseCase;
    readonly claimNextJob: ClaimNextJobUseCase;
    readonly completeJob: CompleteJobUseCase;
    readonly recordJobFailure: RecordJobFailureUseCase;
    readonly extractForm: ExtractFormUseCase;
    nudgeJobWorker: () => void;
  };
  close(): Promise<void>;
};

export function createCompositionRoot(environment: Environment): CompositionRoot {
  const databaseClient = createDatabaseClient(environment.DATABASE_PATH);
  return createCompositionRootFromDatabaseClient(environment, databaseClient);
}

export function createCompositionRootFromDatabaseClient(
  environment: Environment,
  databaseClient: DatabaseClient,
): CompositionRoot {
  const idGenerator = new UuidIdGenerator();
  const healthRepository = new HealthDatabaseRepository(databaseClient.db);
  const exampleItemRepository = new ExampleItemDatabaseRepository(databaseClient.db, idGenerator);
  const jobRepository = new JobDatabaseRepository(databaseClient.db, idGenerator);
  const extractFormUseCase = new ExtractFormUseCase();

  return {
    health: {
      getHealth: new GetHealthUseCase(environment.SERVICE_NAME),
      getReadiness: new GetReadinessUseCase(healthRepository),
    },
    exampleItems: {
      listExampleItems: new ListExampleItemsUseCase(exampleItemRepository),
      createExampleItem: new CreateExampleItemUseCase(exampleItemRepository),
      updateExampleItem: new UpdateExampleItemUseCase(exampleItemRepository),
    },
    jobs: {
      createJob: new CreateJobUseCase(jobRepository),
      getJob: new GetJobUseCase(jobRepository),
      claimNextJob: new ClaimNextJobUseCase(jobRepository),
      completeJob: new CompleteJobUseCase(jobRepository),
      recordJobFailure: new RecordJobFailureUseCase(jobRepository),
      extractForm: extractFormUseCase,
      nudgeJobWorker: () => {},
    },
    close: () => databaseClient.close(),
  };
}
