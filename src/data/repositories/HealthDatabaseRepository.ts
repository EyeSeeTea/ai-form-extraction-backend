import { Future } from "../../domain/entities/generic/Future.js";
import type { DependencyHealth } from "../../domain/entities/DependencyHealth.js";
import type { HealthRepository } from "../../domain/repositories/HealthRepository.js";
import { sql } from "drizzle-orm";
import type { Database } from "../database/Database.js";

export class HealthDatabaseRepository implements HealthRepository {
  constructor(private readonly db: Database) {}

  check(): Future<Error, DependencyHealth> {
    return Future.fromComputation<Error, DependencyHealth>((resolve) => {
      try {
        this.db.run(sql`select 1`);
        resolve({ reachable: true });
      } catch {
        resolve({ reachable: false });
      }
    });
  }
}
