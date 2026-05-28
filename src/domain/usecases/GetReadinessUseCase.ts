import type { HealthRepository } from "../repositories/HealthRepository.js";

export type ReadinessStatus = {
  readonly status: "ready" | "not-ready";
  readonly dependencies: {
    readonly database: "up" | "down";
  };
};

export class GetReadinessUseCase {
  constructor(private readonly healthRepository: HealthRepository) {}

  async execute(): Promise<ReadinessStatus> {
    const databaseHealth = await this.healthRepository.check();

    return {
      status: databaseHealth.reachable ? "ready" : "not-ready",
      dependencies: {
        database: databaseHealth.reachable ? "up" : "down",
      },
    };
  }
}
