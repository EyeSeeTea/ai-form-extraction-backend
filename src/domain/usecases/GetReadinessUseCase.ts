import { Effect } from "effect";

import type { ReadinessStatus } from "../entities/ReadinessStatus.js";
import type { HealthRepository } from "../repositories/HealthRepository.js";

export class GetReadinessUseCase {
  constructor(private readonly healthRepository: HealthRepository) {}

  execute(): Effect.Effect<ReadinessStatus> {
    return Effect.gen(this, function* () {
      const health = yield* this.healthRepository.check.pipe(
        Effect.catchAll(() => Effect.succeed({ reachable: false })),
      );

      return {
        status: health.reachable ? "ready" : "not-ready",
        dependencies: {
          database: health.reachable ? "up" : "down",
        },
      };
    });
  }
}
