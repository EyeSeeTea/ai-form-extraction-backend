import { timingSafeEqual } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const dhis2UsernameHeaderName = "x-forwarded-user";
const authorizationScheme = "ApiToken ";

export function authenticate(authToken: string) {
  return async function authenticateRequest(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authorization = getHeaderValue(request.headers.authorization);

    if (!authorization || !matchesAuthToken(authorization, authToken)) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Unauthorized",
      });
    }

    const dhis2Username = getHeaderValue(request.headers[dhis2UsernameHeaderName]);
    if (dhis2Username) {
      request.dhis2Username = dhis2Username;
    }
  };
}

function matchesAuthToken(authorization: string, authToken: string): boolean {
  const token = getApiToken(authorization);

  if (!token) {
    return false;
  }

  const actual = Buffer.from(token);
  const expected = Buffer.from(authToken);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function getApiToken(authorization: string): string | undefined {
  if (!authorization.startsWith(authorizationScheme)) {
    return undefined;
  }

  return getHeaderValue(authorization.slice(authorizationScheme.length));
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const trimmedValue = rawValue?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue;
}
