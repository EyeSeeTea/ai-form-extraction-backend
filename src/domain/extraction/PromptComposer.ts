import type { FormExtractionPrompt } from "../services/FormExtractionService.js";
import type { JsonObject } from "../entities/generic/Json.js";
import type { ExtractionProfile } from "./ExtractionProfile.js";

export const managedExtractionSystemPrompt =
  "You extract structured data from form images. Return only one valid JSON object and no markdown.";

export const managedExtractionUserPromptTemplate = [
  "Form type: {{formType}}",
  "Canonical JSON Schema: {{jsonSchema}}",
  "Extraction response JSON Schema: {{responseJsonSchema}}",
  "Extraction instructions: {{instructions}}",
  "{{confidenceInstructions}}",
  "The following images are ordered form pages.",
].join("\n\n");

const fieldConfidenceInstructions =
  "Return the extracted values under result. Return fieldConfidence as a JSON object mapping JSON Pointer paths relative to result to model-reported scores from 0 through 1 for every returned scalar value. For example, a top-level result field named country uses /country; do not prefix paths with /result. Do not add confidence entries for unextracted fields.";

export type ComposePromptOptions = Readonly<{
  includeFieldConfidence: boolean;
}>;

export function composePrompt(
  profile: Pick<ExtractionProfile, "formType" | "extractionJsonSchema" | "prompt">,
  options: ComposePromptOptions,
): FormExtractionPrompt {
  const { includeFieldConfidence } = options;

  return {
    system: profile.prompt.system,
    userText: renderTemplate(profile.prompt.userTemplate, {
      formType: profile.formType,
      jsonSchema: JSON.stringify(profile.extractionJsonSchema),
      responseJsonSchema: JSON.stringify(
        buildExtractionResponseJsonSchema(profile.extractionJsonSchema, includeFieldConfidence),
      ),
      instructions: profile.prompt.instructions,
      confidenceInstructions: includeFieldConfidence ? fieldConfidenceInstructions : "",
    }),
  };
}

export function buildExtractionResponseJsonSchema(
  resultSchema: JsonObject,
  includeFieldConfidence: boolean,
): JsonObject {
  return {
    type: "object",
    properties: {
      result: resultSchema,
      ...(includeFieldConfidence
        ? {
            fieldConfidence: {
              type: "object",
              description:
                "JSON Pointer relative to result for model-reported confidence for each returned scalar result value.",
              additionalProperties: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
            },
          }
        : {}),
    },
    required: includeFieldConfidence ? ["result", "fieldConfidence"] : ["result"],
    additionalProperties: false,
  };
}

export function buildDefaultExtractionInstructions(formType: string): string {
  return [
    `Extract structured fields from the provided ${formType} form images.`,
    "Return a single JSON object that matches the provided JSON Schema.",
    "Do not include markdown, commentary, or additional wrapper keys.",
  ].join(" ");
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((currentTemplate, [key, value]) => {
    return currentTemplate.split(`{{${key}}}`).join(value);
  }, template);
}
