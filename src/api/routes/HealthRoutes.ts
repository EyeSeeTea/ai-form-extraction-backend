import type { FastifyPluginAsync } from "fastify";

import type { CompositionRoot } from "../../CompositionRoot.js";

export function createHealthRoutes(compositionRoot: CompositionRoot): FastifyPluginAsync {
  return async function healthRoutes(server) {
    server.get("/health", async () => {
      const health = compositionRoot.health.getHealth.execute();

      return {
        ...health,
        checkedAt: health.checkedAt.toISOString(),
      };
    });

    server.get("/ready", async (request, reply) => {
      const readiness = await compositionRoot.health.getReadiness.execute();

      if (readiness.status !== "ready") {
        return reply.code(503).send(readiness);
      }

      return readiness;
    });
  };
}
