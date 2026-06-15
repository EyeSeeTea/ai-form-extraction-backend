import { Future } from "../entities/generic/Future.js";
import type { ReadinessStatus } from "../entities/ReadinessStatus.js";
import type { HealthRepository } from "../repositories/HealthRepository.js";

export class GetReadinessUseCase {
  constructor(private readonly healthRepository: HealthRepository) {}

  execute(): Future<Error, ReadinessStatus> {
    return this.healthRepository.check().map((health) => {
      return {
        status: health.reachable ? "ready" : "not-ready",
        dependencies: {
          database: health.reachable ? "up" : "down",
        },
      };
    });
  }
}
