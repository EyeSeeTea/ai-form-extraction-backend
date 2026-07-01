import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import { getJobDefinition, isKnownJobType, parseJobInput } from "../../jobs/RegisteredJobs.js";

export type CreateJobInput = {
  readonly type: string;
  readonly input: unknown;
};

export class CreateJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: CreateJobInput, now: Date = new Date()): Future<Error, Job> {
    try {
      if (!isKnownJobType(input.type)) {
        return Future.error(new Error(`Unknown job type: ${input.type}`));
      }

      const definition = getJobDefinition(input.type);
      if (!definition) {
        return Future.error(new Error(`Unknown job type: ${input.type}`));
      }

      const parsedInput = parseJobInput(input.type, input.input);

      return this.jobRepository.create({
        type: definition.type,
        input: parsedInput,
        maxAttempts: definition.maxAttempts,
        availableAt: now,
      });
    } catch (error) {
      return Future.error(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
