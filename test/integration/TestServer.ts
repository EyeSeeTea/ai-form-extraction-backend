import { createServer } from "../../src/api/Server.js";
import type { CompositionRoot } from "../../src/CompositionRoot.js";
import type { Environment } from "../../src/config/Environment.js";
import { ExtractionProfileStaticRepository } from "../../src/data/repositories/ExtractionProfileStaticRepository.js";
import { DefaultGenericExtractionProfileFactory } from "../../src/domain/extraction/GenericExtractionProfileFactory.js";
import { DefaultManagedExtractionProfileResolver } from "../../src/domain/extraction/ManagedExtractionProfileResolver.js";
import { CreateExampleItemUseCase } from "../../src/domain/usecases/CreateExampleItemUseCase.js";
import { ClaimNextJobUseCase } from "../../src/domain/usecases/jobs/ClaimNextJobUseCase.js";
import { CompleteJobUseCase } from "../../src/domain/usecases/jobs/CompleteJobUseCase.js";
import { CreateJobUseCase } from "../../src/domain/usecases/jobs/CreateJobUseCase.js";
import { CreateExtractFormJobUseCase } from "../../src/domain/usecases/jobs/CreateExtractFormJobUseCase.js";
import { CreateGenericExtractFormJobUseCase } from "../../src/domain/usecases/jobs/CreateGenericExtractFormJobUseCase.js";
import { CountExampleItemsUseCase } from "../../src/domain/usecases/CountExampleItemsUseCase.js";
import { ExtractFormUseCase } from "../../src/domain/usecases/ExtractFormUseCase.js";
import { GenericExtractFormUseCase } from "../../src/domain/usecases/GenericExtractFormUseCase.js";
import { GetHealthUseCase } from "../../src/domain/usecases/GetHealthUseCase.js";
import { GetJobUseCase } from "../../src/domain/usecases/jobs/GetJobUseCase.js";
import { GetReadinessUseCase } from "../../src/domain/usecases/GetReadinessUseCase.js";
import { ListExampleItemsUseCase } from "../../src/domain/usecases/ListExampleItemsUseCase.js";
import { RecordJobFailureUseCase } from "../../src/domain/usecases/jobs/RecordJobFailureUseCase.js";
import { UpdateExampleItemUseCase } from "../../src/domain/usecases/UpdateExampleItemUseCase.js";
import { createLogger } from "../../src/shared/Logger.js";
import { createExampleItemMockRepository } from "../mocks/ExampleItemMockRepository.js";
import { createJobMockRepository } from "../mocks/JobMockRepository.js";
import { createHealthMockRepository } from "../mocks/HealthMockRepository.js";
import { StubFormExtractionService } from "../../src/infrastructure/llm/StubFormExtractionService.js";
import { LocalUploadedFileStorage } from "../../src/data/uploads/LocalUploadedFileStorage.js";
import { LocalDocumentPreparationService } from "../../src/infrastructure/documents/LocalDocumentPreparationService.js";
import { PdfToImgPdfPageImageRenderer } from "../../src/infrastructure/documents/PdfToImgPdfPageImageRenderer.js";
import type { DocumentPreparationService } from "../../src/domain/services/DocumentPreparationService.js";
import type { FormExtractionServiceFactory } from "../../src/domain/services/FormExtractionServiceFactory.js";
import type { JobRepository } from "../../src/domain/repositories/JobRepository.js";
type StubTestEnvironment = Extract<Environment, Readonly<{ LLM_PROVIDER: "stub" }>>;

type TestCompositionRootOptions = Readonly<{
  nudgeJobWorker?: () => void;
  jobRepository?: JobRepository;
  documentPreparationService?: DocumentPreparationService;
}>;

export const testEnvironment: StubTestEnvironment = {
  NODE_ENV: "test",
  SERVICE_NAME: "service-under-test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  DATABASE_PATH: ":memory:",
  CORS_ORIGIN: "*",
  AUTH_TOKEN: "test-auth-token",
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_TIME_WINDOW_MS: 60_000,
  UPLOADS_DIR: "/tmp/ai-extraction-backend-test-uploads",
  UPLOAD_MAX_FILES: 20,
  UPLOAD_MAX_FILE_SIZE_BYTES: 25_000_000,
  PDF_MAX_PAGES: 20,
  PDF_MAX_EXTRACTED_IMAGES: 20,
  LLM_PROVIDER: "stub",
  OLLAMA_API_KEY: "ollama",
  OLLAMA_BASE_URL: "http://127.0.0.1:11434/v1",
  OLLAMA_MODEL: "qwen3-vl:4b",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  OPENROUTER_MODEL: "qwen/qwen3-vl-32b-instruct",
  UPLOAD_RETENTION_MS: 30 * 24 * 60 * 60 * 1000,
  OTEL_ENABLED: false,
};

export const authHeaders = {
  authorization: `ApiToken ${testEnvironment.AUTH_TOKEN}`,
};

export function createTestCompositionRoot(
  options: TestCompositionRootOptions = {},
): CompositionRoot {
  const logger = createLogger(testEnvironment);
  const mockRepository = createExampleItemMockRepository([
    {
      id: "8d3f5491-4ddc-44f8-ae8f-dc7e351808e4",
      name: "Initial item",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ]);
  const jobRepository = options.jobRepository ?? createJobMockRepository();
  const createJobUseCase = new CreateJobUseCase(jobRepository);
  const uploadedFileStorage = new LocalUploadedFileStorage(testEnvironment.UPLOADS_DIR);
  const documentPreparationService =
    options.documentPreparationService ??
    new LocalDocumentPreparationService(uploadedFileStorage, new PdfToImgPdfPageImageRenderer(), {
      pdfMaxPages: testEnvironment.PDF_MAX_PAGES,
      pdfMaxExtractedImages: testEnvironment.PDF_MAX_EXTRACTED_IMAGES,
    });
  const formExtractionServiceFactory: FormExtractionServiceFactory = {
    create: (profile) =>
      new StubFormExtractionService({
        providerName: "stub",
        model: profile.model,
        extractionJsonSchema: profile.extractionJsonSchema,
      }),
  };
  const extractionProfileRepository = createExtractionProfileRepository();

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
    jobs: {
      createJob: createJobUseCase,
      getJob: new GetJobUseCase(jobRepository),
      claimNextJob: new ClaimNextJobUseCase(jobRepository),
      completeJob: new CompleteJobUseCase(jobRepository),
      recordJobFailure: new RecordJobFailureUseCase(jobRepository),
      createExtractFormJob: new CreateExtractFormJobUseCase(
        createJobUseCase,
        uploadedFileStorage,
        testEnvironment.UPLOAD_MAX_FILES,
        testEnvironment.UPLOAD_MAX_FILE_SIZE_BYTES,
      ),
      createGenericExtractFormJob: new CreateGenericExtractFormJobUseCase(
        createJobUseCase,
        uploadedFileStorage,
        testEnvironment.UPLOAD_MAX_FILES,
        testEnvironment.UPLOAD_MAX_FILE_SIZE_BYTES,
      ),
      execution: {
        countExampleItems: new CountExampleItemsUseCase(mockRepository),
        extractForm: new ExtractFormUseCase(
          documentPreparationService,
          formExtractionServiceFactory,
          new DefaultManagedExtractionProfileResolver(extractionProfileRepository),
          logger,
        ),
        genericExtractForm: new GenericExtractFormUseCase(
          documentPreparationService,
          formExtractionServiceFactory,
          new DefaultGenericExtractionProfileFactory(extractionProfileRepository),
          logger,
        ),
      },
      nudgeJobWorker: options.nudgeJobWorker ?? (() => {}),
    },
    close: async () => {},
  };
}

export async function createTestServer(
  environmentOverrides: Partial<StubTestEnvironment> = {},
  rootOptions: TestCompositionRootOptions = {},
) {
  const environment: StubTestEnvironment = { ...testEnvironment, ...environmentOverrides };

  return createServer(
    environment,
    createLogger(environment),
    createTestCompositionRoot(rootOptions),
  );
}

function createExtractionProfileRepository() {
  return new ExtractionProfileStaticRepository({
    provider: "stub",
    model: "stub-model",
  });
}
