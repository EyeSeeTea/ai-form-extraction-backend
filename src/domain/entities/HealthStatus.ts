export type HealthStatus = {
  readonly service: string;
  readonly status: "ok";
  readonly checkedAt: Date;
};
