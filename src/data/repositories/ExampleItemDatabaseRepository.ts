import { asc } from "drizzle-orm";

import type { ExampleItem } from "../../domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../domain/repositories/ExampleItemRepository.js";
import type { Database } from "../database/Database.js";
import { exampleItems } from "../database/schema/Schema.js";

export class ExampleItemDatabaseRepository implements ExampleItemRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<ExampleItem[]> {
    return this.db.select().from(exampleItems).orderBy(asc(exampleItems.createdAt));
  }

  async save(exampleItem: ExampleItem): Promise<void> {
    await this.db
      .insert(exampleItems)
      .values(exampleItem)
      .onConflictDoUpdate({
        target: exampleItems.id,
        set: {
          name: exampleItem.name,
        },
      });
  }
}
