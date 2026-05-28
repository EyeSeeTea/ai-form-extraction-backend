import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import type { CompositionRoot } from "../../CompositionRoot.js";
import type { ExampleItem } from "../../domain/entities/ExampleItem.js";

const exampleItemBodySchema = z.object({
  name: z.string().min(1),
});

function serializeExampleItem(item: ExampleItem) {
  return { ...item, createdAt: item.createdAt.toISOString() };
}

export function createExampleItemRoutes(compositionRoot: CompositionRoot): FastifyPluginAsync {
  return async function exampleItemRoutes(server) {
    server.get("/example-items", async () => {
      const exampleItems = await compositionRoot.exampleItems.listExampleItems.execute();

      return {
        items: exampleItems.map(serializeExampleItem),
      };
    });

    server.post("/example-items", async (request, reply) => {
      const body = exampleItemBodySchema.parse(request.body);
      const item = await compositionRoot.exampleItems.createExampleItem.execute({
        name: body.name,
      });

      return reply.code(201).send(serializeExampleItem(item));
    });

    server.put("/example-items/:id", async (request, reply) => {
      const params = z.object({ id: z.uuid() }).parse(request.params);
      const body = exampleItemBodySchema.parse(request.body);
      const item = await compositionRoot.exampleItems.updateExampleItem.execute(params.id, {
        name: body.name,
      });

      if (!item) {
        return reply.code(404).send({ error: "Not Found", message: "Example item not found" });
      }

      return serializeExampleItem(item);
    });
  };
}
