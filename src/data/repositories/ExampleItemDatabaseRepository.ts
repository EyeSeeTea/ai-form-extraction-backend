import { asc, eq } from "drizzle-orm";

import type { ExampleItem } from "../../domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../domain/repositories/ExampleItemRepository.js";
import type { Database } from "../database/Database.js";
import { exampleItems } from "../database/schema/Schema.js";

export class ExampleItemDatabaseRepository implements ExampleItemRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<ExampleItem[]> {
    return this.db.select().from(exampleItems).orderBy(asc(exampleItems.createdAt));
  }

  async create(input: Pick<ExampleItem, "id" | "name">): Promise<ExampleItem> {
    const result = await this.db.insert(exampleItems).values(input).returning();
    const item = result[0];
    if (!item) throw new Error("Failed to insert example item");
    return item;
  }

  async update(id: string, input: Pick<ExampleItem, "name">): Promise<ExampleItem | undefined> {
    const result = await this.db
      .update(exampleItems)
      .set(input)
      .where(eq(exampleItems.id, id))
      .returning();
    return result[0];
  }
}
