import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import type { SwaggerOptions } from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginCallback } from "fastify";
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
} from "fastify-type-provider-zod";

import type { Environment } from "../../config/Environment.js";
import { schemaRegistry } from "../schemas/SchemaRegistry.js";

export const swaggerDocsPlugin = swagger;

export function createSwaggerDocsOptions(environment: Environment): SwaggerOptions {
  return {
    openapi: {
      components: {
        securitySchemes: {
          Authentication: {
            type: "apiKey",
            in: "header",
            name: "Authorization",
            description: "Use `Authorization: ApiToken <token>` to access protected endpoints.",
          },
        },
      },
      info: {
        title: environment.SERVICE_NAME,
        version: "0.1.0",
      },
    },
    transform: createJsonSchemaTransform({ schemaRegistry }),
    transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
  };
}

// Swagger UI needs inline scripts/styles that helmet's default CSP blocks.
// Register it in its own encapsulated context with a relaxed CSP so the rest
// of the app keeps strict security defaults.
export const swaggerUiContext: FastifyPluginCallback = (server, _options, done) => {
  server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://fastify.dev"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });
  server.register(swaggerUi, { routePrefix: "/docs" });
  done();
};
