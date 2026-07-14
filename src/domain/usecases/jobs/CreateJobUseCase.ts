import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import { getRegisteredJob } from "../../jobs/RegisteredJobRegistry.js";

export type CreateJobInput = {
  readonly type: string;
  readonly createdBy: string | null;
  readonly input: unknown;
};

export class CreateJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: CreateJobInput, now: Date = new Date()): Future<Error, Job> {
    try {
      const registeredJob = getRegisteredJob(input.type);
      if (!registeredJob) {
        throw new Error(`Unknown job type: ${input.type}`);
      }

      const parsedInput = registeredJob.definition.inputSchema.parse(input.input);

      return this.jobRepository.create({
        type: registeredJob.definition.type,
        createdBy: input.createdBy,
        input: parsedInput,
        maxAttempts: registeredJob.definition.maxAttempts,
        availableAt: now,
      });
    } catch (error) {
      return Future.error(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
