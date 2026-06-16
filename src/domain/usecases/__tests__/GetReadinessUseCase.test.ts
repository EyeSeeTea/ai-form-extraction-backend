import { describe, expect, it } from "vitest";

import { createHealthMockRepository } from "../../../../test/mocks/HealthMockRepository.js";
import { GetReadinessUseCase } from "../GetReadinessUseCase.js";

describe("GetReadinessUseCase", () => {
  it("returns ready when the database is reachable", async () => {
    await expect(
      new GetReadinessUseCase(createHealthMockRepository(true)).execute().toPromise(),
    ).resolves.toEqual({
      status: "ready",
      dependencies: { database: "up" },
    });
  });

  it("returns not-ready when the database is unreachable", async () => {
    await expect(
      new GetReadinessUseCase(createHealthMockRepository(false)).execute().toPromise(),
    ).resolves.toEqual({
      status: "not-ready",
      dependencies: { database: "down" },
    });
  });
});
