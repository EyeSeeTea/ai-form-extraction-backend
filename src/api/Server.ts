import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import type { Logger } from "pino";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../CompositionRoot.js";
import type { Environment } from "../config/Environment.js";
import { requestTimingHook } from "./middleware/RequestTiming.js";
import { errorHandler } from "./plugins/ErrorHandler.js";
import {
  createSwaggerDocsOptions,
  swaggerDocsPlugin,
  swaggerUiContext,
} from "./plugins/SwaggerDocs.js";
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

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.setErrorHandler(errorHandler);
  server.addHook("onSend", requestTimingHook);

  await server.register(helmet);
  await server.register(cors, {
    origin: environment.CORS_ORIGIN === "*" ? true : environment.CORS_ORIGIN,
  });
  await server.register(sensible);

  await server.register(swaggerDocsPlugin, createSwaggerDocsOptions(environment));
  await server.register(swaggerUiContext);

  await server.register(createHealthRoutes(compositionRoot), { prefix: "/api" });
  await server.register(createExampleItemRoutes(compositionRoot), { prefix: "/api" });

  return server;
}
