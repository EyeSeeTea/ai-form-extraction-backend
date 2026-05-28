import { describe, expect, it } from "vitest";

import { GetHealthUseCase } from "../../src/domain/usecases/GetHealthUseCase.js";

describe("GetHealthUseCase", () => {
  it("returns the service health status", () => {
    const health = new GetHealthUseCase("service-under-test").execute();

    expect(health.service).toBe("service-under-test");
    expect(health.status).toBe("ok");
    expect(health.checkedAt).toBeInstanceOf(Date);
  });
});
