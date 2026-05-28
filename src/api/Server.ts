import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import type { Logger } from "pino";
import { ZodError } from "zod";

import type { CompositionRoot } from "../CompositionRoot.js";
import type { Environment } from "../config/Environment.js";
import { createExampleItemRoutes } from "./routes/ExampleItemRoutes.js";
import { createHealthRoutes } from "./routes/HealthRoutes.js";

export async function createServer(
  environment: Environment,
  logger: Logger,
  compositionRoot: CompositionRoot,
) {
  const server = Fastify({
    loggerInstance: logger,
    requestIdHeader: "x-request-id",
    disableRequestLogging: false,
  });

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Invalid request payload",
        issues: error.issues,
      });
    }

    request.log.error({ error }, "Unhandled request error");

    return reply.code(500).send({
      error: "Internal Server Error",
      message: "Unexpected server error",
    });
  });

  await server.register(helmet);
  await server.register(cors, {
    origin: environment.CORS_ORIGIN === "*" ? true : environment.CORS_ORIGIN,
  });
  await server.register(sensible);

  await server.register(createHealthRoutes(compositionRoot), { prefix: "/api" });
  await server.register(createExampleItemRoutes(compositionRoot), { prefix: "/api" });

  return server;
}
