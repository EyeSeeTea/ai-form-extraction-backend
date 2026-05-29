import type { HealthStatus } from "../../domain/entities/HealthStatus.js";
import type { HealthStatusDto } from "../schemas/HealthSchemas.js";

export function serializeHealthStatus(health: HealthStatus): HealthStatusDto {
  return { ...health, checkedAt: health.checkedAt.toISOString() };
}
