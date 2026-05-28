import { createServer } from "./api/Server.js";
import { createCompositionRoot } from "./CompositionRoot.js";
import { getEnvironment } from "./config/Environment.js";
import { startTelemetry } from "./observability/Telemetry.js";
import { createLogger } from "./shared/Logger.js";

const environment = getEnvironment();
const telemetry = startTelemetry(environment);
const logger = createLogger(environment);
const compositionRoot = createCompositionRoot(environment);
const server = await createServer(environment, logger, compositionRoot);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "Shutting down");
  await server.close();
  await compositionRoot.close();
  await telemetry?.shutdown();
}

process.once("SIGTERM", (signal) => {
  void shutdown(signal).then(() => process.exit(0));
});

process.once("SIGINT", (signal) => {
  void shutdown(signal).then(() => process.exit(0));
});

try {
  await server.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
  logger.fatal({ error }, "Failed to start server");
  await compositionRoot.close();
  await telemetry?.shutdown();
  process.exit(1);
}
