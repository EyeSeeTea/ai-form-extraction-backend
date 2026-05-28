import type { DatabaseHealth } from "../entities/DatabaseHealth.js";

export interface HealthRepository {
  check(): Promise<DatabaseHealth>;
}
