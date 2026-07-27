import { Future } from "../../src/domain/entities/generic/Future.js";
import type { ExampleItem } from "../../src/domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../src/domain/repositories/ExampleItemRepository.js";
import type { Maybe } from "../../src/utils/ts-utils.js";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

export function createExampleItemMockRepository(items: ExampleItem[] = []): ExampleItemRepository {
  let nextId = 1;

  function generateId() {
    const suffix = String(nextId).padStart(12, "0");
    nextId += 1;
    return `00000000-0000-4000-8000-${suffix}`;
  }

  return {
    list: () => Future.success<Error, ExampleItem[]>(items),
    create: (input) => {
      const item = { id: generateId(), ...input, createdAt: fixedDate };
      items.push(item);
      return Future.success<Error, ExampleItem>(item);
    },
    update: (id, input) => {
      const existing = items.find((item) => item.id === id);
      if (!existing) return Future.success<Error, Maybe<ExampleItem>>(undefined);
      Object.assign(existing, input);
      return Future.success<Error, Maybe<ExampleItem>>(existing);
    },
  };
}
