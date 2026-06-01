import { Effect } from "effect";

import type { ExampleItem } from "../entities/ExampleItem.js";
import type { DatabaseError } from "../errors/DatabaseError.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export type CreateExampleItemInput = {
  readonly name: string;
};

export class CreateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(input: CreateExampleItemInput): Effect.Effect<ExampleItem, DatabaseError> {
    return this.exampleItemRepository.create({
      id: crypto.randomUUID(),
      name: input.name,
    });
  }
}
