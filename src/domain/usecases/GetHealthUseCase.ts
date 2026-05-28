import type { HealthStatus } from "../entities/HealthStatus.js";

export class GetHealthUseCase {
  constructor(private readonly serviceName: string) {}

  execute(): HealthStatus {
    return {
      service: this.serviceName,
      status: "ok",
      checkedAt: new Date(),
    };
  }
}
