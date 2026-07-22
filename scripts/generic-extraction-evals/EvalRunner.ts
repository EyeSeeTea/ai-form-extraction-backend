import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm, mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import type { Logger } from "pino";

import type { Environment } from "../../src/config/Environment.js";
import { GenericExtractFormUseCase } from "../../src/domain/usecases/GenericExtractFormUseCase.js";
import { DefaultGenericExtractionProfileFactory } from "../../src/domain/extraction/GenericExtractionProfileFactory.js";
import { ExtractionProfileStaticRepository } from "../../src/data/repositories/ExtractionProfileStaticRepository.js";
import { getLlmConfiguration } from "../../src/config/Environment.js";
import { DefaultFormExtractionServiceFactory } from "../../src/infrastructure/llm/DefaultFormExtractionServiceFactory.js";
import { LocalDocumentPreparationService } from "../../src/infrastructure/documents/LocalDocumentPreparationService.js";
import { PdfToImgPdfPageImageRenderer } from "../../src/infrastructure/documents/PdfToImgPdfPageImageRenderer.js";
import { LocalUploadedFileStorage } from "../../src/data/uploads/LocalUploadedFileStorage.js";
import {
  validateUploadedDocumentInput,
  type UploadedDocumentFileInput,
} from "../../src/domain/uploads/UploadedDocument.js";
import type { JsonObject } from "../../src/domain/entities/generic/Json.js";
import type { LoadedEvaluationSuite, ResolvedEvaluationCase } from "./EvalConfig.js";

export type EvaluationCaseStatus = "pass" | "fail" | "scaffolded" | "error";

export type EvaluationCaseReport = Readonly<{
  description: string;
  status: EvaluationCaseStatus;
  outputDirectory: string;
  costUsd?: number;
  errorMessage?: string;
}>;

export type EvaluationSuiteReport = Readonly<{
  suiteName: string;
  cases: readonly EvaluationCaseReport[];
  elapsedMs: number;
  knownCostUsd: number;
  missingCostCount: number;
}>;

export async function runEvaluationSuite(
  suite: LoadedEvaluationSuite,
  environment: Environment,
  logger: Pick<Logger, "debug" | "error">,
  outputDirectory: string,
  scaffold: boolean,
): Promise<EvaluationSuiteReport> {
  const startedAt = Date.now();
  const runAt = new Date().toISOString();
  const runOutputDirectory = join(outputDirectory, runAt);
  const suiteOutputDirectory = join(runOutputDirectory, slugify(suite.name));
  await mkdir(suiteOutputDirectory, { recursive: true });

  const temporaryUploadsDirectory = await mkdtemp(join(tmpdir(), "generic-extraction-evals-"));
  const uploadedFileStorage = new LocalUploadedFileStorage(temporaryUploadsDirectory);
  const llmConfiguration = getLlmConfiguration(environment);
  const formExtractionServiceFactory = new DefaultFormExtractionServiceFactory({
    openRouter: llmConfiguration.openRouter,
    ollama: llmConfiguration.ollama,
  });
  const genericExtractForm = new GenericExtractFormUseCase(
    new LocalDocumentPreparationService(uploadedFileStorage, new PdfToImgPdfPageImageRenderer(), {
      pdfMaxPages: environment.PDF_MAX_PAGES,
      pdfMaxExtractedImages: environment.PDF_MAX_EXTRACTED_IMAGES,
    }),
    formExtractionServiceFactory,
    new DefaultGenericExtractionProfileFactory(
      new ExtractionProfileStaticRepository(llmConfiguration.profile),
    ),
    logger,
  );

  try {
    const reports: EvaluationCaseReport[] = [];
    for (const evaluationCase of suite.cases) {
      reports.push(
        await runEvaluationCase(
          genericExtractForm,
          uploadedFileStorage,
          evaluationCase,
          suiteOutputDirectory,
          environment,
          suite.configDirectory,
          scaffold,
        ),
      );
    }

    const knownCosts = reports.flatMap((report) =>
      report.costUsd === undefined ? [] : [report.costUsd],
    );
    const report = {
      suiteName: suite.name,
      cases: reports,
      elapsedMs: Date.now() - startedAt,
      knownCostUsd: knownCosts.reduce((total, cost) => total + cost, 0),
      missingCostCount: reports.length - knownCosts.length,
    };
    await writeJson(
      join(runOutputDirectory, "summary.json"),
      buildEvaluationSummary(report, runAt),
    );
    return report;
  } finally {
    await rm(temporaryUploadsDirectory, { recursive: true, force: true });
  }
}

function buildEvaluationSummary(
  report: EvaluationSuiteReport,
  runAt: string,
): Readonly<Record<string, unknown>> {
  return {
    runAt,
    suiteName: report.suiteName,
    elapsedMs: report.elapsedMs,
    knownCostUsd: report.knownCostUsd,
    missingCostCount: report.missingCostCount,
    counts: {
      pass: report.cases.filter((evaluationCase) => evaluationCase.status === "pass").length,
      fail: report.cases.filter((evaluationCase) => evaluationCase.status === "fail").length,
      scaffolded: report.cases.filter((evaluationCase) => evaluationCase.status === "scaffolded")
        .length,
      error: report.cases.filter((evaluationCase) => evaluationCase.status === "error").length,
    },
    cases: report.cases.map(({ description, status, costUsd, errorMessage }) => ({
      description,
      status,
      ...(costUsd === undefined ? {} : { costUsd }),
      ...(errorMessage === undefined ? {} : { errorMessage }),
    })),
  };
}

async function runEvaluationCase(
  useCase: GenericExtractFormUseCase,
  uploadedFileStorage: LocalUploadedFileStorage,
  evaluationCase: ResolvedEvaluationCase & {
    prompt: string;
    outputSchema: JsonObject;
    expected: JsonObject;
  },
  suiteOutputDirectory: string,
  environment: Environment,
  configDirectory: string,
  scaffold: boolean,
): Promise<EvaluationCaseReport> {
  const outputDirectory = join(suiteOutputDirectory, caseDirectoryName(evaluationCase.description));
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    ["actual.json", "diagnostics.json", "expected.json"].map((fileName) =>
      unlink(join(outputDirectory, fileName)).catch(() => undefined),
    ),
  );
  await writeJson(join(outputDirectory, "expected.json"), evaluationCase.expected);

  let bundleId: string | undefined;
  try {
    const files = await Promise.all(
      evaluationCase.filePaths.map((filePath) => readInputFile(resolve(configDirectory, filePath))),
    );
    const validatedDocument = validateUploadedDocumentInput({
      files,
      maxFiles: environment.UPLOAD_MAX_FILES,
      maxFileSizeBytes: environment.UPLOAD_MAX_FILE_SIZE_BYTES,
    });
    const document = await uploadedFileStorage.store(validatedDocument).toPromise();
    bundleId = document.bundleId;
    const actual = await useCase
      .execute({
        form: evaluationCase.form,
        profile: evaluationCase.profile,
        prompt: evaluationCase.prompt,
        outputSchema: evaluationCase.outputSchema,
        document,
      })
      .toPromise();

    const shouldScaffold = scaffold && Object.keys(evaluationCase.expected).length === 0;
    if (shouldScaffold) {
      await writeJson(resolve(configDirectory, evaluationCase.expectedPath), actual.result);
    }
    await writeJson(join(outputDirectory, "actual.json"), actual.result);
    await writeJson(join(outputDirectory, "diagnostics.json"), {
      ...actual.diagnostics,
      ...(shouldScaffold ? { scaffolded: true } : {}),
    });
    await writeJson(
      join(outputDirectory, "expected.json"),
      shouldScaffold ? actual.result : evaluationCase.expected,
    );
    return {
      description: evaluationCase.description,
      status: shouldScaffold
        ? "scaffolded"
        : deepEqual(actual.result, evaluationCase.expected)
          ? "pass"
          : "fail",
      outputDirectory,
      ...(actual.diagnostics.usage?.costUsd === undefined
        ? {}
        : { costUsd: actual.diagnostics.usage.costUsd }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeJson(join(outputDirectory, "diagnostics.json"), {
      status: "error",
      message,
    });
    return {
      description: evaluationCase.description,
      status: "error",
      outputDirectory,
      errorMessage: message,
    };
  } finally {
    if (bundleId) await uploadedFileStorage.cleanupBundle(bundleId).toPromise();
  }
}

function deepEqual(left: JsonObject, right: JsonObject): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    return deepEqualValue(left[key], right[key]);
  });
}

function deepEqualValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqualValue(value, right[index]))
    );
  }
  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
    return deepEqual(left as JsonObject, right as JsonObject);
  }
  return false;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unnamed";
}

function caseDirectoryName(description: string): string {
  const hash = createHash("sha256").update(description).digest("hex").slice(0, 8);
  return `${slugify(description)}-${hash}`;
}

function inferMimeType(filename: string): string {
  switch (extname(filename).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

async function readInputFile(path: string): Promise<UploadedDocumentFileInput> {
  const bytes = await readFile(path);
  return {
    filename: basename(path),
    mimetype: inferMimeType(path),
    size: bytes.length,
    bytes,
  };
}
