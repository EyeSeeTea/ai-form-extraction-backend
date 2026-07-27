import { Future } from "../entities/generic/Future.js";
import type { HealthStatus } from "../entities/HealthStatus.js";

export class GetHealthUseCase {
  constructor(private readonly serviceName: string) {}

  execute(): Future<Error, HealthStatus> {
    return Future.success<Error, HealthStatus>({
      service: this.serviceName,
      status: "ok",
      checkedAt: new Date(),
    });
  }
}
