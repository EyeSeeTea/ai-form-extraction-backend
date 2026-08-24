import type { Logger } from "pino";
import { getLlmConfiguration, type Environment } from "./config/Environment.js";
import { createDatabaseClient, type DatabaseClient } from "./data/database/Database.js";
import { ExampleItemDatabaseRepository } from "./data/repositories/ExampleItemDatabaseRepository.js";
import { ExtractionProfileStaticRepository } from "./data/repositories/ExtractionProfileStaticRepository.js";
import { JobDatabaseRepository } from "./data/repositories/JobDatabaseRepository.js";
import { HealthDatabaseRepository } from "./data/repositories/HealthDatabaseRepository.js";
import { UuidIdGenerator } from "./data/utils/IdGenerator.js";
import { LocalUploadedFileStorage } from "./data/uploads/LocalUploadedFileStorage.js";
import { ClaimNextJobUseCase } from "./domain/usecases/jobs/ClaimNextJobUseCase.js";
import { CompleteJobUseCase } from "./domain/usecases/jobs/CompleteJobUseCase.js";
import { CreateExampleItemUseCase } from "./domain/usecases/CreateExampleItemUseCase.js";
import { CreateJobUseCase } from "./domain/usecases/jobs/CreateJobUseCase.js";
import { CreateExtractFormJobUseCase } from "./domain/usecases/jobs/CreateExtractFormJobUseCase.js";
import { CreateGenericExtractFormJobUseCase } from "./domain/usecases/jobs/CreateGenericExtractFormJobUseCase.js";
import { CountExampleItemsUseCase } from "./domain/usecases/CountExampleItemsUseCase.js";
import { DefaultGenericExtractionProfileFactory } from "./domain/extraction/GenericExtractionProfileFactory.js";
import { DefaultManagedExtractionProfileResolver } from "./domain/extraction/ManagedExtractionProfileResolver.js";
import { ExtractFormUseCase } from "./domain/usecases/ExtractFormUseCase.js";
import { GenericExtractFormUseCase } from "./domain/usecases/GenericExtractFormUseCase.js";
import { GetHealthUseCase } from "./domain/usecases/GetHealthUseCase.js";
import { GetJobUseCase } from "./domain/usecases/jobs/GetJobUseCase.js";
import { GetReadinessUseCase } from "./domain/usecases/GetReadinessUseCase.js";
import { RecordJobFailureUseCase } from "./domain/usecases/jobs/RecordJobFailureUseCase.js";
import { ListExampleItemsUseCase } from "./domain/usecases/ListExampleItemsUseCase.js";
import { UpdateExampleItemUseCase } from "./domain/usecases/UpdateExampleItemUseCase.js";
import { LocalDocumentPreparationService } from "./infrastructure/documents/LocalDocumentPreparationService.js";
import { PdfToImgPdfPageImageRenderer } from "./infrastructure/documents/PdfToImgPdfPageImageRenderer.js";
import { DefaultFormExtractionServiceFactory } from "./infrastructure/llm/DefaultFormExtractionServiceFactory.js";

export type CompositionRoot = {
  readonly health: Readonly<{
    getHealth: GetHealthUseCase;
    getReadiness: GetReadinessUseCase;
  }>;
  readonly exampleItems: Readonly<{
    listExampleItems: ListExampleItemsUseCase;
    createExampleItem: CreateExampleItemUseCase;
    updateExampleItem: UpdateExampleItemUseCase;
  }>;
  readonly jobs: {
    readonly createJob: CreateJobUseCase;
    readonly getJob: GetJobUseCase;
    readonly claimNextJob: ClaimNextJobUseCase;
    readonly completeJob: CompleteJobUseCase;
    readonly recordJobFailure: RecordJobFailureUseCase;
    readonly createExtractFormJob: CreateExtractFormJobUseCase;
    readonly createGenericExtractFormJob: CreateGenericExtractFormJobUseCase;
    readonly execution: Readonly<{
      countExampleItems: CountExampleItemsUseCase;
      extractForm: ExtractFormUseCase;
      genericExtractForm: GenericExtractFormUseCase;
    }>;
    nudgeJobWorker: () => void;
  };
  close(): Promise<void>;
};

export function createCompositionRoot(
  environment: Environment,
  logger: Pick<Logger, "debug" | "error" | "child">,
): CompositionRoot {
  const databaseClient = createDatabaseClient(environment.DATABASE_PATH);
  return createCompositionRootFromDatabaseClient(environment, databaseClient, logger);
}

export function createCompositionRootFromDatabaseClient(
  environment: Environment,
  databaseClient: DatabaseClient,
  logger: Pick<Logger, "debug" | "error" | "child">,
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
  const llmConfiguration = getLlmConfiguration(environment);
  const formExtractionServiceFactory = new DefaultFormExtractionServiceFactory({
    openRouter: llmConfiguration.openRouter,
    ollama: llmConfiguration.ollama,
    stub: llmConfiguration.stub,
  });
  const extractionProfileRepository = new ExtractionProfileStaticRepository(
    llmConfiguration.profile,
  );
  const managedExtractionProfileResolver = new DefaultManagedExtractionProfileResolver(
    extractionProfileRepository,
  );
  const genericExtractionProfileFactory = new DefaultGenericExtractionProfileFactory(
    extractionProfileRepository,
  );
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
      createGenericExtractFormJob: new CreateGenericExtractFormJobUseCase(
        createJobUseCase,
        uploadedFileStorage,
        environment.UPLOAD_MAX_FILES,
        environment.UPLOAD_MAX_FILE_SIZE_BYTES,
      ),
      execution: {
        countExampleItems: new CountExampleItemsUseCase(exampleItemRepository),
        extractForm: new ExtractFormUseCase(
          documentPreparationService,
          formExtractionServiceFactory,
          managedExtractionProfileResolver,
          logger.child({ component: "extract-form-use-case" }),
        ),
        genericExtractForm: new GenericExtractFormUseCase(
          documentPreparationService,
          formExtractionServiceFactory,
          genericExtractionProfileFactory,
          logger.child({ component: "generic-extract-form-use-case" }),
        ),
      },
      nudgeJobWorker: () => {},
    },
    close: () => databaseClient.close(),
  };
}
