import type { DependencyHealth } from "../../domain/entities/DependencyHealth.js";
import type { HealthRepository } from "../../domain/repositories/HealthRepository.js";
import type { DatabaseClient } from "../database/Database.js";

export class HealthDatabaseRepository implements HealthRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async check(): Promise<DependencyHealth> {
    try {
      await this.databaseClient.sql`select 1`;
      return { reachable: true };
    } catch {
      return { reachable: false };
    }
  }
}
