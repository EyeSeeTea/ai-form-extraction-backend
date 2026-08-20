import { getEnvironment } from "./config/Environment.js";
import { startTelemetry } from "./observability/Telemetry.js";

const environment = getEnvironment();
const telemetry = startTelemetry(environment);
const { runApplication } = await import("./RuntimeMain.js");

await runApplication(environment, {
  onShutdown: async () => {
    await telemetry?.shutdown();
  },
});
