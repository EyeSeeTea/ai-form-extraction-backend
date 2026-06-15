import { asc, eq } from "drizzle-orm";

import { Future } from "../../domain/entities/generic/Future.js";
import type { ExampleItem } from "../../domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../domain/repositories/ExampleItemRepository.js";
import type { Database } from "../database/Database.js";
import { exampleItems } from "../database/schema/Schema.js";
import type { Maybe } from "../../utils/ts-utils.js";

export class ExampleItemDatabaseRepository implements ExampleItemRepository {
  constructor(private readonly db: Database) {}

  list(): Future<Error, ExampleItem[]> {
    return Future.fromComputation<Error, ExampleItem[]>((resolve, reject) => {
      this.db
        .select()
        .from(exampleItems)
        .orderBy(asc(exampleItems.createdAt))
        .then(resolve)
        .catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error("Unknown error"));
        });

      return undefined;
    });
  }

  create(input: Pick<ExampleItem, "id" | "name">): Future<Error, ExampleItem> {
    return Future.fromComputation<Error, ExampleItem>((resolve, reject) => {
      this.db
        .insert(exampleItems)
        .values(input)
        .returning()
        .then((result) => {
          const item = result[0];
          if (!item) {
            reject(new Error("Failed to insert example item"));
            return;
          }

          resolve(item);
        })
        .catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error("Unknown error"));
        });

      return undefined;
    });
  }

  update(id: string, input: Pick<ExampleItem, "name">): Future<Error, Maybe<ExampleItem>> {
    return Future.fromComputation<Error, Maybe<ExampleItem>>((resolve, reject) => {
      this.db
        .update(exampleItems)
        .set(input)
        .where(eq(exampleItems.id, id))
        .returning()
        .then((result) => {
          resolve(result[0]);
        })
        .catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error("Unknown error"));
        });

      return undefined;
    });
  }
}
