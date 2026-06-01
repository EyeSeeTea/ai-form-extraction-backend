import type { Effect, Option } from "effect";

import type { ExampleItem } from "../entities/ExampleItem.js";
import type { DatabaseError } from "../errors/DatabaseError.js";

export interface ExampleItemRepository {
  readonly list: Effect.Effect<ExampleItem[], DatabaseError>;
  readonly create: (
    input: Pick<ExampleItem, "id" | "name">,
  ) => Effect.Effect<ExampleItem, DatabaseError>;
  readonly update: (
    id: string,
    input: Pick<ExampleItem, "name">,
  ) => Effect.Effect<Option.Option<ExampleItem>, DatabaseError>;
}
