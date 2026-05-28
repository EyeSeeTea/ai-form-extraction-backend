import pino, { type Logger, type LoggerOptions } from "pino";

import type { Environment } from "../config/Environment.js";

export function createLogger(environment: Environment): Logger {
  const options: LoggerOptions = {
    level: environment.LOG_LEVEL,
    base: {
      service: environment.SERVICE_NAME,
      environment: environment.NODE_ENV,
    },
  };

  if (environment.NODE_ENV === "development") {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };
  }

  return pino(options);
}
