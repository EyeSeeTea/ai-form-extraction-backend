import { Effect, Option } from "effect";

import type { ExampleItem } from "../../src/domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../src/domain/repositories/ExampleItemRepository.js";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

export function createExampleItemMockRepository(items: ExampleItem[] = []): ExampleItemRepository {
  return {
    list: Effect.sync(() => [...items]),
    create: (input) =>
      Effect.sync(() => {
        const item = { ...input, createdAt: fixedDate };
        items.push(item);
        return item;
      }),
    update: (id, input) =>
      Effect.sync(() => {
        const existing = items.find((item) => item.id === id);
        if (!existing) return Option.none();
        Object.assign(existing, input);
        return Option.some(existing);
      }),
  };
}
