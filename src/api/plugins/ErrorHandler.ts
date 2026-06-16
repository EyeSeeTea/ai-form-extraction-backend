import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request payload",
      issues: error.validation,
    });
  }

  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "Bad Request",
      message: "Invalid request payload",
      issues: error.issues,
    });
  }

  request.log.error({ err: error, requestId: request.id }, "Unhandled request error");

  return reply.code(500).send({
    error: "Internal Server Error",
    message: "Unexpected server error",
    requestId: request.id,
  });
}
