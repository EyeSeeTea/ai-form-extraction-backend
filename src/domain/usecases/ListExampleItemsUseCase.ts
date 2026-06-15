import type { Future } from "../entities/generic/Future.js";
import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export class ListExampleItemsUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(): Future<Error, ExampleItem[]> {
    return this.exampleItemRepository.list();
  }
}
