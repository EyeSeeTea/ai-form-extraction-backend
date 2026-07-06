import type { ExtractionProfile } from "../extraction/ExtractionProfile.js";
import type { FormExtractionService } from "./FormExtractionService.js";

export interface FormExtractionServiceFactory {
  create(profile: ExtractionProfile): FormExtractionService;
}
