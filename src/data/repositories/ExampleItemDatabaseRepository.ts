import { asc, eq } from "drizzle-orm";
import { Effect, Option } from "effect";

import type { ExampleItem } from "../../domain/entities/ExampleItem.js";
import { DatabaseError } from "../../domain/errors/DatabaseError.js";
import type { ExampleItemRepository } from "../../domain/repositories/ExampleItemRepository.js";
import type { Database } from "../database/Database.js";
import { exampleItems } from "../database/schema/Schema.js";

export class ExampleItemDatabaseRepository implements ExampleItemRepository {
  constructor(private readonly db: Database) {}

  get list(): Effect.Effect<ExampleItem[], DatabaseError> {
    return Effect.tryPromise({
      try: () => this.db.select().from(exampleItems).orderBy(asc(exampleItems.createdAt)),
      catch: (cause) => new DatabaseError({ cause }),
    });
  }

  create(input: Pick<ExampleItem, "id" | "name">): Effect.Effect<ExampleItem, DatabaseError> {
    return Effect.tryPromise({
      try: () => this.db.insert(exampleItems).values(input).returning(),
      catch: (cause) => new DatabaseError({ cause }),
    }).pipe(
      Effect.flatMap((result) => {
        const item = result[0];
        if (!item)
          return Effect.fail(new DatabaseError({ cause: "Failed to insert example item" }));
        return Effect.succeed(item);
      }),
    );
  }

  update(
    id: string,
    input: Pick<ExampleItem, "name">,
  ): Effect.Effect<Option.Option<ExampleItem>, DatabaseError> {
    return Effect.tryPromise({
      try: () => this.db.update(exampleItems).set(input).where(eq(exampleItems.id, id)).returning(),
      catch: (cause) => new DatabaseError({ cause }),
    }).pipe(Effect.map((result) => Option.fromNullable(result[0])));
  }
}
