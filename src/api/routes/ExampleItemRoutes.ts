import { Effect, Either, Match } from "effect";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../../CompositionRoot.js";
import { ExampleItemSchemas } from "../schemas/ExampleItemSchemas.js";
import { serializeExampleItem } from "../serializers/ExampleItemSerializer.js";

export function createExampleItemRoutes(compositionRoot: CompositionRoot): FastifyPluginAsyncZod {
  return async function exampleItemRoutes(server) {
    server.get("/example-items", {
      schema: ExampleItemSchemas.list,
      handler: async () => {
        const exampleItems = await Effect.runPromise(
          compositionRoot.exampleItems.listExampleItems.execute(),
        );

        return {
          items: exampleItems.map(serializeExampleItem),
        };
      },
    });

    server.post("/example-items", {
      schema: ExampleItemSchemas.create,
      handler: async (request, reply) => {
        const item = await Effect.runPromise(
          compositionRoot.exampleItems.createExampleItem.execute({
            name: request.body.name,
          }),
        );

        return reply.code(201).send(serializeExampleItem(item));
      },
    });

    server.put("/example-items/:id", {
      schema: ExampleItemSchemas.update,
      handler: async (request, reply) => {
        const result = await Effect.runPromise(
          compositionRoot.exampleItems.updateExampleItem
            .execute(request.params.id, { name: request.body.name })
            .pipe(Effect.either),
        );

        if (Either.isLeft(result)) {
          return Match.value(result.left).pipe(
            Match.tag("ExampleItemNotFoundError", (err) =>
              reply
                .code(404)
                .send({ error: "Not Found", message: `Example item ${err.id} not found` }),
            ),
            Match.orElse((error) => {
              throw error;
            }),
          );
        }

        return serializeExampleItem(result.right);
      },
    });
  };
}
