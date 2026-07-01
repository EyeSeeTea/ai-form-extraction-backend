import { z } from "zod";

import { ValidationError } from "../../shared/ValidationError.js";
import type { JsonObject } from "../entities/Job.js";
import { endOfSeasonFormDefinition } from "./end-of-season/EndOfSeasonFormDefinition.js";

type FormRegistryEntry = {
  readonly formType: string;
  readonly extractionSchema: z.ZodType;
  readonly metadata: JsonObject;
  readonly toTrackerPayload: (fields: never) => JsonObject;
};

function createFormRegistry<const TRegistry extends Record<string, FormRegistryEntry>>(
  registry: TRegistry,
): TRegistry {
  return registry;
}

export const formRegistry = createFormRegistry({
  "end-of-season": endOfSeasonFormDefinition,
});

export type FormRegistry = typeof formRegistry;
export type KnownFormType = keyof FormRegistry;
export type KnownFormDefinition = FormRegistry[KnownFormType];

export const knownFormTypes = Object.keys(formRegistry) as [KnownFormType, ...KnownFormType[]];

export function getFormDefinition(formType: string): KnownFormDefinition | undefined {
  if (!isKnownFormType(formType)) {
    return undefined;
  }

  return formRegistry[formType];
}

export function isKnownFormType(formType: string): formType is KnownFormType {
  return formType in formRegistry;
}

export function parseFormType(formType: string): KnownFormType {
  if (!isKnownFormType(formType)) {
    throw new ValidationError(`Unknown form type: ${formType}`);
  }

  return formType;
}
