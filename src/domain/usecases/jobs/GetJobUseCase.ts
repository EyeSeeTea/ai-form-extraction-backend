import { Future } from "../../entities/generic/Future.js";
import type { Job } from "../../entities/Job.js";
import type { Maybe } from "../../../utils/ts-utils.js";
import type { JobRepository } from "../../repositories/JobRepository.js";

export class GetJobUseCase {
  constructor(private readonly jobRepository: JobRepository) {}

  execute(id: string): Future<Error, Maybe<Job>> {
    return this.jobRepository.getById(id);
  }
}
