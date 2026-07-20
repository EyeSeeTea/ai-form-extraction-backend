import { Future } from "../../entities/generic/Future.js";
import type { Job, JsonValue } from "../../entities/Job.js";
import type { JobRepository } from "../../repositories/JobRepository.js";
import {
  getJobDefinition,
  isKnownJobType,
  parseJobInput,
  type JobType,
} from "../../jobs/JobRegistry.js";

export type CreateJobInput = {
  readonly type: string;
  readonly input: unknown;
};

export class CreateJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(input: CreateJobInput, now: Date = new Date()): Future<Error, Job> {
    if (!isKnownJobType(input.type)) {
      return Future.error(new Error(`Unknown job type: ${input.type}`));
    }

    const definition = getJobDefinition(input.type);
    if (!definition) {
      return Future.error(new Error(`Unknown job type: ${input.type}`));
    }

    let parsedInput: JsonValue;
    try {
      parsedInput = parseJobInput(input.type as JobType, input.input);
    } catch (error) {
      return Future.error(error instanceof Error ? error : new Error(String(error)));
    }

    return this.jobRepository.create({
      type: definition.type,
      input: parsedInput,
      maxAttempts: definition.maxAttempts,
      availableAt: now,
    });
  }
}
