import type { Future } from "../entities/generic/Future.js";
import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export type CreateExampleItemInput = Readonly<{
  name: string;
}>;

export class CreateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(input: CreateExampleItemInput): Future<Error, ExampleItem> {
    return this.exampleItemRepository.create({ name: input.name });
  }
}
