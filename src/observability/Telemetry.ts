import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

import type { Environment } from "../config/Environment.js";

export function startTelemetry(environment: Environment): NodeSDK | undefined {
  if (!environment.OTEL_ENABLED) {
    return undefined;
  }

  const sdkOptions = {
    serviceName: environment.SERVICE_NAME,
    instrumentations: [getNodeAutoInstrumentations()],
    ...(environment.OTEL_EXPORTER_OTLP_ENDPOINT
      ? { traceExporter: new OTLPTraceExporter({ url: environment.OTEL_EXPORTER_OTLP_ENDPOINT }) }
      : {}),
  };

  const sdk = new NodeSDK(sdkOptions);

  sdk.start();
  return sdk;
}
