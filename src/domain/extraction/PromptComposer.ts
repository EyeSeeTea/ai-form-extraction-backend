import type { FormExtractionPrompt } from "../services/FormExtractionService.js";
import type { ExtractionProfile } from "./ExtractionProfile.js";

export const managedExtractionSystemPrompt =
  "You extract structured data from form images. Return only one valid JSON object and no markdown.";

export const managedExtractionUserPromptTemplate = [
  "Form type: {{formType}}",
  "Canonical JSON Schema: {{jsonSchema}}",
  "Extraction instructions: {{instructions}}",
  "The following images are ordered form pages.",
].join("\n\n");

export function composePrompt(
  profile: Pick<ExtractionProfile, "formType" | "extractionJsonSchema" | "prompt">,
): FormExtractionPrompt {
  return {
    system: profile.prompt.system,
    userText: renderTemplate(profile.prompt.userTemplate, {
      formType: profile.formType,
      jsonSchema: JSON.stringify(profile.extractionJsonSchema),
      instructions: profile.prompt.instructions,
    }),
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
