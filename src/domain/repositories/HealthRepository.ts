import type { DependencyHealth } from "../entities/DependencyHealth.js";

export interface HealthRepository {
  check(): Promise<DependencyHealth>;
}
