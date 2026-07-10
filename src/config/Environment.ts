import { z } from "zod";

import type { ExtractionProvider } from "../domain/extraction/ExtractionProfile.js";

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
  LLM_PROVIDER: z.enum(["stub", "openrouter", "ollama"]).default("stub"),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().min(1).default("qwen/qwen3-vl-32b-instruct"),
  OLLAMA_API_KEY: z.string().min(1).default("ollama"),
  OLLAMA_BASE_URL: z.url().default("http://127.0.0.1:11434/v1"),
  OLLAMA_MODEL: z.string().min(1).default("qwen3-vl:4b"),
  UPLOAD_RETENTION_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60 * 1000),
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
});

type ParsedEnvironment = z.infer<typeof environmentSchema>;

export type Environment = ParsedEnvironment &
  (
    | {
        readonly LLM_PROVIDER: "stub";
        readonly OPENROUTER_API_KEY?: string;
      }
    | {
        readonly LLM_PROVIDER: "openrouter";
        readonly OPENROUTER_API_KEY: string;
      }
    | {
        readonly LLM_PROVIDER: "ollama";
        readonly OPENROUTER_API_KEY?: string;
      }
  );

export type LlmConfiguration = {
  readonly profile: {
    readonly provider: ExtractionProvider;
    readonly model: string;
  };
  readonly openRouter: {
    readonly apiKey?: string;
    readonly baseUrl: string;
  };
  readonly ollama: {
    readonly apiKey: string;
    readonly baseUrl: string;
  };
};

export function getEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  const environment = environmentSchema.parse(env);

  if (environment.LLM_PROVIDER === "openrouter" && !environment.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY must be set when LLM_PROVIDER=openrouter");
  }

  if (environment.NODE_ENV === "production") {
    requireExplicitEnvValue(env, "DATABASE_PATH");
    requireExplicitEnvValue(env, "UPLOADS_DIR");
    if (environment.CORS_ORIGIN === "*") {
      throw new Error("CORS_ORIGIN must not be '*' in production");
    }
    requireExplicitEnvValue(env, "AUTH_TOKEN");
  }

  return environment as Environment;
}

export function getLlmConfiguration(environment: Environment): LlmConfiguration {
  const providers = {
    openRouter: {
      baseUrl: environment.OPENROUTER_BASE_URL,
      ...(environment.OPENROUTER_API_KEY ? { apiKey: environment.OPENROUTER_API_KEY } : {}),
    },
    ollama: {
      apiKey: environment.OLLAMA_API_KEY,
      baseUrl: environment.OLLAMA_BASE_URL,
    },
  };

  switch (environment.LLM_PROVIDER) {
    case "openrouter":
      return {
        ...providers,
        profile: { provider: "openrouter", model: environment.OPENROUTER_MODEL },
      };
    case "ollama":
      return {
        ...providers,
        profile: { provider: "ollama", model: environment.OLLAMA_MODEL },
      };
    case "stub":
      return {
        ...providers,
        profile: { provider: "stub", model: "stub-model" },
      };
  }
}

function requireExplicitEnvValue(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} must be explicitly set in production`);
  }

  return value;
}
