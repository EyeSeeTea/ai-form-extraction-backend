export type ReadinessStatus = Readonly<{
  status: "ready" | "not-ready";
  dependencies: Readonly<{
    database: "up" | "down";
  }>;
}>;
