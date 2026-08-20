import type { Future } from "../entities/generic/Future.js";
import type {
  ExtractionProfileName,
  ExtractionProfileTemplate,
} from "../extraction/ExtractionProfile.js";
import type { Maybe } from "../../utils/ts-utils.js";

export interface ExtractionProfileRepository {
  list(): Future<Error, readonly ExtractionProfileName[]>;
  getById(id: string): Future<Error, Maybe<ExtractionProfileTemplate>>;
}
