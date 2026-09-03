import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import type { JsonObject } from "../../src/domain/entities/generic/Json.js";
import { Future } from "../../src/domain/entities/generic/Future.js";
import { Either } from "../../src/domain/entities/generic/Either.js";
import { buildGenericExtractFormResultSchema } from "../../src/domain/jobs/generic-extract-form/GenericExtractFormContract.js";
import {
  genericExtractFormFormSchema,
  genericExtractFormProfileSchema,
} from "../../src/domain/jobs/generic-extract-form/GenericExtractFormContract.js";

const pathSchema = z.string().min(1);

const evaluationOverridesSchema = z
  .object({
    confidence: z.boolean().optional(),
    form: genericExtractFormFormSchema.optional(),
    profile: genericExtractFormProfileSchema.optional(),
    prompt: pathSchema.optional(),
    outputSchema: pathSchema.optional(),
    expected: pathSchema.optional(),
    files: z.array(pathSchema).min(1).optional(),
  })
  .strict();

const evaluationCaseSchema = evaluationOverridesSchema
  .extend({ description: z.string().min(1) })
  .strict();

const evaluationSuiteSchema = evaluationOverridesSchema
  .extend({
    name: z.string().min(1),
    evals: z.array(evaluationCaseSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const descriptions = new Set<string>();
    for (const [index, evaluationCase] of value.evals.entries()) {
      if (descriptions.has(evaluationCase.description)) {
        context.addIssue({
          code: "custom",
          path: ["evals", index, "description"],
          message: `Duplicate evaluation description: ${evaluationCase.description}`,
        });
      }
      descriptions.add(evaluationCase.description);
    }
  });

export type EvaluationSuiteConfig = z.infer<typeof evaluationSuiteSchema>;

export type ResolvedEvaluationCase = Readonly<{
  description: string;
  confidence: boolean;
  form: string;
  profile: z.infer<typeof genericExtractFormProfileSchema>;
  promptPath: string;
  outputSchemaPath: string;
  expectedPath: string;
  filePaths: string[];
}>;

export type LoadedEvaluationSuite = Readonly<{
  name: string;
  configPath: string;
  configDirectory: string;
  cases: readonly (ResolvedEvaluationCase & {
    prompt: string;
    outputSchema: JsonObject;
    expected: JsonObject;
  })[];
}>;

type EvaluationDefaults = Readonly<{
  confidence: boolean;
  form: string;
  profile: z.infer<typeof genericExtractFormProfileSchema>;
  prompt: string | undefined;
  outputSchema: string | undefined;
  expected: string | undefined;
  files: string[] | undefined;
}>;

export function loadEvaluationSuite(
  configPathInput: string,
  options: Readonly<{ allowEmptyExpected: boolean }> = { allowEmptyExpected: false },
): Future<Error, LoadedEvaluationSuite> {
  return Future.block<Error, LoadedEvaluationSuite>(async ($) => {
    const configPath = resolve(configPathInput);
    const configDirectory = dirname(configPath);
    const parsedConfig = evaluationSuiteSchema.safeParse(await $(readJsonFile(configPath)));
    if (!parsedConfig.success) {
      return await $(Future.error<Error, never>(new Error(parsedConfig.error.message)));
    }
    const config = parsedConfig.data;

    const defaults = {
      confidence: config.confidence ?? false,
      form: config.form ?? "generic",
      profile: config.profile ?? "default",
      prompt: config.prompt,
      outputSchema: config.outputSchema,
      expected: config.expected,
      files: config.files,
    };

    const cases = await $(
      Future.parallel(
        config.evals.map((evaluationCase) =>
          Future.block(async ($case) => {
            const resolved = await $case(
              Future.fromEither(resolveEvaluationCase(evaluationCase, defaults)),
            );

            if (resolved.filePaths.length === 0) {
              return await $case(
                Future.error<Error, never>(
                  new Error(`Evaluation case "${resolved.description}" has no files`),
                ),
              );
            }

            const { prompt, outputSchema, expected } = await $case(
              Future.joinObj({
                prompt: readTextFile(resolve(configDirectory, resolved.promptPath)),
                outputSchema: readJsonObjectFile(
                  resolve(configDirectory, resolved.outputSchemaPath),
                ),
                expected: readJsonObjectFile(resolve(configDirectory, resolved.expectedPath)),
              }),
            );

            for (const filePath of resolved.filePaths) {
              await $case(
                assertFile(
                  resolve(configDirectory, filePath),
                  `file for "${resolved.description}"`,
                ),
              );
            }

            const resultSchema = await $case(
              Future.fromEither(buildGenericExtractFormResultSchema(outputSchema)),
            );
            const expectedResult = resultSchema.safeParse(expected);
            if (
              !expectedResult.success &&
              !(options.allowEmptyExpected && isEmptyObject(expected))
            ) {
              return await $case(
                Future.error<Error, never>(
                  new Error(
                    `Expected result for "${resolved.description}" does not match output schema: ${expectedResult.error.message}`,
                  ),
                ),
              );
            }

            return { ...resolved, prompt, outputSchema, expected };
          }),
        ),
        { concurrency: config.evals.length },
      ).mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
    );

    return { name: config.name, configPath, configDirectory, cases };
  });
}

export function filterEvaluationSuite(
  suite: LoadedEvaluationSuite,
  filter: string,
): LoadedEvaluationSuite {
  return {
    ...suite,
    cases: filterEvaluationCases(suite.cases, filter),
  };
}

export function filterEvaluationCases<T extends { description: string }>(
  cases: readonly T[],
  filter: string,
): T[] {
  const normalizedFilter = filter.toLowerCase();
  return cases.filter((evaluationCase) =>
    evaluationCase.description.toLowerCase().includes(normalizedFilter),
  );
}

function isEmptyObject(value: JsonObject): boolean {
  return Object.keys(value).length === 0;
}

function readJsonFile(path: string): Future<Error, unknown> {
  return readTextFile(path).flatMap((contents) =>
    Future.fromPromise<unknown>(() => Promise.resolve(JSON.parse(contents) as unknown)),
  );
}

function readJsonObjectFile(path: string): Future<Error, JsonObject> {
  return readJsonFile(path).flatMap((parsed) =>
    isJsonObject(parsed)
      ? Future.success(parsed)
      : Future.error(new Error(`Expected JSON object in ${path}`)),
  );
}

function readTextFile(path: string): Future<Error, string> {
  return assertFile(path, "referenced file").flatMap(() =>
    Future.fromPromise(() => readFile(path, "utf8")),
  );
}

function assertFile(path: string, description: string): Future<Error, undefined> {
  return Future.fromPromise(() => stat(path))
    .mapError(
      (error) =>
        new Error(
          `${description} cannot be read: ${path} (${error instanceof Error ? error.message : String(error)})`,
          { cause: error },
        ),
    )
    .flatMap((file) =>
      file.isFile()
        ? Future.success(undefined)
        : Future.error(new Error(`${description} is not a file: ${path}`)),
    );
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requirePath(
  value: string | undefined,
  property: string,
  evaluationCase: { description: string },
): Either<Error, string> {
  if (!value)
    return Either.error(
      new Error(`Evaluation case "${evaluationCase.description}" is missing ${property}`),
    );
  return Either.success(value);
}

function resolveEvaluationCase(
  evaluationCase: z.infer<typeof evaluationCaseSchema>,
  defaults: EvaluationDefaults,
): Either<Error, ResolvedEvaluationCase> {
  return requirePath(evaluationCase.prompt ?? defaults.prompt, "prompt", evaluationCase).flatMap(
    (promptPath) =>
      requirePath(
        evaluationCase.outputSchema ?? defaults.outputSchema,
        "outputSchema",
        evaluationCase,
      ).flatMap((outputSchemaPath) =>
        requirePath(evaluationCase.expected ?? defaults.expected, "expected", evaluationCase).map(
          (expectedPath) => ({
            description: evaluationCase.description,
            confidence: evaluationCase.confidence ?? defaults.confidence,
            form: evaluationCase.form ?? defaults.form,
            profile: evaluationCase.profile ?? defaults.profile,
            promptPath,
            outputSchemaPath,
            expectedPath,
            filePaths: evaluationCase.files ?? defaults.files ?? [],
          }),
        ),
      ),
  );
}
