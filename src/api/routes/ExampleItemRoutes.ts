import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import type { CompositionRoot } from "../../CompositionRoot.js";

const saveExampleItemBodySchema = z.object({
  name: z.string().min(1),
});

export function createExampleItemRoutes(compositionRoot: CompositionRoot): FastifyPluginAsync {
  return async function exampleItemRoutes(server) {
    server.get("/example-items", async () => {
      const exampleItems = await compositionRoot.exampleItems.listExampleItems.execute();

      return {
        items: exampleItems.map((exampleItem) => ({
          ...exampleItem,
          createdAt: exampleItem.createdAt.toISOString(),
        })),
      };
    });

    server.put("/example-items/:id", async (request, reply) => {
      const params = z.object({ id: z.uuid() }).parse(request.params);
      const body = saveExampleItemBodySchema.parse(request.body);
      const exampleItem = await compositionRoot.exampleItems.saveExampleItem.execute({
        id: params.id,
        name: body.name,
      });

      return reply.code(201).send({
        ...exampleItem,
        createdAt: exampleItem.createdAt.toISOString(),
      });
    });
  };
}
