import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GetReadinessUseCase } from "../../src/domain/usecases/GetReadinessUseCase.js";
import { createHealthMockRepository } from "../mocks/HealthMockRepository.js";

describe("GetReadinessUseCase", () => {
  it("returns ready when the database is reachable", async () => {
    const result = await Effect.runPromise(
      new GetReadinessUseCase(createHealthMockRepository(true)).execute(),
    );

    expect(result).toEqual({
      status: "ready",
      dependencies: { database: "up" },
    });
  });

  it("returns not-ready when the database is unreachable", async () => {
    const result = await Effect.runPromise(
      new GetReadinessUseCase(createHealthMockRepository(false)).execute(),
    );

    expect(result).toEqual({
      status: "not-ready",
      dependencies: { database: "down" },
    });
  });
});
