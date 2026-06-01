import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GetHealthUseCase } from "../../src/domain/usecases/GetHealthUseCase.js";

describe("GetHealthUseCase", () => {
  it("returns the service health status", async () => {
    const health = await Effect.runPromise(new GetHealthUseCase("service-under-test").execute());

    expect(health.service).toBe("service-under-test");
    expect(health.status).toBe("ok");
    expect(health.checkedAt).toBeInstanceOf(Date);
  });
});
