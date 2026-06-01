import { Effect, Option } from "effect";

import type { ExampleItem } from "../entities/ExampleItem.js";
import type { DatabaseError } from "../errors/DatabaseError.js";
import { ExampleItemNotFoundError } from "../errors/ExampleItemErrors.js";
import type { ExampleItemRepository } from "../repositories/ExampleItemRepository.js";

export type UpdateExampleItemInput = {
  readonly name: string;
};

export class UpdateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(
    id: string,
    input: UpdateExampleItemInput,
  ): Effect.Effect<ExampleItem, ExampleItemNotFoundError | DatabaseError> {
    return Effect.gen(this, function* () {
      const item = yield* this.exampleItemRepository.update(id, input);

      if (Option.isNone(item)) {
        return yield* new ExampleItemNotFoundError({ id });
      }

      return item.value;
    });
  }
}
