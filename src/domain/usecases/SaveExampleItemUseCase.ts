import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export type SaveExampleItemInput = {
  readonly id: string;
  readonly name: string;
};

export class SaveExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  async execute(input: SaveExampleItemInput): Promise<ExampleItem> {
    const exampleItem: ExampleItem = {
      id: input.id,
      name: input.name,
      createdAt: new Date(),
    };

    await this.exampleItemRepository.save(exampleItem);
    return exampleItem;
  }
}
