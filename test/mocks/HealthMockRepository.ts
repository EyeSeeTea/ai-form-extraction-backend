import { Future } from "../../src/domain/entities/generic/Future.js";
import type { HealthRepository } from "../../src/domain/repositories/HealthRepository.js";

export function createHealthMockRepository(reachable = true): HealthRepository {
  return {
    check: () => Future.success<Error, { reachable: boolean }>({ reachable }),
  };
}
