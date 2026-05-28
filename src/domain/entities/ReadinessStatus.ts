export type ReadinessStatus = {
  readonly status: "ready" | "not-ready";
  readonly dependencies: {
    readonly database: "up" | "down";
  };
};
