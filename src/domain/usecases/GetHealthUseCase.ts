import { Effect } from "effect";

import type { HealthStatus } from "../entities/HealthStatus.js";

export class GetHealthUseCase {
  constructor(private readonly serviceName: string) {}

  execute(): Effect.Effect<HealthStatus> {
    return Effect.sync(() => ({
      service: this.serviceName,
      status: "ok" as const,
      checkedAt: new Date(),
    }));
  }
}
