import type { ExampleItem } from "../entities/ExampleItem.js";

export interface ExampleItemRepository {
  list(): Promise<ExampleItem[]>;
  save(exampleItem: ExampleItem): Promise<void>;
}
