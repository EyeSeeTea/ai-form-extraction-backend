import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export type CreateExampleItemInput = {
  readonly name: string;
};

export class CreateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  async execute(input: CreateExampleItemInput): Promise<ExampleItem> {
    return this.exampleItemRepository.create({
      id: crypto.randomUUID(),
      name: input.name,
    });
  }
}
