import { ValidationError } from "../../shared/ValidationError.js";
import { getFormDefinition } from "../forms/FormRegistry.js";
import type { ExtractionProfile, ExtractionProvider } from "./ExtractionProfile.js";

export interface ExtractionProfileResolver {
  resolve(formType: string): ExtractionProfile;
}

export type DefaultExtractionProfileResolverConfig = {
  readonly provider: ExtractionProvider;
  readonly model: string;
};

export class DefaultExtractionProfileResolver implements ExtractionProfileResolver {
  constructor(private readonly config: DefaultExtractionProfileResolverConfig) {}

  resolve(formType: string): ExtractionProfile {
    const formDefinition = getFormDefinition(formType);
    if (!formDefinition) {
      throw new ValidationError(`Unknown form type: ${formType}`);
    }

    return {
      id: `default:${formDefinition.formType}`,
      formType: formDefinition.formType,
      provider: this.config.provider,
      model: this.config.model,
      prompt: {
        system: defaultExtractionSystemPrompt,
        userTemplate: defaultExtractionUserPromptTemplate,
        instructions: buildDefaultExtractionInstructions(formDefinition.formType),
      },
      extractionJsonSchema: formDefinition.extractionJsonSchema,
    };
  }
}

function buildDefaultExtractionInstructions(formType: string): string {
  return [
    `Extract structured fields from the provided ${formType} form images.`,
    "Return a single JSON object that matches the provided JSON Schema.",
    "Do not include markdown, commentary, or additional wrapper keys.",
  ].join(" ");
}

const defaultExtractionSystemPrompt =
  "You extract structured data from form images. Return only one valid JSON object and no markdown.";

const defaultExtractionUserPromptTemplate = [
  "Form type: {{formType}}",
  "Canonical JSON Schema: {{jsonSchema}}",
  "Extraction instructions: {{instructions}}",
  "The following images are ordered form pages.",
].join("\n\n");
