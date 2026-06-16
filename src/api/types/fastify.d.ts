import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    dhis2Username?: string;
  }
}
