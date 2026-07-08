import type {
  ExtractionProfileName,
  ExtractionProfileTemplate,
} from "../extraction/ExtractionProfile.js";

export interface ExtractionProfileRepository {
  list(): readonly ExtractionProfileName[];
  getById(id: string): ExtractionProfileTemplate;
}
