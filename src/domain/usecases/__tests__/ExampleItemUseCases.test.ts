import { describe, expect, it } from "vitest";

import { createExampleItemMockRepository } from "../../../../test/mocks/ExampleItemMockRepository.js";
import type { ExampleItem } from "../../entities/ExampleItem.js";
import { CreateExampleItemUseCase } from "../CreateExampleItemUseCase.js";
import { ListExampleItemsUseCase } from "../ListExampleItemsUseCase.js";
import { UpdateExampleItemUseCase } from "../UpdateExampleItemUseCase.js";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

describe("ListExampleItemsUseCase", () => {
  it("returns all items from the repository", async () => {
    const items: ExampleItem[] = [
      { id: "1", name: "First", createdAt: fixedDate },
      { id: "2", name: "Second", createdAt: fixedDate },
    ];
    const useCase = new ListExampleItemsUseCase(createExampleItemMockRepository(items));

    const result = await useCase.execute().toPromise();

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("First");
    expect(result[1]?.name).toBe("Second");
  });

  it("returns an empty array when no items exist", async () => {
    const useCase = new ListExampleItemsUseCase(createExampleItemMockRepository());

    const result = await useCase.execute().toPromise();

    expect(result).toEqual([]);
  });
});

describe("CreateExampleItemUseCase", () => {
  it("creates an item with a generated id", async () => {
    const useCase = new CreateExampleItemUseCase(createExampleItemMockRepository());

    const item = await useCase.execute({ name: "New item" }).toPromise();

    expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(item.name).toBe("New item");
    expect(item.createdAt).toBeInstanceOf(Date);
  });
});

describe("UpdateExampleItemUseCase", () => {
  it("updates an existing item", async () => {
    const items: ExampleItem[] = [{ id: "abc", name: "Old name", createdAt: fixedDate }];
    const useCase = new UpdateExampleItemUseCase(createExampleItemMockRepository(items));

    const result = await useCase.execute("abc", { name: "New name" }).toPromise();

    expect(result).toBeDefined();
    expect(result?.name).toBe("New name");
  });

  it("returns undefined when the item does not exist", async () => {
    const useCase = new UpdateExampleItemUseCase(createExampleItemMockRepository());

    const result = await useCase.execute("nonexistent", { name: "Does not matter" }).toPromise();

    expect(result).toBeUndefined();
  });
});
