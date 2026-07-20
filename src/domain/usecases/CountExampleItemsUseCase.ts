import { Future } from "../entities/generic/Future.js";
import type { CountExampleItemsJobInput } from "../jobs/count-example-items/CountExampleItemsJob.schema.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";
import type { JsonObject } from "../entities/generic/Json.js";

export type CountExampleItemsResult = JsonObject &
  Readonly<{
    exampleItemCount: number;
  }>;

export class CountExampleItemsUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(input: CountExampleItemsJobInput): Future<Error, CountExampleItemsResult> {
    return Future.sleep(input.sleepMs).chain(() =>
      this.exampleItemRepository.list().map((items) => ({
        exampleItemCount: items.length,
      })),
    );
  }
}
