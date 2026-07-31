import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import type { JsonObject } from "../../src/domain/entities/generic/Json.js";
import { buildGenericExtractFormResultSchemas } from "../../src/domain/jobs/generic-extract-form/GenericExtractFormContract.js";
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

export async function loadEvaluationSuite(
  configPathInput: string,
  options: Readonly<{ allowEmptyExpected: boolean }> = { allowEmptyExpected: false },
): Promise<LoadedEvaluationSuite> {
  const configPath = resolve(configPathInput);
  const configDirectory = dirname(configPath);
  const config = evaluationSuiteSchema.parse(await readJsonFile(configPath));

  const defaults = {
    confidence: config.confidence ?? false,
    form: config.form ?? "generic",
    profile: config.profile ?? "default",
    prompt: config.prompt,
    outputSchema: config.outputSchema,
    expected: config.expected,
    files: config.files,
  };

  const cases = await Promise.all(
    config.evals.map(async (evaluationCase) => {
      const resolved = {
        description: evaluationCase.description,
        confidence: evaluationCase.confidence ?? defaults.confidence,
        form: evaluationCase.form ?? defaults.form,
        profile: evaluationCase.profile ?? defaults.profile,
        promptPath: requirePath(evaluationCase.prompt ?? defaults.prompt, "prompt", evaluationCase),
        outputSchemaPath: requirePath(
          evaluationCase.outputSchema ?? defaults.outputSchema,
          "outputSchema",
          evaluationCase,
        ),
        expectedPath: requirePath(
          evaluationCase.expected ?? defaults.expected,
          "expected",
          evaluationCase,
        ),
        filePaths: evaluationCase.files ?? defaults.files ?? [],
      } satisfies Omit<ResolvedEvaluationCase, "expectedPath"> & { expectedPath: string };

      if (resolved.filePaths.length === 0) {
        throw new Error(`Evaluation case "${resolved.description}" has no files`);
      }

      const [prompt, outputSchema, expected] = await Promise.all([
        readTextFile(resolve(configDirectory, resolved.promptPath)),
        readJsonObjectFile(resolve(configDirectory, resolved.outputSchemaPath)),
        readJsonObjectFile(resolve(configDirectory, resolved.expectedPath)),
      ]);

      for (const filePath of resolved.filePaths) {
        await assertFile(resolve(configDirectory, filePath), `file for "${resolved.description}"`);
      }

      const resultSchemas = buildGenericExtractFormResultSchemas(outputSchema);
      const expectedResult = resultSchemas.resultSchema.safeParse(expected);
      if (!expectedResult.success && !(options.allowEmptyExpected && isEmptyObject(expected))) {
        throw new Error(
          `Expected result for "${resolved.description}" does not match output schema: ${expectedResult.error.message}`,
        );
      }

      return { ...resolved, prompt, outputSchema, expected };
    }),
  );

  return { name: config.name, configPath, configDirectory, cases };
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

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readTextFile(path)) as unknown;
}

async function readJsonObjectFile(path: string): Promise<JsonObject> {
  const parsed = await readJsonFile(path);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in ${path}`);
  }
  return parsed as JsonObject;
}

async function readTextFile(path: string): Promise<string> {
  await assertFile(path, "referenced file");
  return readFile(path, "utf8");
}

async function assertFile(path: string, description: string): Promise<void> {
  try {
    const file = await stat(path);
    if (!file.isFile()) throw new Error(`${description} is not a file: ${path}`);
  } catch (error) {
    throw new Error(
      `${description} cannot be read: ${path} (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }
}

function requirePath(
  value: string | undefined,
  property: string,
  evaluationCase: { description: string },
): string {
  if (!value)
    throw new Error(`Evaluation case "${evaluationCase.description}" is missing ${property}`);
  return value;
}
