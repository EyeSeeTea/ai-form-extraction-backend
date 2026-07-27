import type { Future } from "../entities/generic/Future.js";
import type { DependencyHealth } from "../entities/DependencyHealth.js";

export interface HealthRepository {
  check(): Future<Error, DependencyHealth>;
}
