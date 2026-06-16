import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1).default("dhis2-app-backend-skeleton"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_PATH: z.string().min(1).default("./app.sqlite"),
  CORS_ORIGIN: z.string().default("*"),
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function getEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  const environment = environmentSchema.parse(env);

  if (environment.NODE_ENV === "production") {
    if (!env["DATABASE_PATH"]) {
      throw new Error("DATABASE_PATH must be explicitly set in production");
    }
    if (environment.CORS_ORIGIN === "*") {
      throw new Error("CORS_ORIGIN must not be '*' in production");
    }
  }

  return environment;
}
