export type HealthStatus = Readonly<{
  service: string;
  status: "ok";
  checkedAt: Date;
}>;
