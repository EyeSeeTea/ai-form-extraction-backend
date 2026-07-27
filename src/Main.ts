import { randomUUID } from "node:crypto";

import { createServer } from "./api/Server.js";
import { createCompositionRoot } from "./CompositionRoot.js";
import { getEnvironment } from "./config/Environment.js";
import { startTelemetry } from "./observability/Telemetry.js";
import { createLogger } from "./shared/Logger.js";
import { jobRegistry } from "./domain/jobs/JobRegistry.js";
import { JobExecutor } from "./runtime/jobs/JobExecutor.js";
import { JobWorker } from "./runtime/jobs/JobWorker.js";

const environment = getEnvironment();
const telemetry = startTelemetry(environment);
const logger = createLogger(environment);
const compositionRoot = createCompositionRoot(environment);
const worker = new JobWorker(
  compositionRoot.jobs.claimNextJob,
  compositionRoot.jobs.completeJob,
  compositionRoot.jobs.recordJobFailure,
  new JobExecutor(jobRegistry, {
    extractForm: compositionRoot.jobs.extractForm,
  }),
  logger,
  {
    lockedBy: `worker:${String(process.pid)}:${randomUUID()}`,
    pollIntervalMs: 1_000,
    concurrency: 1,
  },
);
compositionRoot.jobs.nudgeJobWorker = () => {
  worker.nudge();
};
const server = await createServer(environment, logger, compositionRoot);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "Shutting down");
  await server.close();
  await worker.stop();
  await compositionRoot.close();
  await telemetry?.shutdown();
}

process.once("SIGTERM", (signal) => {
  void shutdown(signal)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.fatal({ err: toError(error) }, "Shutdown failed");
      process.exit(1);
    });
});

process.once("SIGINT", (signal) => {
  void shutdown(signal)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.fatal({ err: toError(error) }, "Shutdown failed");
      process.exit(1);
    });
});

try {
  await server.listen({ host: environment.HOST, port: environment.PORT });
  worker.start();
} catch (error) {
  logger.fatal({ err: toError(error) }, "Failed to start server");
  await worker.stop();
  await compositionRoot.close();
  await telemetry?.shutdown();
  process.exit(1);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
