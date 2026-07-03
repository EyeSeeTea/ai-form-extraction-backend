import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1).default("ai-form-extraction-backend"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_PATH: z.string().min(1).default("./app.sqlite"),
  CORS_ORIGIN: z.string().default("*"),
  AUTH_TOKEN: z.string().min(1).default("development-auth-token"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  UPLOADS_DIR: z.string().min(1).default("./uploads"),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(20),
  UPLOAD_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(25_000_000),
  PDF_MAX_PAGES: z.coerce.number().int().positive().default(20),
  PDF_MAX_EXTRACTED_IMAGES: z.coerce.number().int().positive().default(20),
  UPLOAD_RETENTION_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60 * 1000),
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
    if (!env["UPLOADS_DIR"]) {
      throw new Error("UPLOADS_DIR must be explicitly set in production");
    }
    if (environment.CORS_ORIGIN === "*") {
      throw new Error("CORS_ORIGIN must not be '*' in production");
    }
    if (!env["AUTH_TOKEN"]) {
      throw new Error("AUTH_TOKEN must be explicitly set in production");
    }
  }

  return environment;
}
