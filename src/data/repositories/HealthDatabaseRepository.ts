import { Future } from "../../domain/entities/generic/Future.js";
import type { DependencyHealth } from "../../domain/entities/DependencyHealth.js";
import type { HealthRepository } from "../../domain/repositories/HealthRepository.js";
import type { DatabaseClient } from "../database/Database.js";

export class HealthDatabaseRepository implements HealthRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  check(): Future<Error, DependencyHealth> {
    return Future.fromComputation<Error, DependencyHealth>((resolve) => {
      this.databaseClient.sql`select 1`.then(
        () => {
          resolve({ reachable: true });
        },
        () => {
          resolve({ reachable: false });
        },
      );
    });
  }
}
