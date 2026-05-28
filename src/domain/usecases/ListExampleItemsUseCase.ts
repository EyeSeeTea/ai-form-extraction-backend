import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export class ListExampleItemsUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(): Promise<ExampleItem[]> {
    return this.exampleItemRepository.list();
  }
}
