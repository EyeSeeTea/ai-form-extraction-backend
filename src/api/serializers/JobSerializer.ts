import type { Job } from "../../domain/entities/Job.js";
import type { JobDto, JobErrorDto } from "../schemas/JobSchemas.js";

export function serializeJob(job: Job): JobDto {
  const base = {
    id: job.id,
    type: job.type,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  switch (job.status) {
    case "queued":
      return {
        ...base,
        status: "queued",
      };
    case "running":
      return {
        ...base,
        status: "running",
      };
    case "succeeded":
      return {
        ...base,
        status: "succeeded",
        result: job.result,
      };
    case "failed":
      return {
        ...base,
        status: "failed",
        error: serializeJobError(job.error),
      };
  }
}

function serializeJobError(error: Job["error"]): JobErrorDto {
  return {
    message: error?.message ?? "Job failed",
    code: "JOB_FAILED",
  };
}
