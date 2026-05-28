import type { ExampleItem } from "../entities/ExampleItem.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export type UpdateExampleItemInput = {
  readonly name: string;
};

export class UpdateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  async execute(id: string, input: UpdateExampleItemInput): Promise<ExampleItem | undefined> {
    return this.exampleItemRepository.update(id, input);
  }
}
