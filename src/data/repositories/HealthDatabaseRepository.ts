import type { DatabaseHealth } from "../../domain/entities/DatabaseHealth.js";
import type { HealthRepository } from "../../domain/repositories/HealthRepository.js";
import type { DatabaseClient } from "../database/Database.js";

export class HealthDatabaseRepository implements HealthRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async check(): Promise<DatabaseHealth> {
    try {
      await this.databaseClient.sql`select 1`;
      return { reachable: true };
    } catch {
      return { reachable: false };
    }
  }
}
