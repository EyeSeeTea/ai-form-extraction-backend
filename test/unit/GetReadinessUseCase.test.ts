import { describe, expect, it } from "vitest";

import { GetReadinessUseCase } from "../../src/domain/usecases/GetReadinessUseCase.js";
import { createHealthMockRepository } from "../mocks/HealthMockRepository.js";

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
