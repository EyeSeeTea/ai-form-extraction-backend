import type { Effect } from "effect";

import type { DependencyHealth } from "../entities/DependencyHealth.js";
import type { DatabaseError } from "../errors/DatabaseError.js";

export interface HealthRepository {
  readonly check: Effect.Effect<DependencyHealth, DatabaseError>;
}
