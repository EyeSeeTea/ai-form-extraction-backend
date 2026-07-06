import type { FormExtractionPrompt } from "../services/FormExtractionService.js";
import type { ExtractionProfile } from "./ExtractionProfile.js";

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

function renderTemplate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((currentTemplate, [key, value]) => {
    return currentTemplate.split(`{{${key}}}`).join(value);
  }, template);
}
