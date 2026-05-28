import type { ReadinessStatus } from "../entities/ReadinessStatus.js";
import type { HealthRepository } from "../repositories/HealthRepository.js";

export class GetReadinessUseCase {
  constructor(private readonly healthRepository: HealthRepository) {}

  async execute(): Promise<ReadinessStatus> {
    const health = await this.healthRepository.check();

    return {
      status: health.reachable ? "ready" : "not-ready",
      dependencies: {
        database: health.reachable ? "up" : "down",
      },
    };
  }
}
