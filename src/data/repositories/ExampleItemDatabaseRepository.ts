import { asc, eq } from "drizzle-orm";

import { Future } from "../../domain/entities/generic/Future.js";
import type { ExampleItem } from "../../domain/entities/ExampleItem.js";
import type { ExampleItemRepository } from "../../domain/repositories/ExampleItemRepository.js";
import type { Database } from "../database/Database.js";
import type { Maybe } from "../../utils/ts-utils.js";
import type { IdGenerator } from "../utils/IdGenerator.js";
import { exampleItems } from "../database/schema/Schema.js";
import { fromQuery } from "../utils/drizzle-future.js";

export class ExampleItemDatabaseRepository implements ExampleItemRepository {
  constructor(
    private readonly db: Database,
    private readonly idGenerator: IdGenerator,
  ) {}

  private findById(id: string): Future<Error, Maybe<ExampleItem>> {
    return fromQuery(`find example item ${id}`, () =>
      this.db.select().from(exampleItems).where(eq(exampleItems.id, id)).limit(1),
    ).map((result) => result[0]);
  }

  list(): Future<Error, ExampleItem[]> {
    return fromQuery("list example items", () =>
      this.db.select().from(exampleItems).orderBy(asc(exampleItems.createdAt)),
    );
  }

  create(input: Pick<ExampleItem, "name">): Future<Error, ExampleItem> {
    const id = this.idGenerator.generate();

    return fromQuery("create example item", () =>
      this.db.insert(exampleItems).values({ id, name: input.name }),
    ).flatMap(() =>
      this.findById(id).map((item) => {
        if (!item) {
          throw new Error("Failed to insert example item");
        }

        return item;
      }),
    );
  }

  update(id: string, input: Pick<ExampleItem, "name">): Future<Error, Maybe<ExampleItem>> {
    return fromQuery(`update example item ${id}`, () =>
      this.db.update(exampleItems).set(input).where(eq(exampleItems.id, id)),
    ).flatMap(() => this.findById(id));
  }
}
