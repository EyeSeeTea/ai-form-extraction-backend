import type { FastifyReply, FastifyRequest } from "fastify";

export async function requestTimingHook(
  _request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): Promise<unknown> {
  void reply.header("x-response-time", `${reply.elapsedTime.toFixed(2)}ms`);
  return payload;
}
