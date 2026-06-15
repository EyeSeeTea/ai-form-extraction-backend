import type { Future } from "../entities/generic/Future.js";
import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";
import type { Maybe } from "../../utils/ts-utils.js";

export type UpdateExampleItemInput = {
  readonly name: string;
};

export class UpdateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(id: string, input: UpdateExampleItemInput): Future<Error, Maybe<ExampleItem>> {
    return this.exampleItemRepository.update(id, input);
  }
}
