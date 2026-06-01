import type { Effect } from "effect";

import type { ExampleItem } from "../entities/ExampleItem.js";
import type { DatabaseError } from "../errors/DatabaseError.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export class ListExampleItemsUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(): Effect.Effect<ExampleItem[], DatabaseError> {
    return this.exampleItemRepository.list;
  }
}
