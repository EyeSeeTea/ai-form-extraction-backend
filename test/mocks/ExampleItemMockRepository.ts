import type { ExampleItem } from "../../src/domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../src/domain/repositories/ExampleItemRepository.js";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

export function createExampleItemMockRepository(items: ExampleItem[] = []): ExampleItemRepository {
  return {
    list: async () => items,
    create: async (input) => {
      const item = { ...input, createdAt: fixedDate };
      items.push(item);
      return item;
    },
    update: async (id, input) => {
      const existing = items.find((item) => item.id === id);
      if (!existing) return undefined;
      Object.assign(existing, input);
      return existing;
    },
  };
}
