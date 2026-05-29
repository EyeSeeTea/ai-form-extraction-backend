import { z } from "zod";

import { schemaRegistry } from "./SchemaRegistry.js";

export const healthResponse = z.object({
  service: z.string(),
  status: z.literal("ok"),
  checkedAt: z.string(),
});

export type HealthStatusDto = z.infer<typeof healthResponse>;

const readinessResponse = z.object({
  status: z.enum(["ready", "not-ready"]),
  dependencies: z.object({ database: z.enum(["up", "down"]) }),
});

schemaRegistry.add(healthResponse, { id: "HealthStatus" });
schemaRegistry.add(readinessResponse, { id: "ReadinessStatus" });

export const HealthSchemas = {
  health: {
    tags: ["Health"],
    response: {
      200: healthResponse,
    },
  },
  readiness: {
    tags: ["Health"],
    response: {
      200: readinessResponse,
      503: readinessResponse,
    },
  },
} as const;
