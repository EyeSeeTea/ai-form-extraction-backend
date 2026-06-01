import { Effect } from "effect";

import type { DependencyHealth } from "../../domain/entities/DependencyHealth.js";
import { DatabaseError } from "../../domain/errors/DatabaseError.js";
import type { HealthRepository } from "../../domain/repositories/HealthRepository.js";
import type { DatabaseClient } from "../database/Database.js";

export class HealthDatabaseRepository implements HealthRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  get check(): Effect.Effect<DependencyHealth, DatabaseError> {
    return Effect.tryPromise({
      try: () => this.databaseClient.sql`select 1`,
      catch: (cause) => new DatabaseError({ cause }),
    }).pipe(Effect.map(() => ({ reachable: true })));
  }
}
