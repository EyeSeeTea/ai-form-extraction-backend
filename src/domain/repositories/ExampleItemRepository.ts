import type { ExampleItem } from "../entities/ExampleItem.js";

export interface ExampleItemRepository {
  list(): Promise<ExampleItem[]>;
  create(input: Pick<ExampleItem, "id" | "name">): Promise<ExampleItem>;
  update(id: string, input: Pick<ExampleItem, "name">): Promise<ExampleItem | undefined>;
}
