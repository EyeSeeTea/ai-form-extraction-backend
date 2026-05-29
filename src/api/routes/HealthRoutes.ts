import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../../CompositionRoot.js";
import { HealthSchemas } from "../schemas/HealthSchemas.js";
import { serializeHealthStatus } from "../serializers/HealthStatusSerializer.js";

export function createHealthRoutes(compositionRoot: CompositionRoot): FastifyPluginAsyncZod {
  return async function healthRoutes(server) {
    server.get("/health", {
      schema: HealthSchemas.health,
      handler: async () => {
        const health = compositionRoot.health.getHealth.execute();

        return serializeHealthStatus(health);
      },
    });

    server.get("/ready", {
      schema: HealthSchemas.readiness,
      handler: async (_request, reply) => {
        const readiness = await compositionRoot.health.getReadiness.execute();

        if (readiness.status !== "ready") {
          return reply.code(503).send(readiness);
        }

        return readiness;
      },
    });
  };
}
