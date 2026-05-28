import { describe, expect, it } from "vitest";

import type { HealthRepository } from "../../src/domain/repositories/HealthRepository.js";
import { GetReadinessUseCase } from "../../src/domain/usecases/GetReadinessUseCase.js";

describe("GetReadinessUseCase", () => {
  it("returns ready when the database is reachable", async () => {
    const repository: HealthRepository = { check: async () => ({ reachable: true }) };

    await expect(new GetReadinessUseCase(repository).execute()).resolves.toEqual({
      status: "ready",
      dependencies: { database: "up" },
    });
  });

  it("returns not-ready when the database is unreachable", async () => {
    const repository: HealthRepository = { check: async () => ({ reachable: false }) };

    await expect(new GetReadinessUseCase(repository).execute()).resolves.toEqual({
      status: "not-ready",
      dependencies: { database: "down" },
    });
  });
});
