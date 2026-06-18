import cors from "@fastify/cors";
import type { FastifyCorsOptions } from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import type { Logger } from "pino";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import type { CompositionRoot } from "../CompositionRoot.js";
import type { Environment } from "../config/Environment.js";
import { authenticate } from "./middleware/Authenticate.js";
import { requestTimingHook } from "./middleware/RequestTiming.js";
import { errorHandler } from "./plugins/ErrorHandler.js";
import {
  createSwaggerDocsOptions,
  swaggerDocsPlugin,
  swaggerUiContext,
} from "./plugins/SwaggerDocs.js";
import { createExampleItemRoutes } from "./routes/ExampleItemRoutes.js";
import { createJobRoutes } from "./routes/JobRoutes.js";
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
  server.decorateRequest("dhis2Username");
  server.addHook("onSend", requestTimingHook);

  await server.register(helmet);
  await server.register(cors, createCorsOptions(environment));
  await server.register(sensible);

  await server.register(swaggerDocsPlugin, createSwaggerDocsOptions(environment));
  await server.register(swaggerUiContext);

  await server.register(
    async function apiRoutes(apiServer) {
      await apiServer.register(rateLimit, createRateLimitOptions(environment));

      await apiServer.register(createHealthRoutes(compositionRoot));

      await apiServer.register(async function protectedApiRoutes(protectedServer) {
        protectedServer.addHook("onRequest", authenticate(environment.AUTH_TOKEN));

        await protectedServer.register(createJobRoutes(compositionRoot));
        await protectedServer.register(createExampleItemRoutes(compositionRoot));
      });
    },
    { prefix: "/api" },
  );

  return server;
}

function createCorsOptions(environment: Environment): FastifyCorsOptions {
  const corsOrigin = environment.CORS_ORIGIN.trim();

  if (corsOrigin === "") {
    return { origin: false };
  }

  return {
    origin: corsOrigin === "*" ? true : corsOrigin,
  };
}

function createRateLimitOptions(environment: Environment) {
  return {
    max: environment.RATE_LIMIT_MAX,
    timeWindow: environment.RATE_LIMIT_TIME_WINDOW_MS,
  };
}
