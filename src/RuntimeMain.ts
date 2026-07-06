import { randomUUID } from "node:crypto";

import { createServer } from "./api/Server.js";
import { createCompositionRoot } from "./CompositionRoot.js";
import type { Environment } from "./config/Environment.js";
import { jobRegistry } from "./domain/jobs/RegisteredJobs.js";
import { JobExecutor } from "./runtime/jobs/JobExecutor.js";
import { JobWorker } from "./runtime/jobs/JobWorker.js";
import { createLogger } from "./shared/Logger.js";
import { toError } from "./utils/error-utils.js";

type RuntimeMainHooks = {
  onShutdown?: () => Promise<void>;
};

export async function runApplication(
  environment: Environment,
  hooks: RuntimeMainHooks = {},
): Promise<void> {
  const logger = createLogger(environment);
  logger.info(
    {
      uploadLimits: {
        uploadsDir: environment.UPLOADS_DIR,
        maxFiles: environment.UPLOAD_MAX_FILES,
        maxFileSizeBytes: environment.UPLOAD_MAX_FILE_SIZE_BYTES,
        maxBodySizeBytes: environment.UPLOAD_MAX_FILE_SIZE_BYTES + 1_048_576,
        retentionMs: environment.UPLOAD_RETENTION_MS,
      },
    },
    "Upload settings configured",
  );

  const compositionRoot = createCompositionRoot(environment, logger);
  const worker = new JobWorker(
    compositionRoot.jobs.claimNextJob,
    compositionRoot.jobs.completeJob,
    compositionRoot.jobs.recordJobFailure,
    new JobExecutor(jobRegistry, {
      countExampleItems: compositionRoot.jobs.countExampleItems,
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
    await hooks.onShutdown?.();
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
    await hooks.onShutdown?.();
    process.exit(1);
  }
}
