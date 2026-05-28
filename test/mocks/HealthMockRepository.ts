import type { HealthRepository } from "../../src/domain/repositories/HealthRepository.js";

export function createHealthMockRepository(reachable = true): HealthRepository {
  return {
    check: async () => ({ reachable }),
  };
}
