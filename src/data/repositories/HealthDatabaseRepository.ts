import { Future } from "../../domain/entities/generic/Future.js";
import type { DependencyHealth } from "../../domain/entities/DependencyHealth.js";
import type { HealthRepository } from "../../domain/repositories/HealthRepository.js";
import type { DatabaseClient } from "../database/Database.js";
import { sql } from "drizzle-orm";

export class HealthDatabaseRepository implements HealthRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  check(): Future<Error, DependencyHealth> {
    return Future.fromComputation<Error, DependencyHealth>((resolve) => {
      try {
        this.databaseClient.db.run(sql`select 1`);
        resolve({ reachable: true });
      } catch {
        resolve({ reachable: false });
      }
    });
  }
}
