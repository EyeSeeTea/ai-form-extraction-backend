import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { JsonValue } from "../../entities/generic/Json.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import { getRegisteredJob } from "../../jobs/RegisteredJobRegistry.js";

export type CreateJobInput = Readonly<{
  type: string;
  createdBy: string | null;
  input: unknown;
}>;

export class CreateJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: CreateJobInput, now: Date = new Date()): Future<Error, Job> {
    const registeredJob = getRegisteredJob(input.type);
    if (!registeredJob) {
      return Future.error(new Error(`Unknown job type: ${input.type}`));
    }

    let parsedInput: JsonValue;
    try {
      parsedInput = registeredJob.definition.inputSchema.parse(input.input);
    } catch (error) {
      return Future.error(error instanceof Error ? error : new Error(String(error)));
    }

    return this.jobRepository.create({
      type: registeredJob.definition.type,
      createdBy: input.createdBy,
      input: parsedInput,
      maxAttempts: registeredJob.definition.maxAttempts,
      availableAt: now,
    });
  }
}
