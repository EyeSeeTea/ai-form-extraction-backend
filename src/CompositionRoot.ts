import type { Environment } from "./config/Environment.js";
import { createDatabaseClient, type DatabaseClient } from "./data/database/Database.js";
import { ExampleItemDatabaseRepository } from "./data/repositories/ExampleItemDatabaseRepository.js";
import { JobDatabaseRepository } from "./data/repositories/JobDatabaseRepository.js";
import { HealthDatabaseRepository } from "./data/repositories/HealthDatabaseRepository.js";
import { UuidIdGenerator } from "./data/utils/IdGenerator.js";
import { LocalUploadedFileStorage } from "./data/uploads/LocalUploadedFileStorage.js";
import { ClaimNextJobUseCase } from "./domain/usecases/jobs/ClaimNextJobUseCase.js";
import { CompleteJobUseCase } from "./domain/usecases/jobs/CompleteJobUseCase.js";
import { CreateExampleItemUseCase } from "./domain/usecases/CreateExampleItemUseCase.js";
import { CreateJobUseCase } from "./domain/usecases/jobs/CreateJobUseCase.js";
import { CreateExtractFormJobUseCase } from "./domain/usecases/jobs/CreateExtractFormJobUseCase.js";
import { CountExampleItemsUseCase } from "./domain/usecases/CountExampleItemsUseCase.js";
import { ExtractFormUseCase } from "./domain/usecases/ExtractFormUseCase.js";
import { GetHealthUseCase } from "./domain/usecases/GetHealthUseCase.js";
import { GetJobUseCase } from "./domain/usecases/jobs/GetJobUseCase.js";
import { GetReadinessUseCase } from "./domain/usecases/GetReadinessUseCase.js";
import { RecordJobFailureUseCase } from "./domain/usecases/jobs/RecordJobFailureUseCase.js";
import { ListExampleItemsUseCase } from "./domain/usecases/ListExampleItemsUseCase.js";
import { UpdateExampleItemUseCase } from "./domain/usecases/UpdateExampleItemUseCase.js";
import { LocalDocumentPreparationService } from "./infrastructure/documents/LocalDocumentPreparationService.js";
import { PdfToImgPdfPageImageRenderer } from "./infrastructure/documents/PdfToImgPdfPageImageRenderer.js";
import { OpenRouterFormExtractionService } from "./infrastructure/llm/OpenRouterFormExtractionService.js";
import { StubFormExtractionService } from "./infrastructure/llm/StubFormExtractionService.js";

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
    readonly createExtractFormJob: CreateExtractFormJobUseCase;
    readonly countExampleItems: CountExampleItemsUseCase;
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
  const uploadedFileStorage = new LocalUploadedFileStorage(environment.UPLOADS_DIR);
  const documentPreparationService = new LocalDocumentPreparationService(
    uploadedFileStorage,
    new PdfToImgPdfPageImageRenderer(),
    {
      pdfMaxPages: environment.PDF_MAX_PAGES,
      pdfMaxExtractedImages: environment.PDF_MAX_EXTRACTED_IMAGES,
    },
  );
  const formExtractionService =
    environment.LLM_PROVIDER === "openrouter"
      ? new OpenRouterFormExtractionService({
          apiKey: environment.OPENROUTER_API_KEY,
          baseUrl: environment.OPENROUTER_BASE_URL,
          model: environment.OPENROUTER_MODEL,
        })
      : new StubFormExtractionService();
  const createJobUseCase = new CreateJobUseCase(jobRepository);

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
      createJob: createJobUseCase,
      getJob: new GetJobUseCase(jobRepository),
      claimNextJob: new ClaimNextJobUseCase(jobRepository),
      completeJob: new CompleteJobUseCase(jobRepository),
      recordJobFailure: new RecordJobFailureUseCase(jobRepository),
      createExtractFormJob: new CreateExtractFormJobUseCase(
        createJobUseCase,
        uploadedFileStorage,
        environment.UPLOAD_MAX_FILES,
        environment.UPLOAD_MAX_FILE_SIZE_BYTES,
      ),
      countExampleItems: new CountExampleItemsUseCase(exampleItemRepository),
      extractForm: new ExtractFormUseCase(documentPreparationService, formExtractionService, {
        model:
          environment.LLM_PROVIDER === "openrouter" ? environment.OPENROUTER_MODEL : "stub-model",
      }),
      nudgeJobWorker: () => {},
    },
    close: () => databaseClient.close(),
  };
}
