import { describe, expect, it } from "vitest";

import { GetHealthUseCase } from "../../src/domain/usecases/GetHealthUseCase.js";

describe("GetHealthUseCase", () => {
  it("returns the service health status", async () => {
    const health = await new GetHealthUseCase("service-under-test").execute().toPromise();

    expect(health.service).toBe("service-under-test");
    expect(health.status).toBe("ok");
    expect(health.checkedAt).toBeInstanceOf(Date);
  });
});
