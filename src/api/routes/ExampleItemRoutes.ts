import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../../CompositionRoot.js";
import { ExampleItemSchemas } from "../schemas/ExampleItemSchemas.js";
import { serializeExampleItem } from "../serializers/ExampleItemSerializer.js";

export function createExampleItemRoutes(compositionRoot: CompositionRoot): FastifyPluginAsyncZod {
  return async function exampleItemRoutes(server) {
    server.get("/example-items", {
      schema: ExampleItemSchemas.list,
      handler: async () => {
        const exampleItems = await compositionRoot.exampleItems.listExampleItems.execute();

        return {
          items: exampleItems.map(serializeExampleItem),
        };
      },
    });

    server.post("/example-items", {
      schema: ExampleItemSchemas.create,
      handler: async (request, reply) => {
        const item = await compositionRoot.exampleItems.createExampleItem.execute({
          name: request.body.name,
        });

        return reply.code(201).send(serializeExampleItem(item));
      },
    });

    server.put("/example-items/:id", {
      schema: ExampleItemSchemas.update,
      handler: async (request, reply) => {
        const item = await compositionRoot.exampleItems.updateExampleItem.execute(
          request.params.id,
          { name: request.body.name },
        );

        if (!item) {
          return reply.code(404).send({ error: "Not Found", message: "Example item not found" });
        }

        return serializeExampleItem(item);
      },
    });
  };
}
